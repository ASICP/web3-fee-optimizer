// =============================================================================
// WalletPanel Component - Wallet Connection and Network Management
// =============================================================================

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface WalletPanelProps {
  walletAddress?: string;
  onConnect: () => void;
  onDisconnect: () => void;
}

type Network = 'Ethereum Mainnet' | 'Sepolia Testnet';

export const WalletPanel: React.FC<WalletPanelProps> = ({
  walletAddress,
  onConnect,
  onDisconnect
}) => {
  const [selectedNetwork, setSelectedNetwork] = useState<Network>('Ethereum Mainnet');
  const [showNetworks, setShowNetworks] = useState(false);

  const networks: Network[] = ['Ethereum Mainnet', 'Sepolia Testnet'];

  const handleNetworkChange = (network: Network) => {
    setSelectedNetwork(network);
    setShowNetworks(false);
  };

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-white text-lg flex items-center gap-2">
          <span className="text-green-400">●</span>
          {walletAddress ? 'MetaMask Connected' : 'Connect Wallet'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {walletAddress ? (
          <>
            {/* Connected State */}
            <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">🦊</span>
                </div>
                <div>
                  <p className="text-white font-medium text-sm">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </p>
                  <p className="text-gray-400 text-xs flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    View on Explorer
                  </p>
                </div>
              </div>
              <Badge className="bg-green-500 text-white">Connected</Badge>
            </div>

            {/* Network Selector */}
            <div>
              <p className="text-gray-400 text-sm mb-2">Network</p>
              <div className="relative">
                <button
                  onClick={() => setShowNetworks(!showNetworks)}
                  className="w-full flex items-center justify-between p-3 bg-gray-900 rounded-lg text-white hover:bg-gray-750 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {selectedNetwork === 'Ethereum Mainnet' ? '🔷' : '🔶'}
                    </span>
                    <span className="text-sm">{selectedNetwork}</span>
                  </div>
                  <Badge className="bg-blue-500 text-white text-xs">Current</Badge>
                </button>

                {showNetworks && (
                  <div className="absolute top-full mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg overflow-hidden z-10">
                    {networks.map((network) => (
                      <button
                        key={network}
                        onClick={() => handleNetworkChange(network)}
                        className={`w-full flex items-center gap-2 p-3 text-sm hover:bg-gray-800 transition-colors ${
                          network === selectedNetwork ? 'bg-gray-800 text-white' : 'text-gray-400'
                        }`}
                      >
                        <span>{network === 'Ethereum Mainnet' ? '🔷' : '🔶'}</span>
                        <span>{network}</span>
                        {network === selectedNetwork && (
                          <span className="ml-auto text-green-400">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Disconnect Button */}
            <Button
              onClick={onDisconnect}
              variant="outline"
              className="w-full bg-transparent border-gray-600 text-gray-400 hover:bg-gray-900 hover:text-white"
            >
              Disconnect
            </Button>
          </>
        ) : (
          <>
            {/* Disconnected State */}
            <p className="text-gray-400 text-sm">
              Connect your wallet to analyze transactions and optimize gas fees
            </p>

            <div className="space-y-2">
              <Button
                onClick={onConnect}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center gap-2"
              >
                <span className="text-lg">🦊</span>
                <span>MetaMask</span>
              </Button>

              <Button
                disabled
                variant="outline"
                className="w-full bg-transparent border-gray-600 text-gray-500 cursor-not-allowed"
              >
                <span className="mr-2">↗️</span>
                <span>WalletConnect</span>
                <Badge className="ml-2 bg-blue-500 text-white text-xs">Coming Soon</Badge>
              </Button>
            </div>

            <div className="flex items-start gap-2 p-3 bg-gray-900 rounded-lg">
              <span className="text-gray-400">ℹ️</span>
              <p className="text-gray-400 text-xs">
                Make sure your wallet is installed and unlocked
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
