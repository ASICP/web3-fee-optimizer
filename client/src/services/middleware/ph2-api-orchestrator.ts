// =============================================================================
// FILE: src/services/middleware/api-orchestrator.ts
// Web3 Fee Optimizer - Centralized API Orchestration Layer
// =============================================================================

import { EventEmitter } from 'events';

// ===== TYPE DEFINITIONS =====

export interface TradeRequest {
  fromToken: string;
  toToken: string;
  amount: string; // in wei
  fromChain: string;
  toChain?: string;
  userAddress: string;
  slippage: number; // percentage
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
  bridgeTime: number; // seconds
  totalCostUSD: number;
  savings: number;
}

export interface OptimizationResult {
  recommendation: 'execute_now' | 'wait' | 'use_l2';
  estimatedSavings: number;
  confidence: number;
  details: {
    currentCost: number;
    optimizedCost: number;
    waitTime?: number;
    l2Details?: L2Option;
  };
  transaction?: {
    to: string;
    data: string;
    value: string;
    gasLimit: string;
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
  };
}

// ===== API SERVICE BASE CLASS =====

abstract class BaseAPIService extends EventEmitter {
  protected name: string;
  protected baseURL: string;
  protected apiKey?: string;
  protected rateLimitDelay: number = 100; // ms between requests
  protected retryAttempts: number = 3;
  
  constructor(name: string, baseURL: string, apiKey?: string) {
    super();
    this.name = name;
    this.baseURL = baseURL;
    this.apiKey = apiKey;
  }

