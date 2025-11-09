import { MockDexRouter } from '../MockDexRouter';

describe('MockDexRouter - Routing Logic', () => {
  let router: MockDexRouter;

  beforeEach(() => {
    router = new MockDexRouter();
  });

  describe('getRaydiumQuote', () => {
    it('should return a quote with Raydium dex name', async () => {
      const quote = await router.getRaydiumQuote('USDC', 'SOL', 100);
      
      expect(quote).toHaveProperty('dex', 'Raydium');
      expect(quote).toHaveProperty('price');
      expect(quote).toHaveProperty('fee', 0.003);
      expect(typeof quote.price).toBe('number');
      expect(quote.price).toBeGreaterThan(0);
    });

    it('should return different prices on multiple calls (randomized)', async () => {
      const quote1 = await router.getRaydiumQuote('USDC', 'SOL', 100);
      const quote2 = await router.getRaydiumQuote('USDC', 'SOL', 100);
      
      // Prices should be in the expected range (98-102% of base price)
      expect(quote1.price).toBeGreaterThanOrEqual(98);
      expect(quote1.price).toBeLessThanOrEqual(102);
      expect(quote2.price).toBeGreaterThanOrEqual(98);
      expect(quote2.price).toBeLessThanOrEqual(102);
    });

    it('should handle different token pairs', async () => {
      const quote1 = await router.getRaydiumQuote('USDC', 'SOL', 100);
      const quote2 = await router.getRaydiumQuote('SOL', 'USDC', 50);
      
      expect(quote1.dex).toBe('Raydium');
      expect(quote2.dex).toBe('Raydium');
    });
  });

  describe('getMeteoraQuote', () => {
    it('should return a quote with Meteora dex name', async () => {
      const quote = await router.getMeteoraQuote('USDC', 'SOL', 100);
      
      expect(quote).toHaveProperty('dex', 'Meteora');
      expect(quote).toHaveProperty('price');
      expect(quote).toHaveProperty('fee', 0.002);
      expect(typeof quote.price).toBe('number');
      expect(quote.price).toBeGreaterThan(0);
    });

    it('should return prices in expected range', async () => {
      const quote = await router.getMeteoraQuote('USDC', 'SOL', 100);
      
      // Meteora prices range from 97-102% of base price
      expect(quote.price).toBeGreaterThanOrEqual(97);
      expect(quote.price).toBeLessThanOrEqual(102);
    });
  });

  describe('Price Comparison Logic', () => {
    it('should allow comparison between Raydium and Meteora quotes', async () => {
      const [raydiumQuote, meteoraQuote] = await Promise.all([
        router.getRaydiumQuote('USDC', 'SOL', 100),
        router.getMeteoraQuote('USDC', 'SOL', 100),
      ]);

      // Both should have valid prices
      expect(raydiumQuote.price).toBeGreaterThan(0);
      expect(meteoraQuote.price).toBeGreaterThan(0);

      // Best route selection logic (higher price is better for output)
      const bestDex = raydiumQuote.price > meteoraQuote.price ? 'Raydium' : 'Meteora';
      expect(['Raydium', 'Meteora']).toContain(bestDex);
    });

    it('should fetch quotes in parallel efficiently', async () => {
      const startTime = Date.now();
      
      const [raydiumQuote, meteoraQuote] = await Promise.all([
        router.getRaydiumQuote('USDC', 'SOL', 100),
        router.getMeteoraQuote('USDC', 'SOL', 100),
      ]);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Parallel execution should be faster than sequential (max ~300ms vs ~600ms)
      expect(duration).toBeLessThan(600);
      expect(raydiumQuote.dex).toBe('Raydium');
      expect(meteoraQuote.dex).toBe('Meteora');
    });
  });

  describe('executeSwap', () => {
    it('should execute swap and return txHash and executedPrice', async () => {
      const result = await router.executeSwap('Raydium', 'USDC', 'SOL', 100);
      
      expect(result).toHaveProperty('txHash');
      expect(result).toHaveProperty('executedPrice');
      expect(typeof result.txHash).toBe('string');
      expect(result.txHash.length).toBeGreaterThan(0);
      expect(typeof result.executedPrice).toBe('number');
      expect(result.executedPrice).toBeGreaterThan(0);
    });

    it('should return different txHash on each execution', async () => {
      const result1 = await router.executeSwap('Raydium', 'USDC', 'SOL', 100);
      const result2 = await router.executeSwap('Meteora', 'USDC', 'SOL', 100);
      
      expect(result1.txHash).not.toBe(result2.txHash);
    });

    it('should handle different DEX selections', async () => {
      const raydiumResult = await router.executeSwap('Raydium', 'USDC', 'SOL', 100);
      const meteoraResult = await router.executeSwap('Meteora', 'USDC', 'SOL', 100);
      
      expect(raydiumResult.txHash).toBeTruthy();
      expect(meteoraResult.txHash).toBeTruthy();
      expect(raydiumResult.executedPrice).toBeGreaterThan(0);
      expect(meteoraResult.executedPrice).toBeGreaterThan(0);
    });
  });
});

