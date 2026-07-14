import dotenv from 'dotenv';
import { initRedisData, loadActiveTrades, startEngineTick, redis } from './engine';

dotenv.config();

async function run() {
  console.log("Starting Xfx Pricing and Trade Execution Engine Daemon...");

  try {
    // 1. Initialize historical prices and candles in Redis
    await initRedisData();

    // 2. Load open trades from Supabase
    await loadActiveTrades();

    // 3. Start simulation tick loop
    startEngineTick(async (symbol, price, candleM1, candleM5) => {
      const tickData = JSON.stringify({
        type: 'tick',
        symbol,
        price,
        candleM1,
        candleM5
      });
      // Publish tick data to Redis channel for API nodes to broadcast
      await redis.publish('xfx:ticks', tickData);
    });

    console.log("Xfx Engine Daemon started and running successfully.");
  } catch (err: any) {
    console.error("FATAL: Failed to start Xfx Engine Daemon:", err.message);
    process.exit(1);
  }
}

// Handle shutdown cleanly
process.on('SIGINT', () => {
  console.log("Shutting down Engine Daemon...");
  process.exit(0);
});

run();
