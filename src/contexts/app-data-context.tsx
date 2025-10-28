
"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

type Currency = 'COP' | 'USD' | 'EUR';

interface AppDataContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  formatUserCurrency: (amount: number, currencyCode?: Currency) => string;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency>('COP');

  const formatUserCurrency = useCallback((amount: number, currencyCode?: Currency) => {
    const code = currencyCode || currency;
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }, [currency]);

  const value = {
    currency,
    setCurrency,
    formatUserCurrency,
  };

  return (
    <AppDataContext.Provider value={value}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (context === undefined) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return context;
}
