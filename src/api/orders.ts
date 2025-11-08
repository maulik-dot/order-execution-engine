import { FastifyInstance } from 'fastify';
import { orderQueue } from '../queue/orderQueue';
import { v4 as uuidv4 } from 'uuid';

export async function orderRoutes(fastify: FastifyInstance) {
  fastify.post('/api/orders/execute', async (request, reply) => {
    const { tokenIn, tokenOut, amount } = request.body as any;

    if (!tokenIn || !tokenOut || !amount) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    const orderId = uuidv4();
    await orderQueue.add(orderId, { tokenIn, tokenOut, amount });

    return { orderId };
  });
}