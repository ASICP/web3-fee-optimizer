// =============================================================================
// Shared Type Definitions for Web3 Fee Optimizer
// =============================================================================

export interface TradeRequest {
  fromToken: string;
  toToken: string;
  amount: string;
  fromChain: string;
  toChain?: string;
  userAddress: string;
  slippage: number;
  priority: 'fast' | 'standard' | 'economy';
}

export interface GasPriceData {
  source: string;
  timestamp: number;
  currentGwei: number;
  fast: number;
  standard: number;
  safe: number;
  baseFee: number;
  priorityFee: number;
  forecast: {
    nextBlock: number;
    next5Blocks: number[];
    confidence: number;
  };
}

export interface DEXRoute {
  source: string;
  route: {
    fromToken: string;
    toToken: string;
    amountIn: string;
    amountOut: string;
    priceImpact: number;
    gasEstimate: number;
    protocols: string[];
  };
  fees: {
    platformFee: number;
    networkFee: number;
    totalFeeUSD: number;
  };
}

export interface L2Option {
  source: string;
  fromChain: string;
  toChain: string;
  bridgeCost: number;
  bridgeTime: number;
  totalCostUSD: number;
  savings: number;
}

export interface SwapAnalysis {
  recommendation: 'execute_now' | 'wait' | 'use_l2';
  savings: {
    amount: number;
    percentage: number;
    currency: 'USD' | 'ETH';
  };
  timing: {
    waitTime?: number;
    confidence: number;
  };
  routes: {
    current: {
      protocol: string;
      cost: number;
      gasEstimate: number;
    };
    optimal: {
      protocol: string;
      cost: number;
      gasEstimate: number;
      execution: 'immediate' | 'delayed' | 'l2';
    };
  };
}
