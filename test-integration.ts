/**
 * Integration test for B20 Scanner data sources
 * Run with: npx tsx test-integration.ts
 */

import { 
  getB20TokensFromFactory, 
  getB20TokensWithMetadata,
  fetchB20TokensFromThirdParty 
} from "./lib/b20-factory";

import { 
  fetchTokenMarketData, 
  batchFetchMarketData 
} from "./lib/market-data";

import { getDataSourceStatus } from "./lib/data-sources";

async function testFactoryIntegration() {
  console.log("🧪 Testing Factory Integration...");
  
  try {
    // Test basic factory token discovery
    const tokens = await getB20TokensFromFactory(10);
    console.log(`✅ Factory discovery: Found ${tokens.length} tokens`);
    
    if (tokens.length > 0) {
      console.log(`   First token: ${tokens[0].address}`);
    }
    
    // Test with metadata
    const tokensWithMetadata = await getB20TokensWithMetadata(5);
    console.log(`✅ Factory with metadata: Found ${tokensWithMetadata.length} tokens`);
    
    if (tokensWithMetadata.length > 0) {
      const token = tokensWithMetadata[0];
      console.log(`   Token: ${token.name} (${token.symbol})`);
      console.log(`   Address: ${token.address}`);
      console.log(`   Variant: ${token.variant}`);
      console.log(`   Total Supply: ${token.totalSupply.toString()}`);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Factory integration failed: ${error}`);
    return false;
  }
}

async function testThirdPartyIntegration() {
  console.log("\n🧪 Testing Third-Party Integration...");
  
  try {
    const tokens = await fetchB20TokensFromThirdParty(10);
    console.log(`✅ Third-party discovery: Found ${tokens.length} tokens`);
    
    if (tokens.length > 0) {
      console.log(`   First token: ${tokens[0].name} (${tokens[0].symbol})`);
      console.log(`   Address: ${tokens[0].address}`);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Third-party integration failed: ${error}`);
    return false;
  }
}

async function testMarketDataIntegration() {
  console.log("\n🧪 Testing Market Data Integration...");
  
  try {
    // Test with a known B20 token address (using a placeholder)
    // In production, replace with actual B20 token addresses
    const testAddresses = [
      "0xB20f000000000000000000000000000000000000", // Placeholder
    ];
    
    console.log("   Testing single token market data...");
    const marketData = await fetchTokenMarketData(testAddresses[0]);
    console.log(`✅ Single token market data fetched`);
    console.log(`   Price: ${marketData.priceUsd ?? "N/A"}`);
    console.log(`   Market Cap: ${marketData.marketCap ?? "N/A"}`);
    console.log(`   Sources: ${marketData.sourcePriority.join(", ")}`);
    
    console.log("   Testing batch market data...");
    const batchData = await batchFetchMarketData(testAddresses, {}, 2);
    console.log(`✅ Batch market data fetched: ${batchData.size} tokens`);
    
    return true;
  } catch (error) {
    console.error(`❌ Market data integration failed: ${error}`);
    return false;
  }
}

async function testDataSourceStatus() {
  console.log("\n🧪 Testing Data Source Status...");
  
  try {
    const status = getDataSourceStatus();
    console.log("✅ Data source status:");
    
    for (const [sourceId, { available, reason }] of Object.entries(status)) {
      const statusIcon = available ? "✅" : "❌";
      const statusText = available ? "Available" : `Unavailable: ${reason}`;
      console.log(`   ${statusIcon} ${sourceId}: ${statusText}`);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Data source status failed: ${error}`);
    return false;
  }
}

async function runAllTests() {
  console.log("🚀 Starting B20 Scanner Integration Tests\n");
  console.log("=".repeat(50));
  
  const results = {
    factory: await testFactoryIntegration(),
    thirdParty: await testThirdPartyIntegration(),
    marketData: await testMarketDataIntegration(),
    dataSourceStatus: await testDataSourceStatus(),
  };
  
  console.log("\n" + "=".repeat(50));
  console.log("📊 Test Results:");
  console.log("=".repeat(50));
  
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  
  for (const [testName, passedTest] of Object.entries(results)) {
    const icon = passedTest ? "✅" : "❌";
    console.log(`   ${icon} ${testName}: ${passedTest ? "PASSED" : "FAILED"}`);
  }
  
  console.log("=".repeat(50));
  console.log(`🎯 Overall: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log("🎉 All tests passed! Integration is working correctly.");
    process.exit(0);
  } else {
    console.log("⚠️  Some tests failed. Check the error messages above.");
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error("❌ Test execution failed:", error);
    process.exit(1);
  });
}

export { 
  testFactoryIntegration, 
  testThirdPartyIntegration, 
  testMarketDataIntegration,
  testDataSourceStatus,
  runAllTests 
};
