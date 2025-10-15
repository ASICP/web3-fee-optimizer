// =============================================================================
// Web3 Wallet Utilities - MetaMask Integration
// =============================================================================
// Provides real MetaMask wallet connection, network detection, and switching
// Supports Ethereum Mainnet and Sepolia Testnet

export interface Network {
  chainId: string;          // Hex format (e.g., '0x1' for mainnet)
  chainName: string;        // Network name for MetaMask
  displayName: string;      // User-friendly display name
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];        // RPC endpoints
  blockExplorerUrls: string[];  // Block explorer URLs
}

/**
 * Supported Networks Configuration
 * - MAINNET: Ethereum Mainnet (Chain ID: 1 / 0x1)
 * - SEPOLIA: Sepolia Testnet (Chain ID: 11155111 / 0xaa36a7)
 */
export const NETWORKS: { [key: string]: Network } = {
  MAINNET: {
    chainId: '0x1',         // Ethereum Mainnet (Chain ID: 1)
    chainName: 'Ethereum Mainnet',
    displayName: 'Ethereum Mainnet',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    rpcUrls: ['https://eth.llamarpc.com'],
    blockExplorerUrls: ['https://etherscan.io']
  },
  SEPOLIA: {
    chainId: '0xaa36a7',    // Sepolia Testnet (Chain ID: 11155111)
    chainName: 'Sepolia Testnet',
    displayName: 'Sepolia Testnet',
    nativeCurrency: {
      name: 'Sepolia Ether',
      symbol: 'ETH',
      decimals: 18
    },
    rpcUrls: ['https://sepolia.infura.io/v3/', 'https://rpc.sepolia.org'],
    blockExplorerUrls: ['https://sepolia.etherscan.io']
  }
};

/**
 * Check if MetaMask browser extension is installed
 * @returns {boolean} True if MetaMask is available
 */
export const isMetaMaskInstalled = (): boolean => {
  return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
};

/**
 * Connect to MetaMask wallet
 * Prompts user to connect their MetaMask wallet and returns the selected address
 * @returns {Promise<string>} The connected Ethereum address
 * @throws {Error} If MetaMask is not installed or user rejects connection
 */
export const connectMetaMask = async (): Promise<string> => {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
  }

  try {
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts'
    });

    if (accounts.length === 0) {
      throw new Error('No accounts found. Please unlock MetaMask.');
    }

    return accounts[0];
  } catch (error: any) {
    if (error.code === 4001) {
      throw new Error('User rejected the connection request.');
    }
    throw error;
  }
};

/**
 * Get the current chain ID from MetaMask
 * @returns {Promise<string>} The current chain ID in hex format (e.g., '0x1')
 * @throws {Error} If MetaMask is not installed
 */
export const getCurrentChainId = async (): Promise<string> => {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed.');
  }

  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  return chainId;
};

/**
 * Convert chain ID to human-readable network name
 * @param {string} chainId - The chain ID in hex format
 * @returns {string} The network display name (e.g., 'Ethereum Mainnet')
 */
export const getNetworkName = (chainId: string): string => {
  const network = Object.values(NETWORKS).find(n => n.chainId === chainId);
  return network?.displayName || 'Unknown Network';
};

/**
 * Switch MetaMask to a specific network
 * Attempts to switch to the requested network. If network is not added to MetaMask, prompts to add it.
 * @param {keyof typeof NETWORKS} networkKey - The network key ('MAINNET' or 'SEPOLIA')
 * @returns {Promise<void>}
 * @throws {Error} If user rejects the network switch or if operation fails
 */
export const switchNetwork = async (networkKey: keyof typeof NETWORKS): Promise<void> => {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed.');
  }

  const network = NETWORKS[networkKey];

  try {
    // Try to switch to the network
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: network.chainId }]
    });
  } catch (switchError: any) {
    // This error code indicates that the chain has not been added to MetaMask
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: network.chainId,
              chainName: network.chainName,
              nativeCurrency: network.nativeCurrency,
              rpcUrls: network.rpcUrls,
              blockExplorerUrls: network.blockExplorerUrls
            }
          ]
        });
      } catch (addError) {
        throw new Error('Failed to add network to MetaMask.');
      }
    } else if (switchError.code === 4001) {
      throw new Error('User rejected the network switch request.');
    } else {
      throw switchError;
    }
  }
};

// Listen for account changes
export const onAccountsChanged = (callback: (accounts: string[]) => void): void => {
  if (!isMetaMaskInstalled()) return;

  window.ethereum.on('accountsChanged', callback);
};

// Listen for chain changes
export const onChainChanged = (callback: (chainId: string) => void): void => {
  if (!isMetaMaskInstalled()) return;

  window.ethereum.on('chainChanged', callback);
};

// Remove event listeners
export const removeListeners = (): void => {
  if (!isMetaMaskInstalled()) return;

  window.ethereum.removeAllListeners('accountsChanged');
  window.ethereum.removeAllListeners('chainChanged');
};

// Get account balance
export const getBalance = async (address: string): Promise<string> => {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed.');
  }

  const balance = await window.ethereum.request({
    method: 'eth_getBalance',
    params: [address, 'latest']
  });

  // Convert from wei to ETH
  const balanceInEth = parseInt(balance, 16) / 1e18;
  return balanceInEth.toFixed(4);
};

// Type declarations for window.ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}
