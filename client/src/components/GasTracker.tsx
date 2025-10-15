// =============================================================================
// GasTracker Component - Live Gas Price Monitoring with Forecast
// =============================================================================

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { getOrchestrator } from '../services/orchestrator';

interface GasData {
  current: number;
  status: 'Low' | 'Medium' | 'High';
  forecast: { block: number; gwei: number; time: string }[];
}

export const GasTracker: React.FC = () => {
  const [gasData, setGasData] = useState<GasData>({
    current: 0,
    status: 'Medium',
    forecast: []
  });
  const [lastUpdate, setLastUpdate] = useState<string>('');

  useEffect(() => {
    const fetchGasData = async () => {
      try {
        const orchestrator = getOrchestrator();
        const priceData = await orchestrator.getCurrentGasPrices();

        const avgPrice = priceData.standard;
        const status = avgPrice < 30 ? 'Low' : avgPrice < 60 ? 'Medium' : 'High';

        // Generate forecast data from the gas price prediction
        const forecast = priceData.forecast.next5Blocks.map((price: number, idx: number) => ({
          block: idx + 1,
          gwei: Math.round(price),
          time: `+${(idx + 1) * 12}s`
        }));

        setGasData({
          current: Math.round(avgPrice),
          status,
          forecast: forecast.slice(0, 6)
        });

        setLastUpdate(new Date().toLocaleTimeString());
      } catch (error) {
        console.error('Failed to fetch gas data:', error);
      }
    };

    fetchGasData();
    const interval = setInterval(fetchGasData, 12000); // Update every 12 seconds (1 block)

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    switch (gasData.status) {
      case 'Low': return 'bg-green-500';
      case 'Medium': return 'bg-yellow-500';
      case 'High': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const maxGwei = Math.max(...gasData.forecast.map(f => f.gwei), gasData.current);
  const minGwei = Math.min(...gasData.forecast.map(f => f.gwei), gasData.current);

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <span className="text-green-400">⚡</span>
            Gas Tracker
          </CardTitle>
          <Badge className={`${getStatusColor()} text-white px-3`}>
            STABLE
          </Badge>
        </div>
        <p className="text-gray-400 text-xs">
          Live Ethereum network fees • Updated {lastUpdate}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Gas Price */}
        <div className="text-center py-4 bg-gray-900 rounded-lg">
          <p className="text-6xl font-bold text-green-400">{gasData.current}</p>
          <p className="text-gray-400 text-sm mt-1">gwei • {gasData.status}</p>
        </div>

        {/* Next Block Preview */}
        {gasData.forecast.length > 0 && (
          <div className="bg-gray-900 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-400 text-sm">Next Block</p>
              <p className="text-white font-bold">
                {gasData.forecast[0].gwei} gwei
                <span className="text-gray-500 text-xs ml-1">~{gasData.forecast[0].time.replace('+', '')}</span>
              </p>
            </div>
          </div>
        )}

        {/* 6-Block Forecast Chart */}
        <div>
          <p className="text-gray-400 text-sm mb-3">6-Block Forecast</p>
          <div className="flex items-end justify-between gap-2 h-24">
            {gasData.forecast.map((block, idx) => {
              const height = ((block.gwei - minGwei) / (maxGwei - minGwei || 1)) * 100;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-green-500 rounded-t transition-all duration-300 hover:bg-green-400"
                    style={{ height: `${Math.max(height, 20)}%` }}
                    title={`Block ${block.block}: ${block.gwei} gwei`}
                  />
                  <p className="text-gray-500 text-xs">{block.gwei}</p>
                  <p className="text-gray-600 text-xs">{block.time}</p>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
