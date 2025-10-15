// =============================================================================
// TokenFeeWarning Component - Display Special Fee Information
// =============================================================================

import React from 'react';
import { Alert, AlertDescription } from './ui/alert';
import { getTokenInfo } from '../utils/tokenFees';

interface TokenFeeWarningProps {
  tokenAddress: string;
  amount: number;
}

export const TokenFeeWarning: React.FC<TokenFeeWarningProps> = ({ tokenAddress, amount }) => {
  const token = getTokenInfo(tokenAddress);

  if (!token || !token.hasSpecialFees || !token.feeStructure) {
    return null;
  }

  const feeCalc = token.feeStructure.calculate(amount);

  return (
    <Alert className="bg-yellow-900/20 border-yellow-700">
      <AlertDescription className="text-yellow-200 text-sm">
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-lg">⚠️</span>
            <div className="flex-1">
              <p className="font-semibold mb-1">{token.symbol} Special Fees</p>
              <p className="text-xs text-yellow-300">{token.feeStructure.description}</p>
            </div>
          </div>

          {amount > 0 && (
            <div className="ml-7 p-2 bg-gray-900/50 rounded text-xs space-y-1">
              <div className="flex justify-between">
                <span>Fee for {amount} {token.symbol}:</span>
                <span className="font-semibold">
                  {feeCalc.fee.toFixed(4)} {token.symbol} ({feeCalc.percentage.toFixed(2)}%)
                </span>
              </div>
              <div className="flex justify-between">
                <span>Fee in USD:</span>
                <span className="font-semibold">
                  ${(feeCalc.fee * token.price).toFixed(2)}
                </span>
              </div>
              {feeCalc.warning && (
                <p className="text-yellow-400 mt-2">{feeCalc.warning}</p>
              )}
            </div>
          )}

          {token.symbol === 'SLVT' && (
            <p className="ml-7 text-xs text-gray-400">
              Note: Redemption requires minimum 200oz. Shipping, insurance, and tax vary by location.
            </p>
          )}

          {token.symbol === 'PAXG' && (
            <p className="ml-7 text-xs text-gray-400">
              Note: No storage fees. Fees shown are for Paxos platform creation/destruction.
            </p>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};
