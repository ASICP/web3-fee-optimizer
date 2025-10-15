// =============================================================================
// Main Application Entry Point
// =============================================================================

import React, { useEffect, useState } from 'react';
import { SwapInterface } from './components/SwapInterface';
import { StatsCard } from './components/StatsCard';
import { GasTracker } from './components/GasTracker';
import { WalletPanel } from './components/WalletPanel';
import { QuickActions } from './components/QuickActions';
import { initializeOrchestrator } from './services/orchestrator';

function App() {
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [mockMode, setMockMode] = useState(true);

  useEffect(() => {
    initializeOrchestrator(mockMode);
  }, [mockMode]);

  const connectWallet = async () => {
    // TODO: Integrate real MetaMask connection
    const mockAddress = '0x742d35Cc6635C0532925a3b8D777532DC4DE0034';
    setWalletAddress(mockAddress);
  };

  const disconnectWallet = () => {
    setWalletAddress('');
  };

  // Mock statistics - TODO: Replace with real data from backend
  const stats = {
    totalSaved: '$132.06',
    optimizedTxs: '23',
    avgSavings: '20%',
    thisWeek: '$37.05'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-xl font-bold">⚡</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">
                  Web3 Fee Optimizer
                </h1>
                <p className="text-xs text-gray-400">
                  AI-powered gas fee optimization
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1 bg-green-500/20 rounded-full">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-400 text-sm font-medium">Live</span>
              </div>
              {mockMode && (
                <div className="px-3 py-1 bg-yellow-500/20 rounded-full">
                  <span className="text-yellow-400 text-sm font-medium">Demo Mode</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Welcome Section - Show only when wallet not connected */}
        {!walletAddress && (
          <div className="mb-8 text-center py-12 bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-2xl border border-gray-700">
            <div className="text-6xl mb-4">⚡</div>
            <h2 className="text-3xl font-bold text-white mb-3">
              Save on Transaction Fees
            </h2>
            <p className="text-gray-400 mb-6 max-w-2xl mx-auto">
              Connect your wallet to start optimizing gas fees with AI-powered recommendations.
              Save 20-40% on every transaction.
            </p>
            <button
              onClick={connectWallet}
              className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-lg font-semibold transition-colors inline-flex items-center gap-2"
            >
              <span className="text-xl">🦊</span>
              <span>Connect Your Wallet</span>
            </button>
            <div className="mt-6 flex items-center justify-center gap-8 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span className="text-gray-400">20-40% Average Savings</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span className="text-gray-400">MEV Protected</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span className="text-gray-400">L2 Routing</span>
              </div>
            </div>
          </div>
        )}

        {/* Statistics Dashboard - Show only when wallet connected */}
        {walletAddress && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatsCard
              icon="💰"
              label="$ Total Saved"
              value={stats.totalSaved}
              iconColor="text-green-400"
            />
            <StatsCard
              icon="📊"
              label="Optimized Txs"
              value={stats.optimizedTxs}
              iconColor="text-blue-400"
            />
            <StatsCard
              icon="📈"
              label="Avg Savings"
              value={stats.avgSavings}
              iconColor="text-purple-400"
            />
            <StatsCard
              icon="📅"
              label="This Week"
              value={stats.thisWeek}
              iconColor="text-yellow-400"
            />
          </div>
        )}

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Swap Interface */}
          <div className="lg:col-span-2">
            <SwapInterface walletAddress={walletAddress} />
          </div>

          {/* Right Column - Wallet, Gas Tracker, Quick Actions */}
          <div className="space-y-6">
            <WalletPanel
              walletAddress={walletAddress}
              onConnect={connectWallet}
              onDisconnect={disconnectWallet}
            />
            <GasTracker />
            <QuickActions />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 py-6 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>
            Web3 Fee Optimizer v2.0 • Powered by AI •
            <a href="https://github.com/ASICP/web3-fee-optimizer" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300 ml-1">
              GitHub
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;