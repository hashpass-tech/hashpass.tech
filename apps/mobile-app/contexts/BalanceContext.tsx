import React, { createContext, useContext, ReactNode, useCallback, useState } from 'react';
import { lukasRewardService } from '../lib/lukas-reward-service';
import { useAuth } from '../hooks/useAuth';

interface BalanceContextType {
  refreshBalance: () => Promise<void>;
  isRefreshing: boolean;
}

const BalanceContext = createContext<BalanceContextType | undefined>(undefined);

interface BalanceProviderProps {
  children: ReactNode;
}

export function BalanceProvider({ children }: BalanceProviderProps) {
  const { isLoggedIn } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshBalance = useCallback(async () => {
    if (!isLoggedIn) return;
    
    setIsRefreshing(true);
    try {
      // The backend resolves the account's Supabase identity. Never pass the
      // provider-specific `user.id` (which may be a Better Auth ID) to a DB query.
      const balance = await lukasRewardService.getUserBalance('LUKAS');
      
      // Update dashboard balance widgets with the backend result.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('balance:refresh', { detail: { balance } }));
      }
    } catch (error) {
      console.error('❌ Error refreshing balance:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [isLoggedIn]);

  const value: BalanceContextType = {
    refreshBalance,
    isRefreshing,
  };

  return (
    <BalanceContext.Provider value={value}>
      {children}
    </BalanceContext.Provider>
  );
}

export function useBalance(): BalanceContextType {
  const context = useContext(BalanceContext);
  if (context === undefined) {
    throw new Error('useBalance must be used within a BalanceProvider');
  }
  return context;
}

