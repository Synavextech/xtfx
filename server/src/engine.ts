import Redis from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase credentials in server environment");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Initialize Redis - strict connection, no in-memory fallback
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
console.log(`Connecting to Redis at: ${redisUrl}...`);
export const redis = new Redis(redisUrl);

redis.on('error', (err) => {
  console.error("Redis connection error:", err);
  process.exit(1); // Exit if Redis fails to ensure strict production-grade testing
});

export interface Asset {
  symbol: string;
  name: string;
  category: 'forex' | 'crypto' | 'commodity' | 'equity' | 'synthetic';
  basePrice: number;
  spread: number;
  decimals: number;
  openDays: number[]; // 0 = Sunday, 1 = Monday, etc.
  openHour: number; // UTC hour
  closeHour: number; // UTC hour
}

export const ASSETS: Asset[] = [
  // Forex
  { symbol: 'EUR/USD', name: 'Euro / US Dollar', category: 'forex', basePrice: 1.0850, spread: 0.0001, decimals: 5, openDays: [1, 2, 3, 4, 5], openHour: 0, closeHour: 22 },
  { symbol: 'GBP/USD', name: 'British Pound / US Dollar', category: 'forex', basePrice: 1.2720, spread: 0.0002, decimals: 5, openDays: [1, 2, 3, 4, 5], openHour: 0, closeHour: 22 },
  { symbol: 'USD/JPY', name: 'US Dollar / Japanese Yen', category: 'forex', basePrice: 157.50, spread: 0.01, decimals: 3, openDays: [1, 2, 3, 4, 5], openHour: 0, closeHour: 22 },
  { symbol: 'USD/MXN', name: 'US Dollar / Mexican Peso', category: 'forex', basePrice: 18.25, spread: 0.005, decimals: 4, openDays: [1, 2, 3, 4, 5], openHour: 0, closeHour: 22 },
  { symbol: 'USD/CHF', name: 'US Dollar / Swiss Franc', category: 'forex', basePrice: 0.8950, spread: 0.0002, decimals: 5, openDays: [1, 2, 3, 4, 5], openHour: 0, closeHour: 22 },
  { symbol: 'USD/KES', name: 'US Dollar / Kenyan Shilling', category: 'forex', basePrice: 130.00, spread: 0.10, decimals: 2, openDays: [1, 2, 3, 4, 5], openHour: 0, closeHour: 22 },
  { symbol: 'USD/CAD', name: 'US Dollar / Canadian Dollar', category: 'forex', basePrice: 1.3650, spread: 0.0001, decimals: 5, openDays: [1, 2, 3, 4, 5], openHour: 0, closeHour: 22 },
  { symbol: 'GPC/CAD', name: 'GPC / Canadian Dollar', category: 'forex', basePrice: 1.7450, spread: 0.0002, decimals: 5, openDays: [1, 2, 3, 4, 5], openHour: 0, closeHour: 22 },
  
  // Commodities
  { symbol: 'XAU/USD', name: 'Gold', category: 'commodity', basePrice: 2330.00, spread: 0.35, decimals: 2, openDays: [1, 2, 3, 4, 5], openHour: 0, closeHour: 22 },
  { symbol: 'XAG/USD', name: 'Silver', category: 'commodity', basePrice: 29.50, spread: 0.02, decimals: 3, openDays: [1, 2, 3, 4, 5], openHour: 0, closeHour: 22 },
  { symbol: 'WTI', name: 'US Crude Oil (WTI)', category: 'commodity', basePrice: 78.50, spread: 0.04, decimals: 2, openDays: [1, 2, 3, 4, 5], openHour: 1, closeHour: 21 },
  { symbol: 'BRENT', name: 'UK Brent Oil', category: 'commodity', basePrice: 82.30, spread: 0.04, decimals: 2, openDays: [1, 2, 3, 4, 5], openHour: 1, closeHour: 21 },
  { symbol: 'NAT_GAS', name: 'Natural Gas', category: 'commodity', basePrice: 2.85, spread: 0.005, decimals: 3, openDays: [1, 2, 3, 4, 5], openHour: 1, closeHour: 21 },
  { symbol: 'COPPER', name: 'Copper', category: 'commodity', basePrice: 4.50, spread: 0.01, decimals: 3, openDays: [1, 2, 3, 4, 5], openHour: 1, closeHour: 21 },
  { symbol: 'LEAD', name: 'Lead', category: 'commodity', basePrice: 2.10, spread: 0.005, decimals: 4, openDays: [1, 2, 3, 4, 5], openHour: 1, closeHour: 21 },
  { symbol: 'COCOA', name: 'US Cocoa', category: 'commodity', basePrice: 8500.00, spread: 15.0, decimals: 2, openDays: [1, 2, 3, 4, 5], openHour: 1, closeHour: 21 },
  { symbol: 'COTTON', name: 'Cotton', category: 'commodity', basePrice: 75.00, spread: 0.15, decimals: 2, openDays: [1, 2, 3, 4, 5], openHour: 1, closeHour: 21 },
  { symbol: 'SUGAR', name: 'Sugar', category: 'commodity', basePrice: 18.50, spread: 0.05, decimals: 2, openDays: [1, 2, 3, 4, 5], openHour: 1, closeHour: 21 },

  // Cryptocurrencies (24/7)
  { symbol: 'BTC/USD', name: 'Bitcoin', category: 'crypto', basePrice: 67500.00, spread: 5.0, decimals: 2, openDays: [0, 1, 2, 3, 4, 5, 6], openHour: 0, closeHour: 24 },
  { symbol: 'ETH/USD', name: 'Ethereum', category: 'crypto', basePrice: 3500.00, spread: 0.6, decimals: 2, openDays: [0, 1, 2, 3, 4, 5, 6], openHour: 0, closeHour: 24 },
  { symbol: 'XRP/USD', name: 'Ripple', category: 'crypto', basePrice: 0.4850, spread: 0.0008, decimals: 4, openDays: [0, 1, 2, 3, 4, 5, 6], openHour: 0, closeHour: 24 },
  { symbol: 'SOL/USD', name: 'Solana', category: 'crypto', basePrice: 145.00, spread: 0.15, decimals: 2, openDays: [0, 1, 2, 3, 4, 5, 6], openHour: 0, closeHour: 24 },
  { symbol: 'DOGE/USD', name: 'Dogecoin', category: 'crypto', basePrice: 0.1250, spread: 0.0002, decimals: 4, openDays: [0, 1, 2, 3, 4, 5, 6], openHour: 0, closeHour: 24 },
  { symbol: 'PEPE/USD', name: 'Pepecoin', category: 'crypto', basePrice: 0.0000095, spread: 0.0000001, decimals: 8, openDays: [0, 1, 2, 3, 4, 5, 6], openHour: 0, closeHour: 24 },

  // Equities
  { symbol: 'TSLA', name: 'Tesla Inc', category: 'equity', basePrice: 178.20, spread: 0.15, decimals: 2, openDays: [1, 2, 3, 4, 5], openHour: 13, closeHour: 20 },
  { symbol: 'NVDA', name: 'Nvidia Corp', category: 'equity', basePrice: 125.40, spread: 0.10, decimals: 2, openDays: [1, 2, 3, 4, 5], openHour: 13, closeHour: 20 },
  { symbol: 'META', name: 'Meta Platforms Inc', category: 'equity', basePrice: 480.00, spread: 0.45, decimals: 2, openDays: [1, 2, 3, 4, 5], openHour: 13, closeHour: 20 },
  { symbol: 'AMD', name: 'Advanced Micro Devices Inc', category: 'equity', basePrice: 160.00, spread: 0.20, decimals: 2, openDays: [1, 2, 3, 4, 5], openHour: 13, closeHour: 20 },
  { symbol: 'MU', name: 'Micron Technology', category: 'equity', basePrice: 132.80, spread: 0.12, decimals: 2, openDays: [1, 2, 3, 4, 5], openHour: 13, closeHour: 20 },
  { symbol: 'MSTR', name: 'MicroStrategy Inc', category: 'equity', basePrice: 1550.00, spread: 2.50, decimals: 2, openDays: [1, 2, 3, 4, 5], openHour: 13, closeHour: 20 },

  // Synthetics (24/7)
  { symbol: '1HZ10V', name: 'Volatility 10 (1s) Index', category: 'synthetic', basePrice: 250.00, spread: 0.10, decimals: 2, openDays: [0, 1, 2, 3, 4, 5, 6], openHour: 0, closeHour: 24 },
  { symbol: '1HZ25V', name: 'Volatility 25 (1s) Index', category: 'synthetic', basePrice: 250.00, spread: 0.10, decimals: 2, openDays: [0, 1, 2, 3, 4, 5, 6], openHour: 0, closeHour: 24 },
  { symbol: '1HZ50V', name: 'Volatility 50 (1s) Index', category: 'synthetic', basePrice: 250.00, spread: 0.10, decimals: 2, openDays: [0, 1, 2, 3, 4, 5, 6], openHour: 0, closeHour: 24 },
  { symbol: '1HZ75V', name: 'Volatility 75 (1s) Index', category: 'synthetic', basePrice: 250.00, spread: 0.10, decimals: 2, openDays: [0, 1, 2, 3, 4, 5, 6], openHour: 0, closeHour: 24 },
  { symbol: '1HZ100V', name: 'Volatility 100 (1s) Index', category: 'synthetic', basePrice: 250.00, spread: 0.10, decimals: 2, openDays: [0, 1, 2, 3, 4, 5, 6], openHour: 0, closeHour: 24 }
];

