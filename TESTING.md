# Testing Guide

This document describes the test suite for the Order Execution Engine.

## Test Coverage

The project includes **25+ tests** covering:

### 1. Routing Logic Tests (10 tests)
**File**: `src/services/__tests__/MockDexRouter.test.ts`

- ✅ Raydium quote generation and validation
- ✅ Meteora quote generation and validation  
- ✅ Price range validation
- ✅ Parallel quote fetching
- ✅ Price comparison logic
- ✅ Best route selection
- ✅ Swap execution
- ✅ Transaction hash generation

### 2. Queue Behavior Tests (5 tests)
**File**: `src/queue/__tests__/orderQueue.test.ts`

- ✅ Order addition to queue
- ✅ Concurrent order handling
- ✅ Order data preservation
- ✅ Queue persistence
- ✅ Multiple order processing

### 3. WebSocket Lifecycle Tests (6 tests)
**File**: `src/__tests__/websocket.test.ts`

- ✅ WebSocket connection establishment
- ✅ Welcome message reception
- ✅ Error handling (missing orderId)
- ✅ Message handling
- ✅ Connection close handling
- ✅ Status update format validation

### 4. Integration Tests (4 tests)
**File**: `src/__tests__/integration.test.ts`

- ✅ End-to-end order submission
- ✅ Error handling for missing fields
- ✅ Complete order lifecycle with WebSocket
- ✅ Routing integration

## Running Tests

### Install Dependencies
```bash
npm install
```

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

## Test Requirements

### Prerequisites
- **Redis** must be running on `localhost:6379`
- For WebSocket tests, the server should be running (tests handle connection failures gracefully)

### Test Environment
- Tests use a separate test queue to avoid conflicts
- Integration tests run on port 3002 to avoid conflicts with main server
- Tests include proper cleanup and teardown

## Postman/Insomnia Collection

A Postman collection is available at `postman_collection.json` with the following requests:

1. **Health Check** - `GET /`
2. **Submit Order** - `POST /api/orders/execute`
3. **Submit Order (Error Case)** - Missing fields validation
4. **WebSocket Connection** - `ws://localhost:3001/ws?orderId={orderId}`
5. **WebSocket Connection (Error Case)** - Missing orderId

### Importing the Collection

**Postman:**
1. Open Postman
2. Click "Import"
3. Select `postman_collection.json`
4. Collection will be imported with all requests

**Insomnia:**
1. Open Insomnia
2. Click "Create" → "Import/Export" → "Import Data"
3. Select "From File"
4. Choose `postman_collection.json`

### Using the Collection

1. Set the `baseUrl` variable to your server URL (default: `http://localhost:3001`)
2. For WebSocket requests, use a WebSocket client or Insomnia's WebSocket support
3. For order submission, the `orderId` will be returned in the response - use this for WebSocket connection

## Test Statistics

- **Total Tests**: 25+
- **Unit Tests**: 15
- **Integration Tests**: 10
- **Coverage Areas**:
  - Routing Logic: ✅ Complete
  - Queue Behavior: ✅ Complete
  - WebSocket Lifecycle: ✅ Complete
  - End-to-End Flow: ✅ Complete

## Notes

- Some WebSocket tests may be skipped if the server is not running (graceful handling)
- Queue tests require Redis to be running
- Integration tests create a temporary server instance for testing

