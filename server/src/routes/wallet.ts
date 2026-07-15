import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import Stripe from 'stripe';
import { authenticate } from './auth';
import dotenv from 'dotenv';
import { redis } from '../engine';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Stripe init
const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: '2024-04-10' as any }) : null;

// PayPal credentials
const paypalClientId = process.env.PAYPAL_CLIENT_ID || '';
const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET || '';

// M-Pesa credentials
const mpesaConsumerKey = process.env.MPESA_CONSUMER_KEY || '';
const mpesaConsumerSecret = process.env.MPESA_CONSUMER_SECRET || '';
const mpesaShortcode = process.env.MPESA_SHORTCODE || '';
const mpesaPasskey = process.env.MPESA_PASSKEY || '';
const mpesaCallbackUrl = process.env.MPESA_CALLBACK_URL || '';

export default async function walletRoutes(fastify: FastifyInstance) {
  
  // 0. Get Crypto Deposit Addresses
  fastify.get('/api/wallet/crypto-addresses', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return {
      btc: process.env.BTC_DEPOSIT_ADDRESS || '',
      usdt: process.env.USDT_DEPOSIT_ADDRESS || '',
      ltc: process.env.LTC_DEPOSIT_ADDRESS || ''
    };
  });

  // Helper to fetch PayPal access token
  async function getPaypalAccessToken(): Promise<string> {
    const auth = Buffer.from(`${paypalClientId}:${paypalClientSecret}`).toString('base64');
    const url = paypalClientId.startsWith('A') ? 
      'https://api-m.paypal.com/v1/oauth2/token' : 
      'https://api-m.sandbox.paypal.com/v1/oauth2/token';
      
    const response = await axios.post(
      url,
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    return response.data.access_token;
  }

  // Helper to fetch Safaricom access token
  async function getMpesaAccessToken(): Promise<string> {
    const auth = Buffer.from(`${mpesaConsumerKey}:${mpesaConsumerSecret}`).toString('base64');
    const url = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
    const response = await axios.get(url, {
      headers: { 'Authorization': `Basic ${auth}` }
    });
    return response.data.access_token;
  }

  // 1. Stripe Create Payment Intent
  fastify.post('/api/wallet/deposit/stripe-intent', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { amount } = request.body as any;
    const user = request.user!;

    if (!amount || amount < 10) {
      return reply.code(400).send({ error: 'Minimum deposit amount is $10' });
    }

    if (!stripe) {
      return reply.code(500).send({ error: 'Stripe integration is not configured' });
    }

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // in cents
        currency: 'usd',
        metadata: { userId: user.id },
        automatic_payment_methods: { enabled: true }
      });

      return { clientSecret: paymentIntent.client_secret };
    } catch (err: any) {
      return reply.code(500).send({ error: `Stripe Intent error: ${err.message}` });
    }
  });

  // 2. Stripe Confirm Hook / Call
  fastify.post('/api/wallet/deposit/stripe-confirm', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { paymentIntentId } = request.body as any;
    const user = request.user!;

    if (!stripe) return reply.code(500).send({ error: 'Stripe not configured' });

    try {
      // Replay Protection: Check if already processed
      const { data: existingTx } = await supabaseAdmin
        .from('transactions')
        .select('id')
        .eq('payment_method', 'stripe')
        .filter('payment_details->>intentId', 'eq', paymentIntentId)
        .maybeSingle();

      if (existingTx) {
        const { data: wallet } = await supabaseAdmin
          .from('wallets')
          .select('*')
          .eq('user_id', user.id)
          .eq('type', 'real')
          .single();
        return { success: true, balance: wallet ? Number(wallet.balance) : 0, message: 'Already processed' };
      }

      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (intent.status === 'succeeded') {
        const amount = intent.amount / 100;

        // Fetch user wallet
        const { data: wallet } = await supabaseAdmin
          .from('wallets')
          .select('*')
          .eq('user_id', user.id)
          .eq('type', 'real')
          .single();

        if (!wallet) return reply.code(404).send({ error: 'Wallet not found' });

        // Update balance
        const newBalance = Number(wallet.balance) + amount;
        await supabaseAdmin.from('wallets').update({ balance: newBalance }).eq('id', wallet.id);

        // Record transaction
        await supabaseAdmin.from('transactions').insert({
          user_id: user.id,
          wallet_id: wallet.id,
          type: 'deposit',
          amount,
          status: 'approved',
          payment_method: 'stripe',
          payment_details: { intentId: paymentIntentId }
        });

        return { success: true, balance: newBalance };
      }

      return reply.code(400).send({ error: 'Payment was not successful' });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // Stripe Webhook handler (signature-forgery proof by retrieving directly from Stripe API)
  fastify.post('/api/wallet/webhooks/stripe', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const eventType = body?.type;

    if (eventType === 'payment_intent.succeeded') {
      const paymentIntentId = body?.data?.object?.id;
      if (!paymentIntentId) {
        return reply.code(400).send({ error: 'Missing payment intent ID' });
      }

      if (!stripe) return reply.code(500).send({ error: 'Stripe not configured' });

      try {
        const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (intent.status === 'succeeded') {
          const userId = intent.metadata.userId;
          const amount = intent.amount / 100;

          if (!userId) {
            console.error(`Stripe payment succeeded but metadata.userId is missing for intent: ${paymentIntentId}`);
            return reply.code(400).send({ error: 'Missing userId metadata' });
          }

          // Check if already processed
          const { data: existingTx } = await supabaseAdmin
            .from('transactions')
            .select('id')
            .eq('payment_method', 'stripe')
            .filter('payment_details->>intentId', 'eq', paymentIntentId)
            .maybeSingle();

          if (existingTx) {
            return { success: true, message: 'Already processed' };
          }

          const { data: wallet } = await supabaseAdmin
            .from('wallets')
            .select('*')
            .eq('user_id', userId)
            .eq('type', 'real')
            .single();

          if (!wallet) {
            console.error(`Stripe Webhook: Wallet not found for user: ${userId}`);
            return reply.code(404).send({ error: 'Wallet not found' });
          }

          const newBalance = Number(wallet.balance) + amount;
          await supabaseAdmin.from('wallets').update({ balance: newBalance }).eq('id', wallet.id);

          await supabaseAdmin.from('transactions').insert({
            user_id: userId,
            wallet_id: wallet.id,
            type: 'deposit',
            amount,
            status: 'approved',
            payment_method: 'stripe',
            payment_details: { intentId: paymentIntentId }
          });

          // Publish notification to user
          const message = {
            type: 'deposit_approved',
            userId,
            amount,
            newBalance,
            payment_method: 'stripe'
          };
          await redis.publish('xfx:notifications', JSON.stringify(message));
          console.log(`Stripe Webhook processed successfully for user ${userId}, credited ${amount} USD`);
        }
      } catch (err: any) {
        console.error("Stripe Webhook processing error:", err.message);
        return reply.code(500).send({ error: err.message });
      }
    }

    return { received: true };
  });

  // 3. PayPal Order Capture Verification
  fastify.post('/api/wallet/deposit/paypal', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { orderID } = request.body as any;
    const user = request.user!;

    if (!orderID) {
      return reply.code(400).send({ error: 'PayPal Order ID is required' });
    }

    try {
      // Replay Protection: Check if orderID was already processed
      const { data: existingTx } = await supabaseAdmin
        .from('transactions')
        .select('id')
        .eq('payment_method', 'paypal')
        .filter('payment_details->>orderID', 'eq', orderID)
        .maybeSingle();

      if (existingTx) {
        return reply.code(400).send({ error: 'This PayPal order has already been processed.' });
      }

      const token = await getPaypalAccessToken();
      const url = paypalClientId.startsWith('A') ?
        `https://api-m.paypal.com/v2/checkout/orders/${orderID}` :
        `https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderID}`;

      const orderResponse = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const orderData = orderResponse.data;
      if (orderData.status === 'COMPLETED') {
        const amount = parseFloat(orderData.purchase_units[0].amount.value);

        if (amount < 10) {
          return reply.code(400).send({ error: 'Minimum deposit amount is $10' });
        }

        const { data: wallet } = await supabaseAdmin
          .from('wallets')
          .select('*')
          .eq('user_id', user.id)
          .eq('type', 'real')
          .single();

        if (!wallet) return reply.code(404).send({ error: 'Wallet not found' });

        const newBalance = Number(wallet.balance) + amount;
        await supabaseAdmin.from('wallets').update({ balance: newBalance }).eq('id', wallet.id);

        await supabaseAdmin.from('transactions').insert({
          user_id: user.id,
          wallet_id: wallet.id,
          type: 'deposit',
          amount,
          status: 'approved',
          payment_method: 'paypal',
          payment_details: { orderID }
        });

        return { success: true, balance: newBalance };
      }

      return reply.code(400).send({ error: 'PayPal order has not been completed' });
    } catch (err: any) {
      return reply.code(500).send({ error: `PayPal verification failed: ${err.message}` });
    }
  });

  // 4. M-Pesa STK Push
  fastify.post('/api/wallet/deposit/mpesa-stk', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { amount, phone } = request.body as any;
    const user = request.user!;

    if (!amount || !phone) {
      return reply.code(400).send({ error: 'Amount and phone number are required' });
    }

    const usdAmount = Number(amount);
    if (usdAmount < 10) {
      return reply.code(400).send({ error: 'Minimum deposit amount is $10' });
    }

    // Convert USD to KES (rate: 130 KES/USD)
    const kesAmount = Math.round(usdAmount * 130);

    // Format phone number to 254XXXXXXXXX
    let formattedPhone = phone.replace(/\+/g, '').trim();
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.substring(1);
    } else if (formattedPhone.startsWith('7') || formattedPhone.startsWith('1')) {
      formattedPhone = '254' + formattedPhone;
    }

    try {
      const accessToken = await getMpesaAccessToken();
      const url = 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
      const password = Buffer.from(`${mpesaShortcode}${mpesaPasskey}${timestamp}`).toString('base64');

      // STK Push request payload
      const response = await axios.post(url, {
        BusinessShortCode: mpesaShortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: kesAmount, // M-Pesa expects KES amount
        PartyA: formattedPhone,
        PartyB: mpesaShortcode,
        PhoneNumber: formattedPhone,
        CallBackURL: mpesaCallbackUrl,
        AccountReference: 'Xfx ExtremeTrader',
        TransactionDesc: `Deposit ${usdAmount} USD`
      }, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      console.log("M-Pesa STK response:", response.data);

      const { data: wallet } = await supabaseAdmin
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'real')
        .single();

      if (!wallet) return reply.code(404).send({ error: 'Wallet not found' });

      // Save as pending transaction (DO NOT auto-approve for security/production-readiness)
      await supabaseAdmin.from('transactions').insert({
        user_id: user.id,
        wallet_id: wallet.id,
        type: 'deposit',
        amount: usdAmount,
        status: 'pending',
        payment_method: 'mpesa',
        payment_details: { 
          CheckoutRequestID: response.data.CheckoutRequestID, 
          responseCode: response.data.ResponseCode, 
          convertedKes: kesAmount 
        }
      });

      return { success: true, balance: Number(wallet.balance), message: 'STK push completed successfully' };
    } catch (err: any) {
      return reply.code(500).send({ error: `M-Pesa transaction failed: ${err.message}` });
    }
  });

  // M-Pesa Callback handler
  fastify.post('/api/wallet/deposit/mpesa-callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    console.log("M-Pesa Callback payload:", JSON.stringify(body));

    const stkCallback = body?.Body?.stkCallback;
    if (!stkCallback) {
      return reply.code(400).send({ error: 'Invalid callback body structure' });
    }

    const checkoutRequestID = stkCallback.CheckoutRequestID;
    const resultCode = stkCallback.ResultCode;

    try {
      // Find the pending transaction with this CheckoutRequestID
      const { data: transaction, error: txErr } = await supabaseAdmin
        .from('transactions')
        .select('*')
        .eq('payment_method', 'mpesa')
        .eq('status', 'pending')
        .filter('payment_details->>CheckoutRequestID', 'eq', checkoutRequestID)
        .maybeSingle();

      if (txErr || !transaction) {
        console.error(`Transaction not found or not pending for CheckoutRequestID: ${checkoutRequestID}`);
        return reply.code(404).send({ error: 'Pending transaction not found' });
      }

      if (resultCode === 0) {
        // Successful payment
        const { data: wallet } = await supabaseAdmin
          .from('wallets')
          .select('*')
          .eq('id', transaction.wallet_id)
          .single();

        if (wallet) {
          const newBalance = Number(wallet.balance) + Number(transaction.amount);
          await supabaseAdmin.from('wallets').update({ balance: newBalance }).eq('id', wallet.id);

          await supabaseAdmin.from('transactions').update({
            status: 'approved',
            approved_at: new Date().toISOString(),
            payment_details: {
              ...transaction.payment_details,
              CallbackMetadata: stkCallback.CallbackMetadata
            }
          }).eq('id', transaction.id);

          // Publish notification to user
          const message = {
            type: 'deposit_approved',
            userId: transaction.user_id,
            amount: transaction.amount,
            newBalance,
            payment_method: 'mpesa'
          };
          await redis.publish('xfx:notifications', JSON.stringify(message));
          console.log(`Successfully credited wallet ${wallet.id} for user ${transaction.user_id} with ${transaction.amount} USD`);
        }
      } else {
        // Transaction failed
        await supabaseAdmin.from('transactions').update({
          status: 'rejected',
          payment_details: {
            ...transaction.payment_details,
            ResultDesc: stkCallback.ResultDesc,
            ResultCode: resultCode
          }
        }).eq('id', transaction.id);
        console.log(`M-Pesa STK payment rejected for transaction ${transaction.id}: ${stkCallback.ResultDesc}`);
      }

      return { ResultCode: 0, ResultDesc: 'Callback processed successfully' };
    } catch (err: any) {
      console.error("M-Pesa Callback handler error:", err.message);
      return reply.code(500).send({ error: err.message });
    }
  });

  // 5. Manual Crypto Deposit Submission
  fastify.post('/api/wallet/deposit/crypto', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { amount, txHash, screenshotUrl, network } = request.body as any;
    const user = request.user!;

    if (!amount || !txHash) {
      return reply.code(400).send({ error: 'Amount and transaction hash are required' });
    }

    const usdAmount = Number(amount);
    if (usdAmount < 10) {
      return reply.code(400).send({ error: 'Minimum deposit amount is $10' });
    }

    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'real')
      .single();

    if (!wallet) return reply.code(404).send({ error: 'Wallet not found' });

    // Creates a pending transaction for admin approval
    const { data, error } = await supabaseAdmin.from('transactions').insert({
      user_id: user.id,
      wallet_id: wallet.id,
      type: 'deposit',
      amount: usdAmount,
      status: 'pending',
      payment_method: 'crypto',
      payment_details: { txHash, network },
      screenshot_url: screenshotUrl || null
    }).select().single();

    if (error) return reply.code(500).send({ error: error.message });

    return { success: true, transaction: data };
  });

  // 6. Request Withdrawal
  fastify.post('/api/wallet/withdraw', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { amount, method, details } = request.body as any;
    const user = request.user!;

    if (!amount || !method || !details) {
      return reply.code(400).send({ error: 'Valid amount, method, and withdrawal details are required' });
    }

    const withdrawAmount = Number(amount);
    if (withdrawAmount < 100) {
      return reply.code(400).send({ error: 'Minimum withdrawal amount is $100' });
    }

    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'real')
      .single();

    if (!wallet) return reply.code(404).send({ error: 'Wallet not found' });

    if (Number(wallet.balance) < withdrawAmount) {
      return reply.code(400).send({ error: 'Insufficient funds for withdrawal' });
    }

    const newBalance = Number(wallet.balance) - withdrawAmount;
    const { error: walletUpdateErr } = await supabaseAdmin
      .from('wallets')
      .update({ balance: newBalance })
      .eq('id', wallet.id);

    if (walletUpdateErr) {
      return reply.code(500).send({ error: 'Failed to update wallet balance' });
    }

    const { data: transaction, error } = await supabaseAdmin.from('transactions').insert({
      user_id: user.id,
      wallet_id: wallet.id,
      type: 'withdrawal',
      amount: withdrawAmount,
      status: 'pending',
      payment_method: method,
      payment_details: details
    }).select().single();

    if (error) {
      // Rollback balance on error
      await supabaseAdmin.from('wallets').update({ balance: wallet.balance }).eq('id', wallet.id);
      return reply.code(500).send({ error: error.message });
    }

    return { success: true, transaction, balance: newBalance };
  });

  // 7. Get Transaction History (unified with closed trade profits/losses)
  fastify.get('/api/wallet/history', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;

    const { data: txs, error: txsErr } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('user_id', user.id);

    if (txsErr) return reply.code(500).send({ error: txsErr.message });

    const { data: trades, error: tradesErr } = await supabaseAdmin
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'closed');

    if (tradesErr) return reply.code(500).send({ error: tradesErr.message });

    const { data: p2pTrades, error: p2pErr } = await supabaseAdmin
      .from('p2p_trades')
      .select('*, p2p_offers(*)')
      .eq('status', 'completed')
      .or(`buyer_id.eq.${user.id},broker_id.eq.${user.id}`);

    if (p2pErr) return reply.code(500).send({ error: p2pErr.message });

    const p2pSells = (p2pTrades || []).filter(t => {
      const isBuyOffer = t.p2p_offers?.type === 'buy';
      const sellerId = isBuyOffer ? t.buyer_id : t.broker_id;
      return sellerId === user.id;
    });

    const mergedHistory = [
      ...(txs || []).map(t => ({
        id: t.id,
        created_at: t.created_at,
        type: t.type,
        amount: Number(t.amount),
        payment_method: t.payment_method,
        status: t.status,
        approved_at: t.approved_at
      })),
      ...(trades || []).map(t => ({
        id: t.id,
        created_at: t.closed_at || t.created_at,
        type: Number(t.profit_loss) >= 0 ? 'trade_profit' : 'trade_loss',
        amount: Math.abs(Number(t.profit_loss)),
        payment_method: t.asset,
        status: 'approved',
        approved_at: t.closed_at
      })),
      ...p2pSells.map(t => ({
        id: t.id,
        created_at: t.created_at,
        type: 'p2p_sell',
        amount: Number(t.amount),
        payment_method: 'P2P Sale',
        status: 'approved',
        approved_at: t.created_at
      }))
    ];

    mergedHistory.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return mergedHistory;
  });

  // 8. Broker Wallet Transfer: move balance between trading (real) and P2P wallet
  fastify.post('/api/wallet/transfer', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { amount, direction } = request.body as any; // direction: 'to_p2p' or 'to_trading'
    const user = request.user!;

    if (!amount || amount <= 0 || !direction || !['to_p2p', 'to_trading'].includes(direction)) {
      return reply.code(400).send({ error: 'Invalid transfer details' });
    }

    // Verify user is broker
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'broker') {
      return reply.code(403).send({ error: 'Only verified brokers can transfer to P2P wallets' });
    }

    const { data: wallets, error: walletsErr } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', user.id);

    if (walletsErr || !wallets) {
      return reply.code(500).send({ error: 'Failed to fetch wallets' });
    }

    const realWallet = wallets.find(w => w.type === 'real');
    const p2pWallet = wallets.find(w => w.type === 'p2p');

    if (!realWallet || !p2pWallet) {
      return reply.code(500).send({ error: 'Broker wallets are not initialized' });
    }

    if (direction === 'to_p2p') {
      if (Number(realWallet.balance) < amount) {
        return reply.code(400).send({ error: 'Insufficient trading balance' });
      }
      const newReal = Number(realWallet.balance) - amount;
      const newP2p = Number(p2pWallet.balance) + amount;

      await supabaseAdmin.from('wallets').update({ balance: newReal }).eq('id', realWallet.id);
      await supabaseAdmin.from('wallets').update({ balance: newP2p }).eq('id', p2pWallet.id);
      return { success: true, realBalance: newReal, p2pBalance: newP2p };
    } else {
      if (Number(p2pWallet.balance) < amount) {
        return reply.code(400).send({ error: 'Insufficient P2P balance' });
      }
      const newReal = Number(realWallet.balance) + amount;
      const newP2p = Number(p2pWallet.balance) - amount;

      await supabaseAdmin.from('wallets').update({ balance: newReal }).eq('id', realWallet.id);
      await supabaseAdmin.from('wallets').update({ balance: newP2p }).eq('id', p2pWallet.id);
      return { success: true, realBalance: newReal, p2pBalance: newP2p };
    }
  });

  // 9. Reset Demo Wallet Balance
  fastify.post('/api/wallet/demo/reset', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;

    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'demo')
      .single();

    if (!wallet) return reply.code(404).send({ error: 'Demo wallet not found' });

    const resetBalance = 10000.00;
    const { error } = await supabaseAdmin
      .from('wallets')
      .update({ balance: resetBalance })
      .eq('id', wallet.id);

    if (error) return reply.code(500).send({ error: error.message });

    return { success: true, balance: resetBalance };
  });
}

// Custom type helper for Reply
type Reply = FastifyReply;
