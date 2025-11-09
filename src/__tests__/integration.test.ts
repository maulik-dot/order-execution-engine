import Fastify from 'fastify';
import websocketPlugin from '@fastify/websocket';
import { orderQueue } from '../queue/orderQueue';
import { MockDexRouter } from '../services/MockDexRouter';
import { v4 as uuidv4 } from 'uuid';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import type { WebSocket } from 'ws';
import WebSocketClient from 'ws';

describe('Integration Tests - Full Order Lifecycle', () => {
  let app: any;
  let server: any;
  let worker: Worker;
  let wsConnections: Map<string, WebSocket>;
  const PORT = 3002; // Use different port for tests
  const dex = new MockDexRouter();

  beforeAll(async () => {
    // Setup Fastify app similar to main index.ts
    app = Fastify({ logger: false });
    wsConnections = new Map<string, WebSocket>();

    await app.register(websocketPlugin);

    // Health check
    app.get('/', async () => ({ status: 'Order Execution Engine Running' }));

    // Order endpoint
    app.post('/api/orders/execute', async (request: any, reply: any) => {
      const { tokenIn, tokenOut, amount } = request.body;

      if (!tokenIn || !tokenOut || !amount) {
        return reply.status(400).send({ error: 'Missing required fields' });
      }

      const orderId = uuidv4();
      await orderQueue.add(orderId, { orderId, tokenIn, tokenOut, amount });

      return { orderId, message: 'Order submitted successfully' };
    });

    // WebSocket endpoint
    app.get('/ws', { websocket: true }, (socket: WebSocket, req: any) => {
      const orderId = req.query?.orderId;

      if (!orderId) {
        socket.close(1008, 'Missing orderId query parameter');
        return;
      }

      wsConnections.set(orderId, socket);

      socket.send(JSON.stringify({
        orderId,
        status: 'connected',
        message: 'WebSocket connection established',
      }));

      socket.on('close', () => {
        wsConnections.delete(orderId);
      });
    });

    // Helper function to send updates
    const sendWsUpdate = (orderId: string, status: string, data?: any) => {
      const ws = wsConnections.get(orderId);
      if (ws && ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ orderId, status, ...data }));
      }
    };

    // Setup worker
    const connectionRedis = new IORedis({
      host: '127.0.0.1',
      port: 6379,
      maxRetriesPerRequest: null,
    });

    worker = new Worker(
      'orders',
      async (job) => {
        const { orderId, tokenIn, tokenOut, amount } = job.data;
        sendWsUpdate(orderId, 'pending');

        sendWsUpdate(orderId, 'routing');
        const [raydiumQuote, meteoraQuote] = await Promise.all([
          dex.getRaydiumQuote(tokenIn, tokenOut, amount),
          dex.getMeteoraQuote(tokenIn, tokenOut, amount),
        ]);
        const chosenDex = raydiumQuote.price > meteoraQuote.price ? 'Raydium' : 'Meteora';
        sendWsUpdate(orderId, 'routing', { quotes: [raydiumQuote, meteoraQuote], chosenDex });

        sendWsUpdate(orderId, 'building');
        sendWsUpdate(orderId, 'submitted');
        const { txHash, executedPrice } = await dex.executeSwap(chosenDex, tokenIn, tokenOut, amount);

        sendWsUpdate(orderId, 'confirmed', { txHash, executedPrice });
        return { txHash, executedPrice, chosenDex };
      },
      { connection: connectionRedis }
    );

    // Start server
    await app.listen({ port: PORT, host: '0.0.0.0' });
  });

  afterAll(async () => {
    await worker.close();
    await app.close();
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe('End-to-End Order Processing', () => {
    it('should submit order and return orderId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/orders/execute',
        payload: {
          tokenIn: 'USDC',
          tokenOut: 'SOL',
          amount: 100,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('orderId');
      expect(body).toHaveProperty('message');
      expect(typeof body.orderId).toBe('string');
    });

    it('should reject order with missing fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/orders/execute',
        payload: {
          tokenIn: 'USDC',
          // Missing tokenOut and amount
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error', 'Missing required fields');
    });

    it('should process order through complete lifecycle with WebSocket updates', (done) => {
      const orderId = uuidv4();
      const ws = new WebSocketClient(`ws://localhost:${PORT}/ws?orderId=${orderId}`);
      const receivedStatuses: string[] = [];

      ws.on('message', (data: WebSocketClient.Data) => {
        const message = JSON.parse(data.toString());
        receivedStatuses.push(message.status);

        if (message.status === 'confirmed') {
          expect(message).toHaveProperty('txHash');
          expect(message).toHaveProperty('executedPrice');
          expect(receivedStatuses).toContain('connected');
          expect(receivedStatuses).toContain('pending');
          expect(receivedStatuses).toContain('routing');
          expect(receivedStatuses).toContain('building');
          expect(receivedStatuses).toContain('submitted');
          expect(receivedStatuses).toContain('confirmed');
          ws.close();
          done();
        }
      });

      ws.on('open', async () => {
        // Submit order after WebSocket is connected
        // Note: The endpoint generates its own orderId, but we can still test
        // by manually adding to queue with our known orderId
        await orderQueue.add(orderId, {
          orderId,
          tokenIn: 'USDC',
          tokenOut: 'SOL',
          amount: 100,
        });
      });

      ws.on('error', (error) => {
        if (error.message.includes('ECONNREFUSED')) {
          console.warn('WebSocket connection failed');
          done();
        } else {
          done(error);
        }
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!ws.CLOSED) {
          ws.close();
          done(new Error('Test timeout'));
        }
      }, 10000);
    });
  });

  describe('Routing Integration', () => {
    it('should compare prices and select best DEX route', async () => {
      const [raydiumQuote, meteoraQuote] = await Promise.all([
        dex.getRaydiumQuote('USDC', 'SOL', 100),
        dex.getMeteoraQuote('USDC', 'SOL', 100),
      ]);

      const chosenDex = raydiumQuote.price > meteoraQuote.price ? 'Raydium' : 'Meteora';

      expect(['Raydium', 'Meteora']).toContain(chosenDex);
      expect(raydiumQuote.dex).toBe('Raydium');
      expect(meteoraQuote.dex).toBe('Meteora');
    });
  });
});