export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ActiveTrade {
  id: string;
  user_id: string;
  wallet_id: string;
  asset: string;
  type: 'buy' | 'sell';
  quantity: number;
  entry_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  duration: number | null; // in seconds
  created_at: string;
  target_outcome?: 'win' | 'lose';
  win_multiplier?: number;
}

// Active trades in memory for evaluation
export let activeTrades: ActiveTrade[] = [];

// Check if an asset market is currently open
export function isMarketOpen(asset: Asset): boolean {
  const now = new Date();
  const utcDay = now.getUTCDay();
  const utcHour = now.getUTCHours();

  if (!asset.openDays.includes(utcDay)) {
    return false;
  }
  return utcHour >= asset.openHour && utcHour < asset.closeHour;
}

// Generate historical candles for an asset going back 30 days (or 2 days for M1)
export function generateHistory(asset: Asset, interval: number = 300): Candle[] {
  const candles: Candle[] = [];
  const now = Math.floor(Date.now() / 1000);
  
  // M1: 3000 candles (~2 days), M5: 8640 candles (~30 days)
  const totalCandles = interval === 60 ? 3000 : 8640;
  let currentPrice = asset.basePrice;
  const startTime = now - (totalCandles * interval);

  for (let i = 0; i < totalCandles; i++) {
    const time = startTime + (i * interval);
    const open = currentPrice;
    
    // Simulate some volatility walk
    const volatility = asset.spread * 15;
    const change = (Math.random() - 0.5) * volatility;
    const close = Number((open + change).toFixed(asset.decimals));
    
    const high = Number((Math.max(open, close) + Math.random() * volatility * 0.5).toFixed(asset.decimals));
    const low = Number((Math.min(open, close) - Math.random() * volatility * 0.5).toFixed(asset.decimals));
    
    candles.push({ time, open, high, low, close });
    currentPrice = close;
  }
  return candles;
}

