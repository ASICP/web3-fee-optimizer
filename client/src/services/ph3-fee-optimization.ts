// =============================================================================
// FILE 2: src/services/fee-optimization.ts - Business Logic Layer
// =============================================================================
// import EventEmitter, APIOrchestrator, getOrchestrator, TradeRequest
import { EventEmitter } from 'events';
import { getOrchestrator } from './orchestrator';
import type { TradeRequest, SwapAnalysis } from '../types/api.types';

// Imports above replace this local interface
// interface SwapAnalysis {
//  recommendation: 'execute_now' | 'wait' | 'use_l2';
//  savings: {
//    amount: number;
//    percentage: number;
//    currency: 'USD' | 'ETH';
//  };
//  timing: {
//    waitTime?: number; // seconds
//    confidence: number; // 0-1
//  };
//  routes: {
//    current: {
//      protocol: string;
//      cost: number;
//      gasEstimate: number;
//    };
//    optimal: {
//      protocol: string;
//      cost: number;
//      gasEstimate: number;
//      execution: 'immediate' | 'delayed' | 'l2';
//    };
//  };
//}

export class FeeOptimizationService extends EventEmitter {
//  private orchestrator: APIOrchestrator;  *  APIOrchestrator is not strictly imported
private orchestrator: any;
  
  constructor() {
    super();
    this.orchestrator = getOrchestrator();
  }

  async analyzeSwap(params: {
    fromToken: string;
    toToken: string;
    amount: string;
    userAddress: string;
    slippage?: number;
  }): Promise<SwapAnalysis> {
    
    const tradeRequest: TradeRequest = {
      fromToken: params.fromToken,
      toToken: params.toToken,
      amount: params.amount,
      fromChain: 'ethereum', // Default to Ethereum
      userAddress: params.userAddress,
      slippage: params.slippage || 0.5,
      priority: 'standard',
    };

    try {
      // Get comprehensive data from all APIs
      const quote = await this.orchestrator.getComprehensiveQuote(tradeRequest);
      
      // Analyze the data and make recommendations
      const analysis = this.analyzeQuoteData(quote);
      
      this.emit('analysis_complete', analysis);
      return analysis;
      
    } catch (error) {
      this.emit('analysis_error', error);
      throw new Error(`Fee optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private analyzeQuoteData(quote: any): SwapAnalysis {
    // Get best gas price (lowest from reliable sources)
    const bestGasData = quote.gasData.reduce((best: any, current: any) => {
      return current.standard < best.standard ? current : best;
    });

    // Get best DEX route (highest output amount)
    const bestRoute = quote.dexRoutes.reduce((best: any, current: any) => {
      return parseFloat(current.route.amountOut) > parseFloat(best.route.amountOut) ? current : best;
    });

    // Calculate current costs
    const currentGasCostETH = (bestGasData.currentGwei * bestRoute.route.gasEstimate) / 1e9;
    const currentGasCostUSD = currentGasCostETH * 2000; // Rough ETH price
    const currentTotalCostUSD = currentGasCostUSD + bestRoute.fees.totalFeeUSD;

    // Analyze L2 options
    const bestL2Option = quote.l2Options.length > 0 
      ? quote.l2Options.reduce((best: any, current: any) => 
          current.totalCostUSD < best.totalCostUSD ? current : best
        )
      : null;

    // Determine recommendation
    let recommendation: 'execute_now' | 'wait' | 'use_l2' = 'execute_now';
    let savings = { amount: 0, percentage: 0, currency: 'USD' as const };
    let waitTime: number | undefined;

    // Check if waiting would save money (based on gas forecast)
    const forecastSavings = this.calculateWaitSavings(bestGasData, bestRoute);
    const l2Savings = bestL2Option ? currentTotalCostUSD - bestL2Option.totalCostUSD : 0;

    if (l2Savings > 5 && l2Savings > forecastSavings.amount) {
      recommendation = 'use_l2';
      savings = { amount: l2Savings, percentage: (l2Savings / currentTotalCostUSD) * 100, currency: 'USD' };
    } else if (forecastSavings.amount > 2 && forecastSavings.confidence > 0.7) {
      recommendation = 'wait';
      savings = forecastSavings;
      waitTime = forecastSavings.waitTime;
    }

    return {
      recommendation,
      savings,
      timing: {
        waitTime,
        confidence: forecastSavings.confidence,
      },
      routes: {
        current: {
          protocol: bestRoute.source,
          cost: currentTotalCostUSD,
          gasEstimate: bestRoute.route.gasEstimate,
        },
        optimal: {
          protocol: recommendation === 'use_l2' ? bestL2Option?.source || bestRoute.source : bestRoute.source,
          cost: recommendation === 'use_l2' ? bestL2Option?.totalCostUSD || currentTotalCostUSD : 
                recommendation === 'wait' ? currentTotalCostUSD - savings.amount : currentTotalCostUSD,
          gasEstimate: bestRoute.route.gasEstimate,
          execution: recommendation === 'execute_now' ? 'immediate' : 
                    recommendation === 'wait' ? 'delayed' : 'l2',
        },
      },
    };
  }

  private calculateWaitSavings(gasData: any, route: any) {
    const currentCost = (gasData.currentGwei * route.route.gasEstimate) / 1e9 * 2000;
    const forecastCosts = gasData.forecast.next5Blocks.map((gwei: number, index: number) => ({
      cost: (gwei * route.route.gasEstimate) / 1e9 * 2000,
      waitTime: (index + 1) * 12, // 12 seconds per block
      gwei,
    }));

    const bestForecast = forecastCosts.reduce((best: any, current: any) => 
      current.cost < best.cost ? current : best
    );

    return {
      amount: Math.max(0, currentCost - bestForecast.cost),
      percentage: Math.max(0, ((currentCost - bestForecast.cost) / currentCost) * 100),
      currency: 'USD' as const,
      waitTime: bestForecast.waitTime,
      confidence: gasData.forecast.confidence,
    };
  }

  async getServiceHealth() {
    return await this.orchestrator.checkServiceHealth();
  }
}