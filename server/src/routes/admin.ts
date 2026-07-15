import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { authenticate } from './auth';
import { sendEmailNotification } from '../utils/email';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Middleware to authorize admin only
export async function authorizeAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user || request.user.role !== 'admin') {
    return reply.code(403).send({ error: 'Forbidden: Admin access only' });
  }
}

export default async function adminRoutes(fastify: FastifyInstance) {
  
  const adminHandlers = { preHandler: [authenticate, authorizeAdmin] };

  // 1. Get all transactions (deposits/withdrawals)
  fastify.get('/api/admin/transactions', adminHandlers, async (request: FastifyRequest, reply: FastifyReply) => {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('*, profile:profiles(username, email, role)')
      .order('created_at', { ascending: false });

    if (error) return reply.code(500).send({ error: error.message });
    return data;
  });

  // 2. Approve Deposit
  fastify.post('/api/admin/deposits/approve', adminHandlers, async (request: FastifyRequest, reply: FastifyReply) => {
    const { transactionId } = request.body as any;

    if (!transactionId) {
      return reply.code(400).send({ error: 'Transaction ID is required' });
    }

    const { data: tx } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (!tx || tx.type !== 'deposit' || tx.status !== 'pending') {
      return reply.code(404).send({ error: 'Pending deposit transaction not found' });
    }

    try {
      // Fetch user profile to check if they are a broker
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', tx.user_id)
        .single();

      if (!profile) throw new Error('User profile not found');

      // Update the transaction status
      const { error: txErr } = await supabaseAdmin
        .from('transactions')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', transactionId);

      if (txErr) throw txErr;

      // Update appropriate wallet
      if (profile.role === 'broker') {
        // If broker, deposit capital gets a 110% update in their P2P wallet!
        const { data: p2pWallet } = await supabaseAdmin
          .from('wallets')
          .select('*')
          .eq('user_id', tx.user_id)
          .eq('type', 'p2p')
          .single();

        if (p2pWallet) {
          const depositCredit = Number(tx.amount) * 1.10;
          const newP2pBalance = Number(p2pWallet.balance) + depositCredit;
          await supabaseAdmin
            .from('wallets')
            .update({ balance: newP2pBalance })
            .eq('id', p2pWallet.id);

          // Update the transaction record amount to the 1.10x scaled value so it is logged correctly in transaction history
          await supabaseAdmin
            .from('transactions')
            .update({ amount: depositCredit })
            .eq('id', transactionId);
        }
      } else {
        // Standard trader/user get credited in their REAL wallet
        const { data: wallet } = await supabaseAdmin
          .from('wallets')
          .select('*')
          .eq('id', tx.wallet_id)
          .single();

        if (wallet) {
          const newBalance = Number(wallet.balance) + Number(tx.amount);
          await supabaseAdmin
            .from('wallets')
            .update({ balance: newBalance })
            .eq('id', wallet.id);
        }

        // Process referral bonus if referred_reward_claimed is false
        if (profile && profile.referred_by && !profile.referred_reward_claimed) {
          const { data: referrer } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', profile.referred_by)
            .single();

          if (referrer) {
            const isTrader = referrer.role === 'trader' || profile.role === 'trader';
            const bonusPercent = isTrader ? 0.125 : 0.10;
            const bonusAmount = Number((Number(tx.amount) * bonusPercent).toFixed(2));

            // Get referrer's real wallet
            const { data: refWallet } = await supabaseAdmin
              .from('wallets')
              .select('*')
              .eq('user_id', referrer.id)
              .eq('type', 'real')
              .single();

            if (refWallet) {
              const newRefBalance = Number(refWallet.balance) + bonusAmount;
              await supabaseAdmin
                .from('wallets')
                .update({ balance: newRefBalance })
                .eq('id', refWallet.id);

              await supabaseAdmin.from('transactions').insert({
                user_id: referrer.id,
                wallet_id: refWallet.id,
                type: 'deposit',
                amount: bonusAmount,
                status: 'approved',
                payment_method: 'referral_bonus',
                payment_details: {
                  referredUserId: profile.id,
                  referredUsername: profile.username,
                  depositAmount: tx.amount,
                  bonusPercentage: bonusPercent * 100
                }
              });
            }
          }

          // Mark reward as claimed
          await supabaseAdmin
            .from('profiles')
            .update({ referred_reward_claimed: true })
            .eq('id', profile.id);
        }
      }

      return { success: true };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // 3. Reject Deposit
  fastify.post('/api/admin/deposits/reject', adminHandlers, async (request: FastifyRequest, reply: FastifyReply) => {
    const { transactionId } = request.body as any;

    if (!transactionId) {
      return reply.code(400).send({ error: 'Transaction ID is required' });
    }

    const { error } = await supabaseAdmin
      .from('transactions')
      .update({ status: 'rejected' })
      .eq('id', transactionId)
      .eq('type', 'deposit')
      .eq('status', 'pending');

    if (error) return reply.code(500).send({ error: error.message });
    return { success: true };
  });

  // 4. Approve Withdrawal
  fastify.post('/api/admin/withdrawals/approve', adminHandlers, async (request: FastifyRequest, reply: FastifyReply) => {
    const { transactionId } = request.body as any;

    if (!transactionId) {
      return reply.code(400).send({ error: 'Transaction ID is required' });
    }

    // Mark as approved (funds were already deducted on user request to prevent double spend)
    const { error } = await supabaseAdmin
      .from('transactions')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', transactionId)
      .eq('type', 'withdrawal')
      .eq('status', 'pending');

    if (error) return reply.code(500).send({ error: error.message });
    return { success: true };
  });

  // 5. Reject Withdrawal (refunds user's wallet)
  fastify.post('/api/admin/withdrawals/reject', adminHandlers, async (request: FastifyRequest, reply: FastifyReply) => {
    const { transactionId } = request.body as any;

    if (!transactionId) {
      return reply.code(400).send({ error: 'Transaction ID is required' });
    }

    const { data: tx } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (!tx || tx.type !== 'withdrawal' || tx.status !== 'pending') {
      return reply.code(404).send({ error: 'Pending withdrawal transaction not found' });
    }

    try {
      // Refund user's wallet
      const { data: wallet } = await supabaseAdmin
        .from('wallets')
        .select('*')
        .eq('id', tx.wallet_id)
        .single();

      if (wallet) {
        const refundedBalance = Number(wallet.balance) + Number(tx.amount);
        await supabaseAdmin
          .from('wallets')
          .update({ balance: refundedBalance })
          .eq('id', wallet.id);
      }

      // Mark status as rejected
      await supabaseAdmin
        .from('transactions')
        .update({ status: 'rejected' })
        .eq('id', transactionId);

      return { success: true };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // 6. Get Broker Applications
  fastify.get('/api/admin/brokers', adminHandlers, async (request: FastifyRequest, reply: FastifyReply) => {
    const { data, error } = await supabaseAdmin
      .from('broker_applications')
      .select('*, profile:profiles(username, email)')
      .order('created_at', { ascending: false });

    if (error) return reply.code(500).send({ error: error.message });
    return data;
  });

  // 7. Approve Broker Application
  fastify.post('/api/admin/brokers/approve', adminHandlers, async (request: FastifyRequest, reply: FastifyReply) => {
    const { applicationId } = request.body as any;

    if (!applicationId) {
      return reply.code(400).send({ error: 'Application ID is required' });
    }

    const { data: app } = await supabaseAdmin
      .from('broker_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (!app || app.status !== 'pending') {
      return reply.code(404).send({ error: 'Pending broker application not found' });
    }

    try {
      // Update application status
      await supabaseAdmin
        .from('broker_applications')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', applicationId);

      // Update user profile role and verified badge
      await supabaseAdmin
        .from('profiles')
        .update({
          role: 'broker',
          verified: true
        })
        .eq('id', app.user_id);

      return { success: true };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // 8. Reject Broker Application
  fastify.post('/api/admin/brokers/reject', adminHandlers, async (request: FastifyRequest, reply: FastifyReply) => {
    const { applicationId } = request.body as any;

    if (!applicationId) {
      return reply.code(400).send({ error: 'Application ID is required' });
    }

    const { error } = await supabaseAdmin
      .from('broker_applications')
      .update({ status: 'rejected' })
      .eq('id', applicationId)
      .eq('status', 'pending');

    if (error) return reply.code(500).send({ error: error.message });
    return { success: true };
  });

  // 9. Post Insight
  fastify.post('/api/admin/insights', adminHandlers, async (request: FastifyRequest, reply: FastifyReply) => {
    const { title, content } = request.body as any;

    if (!title || !content) {
      return reply.code(400).send({ error: 'Title and content are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('insights')
      .insert({ title, content })
      .select()
      .single();

    if (error) return reply.code(500).send({ error: error.message });
    return data;
  });

  // 10. Delete Insight
  fastify.delete('/api/admin/insights/:id', adminHandlers, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;

    const { error } = await supabaseAdmin
      .from('insights')
      .delete()
      .eq('id', id);

    if (error) return reply.code(500).send({ error: error.message });
    return { success: true };
  });

  // 11. Get all user trades (Admin only)
  fastify.get('/api/admin/trades', adminHandlers, async (request: FastifyRequest, reply: FastifyReply) => {
    const { data, error } = await supabaseAdmin
      .from('trades')
      .select('*, profile:profiles(username, email)')
      .order('created_at', { ascending: false });

    if (error) return reply.code(500).send({ error: error.message });
    return data;
  });

  // 12. Reverse Transaction / Broker Application
  fastify.post('/api/admin/transactions/reverse', adminHandlers, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, type } = request.body as any; // type: 'deposit' | 'withdrawal' | 'broker'

    if (!id || !type) {
      return reply.code(400).send({ error: 'ID and type are required' });
    }

    try {
      if (type === 'deposit') {
        const { data: tx } = await supabaseAdmin
          .from('transactions')
          .select('*')
          .eq('id', id)
          .single();

        if (!tx || tx.type !== 'deposit' || tx.status !== 'approved') {
          return reply.code(400).send({ error: 'Approved deposit transaction not found' });
        }

        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('id', tx.user_id)
          .single();

        if (!profile) throw new Error('User profile not found');

        if (profile.role === 'broker') {
          const { data: p2pWallet } = await supabaseAdmin
             .from('wallets')
             .select('*')
             .eq('user_id', tx.user_id)
             .eq('type', 'p2p')
             .single();

          if (p2pWallet) {
            const depositCredit = Number(tx.amount) * 1.10;
            const newP2pBalance = Math.max(0, Number(p2pWallet.balance) - depositCredit);
            await supabaseAdmin
              .from('wallets')
              .update({ balance: newP2pBalance })
              .eq('id', p2pWallet.id);
          }
        } else {
          const { data: wallet } = await supabaseAdmin
            .from('wallets')
            .select('*')
            .eq('id', tx.wallet_id)
            .single();

          if (wallet) {
            const newBalance = Math.max(0, Number(wallet.balance) - Number(tx.amount));
            await supabaseAdmin
              .from('wallets')
              .update({ balance: newBalance })
              .eq('id', wallet.id);
          }
        }

        await supabaseAdmin
          .from('transactions')
          .update({ status: 'rejected', approved_at: null })
          .eq('id', id);

      } else if (type === 'withdrawal') {
        const { data: tx } = await supabaseAdmin
          .from('transactions')
          .select('*')
          .eq('id', id)
          .single();

        if (!tx || tx.type !== 'withdrawal' || tx.status !== 'approved') {
          return reply.code(400).send({ error: 'Approved withdrawal transaction not found' });
        }

        const { data: wallet } = await supabaseAdmin
          .from('wallets')
          .select('*')
          .eq('id', tx.wallet_id)
          .single();

        if (wallet) {
          const refundedBalance = Number(wallet.balance) + Number(tx.amount);
          await supabaseAdmin
            .from('wallets')
            .update({ balance: refundedBalance })
            .eq('id', wallet.id);
        }

        await supabaseAdmin
          .from('transactions')
          .update({ status: 'rejected', approved_at: null })
          .eq('id', id);

      } else if (type === 'broker') {
        const { data: app } = await supabaseAdmin
          .from('broker_applications')
          .select('*')
          .eq('id', id)
          .single();

        if (!app || app.status !== 'approved') {
          return reply.code(400).send({ error: 'Approved broker application not found' });
        }

        await supabaseAdmin
          .from('profiles')
          .update({
            role: 'trader',
            verified: false
          })
          .eq('id', app.user_id);

        await supabaseAdmin
          .from('broker_applications')
          .update({ status: 'rejected', approved_at: null })
          .eq('id', id);
      } else {
        return reply.code(400).send({ error: 'Invalid reversal type' });
      }

      return { success: true };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // 13. Get Onboarding Settings
  fastify.get('/api/admin/settings/onboarding-bonus', adminHandlers, async (request: FastifyRequest, reply: FastifyReply) => {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('*')
      .eq('key', 'onboarding_bonus_enabled')
      .maybeSingle();

    if (error) return reply.code(500).send({ error: error.message });
    return data || { key: 'onboarding_bonus_enabled', value: 'false' };
  });

  // 14. Toggle Onboarding Settings
  fastify.post('/api/admin/settings/onboarding-bonus', adminHandlers, async (request: FastifyRequest, reply: FastifyReply) => {
    const { enabled } = request.body as any;
    const val = enabled ? 'true' : 'false';

    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .upsert({ key: 'onboarding_bonus_enabled', value: val })
      .select()
      .single();

    if (error) return reply.code(500).send({ error: error.message });
    return data;
  });

  // 15. Award Manual Bonus / Referral network reward
  fastify.post('/api/admin/referral/award-bonus', adminHandlers, async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId, amount, message } = request.body as any;

    if (!userId || !amount || amount <= 0) {
      return reply.code(400).send({ error: 'User ID and positive amount are required' });
    }

    try {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!profile) {
        return reply.code(404).send({ error: 'User profile not found' });
      }

      const { data: wallet } = await supabaseAdmin
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'real')
        .single();

      if (!wallet) {
        return reply.code(404).send({ error: 'Real wallet not found' });
      }

      const bonusVal = Number(Number(amount).toFixed(2));
      const newBalance = Number(wallet.balance) + bonusVal;

      // Update wallet balance
      const { error: walletErr } = await supabaseAdmin
        .from('wallets')
        .update({ balance: newBalance })
        .eq('id', wallet.id);

      if (walletErr) throw walletErr;

      // Insert transaction record
      const { data: tx } = await supabaseAdmin
        .from('transactions')
        .insert({
          user_id: userId,
          wallet_id: wallet.id,
          type: 'deposit',
          amount: bonusVal,
          status: 'approved',
          payment_method: 'manual_bonus',
          payment_details: { message: message || 'Admin award' }
        })
        .select()
        .single();

      // Send email notification using Nodemailer utility
      const emailSubject = 'Congratulation! You earned a bonus on Xfx ExtremeTrader';
      const emailBody = `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #111112; color: #D1D4DC;">
          <h2 style="color: #089981;">Xfx ExtremeTrader Bonus Reward</h2>
          <p>Hello <strong>${profile.username}</strong>,</p>
          <p>${message || 'congratulation, someone within your invite link invited someone and you earned a bonus'}</p>
          <div style="margin: 20px 0; padding: 15px; border-left: 4px solid #089981; background-color: #1E222D;">
            <p style="margin: 0; font-size: 18px; font-weight: bold; color: #089981;">Amount: +$${bonusVal.toFixed(2)} USD</p>
            <p style="margin: 5px 0 0 0; font-size: 14px; color: #8A91A5;">New Real Balance: $${newBalance.toFixed(2)} USD</p>
          </div>
          <p>Keep trading and earning extreme profits!</p>
          <hr style="border: 0; border-top: 1px solid #2A2E39; margin: 20px 0;" />
          <p style="font-size: 11px; color: #8A91A5;">
            Complex instruments come with a high risk of losing money rapidly due to leverage. 78.48% of retail investor accounts lose money when trading with this provider.
          </p>
        </div>
      `;

      await sendEmailNotification(profile.email, emailSubject, emailBody);

      return { success: true, balance: newBalance, transaction: tx };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // 16. Get Platform Reviews
  fastify.get('/api/admin/reviews', adminHandlers, async (request: FastifyRequest, reply: FastifyReply) => {
    const { data, error } = await supabaseAdmin
      .from('platform_reviews')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return reply.code(500).send({ error: error.message });
    return data || [];
  });

  // 17. Approve Platform Review
  fastify.post('/api/admin/reviews/approve', adminHandlers, async (request: FastifyRequest, reply: FastifyReply) => {
    const { reviewId } = request.body as any;

    if (!reviewId) {
      return reply.code(400).send({ error: 'Review ID is required' });
    }

    const { data, error } = await supabaseAdmin
      .from('platform_reviews')
      .update({ approved: true })
      .eq('id', reviewId)
      .select()
      .single();

    if (error) return reply.code(500).send({ error: error.message });
    return { success: true, review: data };
  });

  // 18. Reject / Delete Platform Review
  fastify.post('/api/admin/reviews/reject', adminHandlers, async (request: FastifyRequest, reply: FastifyReply) => {
    const { reviewId } = request.body as any;

    if (!reviewId) {
      return reply.code(400).send({ error: 'Review ID is required' });
    }

    const { error } = await supabaseAdmin
      .from('platform_reviews')
      .delete()
      .eq('id', reviewId);

    if (error) return reply.code(500).send({ error: error.message });
    return { success: true };
  });
}