// Initialize historical candles in Redis
export async function initRedisData() {
  console.log("Initializing asset data in Redis...");
  for (const asset of ASSETS) {
    const priceKey = `xfx:asset:${asset.symbol}:price`;

    // 1. Initialize M1 resolution
    const m1Key = `xfx:asset:${asset.symbol}:candles:m1`;
    const m1Exists = await redis.exists(m1Key);
    if (!m1Exists) {
      console.log(`Generating M1 history for ${asset.symbol}...`);
      const candles = generateHistory(asset, 60);
      await redis.set(m1Key, JSON.stringify(candles));
    }

    // 2. Initialize M5 resolution (and write to legacy key for compatibility)
    const m5Key = `xfx:asset:${asset.symbol}:candles:m5`;
    const legacyKey = `xfx:asset:${asset.symbol}:candles`;
    const m5Exists = await redis.exists(m5Key);
    if (!m5Exists) {
      console.log(`Generating M5 history for ${asset.symbol}...`);
      const candles = generateHistory(asset, 300);
      await redis.set(m5Key, JSON.stringify(candles));
      await redis.set(legacyKey, JSON.stringify(candles));
      await redis.set(priceKey, candles[candles.length - 1].close.toString());
    } else {
      const candlesJson = await redis.get(m5Key);
      if (candlesJson) {
        const candles = JSON.parse(candlesJson);
        if (candles.length > 0) {
          await redis.set(priceKey, candles[candles.length - 1].close.toString());
        }
      }
    }
  }
  console.log("Redis initialization complete.");
}

