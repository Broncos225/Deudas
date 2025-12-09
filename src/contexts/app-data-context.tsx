
"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo, useEffect } from 'react';
import type { Debtor, Debt, ActivityLog, Settlement, Category, DebtUserMetadata } from '@/lib/types';
import { useCollection, useFirestore, useUser, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, query, where, Timestamp } from 'firebase/firestore';

type Currency = 'COP' | 'USD' | 'EUR';

interface AppDataContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  formatUserCurrency: (amount: number, currencyCode?: Currency) => string;
  
  // Data modification functions
  addDebt: (debt: Omit<Debt, 'id' | 'payments' | 'debtorName'>) => Promise<void>;
  addActivityLog: (message: string, debtId: string, participants: string[], userPhotoUrl?: string | null) => void;

  // Raw data from Firestore
  debtors: Debtor[];
  privateDebts: Debt[];
  sharedDebts: Debt[];
  settlements: Settlement[];
  categories: Category[];
  
  // Combined and processed data
  allDebts: Debt[];

  // Loading states
  isLoading: boolean;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>('COP');
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  // --- Data Fetching ---
  const debtorsRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return collection(firestore, 'users', user.uid, 'debtors');
  }, [firestore, user?.uid]);

  const privateDebtsRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return collection(firestore, 'users', user.uid, 'debts');
  }, [firestore, user?.uid]);

  const sharedDebtsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    const q = query(collection(firestore, 'debts_shared'), where('participants', 'array-contains', user.uid));
    return q;
  }, [firestore, user?.uid]);

  const settlementsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'settlements'), where('participants', 'array-contains', user.uid));
  }, [firestore, user?.uid]);

  const categoriesRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return collection(firestore, 'users', user.uid, 'categories');
  }, [firestore, user?.uid]);

  const debtUserMetadataQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'debt_user_metadata'), where('userId', '==', user.uid));
  }, [firestore, user?.uid]);


  const { data: debtorsData, isLoading: isLoadingDebtors } = useCollection<Debtor>(debtorsRef);
  const { data: privateDebtsData, isLoading: isLoadingPrivateDebts } = useCollection<Debt>(privateDebtsRef);
  const { data: sharedDebtsData, isLoading: isLoadingSharedDebts } = useCollection<Debt>(sharedDebtsQuery);
  const { data: settlementsData, isLoading: isLoadingSettlements } = useCollection<Settlement>(settlementsQuery);
  const { data: categoriesData, isLoading: isLoadingCategories } = useCollection<Category>(categoriesRef);
  const { data: debtUserMetadata, isLoading: isLoadingDebtUserMetadata } = useCollection<DebtUserMetadata>(debtUserMetadataQuery);


  const getUsername = (email: string | null | undefined) => {
    if (!email) return 'Usuario';
    const username = email.split('@')[0];
    return username.charAt(0).toUpperCase() + username.slice(1);
  }

  const addActivityLog = useCallback((message: string, debtId: string, participants: string[], userPhotoUrl?: string | null) => {
    if (!firestore || !user) return;
    
    if (!participants || participants.length === 0) {
      console.warn('⚠️ No se creó log de actividad: participants está vacío', { message, debtId });
      return;
    }
    
    const activityLog: Omit<ActivityLog, 'id'> = {
      debtId: debtId,
      userId: user.uid,
      userName: user.displayName || getUsername(user.email),
      userPhotoUrl: userPhotoUrl || undefined,
      message: message,
      timestamp: Timestamp.now(),
      participants: participants
    };
  
    addDocumentNonBlocking(collection(firestore, 'activity_logs'), activityLog);
}, [firestore, user]);

  const addDebt = useCallback(async (newDebt: Omit<Debt, 'id' | 'payments' | 'debtorName'>) => {
    if (!firestore || !user || !debtorsData) throw new Error("Not ready to add debt");
    const debtor = debtorsData.find(d => d.id === newDebt.debtorId);
    if (!debtor) throw new Error("Debtor not found");

    const debtToAdd: any = {
        ...newDebt,
        debtorName: debtor.name,
        payments: [],
        isSettled: false,
    };
    
    if (debtor.isAppUser && debtor.appUserId) {
        const participants = [user.uid, debtor.appUserId].sort();
        debtToAdd.isShared = true;
        debtToAdd.participants = participants;
        debtToAdd.userOneId = participants[0];
        debtToAdd.userTwoId = participants[1];
        debtToAdd.creatorId = user.uid; 
        delete debtToAdd.userId; 
        debtToAdd.status = 'pending';
        debtToAdd.approvedBy = [user.uid];
    } else {
        debtToAdd.isShared = false;
        debtToAdd.userId = user.uid;
        debtToAdd.status = 'approved';
    }

    if (debtToAdd.dueDate === undefined) delete debtToAdd.dueDate;
    if (debtToAdd.items === undefined) delete debtToAdd.items;
    if (debtToAdd.receiptUrl === undefined) delete debtToAdd.receiptUrl;

    const collectionRef = debtToAdd.isShared 
      ? collection(firestore, 'debts_shared')
      : collection(firestore, 'users', user.uid, 'debts');

    const docRef = await addDocumentNonBlocking(collectionRef, debtToAdd);
    if (debtToAdd.isShared && docRef && debtToAdd.participants && debtToAdd.participants.length > 0) {
        addActivityLog(
            `${getUsername(user.email)} creó una nueva deuda compartida "${debtToAdd.concept}" con ${debtor.name} (pendiente de aprobación).`, 
            docRef.id, 
            debtToAdd.participants,
            user.photoURL
        );
    }
  }, [firestore, user, debtorsData, addActivityLog]);


  const setCurrency = useCallback((newCurrency: Currency) => {
    setCurrencyState(newCurrency);
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
  
  const allDebts = useMemo(() => {
    if (!user || !debtorsData) return [];

    const metadataMap = new Map(debtUserMetadata?.map(meta => [meta.debtId, meta.categoryId]));

    const privateDebtsList = (privateDebtsData || []).map(debt => ({
        ...debt,
        categoryId: metadataMap.get(debt.id) || debt.categoryId,
    })).filter(d => !d.isShared);

    const processedSharedDebts = (sharedDebtsData || []).map(sharedDebt => {
        const creatorId = sharedDebt.creatorId || sharedDebt.userId; 
        const isCurrentUserTheCreator = creatorId === user.uid;
        
        let perspectiveDebtType = sharedDebt.type;
        if (!isCurrentUserTheCreator) {
            perspectiveDebtType = sharedDebt.type === 'iou' ? 'uome' : 'iou';
        }
        
        const otherUserId = sharedDebt.participants?.find(pId => pId !== user.uid);
        const localDebtorForSharedDebt = debtorsData.find(d => d.isAppUser && d.appUserId === otherUserId);

        return {
            ...sharedDebt,
            type: perspectiveDebtType,
            debtorName: localDebtorForSharedDebt?.name || `Usuario ${otherUserId?.substring(0, 5)}...`,
            debtorId: localDebtorForSharedDebt?.id || otherUserId || 'unknown_debtor',
            isCreator: isCurrentUserTheCreator,
            categoryId: metadataMap.get(sharedDebt.id),
        };
    });

    const all = [...privateDebtsList, ...processedSharedDebts];
    const uniqueDebts = new Map(all.map(d => [d.id, d]));
    
    return Array.from(uniqueDebts.values());
  }, [privateDebtsData, sharedDebtsData, debtorsData, user, debtUserMetadata]);


  const isLoading = isUserLoading || isLoadingDebtors || isLoadingPrivateDebts || isLoadingSharedDebts || isLoadingSettlements || isLoadingCategories || isLoadingDebtUserMetadata;

  const value = useMemo(() => ({
    currency,
    setCurrency,
    formatUserCurrency,
    addDebt,
    addActivityLog,
    debtors: debtorsData || [],
    privateDebts: privateDebtsData || [],
    sharedDebts: sharedDebtsData || [],
    settlements: settlementsData || [],
    categories: categoriesData || [],
    allDebts,
    isLoading,
  }), [
    currency, setCurrency, formatUserCurrency, addDebt, addActivityLog,
    debtorsData, privateDebtsData, sharedDebtsData, settlementsData, categoriesData,
    allDebts, isLoading
  ]);

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
