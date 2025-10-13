// =============================================================================
// FILE 2: src/services/fee-optimization.ts - Business Logic Layer
// =============================================================================
// 
// PURPOSE:
// This service analyzes gas prices, DEX routes, and L2 options to recommend
// the most cost-effective way to execute a swap transaction. It provides
// recommendations like "execute now", "wait for lower fees", or "use L2".
//
// ARCHITECTURE NOTE:
// This is a browser-compatible implementation that replaces Node.js EventEmitter
// with a simple custom event system to avoid browser compatibility issues.
//
// =============================================================================

import { getOrchestrator } from './orchestrator';
import type { TradeRequest, SwapAnalysis } from '../types/api.types';

/**
 * FeeOptimizationService
 * 
 * Main service class that orchestrates fee optimization analysis.
 * Uses the API orchestrator to fetch data from multiple sources (gas APIs,
 * DEX aggregators, L2 bridges) and analyzes them to provide optimal execution
 * recommendations.
 * 
 * EVENT SYSTEM:
 * - 'analysis_complete': Fired when analysis successfully completes
 * - 'analysis_error': Fired when analysis fails
 */
export class FeeOptimizationService {
  // API orchestrator instance that handles all external API calls
  private orchestrator: any;
  
  // Simple event listener storage (browser-compatible replacement for EventEmitter)
  // Structure: { eventName: [callback1, callback2, ...] }
  private listeners: { [key: string]: Function[] } = {};
  
  constructor() {
    // Initialize the API orchestrator singleton
    this.orchestrator = getOrchestrator();
  }

  // =============================================================================
  // EVENT MANAGEMENT (Browser-Compatible EventEmitter Alternative)
  // =============================================================================
  