// Load active open trades from database
export async function loadActiveTrades() {
  const { data, error } = await supabaseAdmin
    .from('trades')
    .select('*')
    .eq('status', 'open');

  if (error) {
    console.error("Error loading active trades:", error.message);
    return;
  }

  const loadedTrades: ActiveTrade[] = [];
  for (const t of data) {
    const metaKey = `xfx:trade:${t.id}:meta`;
    const meta = await redis.hgetall(metaKey);
    
    loadedTrades.push({
      id: t.id,
      user_id: t.user_id,
      wallet_id: t.wallet_id,
      asset: t.asset,
      type: t.type as 'buy' | 'sell',
      quantity: Number(t.quantity),
      entry_price: Number(t.entry_price),
      stop_loss: t.stop_loss ? Number(t.stop_loss) : null,
      take_profit: t.take_profit ? Number(t.take_profit) : null,
      duration: t.duration ? Number(t.duration) : null,
      created_at: t.created_at,
      target_outcome: meta && meta.outcome ? (meta.outcome as 'win' | 'lose') : undefined,
      win_multiplier: meta && meta.win_multiplier ? parseFloat(meta.win_multiplier) : undefined
    });
  }

  activeTrades = loadedTrades;
  console.log(`Loaded ${activeTrades.length} active trades from database.`);
}

// Register a new trade in the engine (idempotent)
export function registerTrade(trade: ActiveTrade) {
  if (!activeTrades.some(t => t.id === trade.id)) {
    activeTrades.push(trade);
    console.log(`[Engine] Trade ${trade.id} registered in memory.`);
  }
}

// Deregister trade (idempotent)
export function deregisterTrade(tradeId: string) {
  const initialLength = activeTrades.length;
  activeTrades = activeTrades.filter(t => t.id !== tradeId);
  if (activeTrades.length < initialLength) {
    console.log(`[Engine] Trade ${tradeId} deregistered from memory.`);
  }
}

// Close an active trade in Supabase and update user's wallet
export async function closeTrade(tradeId: string, exitPrice: number, pnl: number, reason: string = 'manual') {
  // Find active trade details
  const tradeIndex = activeTrades.findIndex(t => t.id === tradeId);
  if (tradeIndex === -1) return;
  const trade = activeTrades[tradeIndex];

  // Overwrite exitPrice and PnL for deterministic synthetic cycle
  let finalExitPrice = exitPrice;
  let finalPnl = pnl;

  const assetConfig = ASSETS.find(a => a.symbol === trade.asset);
  if (assetConfig && assetConfig.category === 'synthetic' && trade.target_outcome && reason === 'duration_expiry') {
    const investment = (trade.quantity * trade.entry_price) / 100;
    if (trade.target_outcome === 'win') {
      const mult = trade.win_multiplier || 0.05;
      finalPnl = Number((investment * mult).toFixed(2));
    } else {
      finalPnl = Number((-investment).toFixed(2));
    }

    if (trade.type === 'buy') {
      finalExitPrice = trade.entry_price + (finalPnl / trade.quantity);
    } else {
      finalExitPrice = trade.entry_price - (finalPnl / trade.quantity);
    }
    finalExitPrice = Number(finalExitPrice.toFixed(assetConfig.decimals));
  }

  console.log(`Closing trade ${tradeId} (${trade.asset}) at ${finalExitPrice} due to ${reason}. PnL: ${finalPnl}`);

  // 1. Remove from active engine memory
  activeTrades.splice(tradeIndex, 1);

  // Clean up Redis metadata
  await redis.del(`xfx:trade:${tradeId}:meta`);

  // 2. Perform database updates in a single transaction-like sequence (settle state)
  // Fetch wallet balance
  const { data: wallet, error: walletErr } = await supabaseAdmin
    .from('wallets')
    .select('balance')
    .eq('id', trade.wallet_id)
    .single();

  if (walletErr || !wallet) {
    console.error(`Failed to fetch wallet ${trade.wallet_id} for closing trade`, walletErr?.message);
    return;
  }

  const currentBalance = Number(wallet.balance);
  const newBalance = Math.max(0, Number((currentBalance + finalPnl).toFixed(2)));

  // Update trade status
  const { error: tradeUpdateErr } = await supabaseAdmin
    .from('trades')
    .update({
      status: 'closed',
      exit_price: finalExitPrice,
      profit_loss: finalPnl,
      closed_at: new Date().toISOString()
    })
    .eq('id', tradeId);

  if (tradeUpdateErr) {
    console.error(`Error updating trade ${tradeId} to closed:`, tradeUpdateErr.message);
    return;
  }

  // Update wallet balance
  const { error: walletUpdateErr } = await supabaseAdmin
    .from('wallets')
    .update({ balance: newBalance })
    .eq('id', trade.wallet_id);

  if (walletUpdateErr) {
    console.error(`Error updating wallet ${trade.wallet_id} balance:`, walletUpdateErr.message);
    return;
  }

  // Publish notification over Redis
  const closeMessage = {
    type: 'trade_closed',
    userId: trade.user_id,
    tradeId,
    pnl: finalPnl,
    newBalance,
    asset: trade.asset,
    exitPrice: finalExitPrice,
    reason
  };
  await redis.publish('xfx:notifications', JSON.stringify(closeMessage));
}

