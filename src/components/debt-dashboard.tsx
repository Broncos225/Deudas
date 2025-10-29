
"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Debt, Payment, Debtor, Settlement } from '@/lib/types';
import DashboardHeader from '@/components/dashboard-header';
import { DebtsGrid } from '@/components/debts-grid';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownLeft, ArrowUpRight, LayoutGrid, List, Loader, PlusCircle, FileDown } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, useUser } from '@/firebase';
import { collection, doc, Timestamp, writeBatch, query, where, getDocs, addDoc } from 'firebase/firestore';
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
import { DebtFilters, type Filters } from './debt-filters';
import { exportToCSV, exportToPDF } from '@/lib/export';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';


export default function DebtDashboard() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<Filters>({
    type: 'all',
    currency: 'all',
    debtorId: 'all',
  });


  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);
  
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
    return query(collection(firestore, 'debts_shared'), where('participants', 'array-contains', user.uid));
  }, [firestore, user?.uid]);


  const settlementsRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return collection(firestore, 'users', user.uid, 'settlements');
    }, [firestore, user?.uid]);
    
  const { data: debtors, isLoading: isLoadingDebtors } = useCollection<Debtor>(debtorsRef);
  const { data: privateDebts, isLoading: isLoadingPrivateDebts } = useCollection<Debt>(privateDebtsRef);
  const { data: sharedDebtsData, isLoading: isLoadingSharedDebts } = useCollection<Debt>(sharedDebtsQuery);
  const { data: settlements, isLoading: isLoadingSettlements } = useCollection<Settlement>(settlementsRef);

  const debts = useMemo(() => {
    if (!user || !debtors) return [];
  
    // Filter out private debts that have been migrated
    const nonSharedPrivateDebts = (privateDebts || []).filter(d => !d.isShared);
    
    const allDebts: Debt[] = [...nonSharedPrivateDebts];
  
    if (sharedDebtsData) {
      const processedSharedDebts = sharedDebtsData.map(sharedDebt => {
        const otherUserId = sharedDebt.participants?.find(pId => pId !== user.uid);
        const localDebtor = debtors.find(d => d.isAppUser && d.appUserId === otherUserId);
  
        if (localDebtor) {
          return {
            ...sharedDebt,
            debtorId: localDebtor.id,
            debtorName: localDebtor.name,
          };
        }
        
        // Fallback name if no local contact is found for the shared debt participant
        const creatorId = sharedDebt.participants?.find(pId => pId === sharedDebt.userId);
        const fallbackName = `Usuario ${otherUserId?.substring(0,5)}...`;
        
        return {
          ...sharedDebt,
          debtorName: fallbackName,
          debtorId: otherUserId || 'unknown'
        };
      });
      allDebts.push(...processedSharedDebts);
    }
    
    // Use a Map to ensure debts are unique by ID, giving preference to the latest version.
    const uniqueDebts = new Map(allDebts.map(d => [d.id, d]));
    return Array.from(uniqueDebts.values());
  
  }, [privateDebts, sharedDebtsData, debtors, user]);



  const handleAddDebt = (newDebt: Omit<Debt, 'id' | 'payments' | 'debtorName'>) => {
    if (!firestore || !user || !debtors) return;
    const debtor = debtors.find(d => d.id === newDebt.debtorId);
    if (!debtor) return;

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
        debtToAdd.userId = user.uid; // The creator's ID
    } else {
        debtToAdd.isShared = false;
        debtToAdd.userId = user.uid;
    }

    if (debtToAdd.dueDate === undefined) delete debtToAdd.dueDate;
    if (debtToAdd.items === undefined) delete debtToAdd.items;

    const collectionRef = debtToAdd.isShared 
      ? collection(firestore, 'debts_shared')
      : collection(firestore, 'users', user.uid, 'debts');

    addDocumentNonBlocking(collectionRef, debtToAdd);
  };
  
  const handleEditDebt = (debtId: string, updatedDebt: Partial<Omit<Debt, 'id'>>, debtorName: string) => {
    if (!firestore || !user || !debts) return;
    const debt = debts.find(d => d.id === debtId);
    if (!debt) return;
    
    const collectionPath = debt.isShared ? 'debts_shared' : `users/${user.uid}/debts`;
    const debtDocRef = doc(firestore, collectionPath, debtId);

    const { debtorName: localName, ...globalUpdateData } = updatedDebt;

    if (globalUpdateData.dueDate === undefined) delete globalUpdateData.dueDate;
    if (globalUpdateData.items === undefined) delete globalUpdateData.items;
    
    updateDocumentNonBlocking(debtDocRef, globalUpdateData);
  };
  
  const handleDeleteDebtor = (debtorId: string) => {
    if (!firestore || !user || !debtors) return;
    const debtorDocRef = doc(firestore, 'users', user.uid, 'debtors', debtorId);
    deleteDocumentNonBlocking(debtorDocRef);
  };

  const handleDeleteDebt = (debtId: string) => {
    if (!firestore || !user || !debts) return;
    const debt = debts.find(d => d.id === debtId);
    if (!debt) return;

    const collectionPath = debt.isShared ? 'debts_shared' : `users/${user.uid}/debts`;
    const debtDocRef = doc(firestore, collectionPath, debtId);
    
    deleteDocumentNonBlocking(debtDocRef);
  };

  const handleAddPayment = (debtId: string, newPayment: Omit<Payment, 'id'>) => {
    if (!firestore || !user || !debts) return;
    const debt = debts.find(d => d.id === debtId);
    if (!debt) return;
    
    const paymentToAdd: Payment = {
      ...newPayment,
      id: doc(collection(firestore, 'dummy')).id, // Firestore-like random ID
    };

    const updatedPayments = [...debt.payments, paymentToAdd];
    const collectionPath = debt.isShared ? 'debts_shared' : `users/${user.uid}/debts`;
    const debtDocRef = doc(firestore, collectionPath, debtId);

    updateDocumentNonBlocking(debtDocRef, { payments: updatedPayments });
  };

  const handleEditPayment = (debtId: string, paymentId: string, updatedPaymentData: Partial<Omit<Payment, 'id'>>) => {
    if (!firestore || !user || !debts) return;
    const debt = debts.find(d => d.id === debtId);
    if (!debt) return;

    const updatedPayments = debt.payments.map(p => {
        if (p.id === paymentId) {
            return { ...p, ...updatedPaymentData, id: p.id };
        }
        return p;
    });
    
    const collectionPath = debt.isShared ? 'debts_shared' : `users/${user.uid}/debts`;
    const debtDocRef = doc(firestore, collectionPath, debtId);

    updateDocumentNonBlocking(debtDocRef, { payments: updatedPayments });
  };

  const handleDeletePayment = (debtId: string, paymentId: string) => {
    if (!firestore || !user || !debts) return;
    const debt = debts.find(d => d.id === debtId);
    if (!debt) return;

    const updatedPayments = debt.payments.filter(p => p.id !== paymentId);
    const collectionPath = debt.isShared ? 'debts_shared' : `users/${user.uid}/debts`;
    const debtDocRef = doc(firestore, collectionPath, debtId);
    updateDocumentNonBlocking(debtDocRef, { payments: updatedPayments });
  };
  
  const handleSettleDebts = async (debtorId: string, iouTotal: number, uomeTotal: number, currency: string) => {
    if (!firestore || !user || !debts) return;

    const batch = writeBatch(firestore);
    const settlementId = doc(collection(firestore, 'dummy')).id; // Generate a unique ID
    const settlementAmount = Math.min(iouTotal, uomeTotal);
    const settlementDate = Timestamp.now();
    
    const settlementPaymentId = `settle_${settlementId}`;
    
    const iouDebts = debts.filter(d => d.debtorId === debtorId && d.type === 'iou' && !d.isSettled);
    const uomeDebts = debts.filter(d => d.debtorId === debtorId && d.type === 'uome' && !d.isSettled);

    let debtsToCredit: Debt[];
    let debtsToDebit: Debt[];

    if (iouTotal > uomeTotal) {
        debtsToDebit = iouDebts;
        debtsToCredit = uomeDebts;
    } else {
        debtsToDebit = uomeDebts;
        debtsToCredit = iouDebts;
    }

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
            const collectionPath = debt.isShared ? 'debts_shared' : `users/${user.uid}/debts`;
            const debtRef = doc(firestore, collectionPath, debt.id);
            batch.update(debtRef, { payments: [...debt.payments, newPayment] });
            creditRemaining -= paymentAmount;
        }
    }

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
            const collectionPath = debt.isShared ? 'debts_shared' : `users/${user.uid}/debts`;
            const debtRef = doc(firestore, collectionPath, debt.id);
            batch.update(debtRef, { payments: [...debt.payments, newPayment] });
            debitRemaining -= paymentAmount;
        }
    }

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
  
    const relatedDebts = debts.filter(d => d.payments.some(p => p.settlementId === settlement.id));
  
    for (const debt of relatedDebts) {
      const updatedPayments = debt.payments.filter(p => p.settlementId !== settlement.id);
      const collectionPath = debt.isShared ? 'debts_shared' : `users/${user.uid}/debts`;
      const debtRef = doc(firestore, collectionPath, debt.id);
      batch.update(debtRef, { payments: updatedPayments });
    }
  
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
      const rate = debt.currency === 'USD' ? 4000 : debt.currency === 'EUR' ? 4500: 1;
      const remaining = debt.amount - debt.payments.reduce((sum, p) => sum + p.amount, 0);

      if (remaining <= 0) return acc;
      
      if (debt.type === 'iou') {
        acc.totalIOwe += remaining * rate;
      } else {
        acc.totalOwedToMe += remaining * rate;
      }
      return acc;
    }, { totalIOwe: 0, totalOwedToMe: 0 });
    
    return totals;
  }, [debts]);


  const handleAddDebtor = (newDebtorData: Omit<Debtor, 'id' | 'userId'>) => {
    if (!debtorsRef || !user) return;
    const debtorToAdd: Omit<Debtor, 'id'> = {
      ...newDebtorData,
      userId: user.uid,
    };
    
    const cleanDebtorData = Object.fromEntries(
      Object.entries(debtorToAdd).filter(([_, value]) => value !== undefined && value !== '')
    );

    addDocumentNonBlocking(debtorsRef, cleanDebtorData);
  };

  const handleEditDebtorAndCreateMirror = async (
    debtorId: string, 
    updatedData: Omit<Debtor, 'id' | 'userId'>, 
    originalDebtor: Debtor
  ) => {
    if (!firestore || !user) {
        return;
    }

    const debtorDocRef = doc(firestore, 'users', user.uid, 'debtors', debtorId);
    
    const cleanUpdatedData = Object.fromEntries(
        Object.entries(updatedData).filter(([_, value]) => value !== undefined && value !== '')
    );

    updateDocumentNonBlocking(debtorDocRef, cleanUpdatedData);

    const wasJustLinked = updatedData.isAppUser && updatedData.appUserId;
    const uidIsNew = updatedData.appUserId !== originalDebtor.appUserId;

    if (wasJustLinked && uidIsNew) {
        const linkedUserId = updatedData.appUserId as string;
        if (linkedUserId === user.uid) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'No puedes vincularte a ti mismo.',
            });
            return;
        }

        const mirrorContactData = {
            name: user.displayName || user.email?.split('@')[0] || `Usuario ${user.uid.substring(0, 5)}`,
            type: "person" as const,
            isAppUser: true,
            appUserId: user.uid,
            userId: linkedUserId,
            paymentMethod: "Otro" as const,
            paymentInfo: "Usuario de la App"
        };
        
        try {
            const mirrorDebtorsColRef = collection(firestore, `users/${linkedUserId}/debtors`);
            await addDoc(mirrorDebtorsColRef, mirrorContactData);
            
            toast({
                title: "¡Contacto Vinculado!",
                description: `Se ha creado un contacto espejo exitosamente. Ahora puedes sincronizar las deudas antiguas.`,
            });
        } catch (e: any) {
            console.error('❌ ERROR creating mirror contact:', e);
            toast({
                variant: 'destructive',
                title: 'Error al vincular',
                description: e.code === 'permission-denied' 
                    ? 'No tienes permisos para crear este contacto. Verifica las reglas de Firestore.'
                    : `Error: ${e.message}`,
            });
        }
    }
};

  const handleSyncDebts = async (debtorId: string) => {
    if (!firestore || !user || !debtors || !privateDebts) {
      toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los datos necesarios." });
      return;
    }

    const debtor = debtors.find(d => d.id === debtorId);
    if (!debtor || !debtor.isAppUser || !debtor.appUserId) {
      toast({ variant: "destructive", title: "Error", description: "El contacto no está vinculado a un usuario de la app." });
      return;
    }
    const linkedUserId = debtor.appUserId;
    const participants = [user.uid, linkedUserId].sort();

    const privateDebtsToSync = privateDebts.filter(d => d.debtorId === debtorId && !d.isShared);

    if (privateDebtsToSync.length === 0) {
      toast({ title: "Nada que Sincronizar", description: "No se encontraron deudas privadas antiguas con este contacto." });
      return;
    }
    
    toast({ title: "Sincronizando...", description: `Moviendo ${privateDebtsToSync.length} deudas a compartidas.` });

    const batch = writeBatch(firestore);

    for (const debt of privateDebtsToSync) {
      // 1. Define reference to the new shared debt
      const newSharedDebtRef = doc(collection(firestore, 'debts_shared'));

      // 2. Prepare the new shared debt data
      const newSharedDebtData: Omit<Debt, 'id'> = {
        ...debt,
        isShared: true,
        participants: participants,
        userOneId: participants[0],
        userTwoId: participants[1],
      };
      // `userId` is kept to know who originally created it

      // 3. Add set operation for the new shared debt
      batch.set(newSharedDebtRef, newSharedDebtData);

      // 4. Add delete operation for the old private debt
      const oldPrivateDebtRef = doc(firestore, 'users', user.uid, 'debts', debt.id);
      batch.delete(oldPrivateDebtRef);
    }
    
    try {
      await batch.commit();
      toast({
        title: "¡Sincronización Completa!",
        description: `${privateDebtsToSync.length} deudas han sido compartidas exitosamente con ${debtor.name}.`,
      });
    } catch (e: any) {
      console.error("Error during debt synchronization batch commit:", e);
      toast({
        variant: "destructive",
        title: "Error de Sincronización",
        description: `No se pudieron compartir las deudas. ${e.message}`,
      });
    }
  };


  const filteredDebts = useMemo(() => {
    if (!debts) return [];
    const query = searchQuery.toLowerCase();
    
    return debts.filter(debt => {
        const matchesSearch = query === "" ||
            debt.concept.toLowerCase().includes(query) ||
            debt.debtorName.toLowerCase().includes(query) ||
            (debt.items && debt.items.some(item => item.name.toLowerCase().includes(query)));

        const matchesType = filters.type === 'all' || debt.type === filters.type;
        const matchesCurrency = filters.currency === 'all' || debt.currency === filters.currency;
        const matchesDebtor = filters.debtorId === 'all' || debt.debtorId === filters.debtorId;

        return matchesSearch && matchesType && matchesCurrency && matchesDebtor;
    });
}, [debts, searchQuery, filters]);


  const isLoading = isLoadingDebtors || isLoadingPrivateDebts || isLoadingSharedDebts || isLoadingSettlements;

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
            <span className="hidden md:inline">Agregar Deuda</span>
        </Button>
    </AddDebtDialog>
  );
  
  const renderContentForDebts = (isSettled: boolean) => {
    const finalFilteredDebts = filteredDebts?.filter(d => {
        const remaining = d.amount - d.payments.reduce((s, p) => s + p.amount, 0);
        const isPaid = remaining <= 0.01;
        return isSettled ? isPaid : !isPaid;
    }) || [];

    if (viewMode === 'list') {
        return <DebtsList
            debts={finalFilteredDebts}
            debtors={debtors || []}
            onAddPayment={handleAddPayment}
            onEditDebt={handleEditDebt}
            onDeleteDebt={handleDeleteDebt}
            onEditPayment={handleEditPayment}
            onDeletePayment={handleDeletePayment}
            isLoading={isLoading}
        />;
    }
    
    return <DebtsGrid 
        debts={finalFilteredDebts}
        debtors={debtors || []}
        onAddPayment={handleAddPayment} 
        onEditDebt={handleEditDebt}
        onDeleteDebt={handleDeleteDebt}
        onEditPayment={handleEditPayment}
        onDeletePayment={handleDeletePayment}
        isLoading={isLoading}
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
              {isLoading ? (
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
               {isLoading ? (
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
                    <TabsTrigger value="all-debts">Deudas</TabsTrigger>
                    <TabsTrigger value="history">Historial</TabsTrigger>
                    <TabsTrigger value="debtors">Contactos</TabsTrigger>
                </TabsList>
                {(activeTab === 'all-debts' || activeTab === 'history') && (
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-1">
                                    <FileDown className="h-4 w-4" />
                                    <span className="hidden sm:inline">Exportar</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onSelect={() => exportToPDF(filteredDebts, { totalIOwe, totalOwedToMe })}>
                                    Exportar a PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => exportToCSV(filteredDebts)}>
                                    Exportar a CSV
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
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
                    </div>
                )}
            </div>
             {(activeTab === 'all-debts' || activeTab === 'history') && (
              <DebtFilters
                filters={filters}
                onFilterChange={setFilters}
                debtors={debtors || []}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />
            )}
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
                onEditDebtor={handleEditDebtorAndCreateMirror}
                onDeleteDebtor={handleDeleteDebtor}
                onSyncDebts={handleSyncDebts}
                isLoading={isLoadingDebtors}
              />
            </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

    
    

    