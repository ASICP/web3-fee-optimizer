// =============================================================================
// SwapInterface Component - Main Token Swap Interface with Fee Analysis
// =============================================================================

import React, { useState } from 'react';
import { useFeeOptimization } from '../hooks/useFeeOptimization';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { TokenFeeWarning } from './TokenFeeWarning';
import { TOKENS, getTokenInfo, tokenToUSD, formatUSD } from '../utils/tokenFees';

interface SwapInterfaceProps {
  walletAddress?: string;
}

export const SwapInterface: React.FC<SwapInterfaceProps> = ({ walletAddress }) => {
  const [fromToken, setFromToken] = useState(TOKENS[0].address);
  const [toToken, setToToken] = useState(TOKENS[2].address); // USDC
  const [fromAmount, setFromAmount] = useState('0.0');
  const [toAmount, setToAmount] = useState('0.0');
  const [slippage, setSlippage] = useState(0.5);

  const { analyzeSwap, analysis, loading, error } = useFeeOptimization();

  // Calculate estimated output amount based on token prices
  const calculateToAmount = (fromAmt: string, fromTokenAddr: string, toTokenAddr: string) => {
    const amount = parseFloat(fromAmt);
    if (isNaN(amount) || amount <= 0) {
      setToAmount('0.0');
      return;
    }

    const fromTokenInfo = getTokenInfo(fromTokenAddr);
    const toTokenInfo = getTokenInfo(toTokenAddr);

    if (!fromTokenInfo || !toTokenInfo) {
      setToAmount('0.0');
      return;
    }

    // Convert from token amount to USD, then to "to" token amount
    const fromUSD = amount * fromTokenInfo.price;
    const toAmt = fromUSD / toTokenInfo.price;

    // Apply a small simulated slippage for realism
    const withSlippage = toAmt * (1 - slippage / 100);

    setToAmount(withSlippage.toFixed(6));
  };

  const handleAnalyze = async () => {
    if (!walletAddress) {
      alert('Please connect your wallet first');
      return;
    }

    const amount = parseFloat(fromAmount);
    if (amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    // Convert to smallest unit (wei for 18 decimals, etc.)
    const token = getTokenInfo(fromToken);
    const amountInSmallestUnit = (amount * Math.pow(10, token?.decimals || 18)).toString();

    await analyzeSwap({
      fromToken,
      toToken,
      amount: amountInSmallestUnit,
      userAddress: walletAddress,
      slippage,
    });
  };

  const handleSwapTokens = () => {
    const tempToken = fromToken;
    const tempAmount = fromAmount;
    setFromToken(toToken);
    setFromAmount(toAmount);
    setToToken(tempToken);
    setToAmount(tempAmount);
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

  const getTokenSymbol = (address: string) => {
    return getTokenInfo(address)?.symbol || 'Unknown';
  };

  const getTokenBalance = (address: string) => {
    // Mock balance - in production, fetch from wallet
    const symbol = getTokenSymbol(address);
    const mockBalances: { [key: string]: string } = {
      'ETH': '2.38',
      'WBTC': '0.05',
      'USDC': '1250.00',
      'USDT': '500.00',
      'DAI': '750.00',
      'PAXG': '1.2',
      'SLVT': '50.0'
    };
    return mockBalances[symbol] || '0.00';
  };

  const fromTokenUSD = tokenToUSD(fromToken, parseFloat(fromAmount) || 0);
  const toTokenUSD = tokenToUSD(toToken, parseFloat(toAmount) || 0);

  return (
    <div className="space-y-6">
      {/* Swap Card */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-lg">Swap Tokens</CardTitle>
            <button className="text-gray-400 hover:text-white transition-colors">
              ⚙️
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* From Token */}
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-gray-400 text-sm">From</label>
              <span className="text-gray-400 text-xs">
                Balance: {getTokenBalance(fromToken)} {getTokenSymbol(fromToken)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={fromAmount}
                  onChange={(e) => {
                    setFromAmount(e.target.value);
                    calculateToAmount(e.target.value, fromToken, toToken);
                  }}
                  className="bg-transparent text-white text-2xl font-semibold outline-none w-full"
                  placeholder="0.0"
                />
                {parseFloat(fromAmount) > 0 && (
                  <p className="text-gray-500 text-sm mt-1">
                    {formatUSD(fromTokenUSD)}
                  </p>
                )}
              </div>
              <select
                value={fromToken}
                onChange={(e) => {
                  setFromToken(e.target.value);
                  calculateToAmount(fromAmount, e.target.value, toToken);
                }}
                className="bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 font-medium hover:bg-gray-750 transition-colors"
              >
                {TOKENS.map(token => (
                  <option key={token.address} value={token.address}>
                    {token.symbol}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Swap Direction Button */}
          <div className="flex justify-center -my-1 relative z-10">
            <button
              onClick={handleSwapTokens}
              className="bg-gray-800 border-4 border-gray-900 rounded-xl p-2 hover:bg-gray-700 transition-colors shadow-lg"
            >
              <span className="text-white text-xl block transform hover:rotate-180 transition-transform duration-300">
                ⇅
              </span>
            </button>
          </div>

          {/* To Token */}
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-gray-400 text-sm">To</label>
              <span className="text-gray-400 text-xs">
                Balance: {getTokenBalance(toToken)} {getTokenSymbol(toToken)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={toAmount}
                  onChange={(e) => setToAmount(e.target.value)}
                  className="bg-transparent text-white text-2xl font-semibold outline-none w-full"
                  placeholder="0.0"
                />
                {parseFloat(toAmount) > 0 && (
                  <p className="text-gray-500 text-sm mt-1">
                    {formatUSD(toTokenUSD)}
                  </p>
                )}
              </div>
              <select
                value={toToken}
                onChange={(e) => {
                  setToToken(e.target.value);
                  calculateToAmount(fromAmount, fromToken, e.target.value);
                }}
                className="bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 font-medium hover:bg-gray-750 transition-colors"
              >
                {TOKENS.map(token => (
                  <option key={token.address} value={token.address}>
                    {token.symbol}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Slippage Control */}
          <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
            <span className="text-gray-400 text-sm flex items-center gap-1">
              ⚠️ Slippage tolerance
            </span>
            <div className="flex items-center gap-2">
              {[0.1, 0.5, 1.0].map((value) => (
                <button
                  key={value}
                  onClick={() => setSlippage(value)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    slippage === value
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {value}%
                </button>
              ))}
            </div>
          </div>

          {/* Token Fee Warnings */}
          {parseFloat(fromAmount) > 0 && (
            <TokenFeeWarning tokenAddress={fromToken} amount={parseFloat(fromAmount)} />
          )}
          {parseFloat(toAmount) > 0 && (
            <TokenFeeWarning tokenAddress={toToken} amount={parseFloat(toAmount)} />
          )}

          {/* Analyze Button */}
          <Button
            onClick={handleAnalyze}
            disabled={loading || !walletAddress || parseFloat(fromAmount) <= 0}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-6 text-lg transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span>
                Analyzing...
              </span>
            ) : (
              'Analyze Swap'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert className="bg-red-900/20 border-red-700">
          <AlertDescription className="text-red-200 flex items-center gap-2">
            <span>❌</span>
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Analysis Results */}
      {analysis && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <span className="text-xl">📊</span>
              Fee Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Recommendation Badge */}
            <div className="flex items-center justify-between p-4 bg-gray-900 rounded-lg">
              <div>
                <p className="text-gray-400 text-sm">Recommendation</p>
                <p className="text-white text-lg font-bold">
                  {formatRecommendation(analysis.recommendation)}
                </p>
              </div>
              <Badge className={`${getRecommendationColor(analysis.recommendation)} text-white px-4 py-2 text-sm`}>
                {(analysis.timing.confidence * 100).toFixed(0)}% Confidence
              </Badge>
            </div>

            {/* Savings Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-green-900/20 border border-green-700 rounded-lg">
                <p className="text-green-400 text-sm mb-1">Potential Savings</p>
                <p className="text-white text-2xl font-bold">
                  ${analysis.savings.amount.toFixed(2)}
                </p>
                <p className="text-green-400 text-sm">
                  {analysis.savings.percentage.toFixed(1)}% saved
                </p>
              </div>

              {analysis.timing.waitTime ? (
                <div className="p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                  <p className="text-yellow-400 text-sm mb-1">Wait Time</p>
                  <p className="text-white text-2xl font-bold">
                    {Math.round(analysis.timing.waitTime / 60)}m
                  </p>
                  <p className="text-yellow-400 text-sm">Recommended</p>
                </div>
              ) : (
                <div className="p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
                  <p className="text-blue-400 text-sm mb-1">Confidence</p>
                  <p className="text-white text-2xl font-bold">
                    {(analysis.timing.confidence * 100).toFixed(0)}%
                  </p>
                  <p className="text-blue-400 text-sm">High confidence</p>
                </div>
              )}
            </div>

            {/* Route Comparison */}
            <div>
              <p className="text-gray-400 text-sm mb-3">Route Comparison</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-900 rounded-lg border border-gray-700">
                  <p className="text-gray-400 text-xs mb-2">Current Route</p>
                  <p className="text-white font-medium">{analysis.routes.current.protocol}</p>
                  <p className="text-gray-400 text-sm">${analysis.routes.current.cost.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-green-900/20 rounded-lg border border-green-700">
                  <p className="text-green-400 text-xs mb-2 flex items-center gap-1">
                    <span>✓</span>
                    Optimal Route
                  </p>
                  <p className="text-white font-medium">{analysis.routes.optimal.protocol}</p>
                  <p className="text-green-400 text-sm">${analysis.routes.optimal.cost.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!analysis && !loading && !error && (
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-8 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-white text-lg font-medium mb-2">Fee Analysis</h3>
            <p className="text-gray-400 text-sm max-w-md mx-auto">
              Enter swap details to get personalized fee optimization recommendations
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