// Define an in-memory cache for candles to avoid parsing JSON strings on every tick
const candlesCache: Record<string, Candle[]> = {};

// Helper to update a candles array in Redis for a specific interval
async function updateCandlesForInterval(symbol: string, newPrice: number, decimals: number, now: number, interval: number): Promise<Candle> {
  const suffix = interval === 60 ? ':m1' : ':m5';
  const key = `xfx:asset:${symbol}:candles${suffix}`;
  
  const cacheKey = `${symbol}${suffix}`;
  let candles = candlesCache[cacheKey];
  if (!candles) {
    const candlesJson = await redis.get(key);
    if (candlesJson) {
      candles = JSON.parse(candlesJson);
    } else {
      candles = [];
    }
    candlesCache[cacheKey] = candles;
  }
  
  const currentCandleTime = Math.floor(now / interval) * interval;
  const maxCandles = interval === 60 ? 3000 : 9000;
  
  if (candles.length > 0) {
    const lastCandle = candles[candles.length - 1];
    if (lastCandle.time === currentCandleTime) {
      lastCandle.close = newPrice;
      if (newPrice > lastCandle.high) lastCandle.high = newPrice;
      if (newPrice < lastCandle.low) lastCandle.low = newPrice;
    } else {
      const newCandle: Candle = {
        time: currentCandleTime,
        open: lastCandle.close,
        high: Math.max(lastCandle.close, newPrice),
        low: Math.min(lastCandle.close, newPrice),
        close: newPrice
      };
      candles.push(newCandle);
      if (candles.length > maxCandles) {
        candles.shift();
      }
    }
  } else {
    const newCandle: Candle = {
      time: currentCandleTime,
      open: newPrice,
      high: newPrice,
      low: newPrice,
      close: newPrice
    };
    candles.push(newCandle);
  }
  
  await redis.set(key, JSON.stringify(candles));
  
  // Keep legacy key updated with M5 for compatibility
  if (interval === 300) {
    await redis.set(`xfx:asset:${symbol}:candles`, JSON.stringify(candles));
  }
  
  return candles[candles.length - 1];
}

