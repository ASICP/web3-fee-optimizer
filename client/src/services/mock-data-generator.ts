// =============================================================================
// FILE: src/services/mock-data-generator.ts
// Web3 Fee Optimizer - Mock Data Generator for Testing
// =============================================================================

import type { GasPriceData, DEXRoute, L2Option, TradeRequest } from '../types/api.types';

export class MockDataGenerator {
  /**
   * Generate random number between min and max
   */
  private static randomBetween(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  /**
   * Generate random integer between min and max
   */
  private static randomInt(min: number, max: number): number {
    return Math.floor(this.randomBetween(min, max));
  }

  /**
   * Generate mock gas price data with realistic forecasts
   * @param baseGwei - Base gas price in gwei (default: 30)
   * @returns Array of gas price data from multiple sources
   */
  static generateGasData(baseGwei: number = 30): GasPriceData[] {
    const sources = ['Blocknative', 'Infura', 'EthGasStation'];
    
    return sources.map(source => {
      // Add variance to make each source slightly different
      const variance = this.randomBetween(0.9, 1.1);
      const currentGwei = baseGwei * variance;
      
      return {
        source,
        timestamp: Date.now(),
        currentGwei,
        fast: currentGwei * 1.2,
        standard: currentGwei,
        safe: currentGwei * 0.8,
        baseFee: currentGwei * 0.7,
        priorityFee: currentGwei * 0.3,
        forecast: {
          nextBlock: currentGwei * 0.95,
          next5Blocks: Array.from({ length: 5 }, (_, i) => 
            currentGwei * (0.95 - (i * 0.03)) // Gradual decrease
          ),
          confidence: this.randomBetween(0.7, 0.95),
        },
      };
    });
  }

  /**
   * Generate mock DEX route data with realistic pricing
   * @param request - Trade request parameters
   * @returns Array of DEX routes from multiple aggregators
   */
  static generateDEXRoutes(request: TradeRequest): DEXRoute[] {
    const dexes = [
      { name: '1inch', protocols: ['Uniswap V3', 'Sushiswap', 'Curve'] },
      { name: 'ParaSwap', protocols: ['Uniswap V2', 'Balancer', '0x'] },
      { name: 'CoWSwap', protocols: ['CoW Protocol'] },
    ];

    const amountIn = parseFloat(request.amount);
    
    return dexes.map(dex => {
      // Generate realistic price impact (0.1% - 2.5%)
      const priceImpact = this.randomBetween(0.1, 2.5);
      const slippageFactor = 1 - (priceImpact / 100);
      
      // Assume ETH to USDC conversion at ~$2000 per ETH
      const amountOut = (amountIn * 2000 * slippageFactor).toString();
      
      // Gas estimate varies by protocol complexity
      const gasEstimate = this.randomInt(150000, 250000);
      const gasPrice = 30; // gwei
      const networkFee = (gasEstimate * gasPrice) / 1e9;
      
      return {
        source: dex.name,
        route: {
          fromToken: request.fromToken,
          toToken: request.toToken,
          amountIn: request.amount,
          amountOut,
          priceImpact,
          gasEstimate,
          protocols: [dex.protocols[this.randomInt(0, dex.protocols.length)]],
        },
        fees: {
          platformFee: dex.name === 'CoWSwap' ? 0 : this.randomBetween(0, 1),
          networkFee,
          totalFeeUSD: networkFee * 2000, // Convert ETH to USD
        },
      };
    });
  }

  /**
   * Generate mock L2 routing options
   * @param request - Trade request with target chain
   * @returns Array of L2 bridge options
   */
  static generateL2Options(request: TradeRequest): L2Option[] {
    // Only generate L2 options if cross-chain is specified
    if (!request.toChain || request.toChain === request.fromChain) {
      return [];
    }

    const l2Networks = [
      { name: 'Arbitrum', bridgeTime: 10, costMultiplier: 0.05 },
      { name: 'Optimism', bridgeTime: 15, costMultiplier: 0.06 },
      { name: 'Polygon', bridgeTime: 20, costMultiplier: 0.02 },
      { name: 'Base', bridgeTime: 8, costMultiplier: 0.04 },
      { name: 'zkSync', bridgeTime: 12, costMultiplier: 0.03 },
    ];

    const l1Cost = 22.5; // Approximate L1 transaction cost in USD

    return l2Networks.map(network => {
      const bridgeCost = l1Cost * network.costMultiplier;
      const totalCostUSD = bridgeCost + this.randomBetween(0.5, 2);
      
      return {
        source: `LI.FI-${network.name}`,
        fromChain: request.fromChain,
        toChain: network.name.toLowerCase(),
        bridgeCost,
        bridgeTime: network.bridgeTime,
        totalCostUSD,
        savings: l1Cost - totalCostUSD,
      };
    });
  }

  /**
   * Generate complete mock quote with all data sources
   * @param request - Trade request parameters
   * @returns Complete quote data
   */
  static generateCompleteQuote(request: TradeRequest) {
    return {
      gasData: this.generateGasData(),
      dexRoutes: this.generateDEXRoutes(request),
      l2Options: this.generateL2Options(request),
      timestamp: Date.now(),
    };
  }

  /**
   * Generate predefined scenarios for testing
   * @returns Object with various gas price scenarios
   */
  static generateScenarios() {
    return {
      lowGas: {
        name: 'Low Gas Period',
        description: 'Gas prices are low (15 gwei), good time to execute',
        gasData: this.generateGasData(15),
        recommendation: 'execute_now' as const,
      },
      highGas: {
        name: 'High Gas Period',
        description: 'Gas prices are high (80 gwei), consider waiting or L2',
        gasData: this.generateGasData(80),
        recommendation: 'wait' as const,
      },
      moderateGas: {
        name: 'Moderate Gas Period',
        description: 'Normal gas prices (35 gwei), proceed as needed',
        gasData: this.generateGasData(35),
        recommendation: 'execute_now' as const,
      },
      veryHighGas: {
        name: 'Very High Gas Period',
        description: 'Extremely high gas (150 gwei), strongly recommend L2',
        gasData: this.generateGasData(150),
        recommendation: 'use_l2' as const,
      },
      volatileGas: {
        name: 'Volatile Gas Period',
        description: 'Gas prices fluctuating rapidly',
        gasData: this.generateGasData(this.randomInt(20, 100)),
        recommendation: 'wait' as const,
      },
    };
  }

  /**
   * Generate historical gas price data for charting
   * @param hours - Number of hours of history to generate
   * @param baseGwei - Base gas price
   * @returns Array of historical gas price points
   */
  static generateHistoricalGasData(hours: number = 24, baseGwei: number = 30) {
    const dataPoints: Array<{ timestamp: number; gwei: number }> = [];
    const now = Date.now();
    const msPerHour = 3600000;

    for (let i = hours; i >= 0; i--) {
      const timestamp = now - (i * msPerHour);
      // Add some wave pattern to make it look realistic
      const wave = Math.sin(i / 4) * 10;
      const noise = this.randomBetween(-5, 5);
      const gwei = Math.max(10, baseGwei + wave + noise);
      
      dataPoints.push({ timestamp, gwei });
    }

    return dataPoints;
  }

  /**
   * Generate mock transaction history for user
   * @param count - Number of transactions to generate
   * @returns Array of mock transactions
   */
  static generateTransactionHistory(count: number = 10) {
    const tokens = [
      { symbol: 'ETH', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' },
      { symbol: 'USDC', address: '0xA0b86a33E6441e1ba4ee5e45b1230E90' },
      { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
      { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F' },
      { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' },
    ];

    const statuses = ['completed', 'pending', 'failed'];
    const now = Date.now();

    return Array.from({ length: count }, (_, i) => {
      const fromToken = tokens[this.randomInt(0, tokens.length)];
      let toToken = tokens[this.randomInt(0, tokens.length)];
      
      // Ensure from and to tokens are different
      while (toToken.symbol === fromToken.symbol) {
        toToken = tokens[this.randomInt(0, tokens.length)];
      }

      const amount = this.randomBetween(0.1, 10).toFixed(4);
      const gasSaved = this.randomBetween(2, 15).toFixed(2);
      const timestamp = now - (i * 3600000); // Each transaction 1 hour apart

      return {
        id: `tx-${i + 1}`,
        hash: `0x${Math.random().toString(16).substring(2, 66)}`,
        timestamp,
        fromToken: fromToken.symbol,
        toToken: toToken.symbol,
        amount,
        gasSaved: parseFloat(gasSaved),
        status: statuses[this.randomInt(0, statuses.length)],
        recommendation: this.randomInt(0, 2) === 0 ? 'execute_now' : 'wait',
        gasPrice: this.randomBetween(20, 60).toFixed(2),
      };
    });
  }

  /**
   * Generate mock savings analytics data
   * @param days - Number of days of data
   * @returns Savings analytics
   */
  static generateSavingsAnalytics(days: number = 30) {
    const dailySavings = Array.from({ length: days }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - i - 1));
      
      return {
        date: date.toISOString().split('T')[0],
        savedUSD: this.randomBetween(5, 50),
        transactionCount: this.randomInt(1, 10),
        avgSavingsPercent: this.randomBetween(15, 40),
      };
    });

    const totalSaved = dailySavings.reduce((sum, day) => sum + day.savedUSD, 0);
    const totalTransactions = dailySavings.reduce((sum, day) => sum + day.transactionCount, 0);
    const avgSavingsPercent = dailySavings.reduce((sum, day) => sum + day.avgSavingsPercent, 0) / days;

    return {
      dailySavings,
      summary: {
        totalSavedUSD: totalSaved,
        totalTransactions,
        avgSavingsPercent,
        bestDay: dailySavings.reduce((best, current) => 
          current.savedUSD > best.savedUSD ? current : best
        ),
      },
    };
  }

  /**
   * Generate mock user profile data
   * @returns User profile with statistics
   */
  static generateUserProfile() {
    return {
      address: `0x${Math.random().toString(16).substring(2, 42)}`,
      memberSince: new Date(Date.now() - this.randomInt(30, 365) * 86400000).toISOString(),
      statistics: {
        totalTransactions: this.randomInt(50, 500),
        totalSavedUSD: this.randomBetween(100, 5000).toFixed(2),
        avgSavingsPercent: this.randomBetween(20, 35).toFixed(1),
        favoriteChain: ['Ethereum', 'Arbitrum', 'Polygon'][this.randomInt(0, 3)],
        optimalExecutionRate: this.randomBetween(75, 95).toFixed(1),
      },
      preferences: {
        defaultSlippage: 0.5,
        autoExecute: false,
        notificationsEnabled: true,
        preferredGasSpeed: 'standard' as const,
      },
    };
  }

  /**
   * Generate mock network statistics
   * @returns Current network statistics
   */
  static generateNetworkStats() {
    return {
      ethereum: {
        gasPrice: this.randomBetween(20, 60),
        tps: this.randomInt(12, 18),
        pendingTxs: this.randomInt(50000, 200000),
        avgBlockTime: this.randomBetween(12, 14),
        networkUtilization: this.randomBetween(60, 95),
      },
      arbitrum: {
        gasPrice: this.randomBetween(0.1, 0.5),
        tps: this.randomInt(2000, 4000),
        pendingTxs: this.randomInt(100, 1000),
        avgBlockTime: this.randomBetween(0.2, 0.5),
        networkUtilization: this.randomBetween(30, 70),
      },
      polygon: {
        gasPrice: this.randomBetween(30, 100),
        tps: this.randomInt(500, 2000),
        pendingTxs: this.randomInt(1000, 5000),
        avgBlockTime: this.randomBetween(2, 3),
        networkUtilization: this.randomBetween(40, 80),
      },
    };
  }

  /**
   * Generate mock token prices
   * @returns Current token prices
   */
  static generateTokenPrices() {
    return {
      ETH: {
        usd: this.randomBetween(1800, 2200),
        change24h: this.randomBetween(-5, 5),
      },
      BTC: {
        usd: this.randomBetween(40000, 50000),
        change24h: this.randomBetween(-3, 3),
      },
      USDC: {
        usd: 1.0,
        change24h: 0,
      },
      USDT: {
        usd: 1.0,
        change24h: 0,
      },
      DAI: {
        usd: this.randomBetween(0.99, 1.01),
        change24h: this.randomBetween(-0.1, 0.1),
      },
    };
  }

  /**
   * Generate mock DEX liquidity data
   * @param tokenPair - Token pair (e.g., "ETH/USDC")
   * @returns Liquidity information
   */
  static generateLiquidityData(tokenPair: string = 'ETH/USDC') {
    const protocols = ['Uniswap V3', 'Uniswap V2', 'Sushiswap', 'Curve', 'Balancer'];
    
    return protocols.map(protocol => ({
      protocol,
      pair: tokenPair,
      liquidityUSD: this.randomBetween(10000000, 500000000),
      volume24h: this.randomBetween(1000000, 100000000),
      apr: this.randomBetween(5, 50),
      fee: protocol.includes('V3') ? this.randomBetween(0.05, 1) : 0.3,
    }));
  }

  /**
   * Generate realistic gas price forecast
   * @param currentGwei - Current gas price
   * @param hours - Hours to forecast
   * @returns Gas price forecast
   */
  static generateGasForecast(currentGwei: number = 30, hours: number = 12) {
    const forecast = [];
    let price = currentGwei;
    
    for (let i = 0; i < hours; i++) {
      // Add realistic price movement with trend and noise
      const trend = Math.sin(i / 3) * 5; // Wave pattern
      const noise = this.randomBetween(-3, 3); // Random fluctuation
      price = Math.max(10, price + trend + noise); // Minimum 10 gwei
      
      forecast.push({
        hour: i + 1,
        estimatedGwei: Math.round(price * 10) / 10,
        confidence: Math.max(0.5, 0.95 - (i * 0.05)), // Decreasing confidence
        range: {
          low: Math.round((price * 0.9) * 10) / 10,
          high: Math.round((price * 1.1) * 10) / 10,
        },
      });
    }
    
    return forecast;
  }

  /**
   * Generate mock MEV (Maximal Extractable Value) data
   * @returns MEV protection statistics
   */
  static generateMEVData() {
    return {
      protected: this.randomInt(80, 98),
      frontrunAttempts: this.randomInt(5, 50),
      savedFromMEV: this.randomBetween(10, 100).toFixed(2),
      flashbotsUsage: this.randomInt(60, 90),
      avgProtectionTime: this.randomBetween(2, 8).toFixed(1),
    };
  }

  /**
   * Generate mock waiting queue data
   * @returns Queue statistics
   */
  static generateQueueData() {
    const statuses = ['waiting', 'ready', 'executing'] as const;
    
    return {
      totalQueued: this.randomInt(5, 50),
      transactions: Array.from({ length: this.randomInt(3, 10) }, (_, i) => ({
        id: `queue-${i + 1}`,
        status: statuses[this.randomInt(0, statuses.length)],
        targetGasPrice: this.randomBetween(20, 40),
        currentGasPrice: this.randomBetween(25, 60),
        estimatedWaitTime: this.randomInt(1, 30),
        potentialSavings: this.randomBetween(2, 15).toFixed(2),
      })),
      avgWaitTime: this.randomInt(5, 20),
      successRate: this.randomBetween(85, 98).toFixed(1),
    };
  }

  /**
   * Generate a complete test dataset for demos
   * @returns Complete test dataset
   */
  static generateCompleteTestDataset() {
    const testAddress = '0x742d35Cc6635C0532925a3b8D777532DC4DE0034';
    
    const tradeRequest: TradeRequest = {
      fromToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      toToken: '0xA0b86a33E6441e1ba4ee5e45b1230E90',
      amount: '1000000000000000000', // 1 ETH
      fromChain: 'ethereum',
      userAddress: testAddress,
      slippage: 0.5,
      priority: 'standard',
    };

    return {
      tradeRequest,
      quote: this.generateCompleteQuote(tradeRequest),
      scenarios: this.generateScenarios(),
      historicalGas: this.generateHistoricalGasData(24),
      transactionHistory: this.generateTransactionHistory(15),
      savingsAnalytics: this.generateSavingsAnalytics(30),
      userProfile: this.generateUserProfile(),
      networkStats: this.generateNetworkStats(),
      tokenPrices: this.generateTokenPrices(),
      liquidityData: this.generateLiquidityData('ETH/USDC'),
      gasForecast: this.generateGasForecast(30, 12),
      mevData: this.generateMEVData(),
      queueData: this.generateQueueData(),
    };
  }

  /**
   * Generate mock API response with realistic timing
   * @param dataGenerator - Function that generates the data
   * @param minDelay - Minimum delay in ms
   * @param maxDelay - Maximum delay in ms
   * @returns Promise with delayed response
   */
  static async generateWithDelay<T>(
    dataGenerator: () => T,
    minDelay: number = 500,
    maxDelay: number = 1500
  ): Promise<T> {
    const delay = this.randomInt(minDelay, maxDelay);
    await new Promise(resolve => setTimeout(resolve, delay));
    return dataGenerator();
  }

  /**
   * Simulate API failure for testing error handling
   * @param successRate - Probability of success (0-1)
   * @param dataGenerator - Function that generates data on success
   * @returns Promise that may reject
   */
  static async generateWithFailure<T>(
    dataGenerator: () => T,
    successRate: number = 0.9
  ): Promise<T> {
    if (Math.random() > successRate) {
      throw new Error('Simulated API failure');
    }
    return dataGenerator();
  }
}

// Export helper function for easy testing
export const generateMockQuote = (
  fromToken: string = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  toToken: string = '0xA0b86a33E6441e1ba4ee5e45b1230E90',
  amount: string = '1000000000000000000'
) => {
  const request: TradeRequest = {
    fromToken,
    toToken,
    amount,
    fromChain: 'ethereum',
    userAddress: '0x742d35Cc6635C0532925a3b8D777532DC4DE0034',
    slippage: 0.5,
    priority: 'standard',
  };
  
  return MockDataGenerator.generateCompleteQuote(request);
};

// Export scenarios for quick testing
export const mockScenarios = {
  lowGas: () => MockDataGenerator.generateScenarios().lowGas,
  highGas: () => MockDataGenerator.generateScenarios().highGas,
  moderateGas: () => MockDataGenerator.generateScenarios().moderateGas,
  veryHighGas: () => MockDataGenerator.generateScenarios().veryHighGas,
  volatileGas: () => MockDataGenerator.generateScenarios().volatileGas,
};