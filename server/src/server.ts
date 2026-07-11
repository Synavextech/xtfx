import fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import path from 'path';
import uWS from 'uWebSockets.js';
import Redis from 'ioredis';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth';
import walletRoutes from './routes/wallet';
import tradeRoutes from './routes/trades';
import p2pRoutes from './routes/p2p';
import adminRoutes from './routes/admin';
import insightsRoutes from './routes/insights';
import chatRoutes from './routes/chat';

// Import engine tasks
import { initRedisData, loadActiveTrades, startEngineTick, redis } from './engine';

dotenv.config();

const PORT = Number(process.env.PORT) || 5000;
const HOST = '0.0.0.0';

// 1. Initialize Fastify Server
const app = fastify({ logger: { level: 'info' } });

// Register cookies
app.register(cookie, {
  secret: process.env.JWT_SECRET || 'extreme_jwt_secret_2026_key_long_enough_to_be_secure',
  hook: 'onRequest'
});

// Register CORS
app.register(cors, {
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
});

// Register routes
app.register(authRoutes);
app.register(walletRoutes);
app.register(tradeRoutes);
app.register(p2pRoutes);
app.register(adminRoutes);
app.register(insightsRoutes);
app.register(chatRoutes);

// Serve Static Frontend Assets in Production
const distPath = path.resolve(__dirname, '../../dist');
app.register(fastifyStatic, {
  root: distPath,
  prefix: '/',
  wildcard: false // Handled manually below for SPA routing
});

// Fallback all non-API calls to index.html for React Router (SPA support)
app.setNotFoundHandler((request, reply) => {
  if (request.raw.url?.startsWith('/api')) {
    reply.code(404).send({ error: 'API Route Not Found' });
  } else {
    reply.sendFile('index.html');
  }
});


// 2. Initialize uWebSockets.js Server
const wsApp = uWS.App();

wsApp.ws('/*', {
  compression: uWS.SHARED_COMPRESSOR,
  maxPayloadLength: 16 * 1024 * 1024,
  idleTimeout: 15,
  open: (ws) => {
    console.log('WebSocket client connected to price feed');
  },
  message: (ws, message, isBinary) => {
    try {
      const data = JSON.parse(Buffer.from(message).toString());
      
      // Handle subscriptions
      if (data.action === 'subscribe') {
        // Subscribe to asset ticks
        ws.subscribe(`market/ticks/${data.asset}`);
        console.log(`WS Client subscribed to price: ${data.asset}`);
      } else if (data.action === 'unsubscribe') {
        ws.unsubscribe(`market/ticks/${data.asset}`);
        console.log(`WS Client unsubscribed from: ${data.asset}`);
      } else if (data.action === 'auth') {
        // Subscribe user to their personal account notifications (e.g. trades closed)
        ws.subscribe(`user/${data.userId}`);
        console.log(`WS Client authenticated for user channel: ${data.userId}`);
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  },
  drain: (ws) => {
    console.log('WS Client buffer overflow, backpressure: ' + ws.getBufferedAmount());
  },
  close: (ws, code, message) => {
    console.log('WebSocket client disconnected');
  }
});


// 3. Setup Redis Subscriber Client for Notifications and Ticks
const shouldRunEngine = process.env.RUN_ENGINE !== 'false';
const subRedis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

subRedis.subscribe('xfx:notifications', 'xfx:ticks');
subRedis.on('message', (channel, message) => {
  try {
    if (channel === 'xfx:ticks') {
      const data = JSON.parse(message);
      // Broadcast to specific asset channels
      wsApp.publish(`market/ticks/${data.symbol}`, message);
    } else if (channel === 'xfx:notifications') {
      const data = JSON.parse(message);
      // Publish user notifications directly to their authenticated WS topic
      wsApp.publish(`user/${data.userId}`, message);
    }
  } catch (err) {
    console.error('Redis subscriber message handle error:', err);
  }
});


// 4. Start Server Boot
async function start() {
  try {
    if (shouldRunEngine) {
      console.log('RUN_ENGINE is enabled on this node. Starting engine tasks...');
      // Boot memory pricing data
      await initRedisData();
      await loadActiveTrades();
    }

    // Start Fastify REST API
    await app.listen({ port: PORT, host: HOST });
    console.log(`Fastify Server is running on port ${PORT}`);

    // Start uWebSockets server only on the first instance in cluster mode
    const isPrimaryInstance = !process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0';
    if (isPrimaryInstance) {
      wsApp.listen(5001, (token) => {
        if (token) {
          console.log('uWebSockets.js high-frequency server listening on port 5001');
        } else {
          console.error('CRITICAL: Failed to bind uWebSockets.js to port 5001');
          process.exit(1);
        }
      });
    } else {
      console.log('uWebSockets.js server skipped for cluster worker: ' + process.env.NODE_APP_INSTANCE);
    }

    if (shouldRunEngine) {
      // Start pricing simulation ticks and publish to Redis
      startEngineTick(async (symbol, price, candleM1, candleM5) => {
        const tickData = JSON.stringify({
          type: 'tick',
          symbol,
          price,
          candleM1,
          candleM5
        });
        await redis.publish('xfx:ticks', tickData);
      });
    }

  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
