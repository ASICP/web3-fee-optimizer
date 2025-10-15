// =============================================================================
// QuickActions Component - Transaction History and Reports Access
// =============================================================================

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export const QuickActions: React.FC = () => {
  const actions = [
    {
      icon: '🔄',
      label: 'Transaction History',
      description: 'View all optimized transactions',
      disabled: false
    },
    {
      icon: '📊',
      label: 'Savings Report',
      description: 'Download detailed analytics',
      disabled: false
    }
  ];

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-white text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.map((action, idx) => (
          <button
            key={idx}
            disabled={action.disabled}
            className="w-full flex items-center gap-3 p-3 bg-gray-900 rounded-lg hover:bg-gray-750 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            <span className="text-2xl">{action.icon}</span>
            <div>
              <p className="text-white text-sm font-medium">{action.label}</p>
              <p className="text-gray-400 text-xs">{action.description}</p>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
};
