
"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo } from 'react';
import type { Debtor, Debt } from '@/lib/types';

type Currency = 'COP' | 'USD' | 'EUR';

interface AppDataContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  formatUserCurrency: (amount: number, currencyCode?: Currency) => string;
  debtors: Debtor[];
  setDebtors: (debtors: Debtor[]) => void;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>('COP');
  const [debtors, setDebtorsState] = useState<Debtor[]>([]);

  const setCurrency = useCallback((newCurrency: Currency) => {
    setCurrencyState(newCurrency);
  }, []);

  const setDebtors = useCallback((newDebtors: Debtor[]) => {
    setDebtorsState(newDebtors);
  }, []);

  const formatUserCurrency = useCallback((amount: number, currencyCode?: Currency) => {
    const code = currencyCode || currency;
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }, [currency]);

  const value = useMemo(() => ({
    currency,
    setCurrency,
    formatUserCurrency,
    debtors,
    setDebtors,
  }), [currency, setCurrency, formatUserCurrency, debtors, setDebtors]);

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
