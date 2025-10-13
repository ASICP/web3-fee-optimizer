// =============================================================================
// FILE 1: src/services/orchestrator.ts - Main Integration Point
// =============================================================================

import { APIOrchestrator, TradeRequest, OptimizationResult } from './middleware/api-orchestrator';
import { EventEmitter } from 'events';

// Singleton instance for your app
let orchestratorInstance: APIOrchestrator | null = null;

export const initializeOrchestrator = () => {
  if (!orchestratorInstance) {
    orchestratorInstance = new APIOrchestrator({
      blocknativeKey: import.meta.env.VITE_BLOCKNATIVE_API_KEY,
      infuraKey: import.meta.env.VITE_INFURA_API_KEY,
    });
    
    // Start background services
    orchestratorInstance.startCacheCleanup();
    
    // Set up global error handling
    orchestratorInstance.on('serviceError', (error) => {
      console.error('API Orchestrator Error:', error);
      // TODO: Send to your error tracking service (Sentry, etc.)
    });
    
    orchestratorInstance.on('serviceSuccess', (data) => {
      console.log('API Service Success:', data.service);
    });
  }
  
  return orchestratorInstance;
};

export const getOrchestrator = (): APIOrchestrator => {
  if (!orchestratorInstance) {
    return initializeOrchestrator();
  }
  return orchestratorInstance;
};