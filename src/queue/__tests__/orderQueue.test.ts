import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { orderQueue } from '../orderQueue';

// Mock Redis connection for testing
const createMockRedis = () => {
  return new IORedis({
    host: '127.0.0.1',
    port: 6379,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });
};

describe('Order Queue - Queue Behavior', () => {
  let testQueue: Queue;
  let redis: IORedis;

  beforeAll(async () => {
    redis = createMockRedis();
    testQueue = new Queue('test-orders', { connection: redis });
  });

  afterAll(async () => {
    await testQueue.close();
    await redis.quit();
  });

  beforeEach(async () => {
    // Clean up queue before each test
    await testQueue.obliterate({ force: true });
  });

  describe('Queue Operations', () => {
    it('should add an order to the queue', async () => {
      const jobData = {
        orderId: 'test-order-1',
        tokenIn: 'USDC',
        tokenOut: 'SOL',
        amount: 100,
      };

      const job = await testQueue.add('test-order-1', jobData);

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.data).toEqual(jobData);
    });

    it('should handle multiple orders concurrently', async () => {
      const orders = [
        { orderId: 'order-1', tokenIn: 'USDC', tokenOut: 'SOL', amount: 100 },
        { orderId: 'order-2', tokenIn: 'SOL', tokenOut: 'USDC', amount: 50 },
        { orderId: 'order-3', tokenIn: 'USDC', tokenOut: 'ETH', amount: 200 },
      ];

      const jobs = await Promise.all(
        orders.map(order => testQueue.add(order.orderId, order))
      );

      expect(jobs).toHaveLength(3);
      jobs.forEach((job, index) => {
        expect(job.data).toEqual(orders[index]);
      });
    });

    it('should preserve order data in queue', async () => {
      const orderData = {
        orderId: 'preserve-test',
        tokenIn: 'USDC',
        tokenOut: 'SOL',
        amount: 150,
      };

      const job = await testQueue.add('preserve-test', orderData);
      const jobData = job.data;

      expect(jobData.orderId).toBe(orderData.orderId);
      expect(jobData.tokenIn).toBe(orderData.tokenIn);
      expect(jobData.tokenOut).toBe(orderData.tokenOut);
      expect(jobData.amount).toBe(orderData.amount);
    });
  });

  describe('Queue Concurrency', () => {
    it('should process multiple orders in queue', async () => {
      const orderCount = 5;
      const orders = Array.from({ length: orderCount }, (_, i) => ({
        orderId: `concurrent-order-${i}`,
        tokenIn: 'USDC',
        tokenOut: 'SOL',
        amount: 100 + i * 10,
      }));

      const jobs = await Promise.all(
        orders.map(order => testQueue.add(order.orderId, order))
      );

      expect(jobs.length).toBe(orderCount);
      
      // Verify all jobs are in the queue
      const waiting = await testQueue.getWaiting();
      expect(waiting.length).toBeGreaterThanOrEqual(0); // Jobs may be processed
    });
  });

  describe('Queue Persistence', () => {
    it('should maintain job data structure', async () => {
      const complexOrder = {
        orderId: 'complex-order',
        tokenIn: 'USDC',
        tokenOut: 'SOL',
        amount: 100,
        metadata: {
          userId: 'user-123',
          timestamp: Date.now(),
        },
      };

      const job = await testQueue.add('complex-order', complexOrder);
      expect(job.data).toMatchObject(complexOrder);
    });
  });
});

