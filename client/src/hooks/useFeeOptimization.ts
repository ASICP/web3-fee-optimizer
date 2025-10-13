// =============================================================================
// FILE 3: src/hooks/useFeeOptimization.ts - React Hook Integration
// =============================================================================
import { useState, useEffect, useCallback } from 'react';
import { FeeOptimizationService } from '../services/fee-optimization';
import type { SwapAnalysis } from '../types/api.types';

interface UseFeeOptimizationReturn {
  analyzeSwap: (params: {
    fromToken: string;
    toToken: string;
    amount: string;
    userAddress: string;
    slippage?: number;
  }) => Promise<void>;
  analysis: SwapAnalysis | null;
  loading: boolean;
  error: string | null;
  serviceHealth: { [key: string]: boolean } | null;
}

export const useFeeOptimization = (): UseFeeOptimizationReturn => {
  const [analysis, setAnalysis] = useState<SwapAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceHealth, setServiceHealth] = useState<{ [key: string]: boolean } | null>(null);
  const [optimizationService] = useState(() => new FeeOptimizationService());

  useEffect(() => {
    const handleAnalysisComplete = (data: SwapAnalysis) => {
      setAnalysis(data);
      setLoading(false);
      setError(null);
    };

    const handleAnalysisError = (err: Error) => {
      setError(err.message);
      setLoading(false);
    };

    optimizationService.on('analysis_complete', handleAnalysisComplete);
    optimizationService.on('analysis_error', handleAnalysisError);

    optimizationService.getServiceHealth().then(setServiceHealth);

    return () => {
      optimizationService.off('analysis_complete', handleAnalysisComplete);
      optimizationService.off('analysis_error', handleAnalysisError);
    };
  }, [optimizationService]);

  const analyzeSwap = useCallback(async (params: {
    fromToken: string;
    toToken: string;
    amount: string;
    userAddress: string;
    slippage?: number;
  }) => {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    
    try {
      await optimizationService.analyzeSwap(params);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setLoading(false);
    }
  }, [optimizationService]);

  return {
    analyzeSwap,
    analysis,
    loading,
    error,
    serviceHealth,
  };
};