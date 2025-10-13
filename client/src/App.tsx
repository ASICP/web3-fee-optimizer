// =============================================================================
// Main Application Entry Point
// =============================================================================

import React, { useEffect, useState } from 'react';
import { SwapInterface } from './components/SwapInterface';
import { initializeOrchestrator } from './services/orchestrator';

function App() {
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [mockMode, setMockMode] = useState(true);

  useEffect(() => {
    initializeOrchestrator(mockMode);
  }, [mockMode]);

  const connectWallet = async () => {
    const mockAddress = '0x742d35Cc6635C0532925a3b8D777532DC4DE0034';
    setWalletAddress(mockAddress);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">
            Web3 Fee Optimizer
          </h1>
          {!walletAddress ? (
            <button onClick={connectWallet} className="bg-blue-600 text-white px-4 py-2 rounded-md">
              Connect Wallet
            </button>
          ) : (
            <div className="text-sm text-gray-600">
              Connected: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </div>
          )}
        </div>
      </header>
      <main className="container mx-auto py-8">
        <SwapInterface walletAddress={walletAddress} />
      </main>
    </div>
  );
}

export default App;