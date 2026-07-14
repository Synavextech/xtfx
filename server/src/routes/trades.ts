import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { authenticate } from './auth';
import { redis, registerTrade, deregisterTrade, closeTrade, activeTrades, ASSETS } from '../engine';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export default async function tradeRoutes(fastify: FastifyInstance) {

  // Get historical candles from Redis
  fastify.get('/api/market/candles', async (request: FastifyRequest, reply: FastifyReply) => {
    const { symbol, resolution } = request.query as any;
    if (!symbol) return reply.code(400).send({ error: 'Symbol is required' });
    const suffix = resolution === 'M1' ? ':m1' : ':m5';
    const candlesJson = await redis.get(`xfx:asset:${symbol}:candles${suffix}`);
    if (!candlesJson) return [];
    return JSON.parse(candlesJson);
  });

  // 1. Open a new position
  fastify.post('/api/trades/open', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { walletType, asset, type, quantity, stopLoss, takeProfit, duration } = request.body as any;
    const user = request.user!;

    if (!asset || !type || !quantity || !['buy', 'sell'].includes(type) || !['real', 'demo'].includes(walletType)) {
      return reply.code(400).send({ error: 'Invalid trade parameters' });
    }

    // Find asset configuration
    const assetConfig = ASSETS.find(a => a.symbol === asset);
    if (!assetConfig) {
      return reply.code(404).send({ error: 'Asset not found' });
    }

    // Duration constraint checks
    if (assetConfig.category === 'synthetic') {
      if (!duration || duration <= 0) {
        return reply.code(400).send({ error: 'Duration is required for synthetic indices' });
      }
    } else {
      if (duration !== null && duration !== undefined && duration < 86400) {
        return reply.code(400).send({ error: 'Non-synthetic assets require a minimum of 24 hours (86400 seconds) duration' });
      }
    }

    try {
      // 1. Fetch user's wallet
      const { data: wallet, error: walletErr } = await supabaseAdmin
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', walletType)
        .single();

      if (walletErr || !wallet) {
        return reply.code(404).send({ error: `Wallet not found for type: ${walletType}` });
      }

      // 2. Fetch current price from Redis
      const priceStr = await redis.get(`xfx:asset:${asset}:price`);
      if (!priceStr) {
        return reply.code(500).send({ error: 'Market price is currently unavailable' });
      }
      const entryPrice = parseFloat(priceStr);

      // Validate minimum trade value ($10)
      const tradeValue = quantity * entryPrice;
      if (tradeValue < 10) {
        return reply.code(400).send({ error: 'Minimum trade value must be at least $10' });
      }

      // Validate Stop Loss and Take Profit
      if (stopLoss !== null && stopLoss !== undefined && stopLoss !== '') {
        const slVal = Number(stopLoss);
        if (isNaN(slVal) || slVal <= 0) {
          return reply.code(400).send({ error: 'Stop Loss must be a positive number' });
        }
        if (type === 'buy' && slVal >= entryPrice) {
          return reply.code(400).send({ error: 'For BUY positions, Stop Loss must be less than the entry price' });
        }
        if (type === 'sell' && slVal <= entryPrice) {
          return reply.code(400).send({ error: 'For SELL positions, Stop Loss must be greater than the entry price' });
        }
      }

      if (takeProfit !== null && takeProfit !== undefined && takeProfit !== '') {
        const tpVal = Number(takeProfit);
        if (isNaN(tpVal) || tpVal <= 0) {
          return reply.code(400).send({ error: 'Take Profit must be a positive number' });
        }
        if (type === 'buy' && tpVal <= entryPrice) {
          return reply.code(400).send({ error: 'For BUY positions, Take Profit must be greater than the entry price' });
        }
        if (type === 'sell' && tpVal >= entryPrice) {
          return reply.code(400).send({ error: 'For SELL positions, Take Profit must be less than the entry price' });
        }
      }

      // 3. Calculate margin needed
      // Quantity acts as the trade volume. Let's say leverage is 1:100.
      // Margin = (Quantity * EntryPrice) / 100.
      // For synthetic indices, we can calculate differently, but let's keep a standard margin of 1% of trade value.
      const leverage = 100;
      const marginRequired = Number(((quantity * entryPrice) / leverage).toFixed(2));

      // Calculate current floating equity
      // Equity = balance + floating PnL
      let floatingPnl = 0;
      const userActiveTrades = activeTrades.filter(t => t.user_id === user.id && t.wallet_id === wallet.id);
      
      for (const t of userActiveTrades) {
        const livePriceStr = await redis.get(`xfx:asset:${t.asset}:price`);
        if (livePriceStr) {
          const livePrice = parseFloat(livePriceStr);
          const diff = livePrice - t.entry_price;
          floatingPnl += t.type === 'buy' ? diff * t.quantity : -diff * t.quantity;
        }
      }

      const balance = Number(wallet.balance);
      const equity = balance + floatingPnl;
      
      // Free Margin = Equity - Total Margin Used
      let totalMarginUsed = 0;
      userActiveTrades.forEach(t => {
        totalMarginUsed += (t.quantity * t.entry_price) / leverage;
      });

      const freeMargin = equity - totalMarginUsed;

      if (freeMargin < marginRequired) {
        return reply.code(400).send({ error: `Insufficient free margin. Required: $${marginRequired.toFixed(2)}, Available: $${freeMargin.toFixed(2)}` });
      }

      // 4. Record trade in Supabase (the settled state tracker)
      const { data: dbTrade, error: tradeErr } = await supabaseAdmin
        .from('trades')
        .insert({
          user_id: user.id,
          wallet_id: wallet.id,
          asset,
          type,
          quantity,
          entry_price: entryPrice,
          stop_loss: stopLoss || null,
          take_profit: takeProfit || null,
          duration: duration || null,
          status: 'open'
        })
        .select()
        .single();

      if (tradeErr || !dbTrade) {
        return reply.code(500).send({ error: `Failed to open trade in DB: ${tradeErr?.message || 'Unknown error'}` });
      }

      // If synthetic asset, increment trade count and determine win/loss cycle outcome
      let outcome: 'win' | 'lose' | undefined;
      let winMultiplier: number | undefined;

      if (assetConfig.category === 'synthetic') {
        const countKey = `xfx:user:${user.id}:synthetic_count`;
        const count = await redis.incr(countKey);
        const cycleIndex = ((count - 1) % 10) + 1; // 1 to 10

        if (cycleIndex === 2) {
          outcome = 'win';
          winMultiplier = 0.05;
        } else if (cycleIndex === 5) {
          outcome = 'win';
          winMultiplier = 0.10;
        } else if (cycleIndex === 10) {
          outcome = 'win';
          winMultiplier = 0.15;
        } else {
          outcome = 'lose';
          winMultiplier = 0;
        }

        // Store outcome metadata in Redis
        const metaKey = `xfx:trade:${dbTrade.id}:meta`;
        await redis.hset(metaKey, 'outcome', outcome, 'win_multiplier', winMultiplier.toString());
      }

      // 5. Register with real-time pricing engine
      const activeTrade = {
        id: dbTrade.id,
        user_id: user.id,
        wallet_id: wallet.id,
        asset,
        type: type as 'buy' | 'sell',
        quantity: Number(quantity),
        entry_price: entryPrice,
        stop_loss: stopLoss ? Number(stopLoss) : null,
        take_profit: takeProfit ? Number(takeProfit) : null,
        duration: duration ? Number(duration) : null,
        created_at: dbTrade.created_at,
        target_outcome: outcome,
        win_multiplier: winMultiplier
      };

      registerTrade(activeTrade);

      // Publish trade placed event
      await redis.publish('xfx:notifications', JSON.stringify({
        type: 'trade_placed',
        userId: user.id,
        trade: dbTrade
      }));

      return { success: true, trade: dbTrade };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // 2. Close an active position manually (Stop Trade)
  fastify.post('/api/trades/close', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tradeId } = request.body as any;
    const user = request.user!;

    if (!tradeId) {
      return reply.code(400).send({ error: 'Trade ID is required' });
    }

    const trade = activeTrades.find(t => t.id === tradeId && t.user_id === user.id);
    if (!trade) {
      return reply.code(404).send({ error: 'Active trade not found' });
    }

    try {
      // Fetch current price from Redis
      const priceStr = await redis.get(`xfx:asset:${trade.asset}:price`);
      if (!priceStr) {
        return reply.code(500).send({ error: 'Market price is currently unavailable' });
      }
      const exitPrice = parseFloat(priceStr);

      // Calculate P&L
      const diff = exitPrice - trade.entry_price;
      const pnl = Number((trade.type === 'buy' ? diff * trade.quantity : -diff * trade.quantity).toFixed(2));

      // Close using engine helper
      await closeTrade(tradeId, exitPrice, pnl, 'manual');

      return { success: true, tradeId, exitPrice, pnl };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // 3. Close multiple active positions
  fastify.post('/api/trades/close-multiple', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tradeIds } = request.body as any; // array of trade IDs
    const user = request.user!;

    if (!tradeIds || !Array.isArray(tradeIds)) {
      return reply.code(400).send({ error: 'Trade IDs array is required' });
    }

    const results = [];

    for (const tradeId of tradeIds) {
      const trade = activeTrades.find(t => t.id === tradeId && t.user_id === user.id);
      if (!trade) continue;

      try {
        const priceStr = await redis.get(`xfx:asset:${trade.asset}:price`);
        if (!priceStr) continue;
        const exitPrice = parseFloat(priceStr);
        const diff = exitPrice - trade.entry_price;
        const pnl = Number((trade.type === 'buy' ? diff * trade.quantity : -diff * trade.quantity).toFixed(2));

        await closeTrade(tradeId, exitPrice, pnl, 'manual');
        results.push({ tradeId, success: true, pnl });
      } catch (err) {
        results.push({ tradeId, success: false });
      }
    }

    return { results };
  });

  // 4. Get active positions
  fastify.get('/api/trades/active', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    
    // Return positions from memory
    const userTrades = activeTrades.filter(t => t.user_id === user.id);
    
    // Add current live price and floating PnL to response
    const tradesWithLiveStats = [];
    for (const t of userTrades) {
      const priceStr = await redis.get(`xfx:asset:${t.asset}:price`);
      const livePrice = priceStr ? parseFloat(priceStr) : t.entry_price;
      const diff = livePrice - t.entry_price;
      const pnl = Number((t.type === 'buy' ? diff * t.quantity : -diff * t.quantity).toFixed(2));
      
      tradesWithLiveStats.push({
        ...t,
        livePrice,
        pnl
      });
    }

    return tradesWithLiveStats;
  });

  // 5. Get history of trades
  fastify.get('/api/trades/history', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { data, error } = await supabaseAdmin
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'closed')
      .order('closed_at', { ascending: false });

    if (error) return reply.code(500).send({ error: error.message });
    return data;
  });
}
