import Fastify from 'fastify';
import websocketPlugin from '@fastify/websocket';
import { orderQueue } from './queue/orderQueue';
import { MockDexRouter } from './services/MockDexRouter';
import { v4 as uuidv4 } from 'uuid';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import type { FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';

const fastify = Fastify({ logger: true });
const dex = new MockDexRouter();

// Track WebSocket connections by orderId
const wsConnections = new Map<string, WebSocket>();

// Register WebSocket plugin
fastify.register(websocketPlugin);

// Health check
fastify.get('/', async () => ({ status: 'Order Execution Engine Running' }));

// ✅ Endpoint to submit new orders
fastify.post('/api/orders/execute', async (request, reply) => {
  const { tokenIn, tokenOut, amount } = request.body as any;

  if (!tokenIn || !tokenOut || !amount) {
    return reply.status(400).send({ error: 'Missing required fields' });
  }

  const orderId = uuidv4();
  await orderQueue.add(orderId, { orderId, tokenIn, tokenOut, amount });

  fastify.log.info(`🟢 Order received: ${orderId}`);
  return { orderId, message: 'Order submitted successfully' };
});

// ✅ WebSocket endpoint
// fastify.get('/ws', { websocket: true }, (connection: WebSocket, req: FastifyRequest) => {
//   connection.on('message', (msg: string | Buffer) => {
//     console.log(msg.toString());
//   });
// });

// ✅ Function to send WebSocket updates
function sendWsUpdate(orderId: string, status: string, data?: any) {
  const ws = wsConnections.get(orderId);

  if (!ws) {
    console.warn(`No WebSocket connection found for orderId: ${orderId}`);
    return;
  }

  // Ensure the socket is open before sending
  if (ws.readyState === ws.OPEN) { // 1 = OPEN
    ws.send(JSON.stringify({ orderId, status, ...data }));
  } else {
    console.warn(`WebSocket not open for orderId: ${orderId}`);
  }
}

// ✅ Redis connection
const connectionRedis = new IORedis({
  host: '127.0.0.1',
  port: 6379,
  maxRetriesPerRequest: null,
});

// ✅ Worker logic
// Start BullMQ worker
new Worker(
  'orders',
  async job => {
    const { orderId, tokenIn, tokenOut, amount } = job.data;
    console.log(`⚙️ Starting order processing: ${orderId}`);
    sendWsUpdate(orderId, 'pending');

    // Step 1: Routing
    sendWsUpdate(orderId, 'routing');
    const [raydiumQuote, meteoraQuote] = await Promise.all([
      dex.getRaydiumQuote(tokenIn, tokenOut, amount),
      dex.getMeteoraQuote(tokenIn, tokenOut, amount),
    ]);
    const chosenDex =
      raydiumQuote.price > meteoraQuote.price ? 'Raydium' : 'Meteora';
    console.log(`📊 Best route for ${orderId}: ${chosenDex}`);
    sendWsUpdate(orderId, 'routing', { quotes: [raydiumQuote, meteoraQuote], chosenDex });

    // Step 2: Building transaction
    sendWsUpdate(orderId, 'building');

    // Step 3: Submit transaction
    sendWsUpdate(orderId, 'submitted');
    const { txHash, executedPrice } = await dex.executeSwap(chosenDex, tokenIn, tokenOut, amount);

    // Step 4: Confirmed
    sendWsUpdate(orderId, 'confirmed', { txHash, executedPrice });
    console.log(`✅ Order confirmed: ${orderId} | ${txHash} | Executed Price ${executedPrice}`);

    return { txHash, executedPrice, chosenDex };
  },
  { connection: connectionRedis }
);

// Simple delay helper
function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

// ✅ Start Fastify server
const PORT = 3001;
fastify.listen({ port: PORT }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`🚀 Server running at ${address}`);
});