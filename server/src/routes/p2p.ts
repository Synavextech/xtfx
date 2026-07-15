import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { authenticate } from './auth';
import { redis } from '../engine';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export default async function p2pRoutes(fastify: FastifyInstance) {

  // 1. Broker Profile Application
  fastify.post('/api/p2p/broker/apply', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { capital, paymentOptions, paymentDetails, instructions } = request.body as any;
    const user = request.user!;

    if (!capital || capital < 1000) {
      return reply.code(400).send({ error: 'Minimum trading capital of $1000 is required' });
    }

    if (!paymentOptions || !paymentDetails) {
      return reply.code(400).send({ error: 'Preferred payment options and details are required' });
    }

    // Check if user already applied or is a broker
    const { data: existingApp } = await supabaseAdmin
      .from('broker_applications')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingApp) {
      return reply.code(400).send({ error: 'You already have a pending broker application' });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile && profile.role === 'broker') {
      return reply.code(400).send({ error: 'You are already a broker' });
    }

    const { data, error } = await supabaseAdmin
      .from('broker_applications')
      .insert({
        user_id: user.id,
        capital,
        payment_options: paymentOptions,
        payment_details: paymentDetails,
        instructions: instructions || '',
        status: 'pending'
      })
      .select()
      .single();

    if (error) return reply.code(500).send({ error: error.message });

    return { success: true, application: data };
  });

  // Check application status
  fastify.get('/api/p2p/broker/status', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { data, error } = await supabaseAdmin
      .from('broker_applications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) return reply.code(500).send({ error: error.message });
    return data;
  });

  // 2. Create P2P Offer (Broker or Standard Trader > $100)
  fastify.post('/api/p2p/offers', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { type, amount, minLimit, maxLimit, paymentMethod } = request.body as any;
    const user = request.user!;

    // Verify user profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return reply.code(404).send({ error: 'Profile not found' });
    }

    const isBroker = profile.role === 'broker';

    if (!isBroker) {
      // Standard trader can ONLY list 'sell' offers and must have balance > $100
      if (type !== 'sell') {
        return reply.code(403).send({ error: 'Only authorized brokers can list P2P buy offers' });
      }

      const { data: realWallet } = await supabaseAdmin
        .from('wallets')
        .select('balance')
        .eq('user_id', user.id)
        .eq('type', 'real')
        .single();

      if (!realWallet || Number(realWallet.balance) < 100) {
        return reply.code(403).send({ error: 'Standard traders must have a balance greater than $100 to list sell offers' });
      }
    }

    if (!type || !amount || amount <= 0 || !minLimit || !maxLimit || !paymentMethod || !['buy', 'sell'].includes(type)) {
      return reply.code(400).send({ error: 'Invalid offer parameters' });
    }

    // Check if seller has enough balance
    if (type === 'sell') {
      const walletType = isBroker ? 'p2p' : 'real';
      const { data: wallet } = await supabaseAdmin
        .from('wallets')
        .select('balance')
        .eq('user_id', user.id)
        .eq('type', walletType)
        .single();

      if (!wallet || Number(wallet.balance) < amount) {
        return reply.code(400).send({ error: `Insufficient ${walletType} wallet balance to list this sell offer` });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('p2p_offers')
      .insert({
        broker_id: user.id,
        type,
        amount,
        min_limit: minLimit,
        max_limit: maxLimit,
        payment_method: paymentMethod,
        status: 'active'
      })
      .select()
      .single();

    if (error) return reply.code(500).send({ error: error.message });

    return { success: true, offer: data };
  });

  // 3. Get Active Offers
  fastify.get('/api/p2p/offers', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { data, error } = await supabaseAdmin
      .from('p2p_offers')
      .select('*, broker:profiles(username, rating, review_count, verified)')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) return reply.code(500).send({ error: error.message });
    return data;
  });

  // 4. Buyer/Seller initiates a trade on a broker's offer
  fastify.post('/api/p2p/trades/initiate', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { offerId, amount } = request.body as any;
    const user = request.user!;

    if (!offerId || !amount || amount <= 0) {
      return reply.code(400).send({ error: 'Offer ID and valid amount are required' });
    }

    // Fetch the offer
    const { data: offer } = await supabaseAdmin
      .from('p2p_offers')
      .select('*')
      .eq('id', offerId)
      .single();

    if (!offer || offer.status !== 'active') {
      return reply.code(404).send({ error: 'Active P2P offer not found' });
    }

    if (amount < offer.min_limit || amount > offer.max_limit) {
      return reply.code(400).send({ error: `Amount must be between $${offer.min_limit} and $${offer.max_limit}` });
    }

    try {
      // 1. Escrow Handling:
      // If type === 'sell' (Broker sells to user): Broker is the seller. Broker funds locked.
      if (offer.type === 'sell') {
        const { data: sellerProfile } = await supabaseAdmin
          .from('profiles')
          .select('role')
          .eq('id', offer.broker_id)
          .single();

        const walletType = (sellerProfile && sellerProfile.role === 'broker') ? 'p2p' : 'real';

        const { data: sellerWallet } = await supabaseAdmin
          .from('wallets')
          .select('*')
          .eq('user_id', offer.broker_id)
          .eq('type', walletType)
          .single();

        if (!sellerWallet || Number(sellerWallet.balance) < amount) {
          return reply.code(400).send({ error: 'Seller has insufficient wallet balance to cover this trade' });
        }

        // Lock funds into pending
        const newBalance = Number(sellerWallet.balance) - amount;
        const newPending = Number(sellerWallet.pending_balance) + amount;
        await supabaseAdmin
          .from('wallets')
          .update({ balance: newBalance, pending_balance: newPending })
          .eq('id', sellerWallet.id);
      } 
      // If type === 'buy' (Broker buys from user): User is the seller. User funds locked in escrow.
      else if (offer.type === 'buy') {
        const { data: userWallet } = await supabaseAdmin
          .from('wallets')
          .select('*')
          .eq('user_id', user.id)
          .eq('type', 'real')
          .single();

        if (!userWallet || Number(userWallet.balance) < amount) {
          return reply.code(400).send({ error: 'Insufficient real wallet balance to place in escrow for this P2P sale' });
        }

        // Lock funds into pending
        const newBalance = Number(userWallet.balance) - amount;
        const newPending = Number(userWallet.pending_balance) + amount;
        await supabaseAdmin
          .from('wallets')
          .update({ balance: newBalance, pending_balance: newPending })
          .eq('id', userWallet.id);
      }

      // Create P2P trade record
      const { data: trade, error } = await supabaseAdmin
        .from('p2p_trades')
        .insert({
          offer_id: offerId,
          buyer_id: user.id,
          broker_id: offer.broker_id,
          amount,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      // Automatically initiate chat conversation
      const initialMessage = offer.type === 'buy' ? 
        `Hello! I am selling $${amount} to your buying offer. My funds have been locked in escrow. Please proceed to pay me.` :
        `Hello! I have initiated a trade request for $${amount}. Let's proceed.`;

      await supabaseAdmin.from('chats').insert({
        sender_id: user.id,
        recipient_id: offer.broker_id,
        trade_id: trade.id,
        message: initialMessage,
        is_read: false
      });

      return { success: true, trade };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // 5. Broker/Seller accepts the P2P trade
  fastify.post('/api/p2p/trades/accept', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tradeId } = request.body as any;
    const user = request.user!;

    const { data: trade } = await supabaseAdmin
      .from('p2p_trades')
      .select('*')
      .eq('id', tradeId)
      .single();

    if (!trade || trade.status !== 'pending') {
      return reply.code(404).send({ error: 'Pending trade not found' });
    }

    if (trade.broker_id !== user.id) {
      return reply.code(403).send({ error: 'Only the seller/broker can accept this trade' });
    }

    const { data, error } = await supabaseAdmin
      .from('p2p_trades')
      .update({ status: 'pending' }) // accepted and waiting for payment
      .eq('id', tradeId)
      .select()
      .single();

    if (error) return reply.code(500).send({ error: error.message });
    return { success: true, trade: data };
  });

  // 6. Buyer marks trade as paid and attaches proof
  fastify.post('/api/p2p/trades/pay', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tradeId, screenshotUrl } = request.body as any;
    const user = request.user!;

    const { data: trade } = await supabaseAdmin
      .from('p2p_trades')
      .select('*, p2p_offers(*)')
      .eq('id', tradeId)
      .single() as any;

    if (!trade || trade.status !== 'pending') {
      return reply.code(404).send({ error: 'Trade is not in a payable state' });
    }

    const isBuyOffer = trade.p2p_offers?.type === 'buy';
    const expectedBuyerId = isBuyOffer ? trade.broker_id : trade.buyer_id;
    const expectedSellerId = isBuyOffer ? trade.buyer_id : trade.broker_id;

    if (user.id !== expectedBuyerId) {
      return reply.code(403).send({ error: 'Only the buyer can mark this trade as paid' });
    }

    const { data, error } = await supabaseAdmin
      .from('p2p_trades')
      .update({
        status: 'paid',
        payment_screenshot: screenshotUrl || 'marked_paid_by_buyer'
      })
      .eq('id', tradeId)
      .select()
      .single();

    if (error) return reply.code(500).send({ error: error.message });

    // Send chat system update
    await supabaseAdmin.from('chats').insert({
      sender_id: user.id,
      recipient_id: expectedSellerId,
      trade_id: tradeId,
      message: `[SYSTEM]: Buyer has marked this trade as paid and uploaded payment confirmation.`,
      is_read: false
    });

    // Real-time notification publish via Redis Pub/Sub
    await redis.publish('xfx:notifications', JSON.stringify({
      type: 'p2p_trade_paid',
      userId: expectedSellerId,
      tradeId: tradeId
    }));

    return { success: true, trade: data };
  });

  // 7. Seller completes trade - releases escrow to buyer's wallet
  fastify.post('/api/p2p/trades/complete', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tradeId } = request.body as any;
    const user = request.user!;

    const { data: trade } = await supabaseAdmin
      .from('p2p_trades')
      .select('*, p2p_offers(*)')
      .eq('id', tradeId)
      .single() as any;

    if (!trade || trade.status !== 'paid') {
      return reply.code(404).send({ error: 'Trade must be marked as Paid to be completed' });
    }

    const isBuyOffer = trade.p2p_offers?.type === 'buy';
    const expectedSellerId = isBuyOffer ? trade.buyer_id : trade.broker_id;
    const expectedBuyerId = isBuyOffer ? trade.broker_id : trade.buyer_id;

    if (user.id !== expectedSellerId) {
      return reply.code(403).send({ error: 'Only the seller can complete this trade' });
    }

    try {
      // 1. Fetch seller wallet type and record
      const { data: sellerProfile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', expectedSellerId)
        .single();

      const sellerWalletType = isBuyOffer ? 'real' : ((sellerProfile && sellerProfile.role === 'broker') ? 'p2p' : 'real');

      const { data: sellerWallet } = await supabaseAdmin
        .from('wallets')
        .select('*')
        .eq('user_id', expectedSellerId)
        .eq('type', sellerWalletType)
        .single();

      if (!sellerWallet) {
        throw new Error('Seller wallet not found');
      }

      // Check balance / pending balance to release
      if (Number(sellerWallet.pending_balance) >= Number(trade.amount)) {
        const newPending = Math.max(0, Number(sellerWallet.pending_balance) - Number(trade.amount));
        await supabaseAdmin
          .from('wallets')
          .update({ pending_balance: newPending })
          .eq('id', sellerWallet.id);
      } else if (Number(sellerWallet.balance) >= Number(trade.amount)) {
        const newBalance = Number(sellerWallet.balance) - Number(trade.amount);
        await supabaseAdmin
          .from('wallets')
          .update({ balance: newBalance })
          .eq('id', sellerWallet.id);
      } else {
        return reply.code(400).send({ error: 'Insufficient balance to complete the trade. Please top up your wallet.' });
      }

      // 2. Deposit funds directly into buyer's wallet (P2P wallet for brokers, real wallet for users)
      const buyerWalletType = isBuyOffer ? 'p2p' : 'real';
      let buyerWallet = null;
      
      const buyerWalletRes = await supabaseAdmin
        .from('wallets')
        .select('*')
        .eq('user_id', expectedBuyerId)
        .eq('type', buyerWalletType)
        .maybeSingle();

      if (buyerWalletRes.data) {
        buyerWallet = buyerWalletRes.data;
      } else {
        const fallbackWallet = await supabaseAdmin
          .from('wallets')
          .select('*')
          .eq('user_id', expectedBuyerId)
          .eq('type', 'real')
          .single();
        buyerWallet = fallbackWallet.data;
      }

      if (!buyerWallet) {
        throw new Error('Buyer wallet not found');
      }

      const newBuyerBalance = Number(buyerWallet.balance) + Number(trade.amount);
      await supabaseAdmin
        .from('wallets')
        .update({ balance: newBuyerBalance })
        .eq('id', buyerWallet.id);

      // 3. Mark P2P trade as completed
      const { data: updatedTrade } = await supabaseAdmin
        .from('p2p_trades')
        .update({ status: 'completed' })
        .eq('id', tradeId)
        .select()
        .single();

      // Record deposit transaction for the buyer
      await supabaseAdmin.from('transactions').insert({
        user_id: expectedBuyerId,
        wallet_id: buyerWallet.id,
        type: 'deposit',
        amount: trade.amount,
        status: 'approved',
        payment_method: `p2p_seller_${user.username}`
      });

      // Send chat system update
      await supabaseAdmin.from('chats').insert({
        sender_id: user.id,
        recipient_id: expectedBuyerId,
        trade_id: tradeId,
        message: `[SYSTEM]: Seller has released escrow. Trade successfully completed.`,
        is_read: false
      });

      // Real-time notification publish via Redis Pub/Sub
      await redis.publish('xfx:notifications', JSON.stringify({
        type: 'p2p_trade_completed',
        userId: expectedBuyerId,
        tradeId: tradeId
      }));

      return { success: true, trade: updatedTrade };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // 8. Submit Rating and Review
  fastify.post('/api/p2p/trades/rate', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tradeId, rating, review } = request.body as any;
    const user = request.user!;

    if (!tradeId || !rating || rating < 1 || rating > 5 || !review) {
      return reply.code(400).send({ error: 'Valid tradeId, rating (1-5), and review text are required' });
    }

    const { data: trade } = await supabaseAdmin
      .from('p2p_trades')
      .select('*')
      .eq('id', tradeId)
      .single();

    if (!trade || trade.status !== 'completed') {
      return reply.code(400).send({ error: 'Reviews can only be left for completed P2P trades' });
    }

    if (trade.buyer_id !== user.id) {
      return reply.code(403).send({ error: 'Only the buyer can review the broker' });
    }

    // Check if review already exists
    const { data: existingReview } = await supabaseAdmin
      .from('p2p_reviews')
      .select('id')
      .eq('trade_id', tradeId)
      .maybeSingle();

    if (existingReview) {
      return reply.code(400).send({ error: 'You have already reviewed this trade' });
    }

    try {
      // Insert review
      await supabaseAdmin.from('p2p_reviews').insert({
        trade_id: tradeId,
        broker_id: trade.broker_id,
        user_id: user.id,
        rating,
        review
      });

      // Calculate broker's new average rating and review count
      const { data: reviews } = await supabaseAdmin
        .from('p2p_reviews')
        .select('rating')
        .eq('broker_id', trade.broker_id);

      if (reviews && reviews.length > 0) {
        const total = reviews.reduce((sum, r) => sum + r.rating, 0);
        const avgRating = Number((total / reviews.length).toFixed(2));
        
        await supabaseAdmin
          .from('profiles')
          .update({
            rating: avgRating,
            review_count: reviews.length
          })
          .eq('id', trade.broker_id);
      }

      return { success: true };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // 9. Get User P2P trade history
  fastify.get('/api/p2p/trades', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { data, error } = await supabaseAdmin
      .from('p2p_trades')
      .select('*, broker:profiles!p2p_trades_broker_id_fkey(username), buyer:profiles!p2p_trades_buyer_id_fkey(username), p2p_offers(*)')
      .or(`buyer_id.eq.${user.id},broker_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (error) return reply.code(500).send({ error: error.message });
    return data;
  });

  // 10. Broker P2P Wallet Top-up request
  fastify.post('/api/p2p/broker/topup', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { amount, paymentDetails } = request.body as any;
    const user = request.user!;

    if (!amount || amount <= 0) {
      return reply.code(400).send({ error: 'Valid amount is required' });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'broker') {
      return reply.code(403).send({ error: 'Only verified brokers can request P2P wallet top-ups' });
    }

    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'p2p')
      .single();

    if (!wallet) {
      return reply.code(404).send({ error: 'P2P Wallet not found' });
    }

    // Creates a pending transaction for admin approval
    const { data, error } = await supabaseAdmin.from('transactions').insert({
      user_id: user.id,
      wallet_id: wallet.id,
      type: 'deposit',
      amount,
      status: 'pending',
      payment_method: 'p2p_topup',
      payment_details: paymentDetails || {}
    }).select().single();

    if (error) return reply.code(500).send({ error: error.message });

    return { success: true, transaction: data };
  });

  // 11. Add Admin to P2P Trade Chat (dispute arbitration)
  fastify.post('/api/p2p/trades/:tradeId/add-admin', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tradeId } = request.params as any;
    const user = request.user!;

    const { data: trade } = await supabaseAdmin
      .from('p2p_trades')
      .select('*')
      .eq('id', tradeId)
      .single();

    if (!trade) {
      return reply.code(404).send({ error: 'Trade not found' });
    }

    if (trade.buyer_id !== user.id && trade.broker_id !== user.id && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    // Mark admin_involved as true
    const { error: updateErr } = await supabaseAdmin
      .from('p2p_trades')
      .update({ admin_involved: true })
      .eq('id', tradeId);

    if (updateErr) return reply.code(500).send({ error: updateErr.message });

    // Send system chat message
    await supabaseAdmin.from('chats').insert({
      sender_id: user.id,
      recipient_id: null,
      trade_id: tradeId,
      message: `[SYSTEM]: Admin has been invited to this trade chat by ${user.username || 'user'} for dispute resolution.`,
      is_read: false
    });

    return { success: true };
  });

  // 12. Update P2P Offer
  fastify.put('/api/p2p/offers/:id', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const { amount, minLimit, maxLimit, paymentMethod } = request.body as any;
    const user = request.user!;

    if (!amount || amount <= 0 || !minLimit || !maxLimit || !paymentMethod) {
      return reply.code(400).send({ error: 'All offer fields (amount, minLimit, maxLimit, paymentMethod) are required' });
    }

    const { data: offer } = await supabaseAdmin
      .from('p2p_offers')
      .select('*')
      .eq('id', id)
      .single();

    if (!offer) {
      return reply.code(404).send({ error: 'Offer not found' });
    }

    if (offer.broker_id !== user.id && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Forbidden: You can only edit your own offers' });
    }

    if (offer.status !== 'active') {
      return reply.code(400).send({ error: 'Only active offers can be edited' });
    }

    // Check if seller has enough balance for the new amount
    if (offer.type === 'sell') {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      const isBroker = profile?.role === 'broker';
      const walletType = isBroker ? 'p2p' : 'real';

      const { data: wallet } = await supabaseAdmin
        .from('wallets')
        .select('balance')
        .eq('user_id', user.id)
        .eq('type', walletType)
        .single();

      if (!wallet || Number(wallet.balance) < amount) {
        return reply.code(400).send({ error: `Insufficient ${walletType} wallet balance to list this sell offer` });
      }
    }

    const { data: updatedOffer, error } = await supabaseAdmin
      .from('p2p_offers')
      .update({
        amount,
        min_limit: minLimit,
        max_limit: maxLimit,
        payment_method: paymentMethod
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return reply.code(500).send({ error: error.message });
    return { success: true, offer: updatedOffer };
  });

  // 13. Cancel (Delete) P2P Offer
  fastify.delete('/api/p2p/offers/:id', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const user = request.user!;

    const { data: offer } = await supabaseAdmin
      .from('p2p_offers')
      .select('*')
      .eq('id', id)
      .single();

    if (!offer) {
      return reply.code(404).send({ error: 'Offer not found' });
    }

    if (offer.broker_id !== user.id && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Forbidden: You can only cancel your own offers' });
    }

    if (offer.status !== 'active') {
      return reply.code(400).send({ error: 'Offer is not active' });
    }

    const { data: cancelledOffer, error } = await supabaseAdmin
      .from('p2p_offers')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single();

    if (error) return reply.code(500).send({ error: error.message });
    return { success: true, offer: cancelledOffer };
  });
}

