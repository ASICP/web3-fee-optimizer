// =============================================================================
// FILE 4: src/components/SwapInterface.tsx - Updated Component Integration
// =============================================================================

import React, { useState } from 'react';
import { useFeeOptimization } from '../hooks/useFeeOptimization';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';

interface SwapInterfaceProps {
  walletAddress?: string;
}

export const SwapInterface: React.FC<SwapInterfaceProps> = ({ walletAddress }) => {
  const [fromToken, setFromToken] = useState('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'); // ETH
  const [toToken, setToToken] = useState('0xA0b86a33E6441e1ba4ee5e45b1230E90'); // USDC
  const [amount, setAmount] = useState('1000000000000000000'); // 1 ETH in wei
  const [slippage, setSlippage] = useState(0.5);
  
  const { analyzeSwap, analysis, loading, error, serviceHealth } = useFeeOptimization();

  const handleAnalyze = async () => {
    if (!walletAddress) {
      alert('Please connect your wallet first');
      return;
    }

    await analyzeSwap({
      fromToken,
      toToken,
      amount,
      userAddress: walletAddress,
      slippage,
    });
  };

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'execute_now': return 'bg-green-500';
      case 'wait': return 'bg-yellow-500';
      case 'use_l2': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const formatRecommendation = (rec: string) => {
    switch (rec) {
      case 'execute_now': return 'Execute Now';
      case 'wait': return 'Wait for Lower Fees';
      case 'use_l2': return 'Use Layer 2';
      default: return rec;
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Swap Tokens</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Token Input Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">From Token</label>
              <input
                type="text"
                value={fromToken}
                onChange={(e) => setFromToken(e.target.value)}
                className="w-full p-2 border rounded-md"
                placeholder="Token address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">To Token</label>
              <input
                type="text"
                value={toToken}
                onChange={(e) => setToToken(e.target.value)}
                className="w-full p-2 border rounded-md"
                placeholder="Token address"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Amount (wei)</label>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-2 border rounded-md"
              placeholder="Amount in wei"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Slippage (%)</label>
            <input
              type="number"
              value={slippage}
              onChange={(e) => setSlippage(parseFloat(e.target.value))}
              step="0.1"
              min="0"
              max="5"
              className="w-full p-2 border rounded-md"
            />
          </div>

          <Button 
            onClick={handleAnalyze} 
            disabled={loading || !walletAddress}
            className="w-full"
          >
            {loading ? 'Analyzing...' : 'Analyze Swap'}
          </Button>
        </CardContent>
      </Card>

      {/* Service Health Status */}
      {serviceHealth && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Service Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(serviceHealth).map(([service, healthy]) => (
                <Badge 
                  key={service}
                  variant={healthy ? "default" : "destructive"}
                  className="text-xs"
                >
                  {service}: {healthy ? '✓' : '✗'}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Analysis Results */}
      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Fee Optimization Analysis
              <Badge 
                className={`text-white ${getRecommendationColor(analysis.recommendation)}`}
              >
                {formatRecommendation(analysis.recommendation)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Savings Information */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600">Potential Savings</p>
                <p className="text-lg font-bold text-green-600">
                  ${analysis.savings.amount.toFixed(2)} ({analysis.savings.percentage.toFixed(1)}%)
                </p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">Confidence</p>
                <p className="text-lg font-bold text-blue-600">
                  {(analysis.timing.confidence * 100).toFixed(0)}%
                </p>
              </div>
            </div>

            {/* Wait Time */}
            {analysis.timing.waitTime && (
              <div className="p-3 bg-yellow-50 rounded-lg">
                <p className="text-sm text-gray-600">Recommended Wait Time</p>
                <p className="text-lg font-bold text-yellow-600">
                  {Math.round(analysis.timing.waitTime / 60)} minutes
                </p>
              </div>
            )}

            {/* Route Comparison */}
            <div>
              <h4 className="font-medium mb-2">Route Comparison</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-2 border rounded">
                  <p className="font-medium">Current Route</p>
                  <p>Protocol: {analysis.routes.current.protocol}</p>
                  <p>Cost: ${analysis.routes.current.cost.toFixed(2)}</p>
                </div>
                <div className="p-2 border rounded bg-green-50">
                  <p className="font-medium">Optimal Route</p>
                  <p>Protocol: {analysis.routes.optimal.protocol}</p>
                  <p>Cost: ${analysis.routes.optimal.cost.toFixed(2)}</p>
                  <p>Execution: {analysis.routes.optimal.execution}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};