// =============================================================================
// StatsCard Component - Dashboard Statistics Display
// =============================================================================

import React from 'react';
import { Card, CardContent } from './ui/card';

interface StatsCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  iconColor?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  icon,
  label,
  value,
  iconColor = 'text-green-400'
}) => {
  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`${iconColor} text-xl`}>
            {icon}
          </div>
          <div>
            <p className="text-gray-400 text-sm">{label}</p>
            <p className="text-white text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
