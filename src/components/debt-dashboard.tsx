
"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Debt, Payment, Debtor, Settlement } from '@/lib/types';
import DashboardHeader from '@/components/dashboard-header';
import { DebtsGrid } from '@/components/debts-grid';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownLeft, ArrowUpRight, LayoutGrid, List, Loader, PlusCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, useUser } from '@/firebase';
import { collection, doc, Timestamp, writeBatch } from 'firebase/firestore';
import { DebtorDetails } from './debtor-details';
import { DebtsByPerson } from './debts-by-person';
import { Skeleton } from './ui/skeleton';
import { AddDebtDialog } from './add-debt-dialog';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { DebtsChart } from './debts-chart';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { DebtsList } from './debts-list';


export default function DebtDashboard() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');


  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);
  
  const debtorsRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return collection(firestore, 'users', user.uid, 'debtors');
  }, [firestore, user?.uid]);

  const debtsRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return collection(firestore, 'users', user.uid, 'debts');
  }, [firestore, user?.uid]);

  const settlementsRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return collection(firestore, 'users', user.uid, 'settlements');
    }, [firestore, user?.uid]);
    
  const { data: debtors, isLoading: isLoadingDebtors } = useCollection<Debtor>(debtorsRef);
  const { data: debts, isLoading: isLoadingDebtsData } = useCollection<Debt>(debtsRef);
  const { data: settlements, isLoading: isLoadingSettlements } = useCollection<Settlement>(settlementsRef);

  const handleAddDebt = (newDebt: Omit<Debt, 'id' | 'payments' | 'userId' | 'debtorName'> & { receiptUrl?: string }) => {
    if (!debtsRef || !user || !debtors) return;
    const debtor = debtors.find(d => d.id === newDebt.debtorId);
    if (!debtor) return;

    const debtToAdd: Omit<Debt, 'id'> = {
      ...newDebt,
      debtorName: debtor.name,
      payments: [],
      userId: user.uid,
      isSettled: false,
    };
    addDocumentNonBlocking(debtsRef, debtToAdd);
  };
  
  const handleEditDebt = (debtId: string, updatedDebt: Partial<Omit<Debt, 'id'>>, debtorName: string) => {
    if (!debtsRef) return;
    const debtDocRef = doc(debtsRef, debtId);
    updateDocumentNonBlocking(debtDocRef, { ...updatedDebt, debtorName });
  };
  
  const handleDeleteDebt = (debtId: string) => {
    if (!debtsRef) return;
    const debtDocRef = doc(debtsRef, debtId);
    deleteDocumentNonBlocking(debtDocRef);
  };

  const handleAddPayment = (debtId: string, newPayment: Omit<Payment, 'id'>) => {
    if (!debtsRef || !debts) return;
    const debt = debts.find(d => d.id === debtId);
    if (!debt) return;
    
    const paymentToAdd: Payment = {
      ...newPayment,
      id: new Date().getTime().toString(),
    };

    const updatedPayments = [...debt.payments, paymentToAdd];
    updateDocumentNonBlocking(doc(debtsRef, debtId), { payments: updatedPayments });
  };

  const handleEditPayment = (debtId: string, paymentId: string, updatedPaymentData: Partial<Omit<Payment, 'id'>>) => {
    if (!debtsRef || !debts) return;
    const debt = debts.find(d => d.id === debtId);
    if (!debt) return;

    const updatedPayments = debt.payments.map(p => {
        if (p.id === paymentId) {
            return { ...p, ...updatedPaymentData, id: p.id };
        }
        return p;
    });

    updateDocumentNonBlocking(doc(debtsRef, debtId), { payments: updatedPayments });
  };

  const handleDeletePayment = (debtId: string, paymentId: string) => {
    if (!debtsRef || !debts) return;
    const debt = debts.find(d => d.id === debtId);
    if (!debt) return;

    const updatedPayments = debt.payments.filter(p => p.id !== paymentId);
    updateDocumentNonBlocking(doc(debtsRef, debtId), { payments: updatedPayments });
  };
  
  const handleSettleDebts = async (debtorId: string, iouTotal: number, uomeTotal: number, currency: string) => {
    if (!firestore || !user || !debts) return;

    const batch = writeBatch(firestore);
    const settlementId = doc(collection(firestore, 'dummy')).id; // Generate a unique ID
    const settlementAmount = Math.min(iouTotal, uomeTotal);
    const settlementDate = Timestamp.now();
    
    const settlementPaymentId = `settle_${settlementId}`;
    
    // Debts where I owe money (iou)
    const iouDebts = debts.filter(d => d.debtorId === debtorId && d.type === 'iou' && !d.isSettled);
    // Debts where they owe me money (uome)
    const uomeDebts = debts.filter(d => d.debtorId === debtorId && d.type === 'uome' && !d.isSettled);

    let debtsToCredit: Debt[];
    let debtsToDebit: Debt[];

    if (iouTotal > uomeTotal) {
        // I owe more. Debit my 'iou' debts, credit their 'uome' debts.
        debtsToDebit = iouDebts;
        debtsToCredit = uomeDebts;
    } else {
        // They owe more or it's equal. Debit their 'uome' debts, credit my 'iou' debts.
        debtsToDebit = uomeDebts;
        debtsToCredit = iouDebts;
    }

    // Apply the settlement as a payment to the smaller side, effectively paying it off.
    let creditRemaining = settlementAmount;
    for (const debt of debtsToCredit) {
        const debtRemaining = debt.amount - debt.payments.reduce((acc, p) => acc + p.amount, 0);
        const paymentAmount = Math.min(debtRemaining, creditRemaining);

        if (paymentAmount > 0) {
            const newPayment: Payment = {
                id: `${settlementPaymentId}_${debt.id}`,
                amount: paymentAmount,
                date: settlementDate,
                isSettlement: true,
                settlementId: settlementId,
            };
            const debtRef = doc(firestore, 'users', user.uid, 'debts', debt.id);
            batch.update(debtRef, { payments: [...debt.payments, newPayment] });
            creditRemaining -= paymentAmount;
        }
    }

    // Apply the settlement as a payment to the larger side.
    let debitRemaining = settlementAmount;
    for (const debt of debtsToDebit) {
        const debtRemaining = debt.amount - debt.payments.reduce((acc, p) => acc + p.amount, 0);
        const paymentAmount = Math.min(debtRemaining, debitRemaining);

        if (paymentAmount > 0) {
            const newPayment: Payment = {
                id: `${settlementPaymentId}_${debt.id}`,
                amount: paymentAmount,
                date: settlementDate,
                isSettlement: true,
                settlementId: settlementId,
            };
            const debtRef = doc(firestore, 'users', user.uid, 'debts', debt.id);
            batch.update(debtRef, { payments: [...debt.payments, newPayment] });
            debitRemaining -= paymentAmount;
        }
    }

    // Record the settlement event itself
    const settlementDocRef = doc(firestore, 'users', user.uid, 'settlements', settlementId);
    const newSettlement: Settlement = {
        id: settlementId,
        debtorId,
        date: settlementDate,
        amountSettled: settlementAmount,
        currency,
        userId: user.uid,
    };
    batch.set(settlementDocRef, newSettlement);

    try {
        await batch.commit();
    } catch (e) {
        const error = new FirestorePermissionError({
            path: `users/${user.uid}/settlements/${settlementId}`,
            operation: 'write',
            requestResourceData: { iouTotal, uomeTotal, currency, debtorId }
        });
        errorEmitter.emit('permission-error', error);
    }
  };
  
  const handleReverseSettlement = async (settlement: Settlement) => {
    if (!firestore || !user || !debts) return;
  
    const batch = writeBatch(firestore);
  
    // Find all debts that have a payment from this settlement
    const relatedDebts = debts.filter(d => d.payments.some(p => p.settlementId === settlement.id));
  
    for (const debt of relatedDebts) {
      // Filter out the payments related to this settlement
      const updatedPayments = debt.payments.filter(p => p.settlementId !== settlement.id);
      const debtRef = doc(firestore, 'users', user.uid, 'debts', debt.id);
      batch.update(debtRef, { payments: updatedPayments });
    }
  
    // Delete the settlement record
    const settlementRef = doc(firestore, 'users', user.uid, 'settlements', settlement.id);
    batch.delete(settlementRef);
  
    try {
        await batch.commit();
        toast({
          title: "Cruce Revertido",
          description: "El cruce de cuentas ha sido deshecho.",
        });
    } catch(e) {
        const error = new FirestorePermissionError({
            path: `users/${user.uid}/settlements/${settlement.id}`,
            operation: 'delete',
            requestResourceData: settlement
        });
        errorEmitter.emit('permission-error', error);
    }
  };

  const formatCurrency = (amount: number, currency: string) => new Intl.NumberFormat('es-CO', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);

  const { totalIOwe, totalOwedToMe } = useMemo(() => {
    if (!debts) return { totalIOwe: 0, totalOwedToMe: 0 };
    
    const totals = debts.reduce((acc, debt) => {
      const rate = debt.currency === 'USD' ? 4000 : debt.currency === 'EUR' ? 4500: 1; // Example fixed rate
      const remaining = debt.amount - debt.payments.reduce((sum, p) => sum + p.amount, 0);

      // Only consider debts with a remaining balance
      if (remaining <= 0) return acc;
      
      if (debt.type === 'iou') { // I owe you
        acc.totalIOwe += remaining * rate;
      } else { // You owe me
        acc.totalOwedToMe += remaining * rate;
      }
      return acc;
    }, { totalIOwe: 0, totalOwedToMe: 0 });
    
    return totals;
  }, [debts]);

  const handleAddDebtor = (newDebtor: Omit<Debtor, 'id' | 'userId'>) => {
    if (!debtorsRef || !user) return;
    const debtorToAdd = {
      ...newDebtor,
      userId: user.uid,
    };
    addDocumentNonBlocking(debtorsRef, debtorToAdd);
  };

  const handleEditDebtor = (debtorId: string, updatedData: Omit<Debtor, 'id' | 'userId'>) => {
    if (!debtorsRef) return;
    const debtorDocRef = doc(debtorsRef, debtorId);
    updateDocumentNonBlocking(debtorDocRef, updatedData);
  };

  const handleDeleteDebtor = (debtorId: string) => {
    if (!debtorsRef) return;
    const debtorDocRef = doc(debtorsRef, debtorId);
    deleteDocumentNonBlocking(debtorDocRef);
  };


  if (isUserLoading || !user) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-muted/40 items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground mt-4">Cargando...</p>
      </div>
    );
  }
  
  const addDebtDialog = (
    <AddDebtDialog onAddDebt={handleAddDebt} onEditDebt={handleEditDebt} debtors={debtors || []}>
        <Button size="sm" className="gap-1 bg-accent hover:bg-accent/90 text-accent-foreground text-xs md:text-sm" disabled={!debtors || debtors.length === 0}>
            <PlusCircle className="h-4 w-4" />
            Agregar Deuda
        </Button>
    </AddDebtDialog>
  );

  const isLoading = isLoadingDebtors || isLoadingDebtsData || isLoadingSettlements;
  
  const renderContentForDebts = (isSettled: boolean) => {
    const filteredDebts = debts?.filter(d => {
        const remaining = d.amount - d.payments.reduce((s, p) => s + p.amount, 0);
        const isPaid = remaining <= 0.01;
        return isSettled ? isPaid : !isPaid;
    }) || [];

    if (viewMode === 'list') {
        return <DebtsList
            debts={filteredDebts}
            debtors={debtors || []}
            onAddPayment={handleAddPayment}
            onEditDebt={handleEditDebt}
            onDeleteDebt={handleDeleteDebt}
            onEditPayment={handleEditPayment}
            onDeletePayment={handleDeletePayment}
            isLoading={isLoadingDebtsData || isLoadingDebtors}
        />;
    }
    
    return <DebtsGrid 
        debts={filteredDebts}
        debtors={debtors || []}
        onAddPayment={handleAddPayment} 
        onEditDebt={handleEditDebt}
        onDeleteDebt={handleDeleteDebt}
        onEditPayment={handleEditPayment}
        onDeletePayment={handleDeletePayment}
        isLoading={isLoadingDebtsData || isLoadingDebtors}
        showSettled={isSettled}
      />;
  };


  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <DashboardHeader addDebtDialog={addDebtDialog} />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total que Debes (aprox. COP)</CardTitle>
              <ArrowDownLeft className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              {isLoadingDebtsData ? (
                <Skeleton className="h-8 w-3/4" />
              ) : (
                <div className="text-2xl font-bold font-headline text-red-500">
                  {formatCurrency(totalIOwe, 'COP')}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total que Te Deben (aprox. COP)</CardTitle>
               <ArrowUpRight className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
               {isLoadingDebtsData ? (
                <Skeleton className="h-8 w-3/4" />
              ) : (
                <div className="text-2xl font-bold font-headline text-green-500">
                    {formatCurrency(totalOwedToMe, 'COP')}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <Tabs defaultValue="overview" className="w-full" value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center justify-between flex-wrap gap-2">
                <TabsList>
                    <TabsTrigger value="overview">Resumen</TabsTrigger>
                    <TabsTrigger value="all-debts">Deudas Activas</TabsTrigger>
                    <TabsTrigger value="history">Historial</TabsTrigger>
                    <TabsTrigger value="debtors">Contactos</TabsTrigger>
                </TabsList>
                {(activeTab === 'all-debts' || activeTab === 'history') && (
                    <ToggleGroup 
                        type="single" 
                        value={viewMode} 
                        onValueChange={(value) => value && setViewMode(value as 'grid' | 'list')}
                        className="gap-1"
                    >
                        <ToggleGroupItem value="grid" aria-label="Grid view">
                            <LayoutGrid className="h-4 w-4" />
                        </ToggleGroupItem>
                        <ToggleGroupItem value="list" aria-label="List view">
                            <List className="h-4 w-4" />
                        </ToggleGroupItem>
                    </ToggleGroup>
                )}
            </div>
            <TabsContent value="overview" forceMount={activeTab === 'overview'}>
              <div className="space-y-4">
                <DebtsByPerson
                  user={user}
                  debts={debts || []}
                  debtors={debtors || []}
                  settlements={settlements || []}
                  onAddPayment={handleAddPayment}
                  onEditDebt={handleEditDebt}
                  onDeleteDebt={handleDeleteDebt}
                  onEditPayment={handleEditPayment}
                  onDeletePayment={handleDeletePayment}
                  onSettleDebts={handleSettleDebts}
                  onReverseSettlement={handleReverseSettlement}
                  isLoading={isLoading}
                />
                <DebtsChart debts={debts || []} />
              </div>
            </TabsContent>
            <TabsContent value="all-debts" forceMount={activeTab === 'all-debts'}>
              {renderContentForDebts(false)}
            </TabsContent>
             <TabsContent value="history" forceMount={activeTab === 'history'}>
              {renderContentForDebts(true)}
            </TabsContent>
            <TabsContent value="debtors" forceMount={activeTab === 'debtors'}>
              <DebtorDetails
                debtors={debtors || []}
                onAddDebtor={handleAddDebtor}
                onEditDebtor={handleEditDebtor}
                onDeleteDebtor={handleDeleteDebtor}
                isLoading={isLoadingDebtors}
              />
            </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