  protected async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await fetch(`${this.baseURL}${endpoint}`, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
            ...options.headers,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        this.emit('success', { service: this.name, endpoint, data });
        return data;
        
      } catch (error) {
        lastError = error as Error;
        this.emit('error', { service: this.name, endpoint, error, attempt });
        
        if (attempt < this.retryAttempts) {
          await this.delay(this.rateLimitDelay * attempt);
        }
      }
    }
    
    throw new Error(`${this.name} API failed after ${this.retryAttempts} attempts: ${lastError.message}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  abstract isHealthy(): Promise<boolean>;
}

// ===== GAS PRICE SERVICES =====

class BlocknativeGasService extends BaseAPIService {
  constructor(apiKey: string) {
    super('Blocknative', 'https://api.blocknative.com/gasprices/blockprices', apiKey);
  }

  async getCurrentGasPrices(): Promise<GasPriceData> {
    const data = await this.makeRequest<any>('');
    
    return {
      source: this.name,
      timestamp: Date.now(),
      currentGwei: data.blockPrices[0]?.estimatedPrices[0]?.price || 0,
      fast: data.blockPrices[0]?.estimatedPrices[0]?.price || 0,
      standard: data.blockPrices[0]?.estimatedPrices[1]?.price || 0,
      safe: data.blockPrices[0]?.estimatedPrices[2]?.price || 0,
      baseFee: data.blockPrices[0]?.baseFeePerGas || 0,
      priorityFee: data.blockPrices[0]?.estimatedPrices[0]?.maxPriorityFeePerGas || 0,
      forecast: {
        nextBlock: data.blockPrices[1]?.estimatedPrices[1]?.price || 0,
        next5Blocks: data.blockPrices.slice(0, 5).map((block: any) => 
          block.estimatedPrices[1]?.price || 0
        ),
        confidence: data.confidence || 0.85,
      },
    };
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.makeRequest('');
      return true;
    } catch {
      return false;
    }
  }
}

class InfuraGasService extends BaseAPIService {
  constructor(apiKey: string) {
    super('Infura', 'https://gas-api.metaswap.codefi.network/networks/1', apiKey);
  }

  async getCurrentGasPrices(): Promise<GasPriceData> {
    const data = await this.makeRequest<any>('/suggestedGasFees');
    
    return {
      source: this.name,
      timestamp: Date.now(),
      currentGwei: parseFloat(data.medium.suggestedMaxFeePerGas),
      fast: parseFloat(data.high.suggestedMaxFeePerGas),
      standard: parseFloat(data.medium.suggestedMaxFeePerGas),
      safe: parseFloat(data.low.suggestedMaxFeePerGas),
      baseFee: parseFloat(data.estimatedBaseFee),
      priorityFee: parseFloat(data.medium.suggestedMaxPriorityFeePerGas),
      forecast: {
        nextBlock: parseFloat(data.medium.suggestedMaxFeePerGas) * 0.95,
        next5Blocks: [
          parseFloat(data.medium.suggestedMaxFeePerGas) * 0.95,
          parseFloat(data.medium.suggestedMaxFeePerGas) * 0.90,
          parseFloat(data.medium.suggestedMaxFeePerGas) * 0.88,
          parseFloat(data.medium.suggestedMaxFeePerGas) * 0.85,
          parseFloat(data.medium.suggestedMaxFeePerGas) * 0.82,
        ],
        confidence: 0.75,
      },
    };
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.makeRequest('/suggestedGasFees');
      return true;
    } catch {
      return false;
    }
  }
}

// ===== DEX AGGREGATION SERVICES =====

class OneInchDEXService extends BaseAPIService {
  constructor() {
    super('1inch', 'https://api.1inch.io/v5.0/1');
  }

  async getBestRoute(request: TradeRequest): Promise<DEXRoute> {
    const params = new URLSearchParams({
      fromTokenAddress: request.fromToken,
      toTokenAddress: request.toToken,
      amount: request.amount,
      fromAddress: request.userAddress,
      slippage: request.slippage.toString(),
      disableEstimate: 'false',
    });

    const data = await this.makeRequest<any>(`/swap?${params}`);
    
    return {
      source: this.name,
      route: {
        fromToken: request.fromToken,
        toToken: request.toToken,
        amountIn: request.amount,
        amountOut: data.toTokenAmount,
        priceImpact: parseFloat(data.priceImpact || '0'),
        gasEstimate: parseInt(data.estimatedGas || '0'),
        protocols: data.protocols?.[0]?.map((p: any) => p[0]?.name) || [],
      },
      fees: {
        platformFee: 0,
        networkFee: parseInt(data.estimatedGas || '0') * 20,
        totalFeeUSD: (parseInt(data.estimatedGas || '0') * 20 * 2000) / 1e9,
      },
    };
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.makeRequest('/healthcheck');
      return true;
    } catch {
      return false;
    }
  }
}

class ParaSwapDEXService extends BaseAPIService {
  constructor() {
    super('ParaSwap', 'https://apiv5.paraswap.io');
  }

  async getBestRoute(request: TradeRequest): Promise<DEXRoute> {
    const priceParams = new URLSearchParams({
      srcToken: request.fromToken,
      destToken: request.toToken,
      amount: request.amount,
      network: '1',
      userAddress: request.userAddress,
    });

    const priceData = await this.makeRequest<any>(`/prices?${priceParams}`);
    
    return {
      source: this.name,
      route: {
        fromToken: request.fromToken,
        toToken: request.toToken,
        amountIn: request.amount,
        amountOut: priceData.destAmount,
        priceImpact: parseFloat(priceData.priceImpact || '0'),
        gasEstimate: parseInt(priceData.gasCost || '0'),
        protocols: priceData.bestRoute?.[0]?.swaps?.map((s: any) => s.swapExchanges[0]?.exchange) || [],
      },
      fees: {
        platformFee: parseFloat(priceData.partnerFee || '0'),
        networkFee: parseInt(priceData.gasCost || '0'),
        totalFeeUSD: (parseInt(priceData.gasCostUSD || '0')),
      },
    };
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.makeRequest('/prices?srcToken=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&destToken=0xA0b86a33E6441e1ba4ee5e45b1230E90&amount=1000000000000000000&network=1');
      return true;
    } catch {
      return false;
    }
  }
}

// ===== L2 ROUTING SERVICES =====

class LiFiL2Service extends BaseAPIService {
  constructor() {
    super('LI.FI', 'https://li.fi/api/v1');
  }

  async getL2Options(request: TradeRequest): Promise<L2Option[]> {
    const routeRequest = {
      fromChain: request.fromChain,
      toChain: request.toChain || 'arbitrum',
      fromToken: request.fromToken,
      toToken: request.toToken,
      fromAmount: request.amount,
      fromAddress: request.userAddress,
      toAddress: request.userAddress,
    };

    const data = await this.makeRequest<any>('/quote', {
      method: 'POST',
      body: JSON.stringify(routeRequest),
    });

    return data.routes?.map((route: any) => ({
      source: this.name,
      fromChain: request.fromChain,
      toChain: route.toChain,
      bridgeCost: parseFloat(route.gasCostUSD || '0'),
      bridgeTime: route.estimatedExecutionDuration || 600,
      totalCostUSD: parseFloat(route.gasCostUSD || '0'),
      savings: parseFloat(route.savingsUSD || '0'),
    })) || [];
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.makeRequest('/status');
      return true;
    } catch {
      return false;
    }
  }
}

// ===== MAIN API ORCHESTRATOR =====

export class APIOrchestrator extends EventEmitter {
  private gasServices: BaseAPIService[];
  private dexServices: BaseAPIService[];
  private l2Services: BaseAPIService[];
  private cache: Map<string, { data: any; timestamp: number }>;
  private cacheTimeout: number = 30 * 1000; // 30 seconds

  constructor(config: {
    blocknativeKey?: string;
    infuraKey?: string;
  }) {
    super();
    
    this.cache = new Map();
    
    // Initialize gas services
    this.gasServices = [
      ...(config.blocknativeKey ? [new BlocknativeGasService(config.blocknativeKey)] : []),
      ...(config.infuraKey ? [new InfuraGasService(config.infuraKey)] : []),
    ];

    // Initialize DEX services
    this.dexServices = [
      new OneInchDEXService(),
      new ParaSwapDEXService(),
    ];

    // Initialize L2 services
    this.l2Services = [
      new LiFiL2Service(),
    ];

    // Set up event listeners
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const allServices = [...this.gasServices, ...this.dexServices, ...this.l2Services];
    
    allServices.forEach(service => {
      service.on('error', (error) => {
        this.emit('serviceError', { service: service.constructor.name, error });
      });
      
      service.on('success', (data) => {
        this.emit('serviceSuccess', { service: service.constructor.name, data });
      });
    });
  }

  private getCacheKey(prefix: string, params: any): string {
    return `${prefix}:${JSON.stringify(params)}`;
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  async getOptimizedGasData(): Promise<GasPriceData[]> {
    const cacheKey = this.getCacheKey('gas', {});
    const cached = this.getFromCache<GasPriceData[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const results = await Promise.allSettled(
      this.gasServices.map(service => 
        (service as any).getCurrentGasPrices()
      )
    );

    const gasData = results
      .filter((result): result is PromiseFulfilledResult<GasPriceData> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value);

    this.setCache(cacheKey, gasData);
    return gasData;
  }

  async getBestDEXRoutes(request: TradeRequest): Promise<DEXRoute[]> {
    const cacheKey = this.getCacheKey('dex', request);
    const cached = this.getFromCache<DEXRoute[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const results = await Promise.allSettled(
      this.dexServices.map(service => 
        (service as any).getBestRoute(request)
      )
    );

    const routes = results
      .filter((result): result is PromiseFulfilledResult<DEXRoute> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value);

    this.setCache(cacheKey, routes);
    return routes;
  }

  async getL2Alternatives(request: TradeRequest): Promise<L2Option[]> {
    if (!request.toChain) {
      return [];
    }

    const cacheKey = this.getCacheKey('l2', request);
    const cached = this.getFromCache<L2Option[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const results = await Promise.allSettled(
      this.l2Services.map(service => 
        (service as any).getL2Options(request)
      )
    );

    const options = results
      .filter((result): result is PromiseFulfilledResult<L2Option[]> => 
        result.status === 'fulfilled'
      )
      .flatMap(result => result.value);

    this.setCache(cacheKey, options);
    return options;
  }

  async getComprehensiveQuote(request: TradeRequest): Promise<{
    gasData: GasPriceData[];
    dexRoutes: DEXRoute[];
    l2Options: L2Option[];
    timestamp: number;
  }> {
    const [gasData, dexRoutes, l2Options] = await Promise.all([
      this.getOptimizedGasData(),
      this.getBestDEXRoutes(request),
      this.getL2Alternatives(request),
    ]);

    return {
      gasData,
      dexRoutes,
      l2Options,
      timestamp: Date.now(),
    };
  }

  async checkServiceHealth(): Promise<{ [key: string]: boolean }> {
    const allServices = [...this.gasServices, ...this.dexServices, ...this.l2Services];
    
    const healthChecks = await Promise.allSettled(
      allServices.map(async service => ({
        name: service.constructor.name,
        healthy: await service.isHealthy(),
      }))
    );

    const health: { [key: string]: boolean } = {};
    
    healthChecks.forEach(result => {
      if (result.status === 'fulfilled') {
        health[result.value.name] = result.value.healthy;
      }
    });

    return health;
  }

  startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > this.cacheTimeout) {
          this.cache.delete(key);
        }
      }
    }, this.cacheTimeout);
  }

  async shutdown(): void {
    this.removeAllListeners();
    this.cache.clear();
  }
}