  /**
   * Register an event listener
   * @param event - Event name ('analysis_complete' or 'analysis_error')
   * @param callback - Function to call when event is emitted
   */
  on(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  /**
   * Unregister an event listener
   * @param event - Event name
   * @param callback - Function to remove
   */
  off(event: string, callback: Function) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  /**
   * Emit an event to all registered listeners
   * @param event - Event name to emit
   * @param data - Data to pass to listeners
   */
  private emit(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  // =============================================================================
  // MAIN ANALYSIS FUNCTION
  // =============================================================================
  
  /**
   * Analyze a swap transaction and provide optimization recommendations
   * 
   * PROCESS:
   * 1. Format the trade request for the orchestrator
   * 2. Fetch comprehensive quote data (gas prices, DEX routes, L2 options)
   * 3. Analyze the data to determine optimal execution strategy
   * 4. Emit 'analysis_complete' event with results
   * 
   * @param params - Swap parameters (tokens, amount, user address, slippage)
   * @returns SwapAnalysis object with recommendations and savings estimates
   * @throws Error if analysis fails
   */
  async analyzeSwap(params: {
    fromToken: string;      // Source token address (e.g., ETH address)
    toToken: string;        // Destination token address (e.g., USDC address)
    amount: string;         // Amount in wei
    userAddress: string;    // User's wallet address
    slippage?: number;      // Acceptable slippage percentage (default: 0.5%)
  }): Promise<SwapAnalysis> {
    
    // Build standardized trade request for the orchestrator
    const tradeRequest: TradeRequest = {
      fromToken: params.fromToken,
      toToken: params.toToken,
      amount: params.amount,
      fromChain: 'ethereum',                    // Currently only Ethereum L1 supported
      userAddress: params.userAddress,
      slippage: params.slippage || 0.5,         // Default to 0.5% slippage
      priority: 'standard',                     // Standard priority gas
    };

    try {
      // STEP 1: Fetch comprehensive quote from all API sources
      // This includes: gas prices (Blocknative, Infura), DEX routes (1inch, ParaSwap), 
      // and L2 options (LI.FI)
      const quote = await this.orchestrator.getComprehensiveQuote(tradeRequest);
      
      // STEP 2: Analyze the quote data to generate recommendations
      const analysis = this.analyzeQuoteData(quote);
      
      // STEP 3: Emit success event for React hooks to consume
      this.emit('analysis_complete', analysis);
      
      return analysis;
      
    } catch (error) {
      // Emit error event for React hooks to handle
      this.emit('analysis_error', error);
      throw new Error(`Fee optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================================================
  // ANALYSIS LOGIC
  // =============================================================================
  
  /**
   * Analyze quote data from multiple sources to determine optimal execution strategy
   * 
   * DECISION LOGIC:
   * 1. Compare gas prices across providers → select lowest
   * 2. Compare DEX routes → select highest output amount
   * 3. Calculate current total cost (gas + trading fees)
   * 4. Evaluate L2 alternatives (if savings > $5)
   * 5. Evaluate "wait" strategy (if forecast savings > $2 with >70% confidence)
   * 6. Return recommendation: execute_now | wait | use_l2
   * 
   * @param quote - Comprehensive quote data from orchestrator
   * @returns SwapAnalysis with recommendation, savings, and route details
   */
  private analyzeQuoteData(quote: any): SwapAnalysis {
    
    // STEP 1: Find the best (lowest) gas price from all providers
    // Reduces over gasData array to find provider with lowest 'standard' gas price
    const bestGasData = quote.gasData.reduce((best: any, current: any) => {
      return current.standard < best.standard ? current : best;
    });

    // STEP 2: Find the best DEX route (highest output amount = best price)
    // Higher amountOut means better exchange rate for the user
    const bestRoute = quote.dexRoutes.reduce((best: any, current: any) => {
      return parseFloat(current.route.amountOut) > parseFloat(best.route.amountOut) ? current : best;
    });

    // STEP 3: Calculate current execution costs
    // Formula: (gasPrice_gwei * gasLimit) / 1e9 = cost in ETH
    const currentGasCostETH = (bestGasData.currentGwei * bestRoute.route.gasEstimate) / 1e9;
    
    // Rough ETH price assumption: $2000 (in production, fetch real-time price)
    const currentGasCostUSD = currentGasCostETH * 2000;
    
    // Total cost = network gas fees + DEX trading fees
    const currentTotalCostUSD = currentGasCostUSD + bestRoute.fees.totalFeeUSD;

    // STEP 4: Find the best L2 option (if any available)
    // L2 chains like Arbitrum/Optimism offer much lower fees
    const bestL2Option = quote.l2Options.length > 0 
      ? quote.l2Options.reduce((best: any, current: any) => 
          current.totalCostUSD < best.totalCostUSD ? current : best
        )
      : null;

    // STEP 5: Initialize recommendation variables
    let recommendation: 'execute_now' | 'wait' | 'use_l2' = 'execute_now';
    let savings = { amount: 0, percentage: 0, currency: 'USD' as const };
    let waitTime: number | undefined;

    // STEP 6: Calculate potential savings from waiting for lower gas
    // Uses gas price forecast (next 5-10 blocks) to estimate savings
    const forecastSavings = this.calculateWaitSavings(bestGasData, bestRoute);
    
    // Calculate L2 savings (difference between L1 and L2 costs)
    const l2Savings = bestL2Option ? currentTotalCostUSD - bestL2Option.totalCostUSD : 0;

    // STEP 7: Determine optimal recommendation based on savings thresholds
    
    // Priority 1: Use L2 if savings > $5 AND better than waiting
    // Rationale: L2 offers significant savings and immediate execution
    if (l2Savings > 5 && l2Savings > forecastSavings.amount) {
      recommendation = 'use_l2';
      savings = { 
        amount: l2Savings, 
        percentage: (l2Savings / currentTotalCostUSD) * 100, 
        currency: 'USD' 
      };
    } 
    // Priority 2: Wait if forecast savings > $2 with >70% confidence
    // Rationale: Only recommend waiting if savings are significant and likely
    else if (forecastSavings.amount > 2 && forecastSavings.confidence > 0.7) {
      recommendation = 'wait';
      savings = forecastSavings;
      waitTime = forecastSavings.waitTime;
    }
    // Priority 3: Execute now (default if no significant savings)
    // Rationale: Small potential savings don't justify delay or complexity

    // STEP 8: Build and return comprehensive analysis object
    return {
      recommendation,                          // execute_now | wait | use_l2
      savings,                                 // Amount and percentage saved
      timing: {
        waitTime,                              // Seconds to wait (if 'wait' recommendation)
        confidence: forecastSavings.confidence // Forecast confidence (0-1)
      },
      routes: {
        current: {
          protocol: bestRoute.source,          // DEX name (e.g., "1inch", "ParaSwap")
          cost: currentTotalCostUSD,           // Current L1 execution cost
          gasEstimate: bestRoute.route.gasEstimate // Gas units required
        },
        optimal: {
          protocol: recommendation === 'use_l2' 
            ? bestL2Option?.source || bestRoute.source 
            : bestRoute.source,
          cost: recommendation === 'use_l2' 
            ? bestL2Option?.totalCostUSD || currentTotalCostUSD 
            : recommendation === 'wait' 
              ? currentTotalCostUSD - savings.amount 
              : currentTotalCostUSD,
          gasEstimate: bestRoute.route.gasEstimate,
          execution: recommendation === 'execute_now' 
            ? 'immediate' 
            : recommendation === 'wait' 
              ? 'delayed' 
              : 'l2'
        }
      }
    };
  }

  // =============================================================================
  // WAIT STRATEGY CALCULATION
  // =============================================================================
  
  /**
   * Calculate potential savings from waiting for lower gas prices
   * 
   * METHODOLOGY:
   * 1. Get current execution cost at current gas price
   * 2. Calculate costs for next 5 blocks using gas forecast
   * 3. Find the block with lowest cost
   * 4. Calculate savings and wait time
   * 
   * ASSUMPTIONS:
   * - ETH price: $2000 (should be real-time in production)
   * - Block time: 12 seconds (Ethereum average)
   * - Forecast covers next 5 blocks (~1 minute)
   * 
   * @param gasData - Gas price data with forecast
   * @param route - DEX route with gas estimate
   * @returns Savings amount, percentage, wait time, and confidence
   */
  private calculateWaitSavings(gasData: any, route: any) {
    // Calculate cost at current gas price
    const currentCost = (gasData.currentGwei * route.route.gasEstimate) / 1e9 * 2000;
    
    // Map forecast gas prices to execution costs
    // Index 0 = next block (12s), Index 1 = 2 blocks ahead (24s), etc.
    const forecastCosts = gasData.forecast.next5Blocks.map((gwei: number, index: number) => ({
      cost: (gwei * route.route.gasEstimate) / 1e9 * 2000,  // Cost in USD
      waitTime: (index + 1) * 12,                            // Wait time in seconds
      gwei,                                                   // Gas price in gwei
    }));

    // Find the forecast with the lowest cost (best opportunity)
    const bestForecast = forecastCosts.reduce((best: any, current: any) => 
      current.cost < best.cost ? current : best
    );

    // Return savings analysis
    return {
      amount: Math.max(0, currentCost - bestForecast.cost),    // $ saved
      percentage: Math.max(0, ((currentCost - bestForecast.cost) / currentCost) * 100), // % saved
      currency: 'USD' as const,
      waitTime: bestForecast.waitTime,                          // Seconds to wait
      confidence: gasData.forecast.confidence,                  // Provider's confidence (0-1)
    };
  }

  // =============================================================================
  // SERVICE HEALTH CHECK
  // =============================================================================
  
  /**
   * Check health status of all external API services
   * 
   * Useful for displaying service status in the UI and diagnosing issues
   * 
   * @returns Object with service names as keys and boolean health status as values
   * Example: { "Blocknative": true, "1inch": false, "LI.FI": true }
   */
  async getServiceHealth() {
    return await this.orchestrator.checkServiceHealth();
  }
}

// =============================================================================
// USAGE EXAMPLE
// =============================================================================
/*
const service = new FeeOptimizationService();

// Set up event listeners
service.on('analysis_complete', (analysis) => {
  console.log('Recommendation:', analysis.recommendation);
  console.log('Savings:', analysis.savings.amount);
});

service.on('analysis_error', (error) => {
  console.error('Analysis failed:', error);
});

// Analyze a swap
const result = await service.analyzeSwap({
  fromToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
  toToken: '0xA0b86a33E6441e1ba4ee5e45b1230E90',         // USDC
  amount: '1000000000000000000',                        // 1 ETH in wei
  userAddress: '0x...',
  slippage: 0.5
});
*/