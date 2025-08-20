// Quick test to verify validation logic
import { validateOrderQuantity } from './src/lib/utils.js';

// Mock BTCUSDT symbol info with real constraints
const btcUsdtInfo = {
  symbol: 'BTCUSDT',
  status: 'TRADING',
  baseAsset: 'BTC',
  quoteAsset: 'USDT',
  baseAssetPrecision: 8,
  quoteAssetPrecision: 8,
  orderTypes: ['LIMIT', 'MARKET'],
  filters: [
    {
      filterType: 'LOT_SIZE',
      minQty: '0.00001000',
      maxQty: '9000.00000000',
      stepSize: '0.00001000'
    }
  ]
};

console.log('Testing LOT_SIZE validation...');

// Test case 1: Quantity too small (should fail)
const test1 = validateOrderQuantity(0.000001, btcUsdtInfo);
console.log('Test 1 (too small):', test1);

// Test case 2: Valid quantity (should pass)
const test2 = validateOrderQuantity(0.00001, btcUsdtInfo);
console.log('Test 2 (valid):', test2);

// Test case 3: Invalid step size (should fail)
const test3 = validateOrderQuantity(0.000015, btcUsdtInfo);
console.log('Test 3 (invalid step):', test3);

// Test case 4: Exact minimum (should pass)
const test4 = validateOrderQuantity(0.00001000, btcUsdtInfo);
console.log('Test 4 (exact min):', test4);

console.log('All tests completed!');
