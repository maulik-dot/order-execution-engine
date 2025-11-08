import { v4 as uuidv4 } from 'uuid';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class MockDexRouter {
  private basePrice = 100; // example price for testing

  async getRaydiumQuote(tokenIn: string, tokenOut: string, amount: number) {
    await sleep(200 + Math.random() * 100); // simulate network delay
    const price = this.basePrice * (0.98 + Math.random() * 0.04);
    return { dex: 'Raydium', price, fee: 0.003 };
  }

  async getMeteoraQuote(tokenIn: string, tokenOut: string, amount: number) {
    await sleep(200 + Math.random() * 100);
    const price = this.basePrice * (0.97 + Math.random() * 0.05);
    return { dex: 'Meteora', price, fee: 0.002 };
  }

  async executeSwap(chosenDex: string, tokenIn: string, tokenOut: string, amount: number) {
    await sleep(2000 + Math.random() * 1000); // simulate swap execution
    const executedPrice = this.basePrice * (0.98 + Math.random() * 0.04);
    return { txHash: uuidv4(), executedPrice };
  }
}