// Tick loop: runs sequentially with recursive setTimeout to generate live prices, update candles, and evaluate open positions
export function startEngineTick(publishTick: (symbol: string, price: number, candleM1: Candle, candleM5: Candle) => void) {
  async function tick() {
    const startTime = Date.now();
    const now = Math.floor(startTime / 1000);
    const latestPrices: Record<string, number> = {};
    
    for (const asset of ASSETS) {
      const priceKey = `xfx:asset:${asset.symbol}:price`;

      // Get last price
      const lastPriceStr = await redis.get(priceKey);
      let lastPrice = lastPriceStr ? parseFloat(lastPriceStr) : asset.basePrice;

      const tradesForAsset = activeTrades.filter(t => t.asset === asset.symbol);

      if (!isMarketOpen(asset)) {
        // Market is closed. Still evaluate Stop Loss, Take Profit and Duration Expiry against last known price
        for (const trade of tradesForAsset) {
          try {
            let pnl = 0;
            const diff = lastPrice - trade.entry_price;
            
            if (trade.type === 'buy') {
              pnl = diff * trade.quantity;
            } else {
              pnl = -diff * trade.quantity;
            }

            // Check stop loss (only if set and configured in correct direction)
            if (trade.stop_loss !== null) {
              const isSlValid = trade.type === 'buy' ? trade.stop_loss < trade.entry_price : trade.stop_loss > trade.entry_price;
              if (isSlValid && ((trade.type === 'buy' && lastPrice <= trade.stop_loss) || 
                               (trade.type === 'sell' && lastPrice >= trade.stop_loss))) {
                const lossPnl = trade.type === 'buy' ? 
                  (trade.stop_loss - trade.entry_price) * trade.quantity : 
                  -(trade.stop_loss - trade.entry_price) * trade.quantity;
                
                const investment = (trade.quantity * trade.entry_price) / 100;
                const cappedLossPnl = Math.max(-investment, Math.min(0, lossPnl));

                let slExitPrice = trade.stop_loss;
                if (cappedLossPnl === -investment) {
                  slExitPrice = trade.type === 'buy' ?
                    trade.entry_price - (investment / trade.quantity) :
                    trade.entry_price + (investment / trade.quantity);
                }
                
                await closeTrade(trade.id, Number(slExitPrice.toFixed(asset.decimals)), Number(cappedLossPnl.toFixed(2)), 'stop_loss');
                continue;
              }
            }

            // Check take profit (only if set and configured in correct direction)
            if (trade.take_profit !== null) {
              const isTpValid = trade.type === 'buy' ? trade.take_profit > trade.entry_price : trade.take_profit < trade.entry_price;
              if (isTpValid && ((trade.type === 'buy' && lastPrice >= trade.take_profit) || 
                               (trade.type === 'sell' && lastPrice <= trade.take_profit))) {
                const profitPnl = trade.type === 'buy' ? 
                  (trade.take_profit - trade.entry_price) * trade.quantity : 
                  -(trade.take_profit - trade.entry_price) * trade.quantity;
                
                await closeTrade(trade.id, trade.take_profit, Number(profitPnl.toFixed(2)), 'take_profit');
                continue;
              }
            }

            // Check duration expiration
            if (trade.duration !== null) {
              const tradeTime = Math.floor(new Date(trade.created_at).getTime() / 1000);
              const elapsed = now - tradeTime;
              if (elapsed >= trade.duration) {
                await closeTrade(trade.id, lastPrice, Number(pnl.toFixed(2)), 'duration_expiry');
              }
            }
          } catch (tradeErr) {
            console.error(`Error evaluating trade ${trade.id} for closed asset ${asset.symbol}:`, tradeErr);
          }
        }
        latestPrices[asset.symbol] = lastPrice;
        continue;
      }

      // Volatility walk
      // Bias walk direction if there are active trades for this synthetic asset
      let bias = 0.5; // default center

      if (asset.category === 'synthetic' && tradesForAsset.length > 0) {
        const oldestTrade = tradesForAsset[0];
        if (oldestTrade.target_outcome === 'win') {
          // If buy, bias up (lower bias means positive walk)
          bias = oldestTrade.type === 'buy' ? 0.38 : 0.62;
        } else if (oldestTrade.target_outcome === 'lose') {
          // If buy, bias down (higher bias means negative walk)
          bias = oldestTrade.type === 'buy' ? 0.62 : 0.38;
        }
      }

      const volMultiplier = asset.category === 'synthetic' ? 2 : 1;
      const walk = (Math.random() - bias) * asset.spread * 3 * volMultiplier;
      const newPrice = Number((lastPrice + walk).toFixed(asset.decimals));

      // Update current price in Redis
      await redis.set(priceKey, newPrice.toString());
      latestPrices[asset.symbol] = newPrice;

      // Update both M1 and M5 candles list in Redis
      const candleM1 = await updateCandlesForInterval(asset.symbol, newPrice, asset.decimals, now, 60);
      const candleM5 = await updateCandlesForInterval(asset.symbol, newPrice, asset.decimals, now, 300);

      // Publish tick to client with both candle intervals
      publishTick(asset.symbol, newPrice, candleM1, candleM5);

      // Evaluate active trades for this asset
      for (const trade of tradesForAsset) {
        try {
          // Calculate current P&L
          let pnl = 0;
          const diff = newPrice - trade.entry_price;
          
          if (trade.type === 'buy') {
            pnl = diff * trade.quantity;
          } else {
            pnl = -diff * trade.quantity;
          }

          // Check stop loss
          if (trade.stop_loss !== null) {
            const isSlValid = trade.type === 'buy' ? trade.stop_loss < trade.entry_price : trade.stop_loss > trade.entry_price;
            if (isSlValid && ((trade.type === 'buy' && newPrice <= trade.stop_loss) || 
                             (trade.type === 'sell' && newPrice >= trade.stop_loss))) {
              const lossPnl = trade.type === 'buy' ? 
                (trade.stop_loss - trade.entry_price) * trade.quantity : 
                -(trade.stop_loss - trade.entry_price) * trade.quantity;
              
              // Protect balance by capping loss at initial investment
              const investment = (trade.quantity * trade.entry_price) / 100;
              const cappedLossPnl = Math.max(-investment, Math.min(0, lossPnl));

              let slExitPrice = trade.stop_loss;
              if (cappedLossPnl === -investment) {
                slExitPrice = trade.type === 'buy' ?
                  trade.entry_price - (investment / trade.quantity) :
                  trade.entry_price + (investment / trade.quantity);
              }
              
              await closeTrade(trade.id, Number(slExitPrice.toFixed(asset.decimals)), Number(cappedLossPnl.toFixed(2)), 'stop_loss');
              continue;
            }
          }

          // Check take profit
          if (trade.take_profit !== null) {
            const isTpValid = trade.type === 'buy' ? trade.take_profit > trade.entry_price : trade.take_profit < trade.entry_price;
            if (isTpValid && ((trade.type === 'buy' && newPrice >= trade.take_profit) || 
                             (trade.type === 'sell' && newPrice <= trade.take_profit))) {
              const profitPnl = trade.type === 'buy' ? 
                (trade.take_profit - trade.entry_price) * trade.quantity : 
                -(trade.take_profit - trade.entry_price) * trade.quantity;
              
              await closeTrade(trade.id, trade.take_profit, Number(profitPnl.toFixed(2)), 'take_profit');
              continue;
            }
          }

          // Check duration expiration
          if (trade.duration !== null) {
            const tradeTime = Math.floor(new Date(trade.created_at).getTime() / 1000);
            const elapsed = now - tradeTime;
            if (elapsed >= trade.duration) {
              await closeTrade(trade.id, newPrice, Number(pnl.toFixed(2)), 'duration_expiry');
            }
          }
        } catch (tradeErr) {
          console.error(`Error evaluating trade ${trade.id} for asset ${asset.symbol}:`, tradeErr);
        }
      }
    }

    // Evaluate stop-out (liquidation) for all active wallets using batched query
    const activeWallets = new Set<string>();
    activeTrades.forEach(t => activeWallets.add(t.wallet_id));
    const walletIds = Array.from(activeWallets);

    if (walletIds.length > 0) {
      try {
        const { data: wallets, error: walletsErr } = await supabaseAdmin
          .from('wallets')
          .select('id, balance')
          .in('id', walletIds);

        if (!walletsErr && wallets) {
          for (const wallet of wallets) {
            const walletId = wallet.id;
            const balance = Number(wallet.balance);
            let totalFloatingPnL = 0;
            const tradesForWallet = activeTrades.filter(t => t.wallet_id === walletId);

            for (const trade of tradesForWallet) {
              const asset = ASSETS.find(a => a.symbol === trade.asset);
              if (!asset) continue;

              // Use local in-memory latest prices instead of querying Redis
              const currentPrice = latestPrices[trade.asset] !== undefined 
                ? latestPrices[trade.asset] 
                : trade.entry_price;

              const diff = currentPrice - trade.entry_price;
              const pnl = trade.type === 'buy' ? diff * trade.quantity : -diff * trade.quantity;
              totalFloatingPnL += pnl;
            }

            const equity = balance + totalFloatingPnL;
            if (equity <= 0) {
              console.log(`[STOP-OUT] Liquidation triggered for wallet ${walletId}. Equity: ${equity.toFixed(2)}. Closing all active trades.`);
              
              // Close all trades for this wallet
              for (const trade of tradesForWallet) {
                const currentPrice = latestPrices[trade.asset] !== undefined 
                  ? latestPrices[trade.asset] 
                  : trade.entry_price;

                const diff = currentPrice - trade.entry_price;
                const pnl = trade.type === 'buy' ? diff * trade.quantity : -diff * trade.quantity;
                
                await closeTrade(trade.id, currentPrice, pnl, 'stop_out');
              }
            }
          }
        }
      } catch (err) {
        console.error("Error in batched stop-out evaluation:", err);
      }
    }

    // Schedule next tick loop to run sequentially
    const elapsed = Date.now() - startTime;
    const delay = Math.max(0, 1000 - elapsed);
    setTimeout(tick, delay);
  }

  // Start execution loop
  setTimeout(tick, 1000);
}
