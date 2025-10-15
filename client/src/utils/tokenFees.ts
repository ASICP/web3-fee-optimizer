// =============================================================================
// Token Fee Utilities - Special Fee Calculations for PAXG and SLVT
// =============================================================================

export interface TokenFeeInfo {
  symbol: string;
  address: string;
  name: string;
  decimals: number;
  price: number;
  hasSpecialFees: boolean;
  feeStructure?: {
    type: 'tiered' | 'flat' | 'percentage';
    description: string;
    calculate: (amount: number) => { fee: number; percentage: number; warning?: string };
  };
}

/**
 * Calculate PAXG creation/destruction fees based on tiered structure
 * Note: Creation fees waived until 10/31/25 (promotional period)
 */
export const calculatePAXGFee = (amount: number, isCreation: boolean = false): {
  fee: number;
  percentage: number;
  warning?: string
} => {
  // Creation fees waived until 10/31/25
  const promotionalPeriod = new Date() < new Date('2025-10-31');

  if (isCreation && promotionalPeriod) {
    return {
      fee: 0,
      percentage: 0,
      warning: '✓ Creation fee waived until 10/31/25'
    };
  }

  // Tiered fee structure
  if (amount < 0.03) {
    return { fee: 0, percentage: 0, warning: '⚠️ Minimum purchase is 0.03 PAXG' };
  } else if (amount < 2) {
    return { fee: 0.02, percentage: (0.02 / amount) * 100 };
  } else if (amount < 25) {
    return { fee: amount * 0.01, percentage: 1.0 };
  } else if (amount < 50) {
    return { fee: amount * 0.0075, percentage: 0.75 };
  } else if (amount < 75) {
    return { fee: amount * 0.005, percentage: 0.5 };
  } else if (amount < 200) {
    return { fee: amount * 0.0025, percentage: 0.25 };
  } else if (amount < 800) {
    return { fee: amount * 0.0015, percentage: 0.15 };
  } else {
    return { fee: amount * 0.00125, percentage: 0.125 };
  }
};

/**
 * Calculate SLVT transaction fees based on tiered structure
 */
export const calculateSLVTFee = (amount: number): {
  fee: number;
  percentage: number;
  warning?: string
} => {
  if (amount <= 2) {
    return { fee: 0, percentage: 0, warning: '✓ Free for transactions ≤ 2 SLVT' };
  } else if (amount <= 500) {
    return { fee: amount * 0.01, percentage: 1.0 };
  } else {
    return { fee: amount * 0.008, percentage: 0.8 };
  }
};

/**
 * Token definitions with fee information
 */
export const TOKENS: TokenFeeInfo[] = [
  {
    symbol: 'ETH',
    address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    name: 'Ethereum',
    decimals: 18,
    price: 2500, // TODO: Replace with real-time price feed
    hasSpecialFees: false
  },
  {
    symbol: 'WBTC',
    address: '0x2260FAC5E5542a773Aa44fBCfeDc1F2F4C97b07b', // Mainnet WBTC
    name: 'Wrapped Bitcoin',
    decimals: 8,
    price: 43000, // TODO: Replace with real-time price feed
    hasSpecialFees: false
  },
  {
    symbol: 'USDC',
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    name: 'USD Coin',
    decimals: 6,
    price: 1,
    hasSpecialFees: false
  },
  {
    symbol: 'USDT',
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    name: 'Tether',
    decimals: 6,
    price: 1,
    hasSpecialFees: false
  },
  {
    symbol: 'DAI',
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    name: 'Dai',
    decimals: 18,
    price: 1,
    hasSpecialFees: false
  },
  {
    symbol: 'PAXG',
    address: '0x45804880De22913dAFE09f4980848ECE6EcbAf78',
    name: 'Pax Gold',
    decimals: 18,
    price: 2650, // TODO: Replace with real-time gold price
    hasSpecialFees: true,
    feeStructure: {
      type: 'tiered',
      description: 'PAXG charges creation/destruction fees on tiered basis. Creation fees waived until 10/31/25.',
      calculate: (amount: number) => calculatePAXGFee(amount, false)
    }
  },
  {
    symbol: 'SLVT',
    address: '0x1Ef0048B9C3d1819d3d0BdF6Be92B9C76e4b7d75', // Mainnet SLVT (Silverton)
    name: 'Silver Token',
    decimals: 18,
    price: 31, // TODO: Replace with real-time silver price
    hasSpecialFees: true,
    feeStructure: {
      type: 'tiered',
      description: 'SLVT charges transaction fees: Free ≤2 SLVT, 1% for 3-500 SLVT, 0.8% for 501+ SLVT. Redemption requires minimum 200oz.',
      calculate: (amount: number) => calculateSLVTFee(amount)
    }
  }
];

/**
 * Get token information by address
 */
export const getTokenInfo = (address: string): TokenFeeInfo | undefined => {
  return TOKENS.find(token => token.address.toLowerCase() === address.toLowerCase());
};

/**
 * Calculate total fee including special token fees and gas costs
 */
export const calculateTotalFees = (
  tokenAddress: string,
  amount: number,
  gasCostUSD: number
): {
  gasFee: number;
  specialFee: number;
  specialFeePercentage: number;
  totalFee: number;
  warning?: string;
} => {
  const token = getTokenInfo(tokenAddress);

  if (!token || !token.hasSpecialFees || !token.feeStructure) {
    return {
      gasFee: gasCostUSD,
      specialFee: 0,
      specialFeePercentage: 0,
      totalFee: gasCostUSD
    };
  }

  const feeCalc = token.feeStructure.calculate(amount);
  const specialFeeUSD = feeCalc.fee * token.price;

  return {
    gasFee: gasCostUSD,
    specialFee: specialFeeUSD,
    specialFeePercentage: feeCalc.percentage,
    totalFee: gasCostUSD + specialFeeUSD,
    warning: feeCalc.warning
  };
};

/**
 * Format USD amount for display
 */
export const formatUSD = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Convert token amount to USD
 */
export const tokenToUSD = (tokenAddress: string, amount: number): number => {
  const token = getTokenInfo(tokenAddress);
  return token ? amount * token.price : 0;
};
