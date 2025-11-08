import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// Redis connection for BullMQ
const connection = new IORedis({
  host: '127.0.0.1',
  port: 6379,
  maxRetriesPerRequest: null, // <-- required by BullMQ
});

export const orderQueue = new Queue('orders', { connection });