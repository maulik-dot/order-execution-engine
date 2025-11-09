// Test setup file
// This file runs before all tests

// Increase timeout for integration tests
jest.setTimeout(30000);

// Clean up after all tests
afterAll(async () => {
  // Give time for cleanup
  await new Promise(resolve => setTimeout(resolve, 1000));
});

