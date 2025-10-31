
"use client";

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Debt, Payment, Debtor, Settlement, ActivityLog } from '@/lib/types';
import DashboardHeader from '@/components/dashboard-header';
import { DebtsGrid } from '@/components/debts-grid';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownLeft, ArrowUpRight, LayoutGrid, List, Loader, PlusCircle, FileDown } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, useUser } from '@/firebase';
import { collection, doc, Timestamp, writeBatch, query, where, getDocs, addDoc, arrayUnion, deleteField, getDoc } from 'firebase/firestore';
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
import { ActivityFeed } from './activity-feed';
import { ViewDebtDialog } from './view-debt-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useAppData } from '@/contexts/app-data-context';


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
  const [debtToView, setDebtToView] = useState<Debt | null>(null);
  const { setDebtors: setGlobalDebtors } = useAppData();


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
    if (!firestore || !user?.uid) {
      return null;
    }
    const q = query(collection(firestore, 'debts_shared'), where('participants', 'array-contains', user.uid));
    return q;
  }, [firestore, user?.uid]);


  const settlementsRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return collection(firestore, 'users', user.uid, 'settlements');
    }, [firestore, user?.uid]);
    
  const { data: rawDebtors, isLoading: isLoadingDebtors } = useCollection<Debtor>(debtorsRef);
  const { data: privateDebts, isLoading: isLoadingPrivateDebts } = useCollection<Debt>(privateDebtsRef);
  const { data: sharedDebtsData, isLoading: isLoadingSharedDebts } = useCollection<Debt>(sharedDebtsQuery);
  const { data: settlements, isLoading: isLoadingSettlements } = useCollection<Settlement>(settlementsRef);

  const [enrichedDebtors, setEnrichedDebtors] = useState<Debtor[]>([]);
  const [isEnriching, setIsEnriching] = useState(true);

  useEffect(() => {
    const enrichDebtors = async () => {
      if (!firestore || !rawDebtors) {
        setIsEnriching(false);
        return;
      };

      setIsEnriching(true);
      const debtorPromises = rawDebtors.map(async (debtor) => {
        if (debtor.isAppUser && debtor.appUserId) {
          try {
            // This is a simplification. In a real app, you wouldn't have direct access
            // to other users' profiles. You'd likely use a Cloud Function or have a
            // public 'users_public' collection. Here, we simulate getting their photo.
            // We can't fetch `users/{uid}` due to security rules.
            // A workaround: Check shared debts to find a debt with that user.
            const userPublicData: { photoURL?: string } = {}; 
            
            // For now, let's just mark that we know it's a user.
            // The avatar component can then construct a fallback URL.
            // We'll pass the photoURL if we have it from some other source.
            // In our case, the debtor doesn't store the other user's photo.
            return { ...debtor }; 
          } catch (error) {
            console.warn(`Could not fetch public data for user ${debtor.appUserId}`, error);
            return debtor;
          }
        }
        return debtor;
      });

      const results = await Promise.all(debtorPromises);
      setEnrichedDebtors(results);
      setGlobalDebtors(results);
      setIsEnriching(false);
    };

    enrichDebtors();
  }, [rawDebtors, firestore, setGlobalDebtors]);

  const debtors = enrichedDebtors;

  const formatCurrency = (amount: number, currency: string) => new Intl.NumberFormat('es-CO', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);

  const getUsername = (email: string | null | undefined) => {
    if (!email) return 'Usuario';
    const username = email.split('@')[0];
    return username.charAt(0).toUpperCase() + username.slice(1);
  }

  const addActivityLog = (message: string, debtId: string, participants: string[]) => {
    if (!firestore || !user) return;
    
    if (!participants || participants.length === 0) {
      console.warn('⚠️ No se creó log de actividad: participants está vacío', { message, debtId });
      return;
    }
    
    const activityLog: Omit<ActivityLog, 'id'> = {
      debtId: debtId,
      userId: user.uid,
      userName: getUsername(user.email),
      message: message,
      timestamp: Timestamp.now(),
      participants: participants
    };
  
    addDocumentNonBlocking(collection(firestore, 'activity_logs'), activityLog);
};

const createEditActivityLog = (
    debt: Debt, 
    updatedData: Partial<Debt>,
    debtorName: string
) => {
    if (!user || !debt.participants) return;

    const changes = [];
    if (updatedData.concept && updatedData.concept !== debt.concept) {
        changes.push(`cambió el concepto de "${debt.concept}" a "${updatedData.concept}"`);
    }
    if (updatedData.amount && updatedData.amount !== debt.amount) {
        const oldAmount = formatCurrency(debt.amount, debt.currency);
        const newAmount = formatCurrency(updatedData.amount, updatedData.currency || debt.currency);
        changes.push(`cambió el monto de ${oldAmount} a ${newAmount}`);
    }
    if (updatedData.debtorId && updatedData.debtorId !== debt.debtorId) {
        changes.push(`cambió la persona de "${debt.debtorName}" a "${debtorName}"`);
    }

    let message;
    if (changes.length > 0) {
        message = `${getUsername(user.email)} editó la deuda "${debt.concept}": ${changes.join(', ')}.`;
    } else {
        message = `${getUsername(user.email)} editó la deuda "${debt.concept}".`;
    }
    
    if (updatedData.status === 'pending') {
        message += ` La deuda ahora requiere nueva aprobación.`
    }

    addActivityLog(message, debt.id, debt.participants);
};

const debts = useMemo(() => {
    if (!user || !debtors) return [];

    const privateDebtsList = (privateDebts || []).filter(d => !d.isShared);

    const processedSharedDebts = (sharedDebtsData || []).map(sharedDebt => {
        const creatorId = sharedDebt.creatorId || sharedDebt.userId; 
        const isCurrentUserTheCreator = creatorId === user.uid;
        
        let perspectiveDebtType = sharedDebt.type;
        if (!isCurrentUserTheCreator) {
            perspectiveDebtType = sharedDebt.type === 'iou' ? 'uome' : 'iou';
        }
        
        const otherUserId = sharedDebt.participants?.find(pId => pId !== user.uid);
        const localDebtorForSharedDebt = debtors.find(d => d.isAppUser && d.appUserId === otherUserId);

        return {
            ...sharedDebt,
            type: perspectiveDebtType,
            debtorName: localDebtorForSharedDebt?.name || `Usuario ${otherUserId?.substring(0, 5)}...`,
            debtorId: localDebtorForSharedDebt?.id || otherUserId || 'unknown_debtor',
            isCreator: isCurrentUserTheCreator,
        };
    });

    const allDebts = [...privateDebtsList, ...processedSharedDebts];
    const uniqueDebts = new Map(allDebts.map(d => [d.id, d]));
    
    return Array.from(uniqueDebts.values());

}, [privateDebts, sharedDebtsData, debtors, user]);


const handleAddDebt = useCallback((newDebt: Omit<Debt, 'id' | 'payments' | 'debtorName'>) => {
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

    const collectionRef = debtToAdd.isShared 
      ? collection(firestore, 'debts_shared')
      : collection(firestore, 'users', user.uid, 'debts');

    addDocumentNonBlocking(collectionRef, debtToAdd).then(docRef => {
        if (debtToAdd.isShared && docRef && debtToAdd.participants && debtToAdd.participants.length > 0) {
            addActivityLog(
                `${getUsername(user.email)} creó una nueva deuda compartida "${debtToAdd.concept}" con ${debtor.name} (pendiente de aprobación).`, 
                docRef.id, 
                debtToAdd.participants
            );
        }
    });
  }, [firestore, user, debtors, getUsername]);
  
  const handleEditDebt = (debtId: string, updatedDebt: Partial<Omit<Debt, 'id'>>, debtorName: string) => {
    if (!firestore || !user || !debts) return;
    const debt = debts.find(d => d.id === debtId);
    if (!debt) return;
    
    const collectionPath = debt.isShared ? 'debts_shared' : `users/${user.uid}/debts`;
    const debtDocRef = doc(firestore, collectionPath, debtId);

    const { debtorName: localName, ...globalUpdateData } = updatedDebt;

    if (globalUpdateData.dueDate === undefined) delete globalUpdateData.dueDate;
    if (globalUpdateData.items === undefined) delete globalUpdateData.items;

    if (globalUpdateData.isShared && globalUpdateData.status === 'pending') {
        (globalUpdateData as any).rejectedBy = deleteField();
        (globalUpdateData as any).rejectionReason = deleteField();
    }
    
    updateDocumentNonBlocking(debtDocRef, globalUpdateData);
    
    if (debt.isShared && debt.participants && debt.participants.length > 0) {
        createEditActivityLog(debt, globalUpdateData, debtorName);
    }
};

  const handleApproveDebt = (debtId: string) => {
    if (!firestore || !user || !debts) return;
    const debt = debts.find(d => d.id === debtId);
    if (!debt || !debt.isShared) return;

    const collectionPath = 'debts_shared';
    const debtDocRef = doc(firestore, collectionPath, debtId);

    const updateData: Partial<Debt> = {
      approvedBy: arrayUnion(user.uid) as unknown as string[],
    };

    if (debt.participants && debt.participants.length -1 === debt.approvedBy?.length) {
      updateData.status = 'approved';
    }
    
    updateDocumentNonBlocking(debtDocRef, updateData);

    if (debt.participants) {
      const message = updateData.status === 'approved' 
        ? `${getUsername(user.email)} aprobó y activó la deuda "${debt.concept}".`
        : `${getUsername(user.email)} aprobó la deuda "${debt.concept}".`;
      addActivityLog(message, debtId, debt.participants);
    }
  };

  const handleRejectDebt = (debtId: string, reason: string) => {
    if (!firestore || !user || !debts) return;
    const debt = debts.find(d => d.id === debtId);
    if (!debt || !debt.isShared) return;

    const collectionPath = 'debts_shared';
    const debtDocRef = doc(firestore, collectionPath, debtId);

    const updateData: Partial<Debt> = {
      status: 'rejected',
      rejectedBy: user.uid,
      rejectionReason: reason
    };

    updateDocumentNonBlocking(debtDocRef, updateData);

    if (debt.participants) {
      addActivityLog(`${getUsername(user.email)} rechazó la deuda "${debt.concept}". Motivo: ${reason}`, debtId, debt.participants);
    }
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
    
    if (debt.isShared) {
        const collectionPath = 'debts_shared';
        const debtDocRef = doc(firestore, collectionPath, debtId);
        
        const updateData: Partial<Debt> = {
            deletionStatus: 'requested',
            deletionRequestedBy: user.uid,
        };

        updateDocumentNonBlocking(debtDocRef, updateData);

        if (debt.participants) {
            addActivityLog(
                `${getUsername(user.email)} solicitó eliminar la deuda "${debt.concept}".`, 
                debtId, 
                debt.participants
            );
        }
        toast({
            title: 'Solicitud de Eliminación Enviada',
            description: 'La otra parte debe confirmar para eliminar la deuda permanentemente.',
        });
    } else {
        const debtDocRef = doc(firestore, `users/${user.uid}/debts`, debtId);
        deleteDocumentNonBlocking(debtDocRef);
        toast({
            title: 'Deuda Eliminada',
            description: 'La deuda ha sido eliminada permanentemente.',
        });
    }
};

  const handleConfirmDeletion = (debtId: string) => {
    if (!firestore || !user || !debts) return;
    const debt = debts.find(d => d.id === debtId);
    if (!debt || !debt.isShared) return;

    const debtDocRef = doc(firestore, 'debts_shared', debtId);
    deleteDocumentNonBlocking(debtDocRef);

    if (debt.participants) {
      addActivityLog(
        `${getUsername(user.email)} confirmó la eliminación de la deuda "${debt.concept}".`,
        debtId,
        debt.participants
      );
    }
    toast({
      title: 'Deuda Eliminada',
      description: 'La deuda compartida ha sido eliminada permanentemente.',
    });
  };

  const handleCancelDeletionRequest = (debtId: string) => {
    if (!firestore || !user || !debts) return;
    const debt = debts.find(d => d.id === debtId);
    if (!debt || !debt.isShared) return;

    const debtDocRef = doc(firestore, 'debts_shared', debtId);
    const updateData = {
      deletionStatus: 'none',
      deletionRequestedBy: deleteField(),
    };
    updateDocumentNonBlocking(debtDocRef, updateData);

    if (debt.participants) {
      addActivityLog(
        `${getUsername(user.email)} canceló la solicitud de eliminación para la deuda "${debt.concept}".`,
        debtId,
        debt.participants
      );
    }
  };

  const handleAddPayment = (debtId: string, newPayment: Omit<Payment, 'id'>) => {
    if (!firestore || !user || !debts) return;
    const debt = debts.find(d => d.id === debtId);
    if (!debt) return;
    
    const paymentToAdd: Payment = {
      ...newPayment,
      id: doc(collection(firestore, 'dummy')).id,
      createdBy: user.uid,
    };

    const updatedPayments = [...debt.payments, paymentToAdd];
    const collectionPath = debt.isShared ? 'debts_shared' : `users/${user.uid}/debts`;
    const debtDocRef = doc(firestore, collectionPath, debtId);

    updateDocumentNonBlocking(debtDocRef, { payments: updatedPayments });

    if (debt.isShared && debt.participants && debt.participants.length > 0) {
        const paymentAmount = formatCurrency(newPayment.amount, debt.currency);
        addActivityLog(
            `${getUsername(user.email)} registró un pago de ${paymentAmount} en la deuda "${debt.concept}".`, 
            debtId, 
            debt.participants
        );
    }
};

  const handleEditPayment = (debtId: string, paymentId: string, updatedPaymentData: Partial<Omit<Payment, 'id'>>) => {
    if (!firestore || !user || !debts) return;
    const debt = debts.find(d => d.id === debtId);
    if (!debt) return;

    const originalPayment = debt.payments.find(p => p.id === paymentId);
    if (!originalPayment) return;

    const updatedPayments = debt.payments.map(p => {
        if (p.id === paymentId) {
            return { ...p, ...updatedPaymentData, id: p.id };
        }
        return p;
    });
    
    const collectionPath = debt.isShared ? 'debts_shared' : `users/${user.uid}/debts`;
    const debtDocRef = doc(firestore, collectionPath, debtId);

    updateDocumentNonBlocking(debtDocRef, { payments: updatedPayments });
    
    if (debt.isShared && debt.participants && debt.participants.length > 0) {
        const originalAmount = formatCurrency(originalPayment.amount, debt.currency);
        const newAmount = formatCurrency(updatedPaymentData.amount ?? originalPayment.amount, debt.currency);
        
        let message = `${getUsername(user.email)} editó un pago en la deuda "${debt.concept}".`;
        if (originalAmount !== newAmount) {
            message = `${getUsername(user.email)} editó un pago de ${originalAmount} a ${newAmount} en la deuda "${debt.concept}".`;
        }

        addActivityLog(
            message,
            debtId, 
            debt.participants
        );
    }
  };

  const handleDeletePayment = (debtId: string, paymentId: string) => {
    if (!firestore || !user || !debts) return;
    const debt = debts.find(d => d.id === debtId);
    if (!debt) return;

    const paymentToDelete = debt.payments.find(p => p.id === paymentId);
    const updatedPayments = debt.payments.filter(p => p.id !== paymentId);
    const collectionPath = debt.isShared ? 'debts_shared' : `users/${user.uid}/debts`;
    const debtDocRef = doc(firestore, collectionPath, debtId);
    updateDocumentNonBlocking(debtDocRef, { payments: updatedPayments });

    if (debt.isShared && debt.participants && debt.participants.length > 0 && paymentToDelete) {
      const paymentAmount = formatCurrency(paymentToDelete.amount, debt.currency);
      addActivityLog(
          `${getUsername(user.email)} eliminó un pago de ${paymentAmount} en la deuda "${debt.concept}".`, 
          debtId, 
          debt.participants
      );
    }
  };
  
  const handleSettleDebts = async (debtorId: string, iouTotal: number, uomeTotal: number, currency: string) => {
    if (!firestore || !user || !debts) return;

    const batch = writeBatch(firestore);
    const settlementId = doc(collection(firestore, 'dummy')).id;
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

  const handleAddDebtor = async (newDebtorData: Omit<Debtor, 'id' | 'userId'>) => {
    if (!debtorsRef || !user || !firestore) return;
  
    const linkedUserId = newDebtorData.appUserId;
  
    if (linkedUserId && linkedUserId === user.uid) {
      toast({
        variant: 'destructive',
        title: 'Error de Vinculación',
        description: 'No puedes vincularte a ti mismo como contacto.',
      });
      return;
    }
  
    if (linkedUserId && debtors) {
      const isAlreadyLinked = debtors.some(
        (d) => d.isAppUser && d.appUserId === linkedUserId
      );
      if (isAlreadyLinked) {
        toast({
          variant: 'destructive',
          title: 'Error de Vinculación',
          description: 'Este usuario ya está vinculado a otro de tus contactos.',
        });
        return;
      }
    }
  
    const debtorToAdd: Omit<Debtor, 'id'> = {
      name: newDebtorData.name,
      type: newDebtorData.type || 'person',
      userId: user.uid,
      isAppUser: newDebtorData.isAppUser || false,
      ...(newDebtorData.contact && { contact: newDebtorData.contact }),
      ...(newDebtorData.paymentMethod && { paymentMethod: newDebtorData.paymentMethod }),
      ...(newDebtorData.paymentInfo && { paymentInfo: newDebtorData.paymentInfo }),
      ...(newDebtorData.appUserId && { appUserId: newDebtorData.appUserId }),
    };
  
    const isLinkingToAppUser = newDebtorData.isAppUser && linkedUserId;
  
    if (isLinkingToAppUser) {
      try {
        const mirrorContactData = {
          name: getUsername(user.email),
          type: "person",
          isAppUser: true,
          appUserId: user.uid,
          userId: linkedUserId,
          paymentMethod: "Otro",
          paymentInfo: "Usuario de la App"
        };
        
        const mirrorDebtorsColRef = collection(firestore, `users/${linkedUserId}/debtors`);
        const mirrorDocRef = await addDocumentNonBlocking(mirrorDebtorsColRef, mirrorContactData);
        
        if (!mirrorDocRef) {
          throw new Error('No se pudo crear el contacto espejo.');
        }
  
        await addDocumentNonBlocking(debtorsRef, debtorToAdd);
        
        toast({
          title: "¡Contacto Vinculado Creado!",
          description: `${newDebtorData.name} ha sido agregado y vinculado exitosamente.`,
        });
  
      } catch (e: any) {
        console.error('❌ ERROR creando el contacto vinculado:', e);
        toast({
          variant: 'destructive',
          title: 'Error al Crear Contacto Vinculado',
          description: e.code === 'permission-denied' 
            ? 'El usuario no existe o no se pudo crear el contacto. Verifica que el código de usuario sea correcto.'
            : `No se pudo completar la vinculación: ${e.message}`,
        });
      }
    } else {
      await addDocumentNonBlocking(debtorsRef, debtorToAdd);
      toast({
        title: "Contacto Agregado",
        description: `${newDebtorData.name} ha sido agregado exitosamente.`,
      });
    }
  };


const handleEditDebtorAndCreateMirror = async (
  debtorId: string, 
  updatedData: Omit<Debtor, 'id' | 'userId'>, 
  originalDebtor: Debtor
) => {
  if (!firestore || !user || !debtors) {
      return;
  }

  const linkedUserId = updatedData.appUserId;

  // Prevent self-linking
  if (linkedUserId && linkedUserId === user.uid) {
      toast({
          variant: 'destructive',
          title: 'Error de Vinculación',
          description: 'No puedes vincularte a ti mismo como contacto.',
      });
      return;
  }

  // Prevent linking to an already linked user
  if (linkedUserId) {
      const isAlreadyLinked = debtors.some(
          (d) => d.id !== debtorId && d.appUserId === linkedUserId
      );
      if (isAlreadyLinked) {
          toast({
              variant: 'destructive',
              title: 'Error de Vinculación',
              description: 'Este usuario ya está vinculado a otro de tus contactos.',
          });
          return;
      }
  }
  
  const debtorDocRef = doc(firestore, 'users', user.uid, 'debtors', debtorId);
  
  const cleanUpdatedData = Object.fromEntries(
      Object.entries(updatedData).filter(([_, value]) => value !== undefined && value !== '')
  );

  const wasJustLinked = updatedData.isAppUser && updatedData.appUserId;
  const uidIsNew = updatedData.appUserId !== originalDebtor.appUserId;

  if (wasJustLinked && uidIsNew && linkedUserId) {
      try {
          // ✅ NO verificar usuario, ir directo a crear el espejo
          console.log('✅ Attempting to create mirror contact...');

          // Crear el contacto espejo
          const mirrorContactData = {
              name: getUsername(user.email),
              type: "person",
              isAppUser: true,
              appUserId: user.uid,
              userId: linkedUserId,
              paymentMethod: "Otro",
              paymentInfo: "Usuario de la App"
          };
          
          console.log('📝 Mirror contact data:', mirrorContactData);
          
          const mirrorDebtorsColRef = collection(firestore, `users/${linkedUserId}/debtors`);
          
          // Intentar crear el contacto espejo directamente
          console.log('⏳ Creating mirror contact...');
          const mirrorDocRef = await addDocumentNonBlocking(mirrorDebtorsColRef, mirrorContactData);
          
          if (!mirrorDocRef) {
              throw new Error('No se pudo crear el contacto espejo');
          }

          console.log('✅ Contacto espejo creado exitosamente:', mirrorDocRef.id);

          // Actualizar el contacto local
          await updateDocumentNonBlocking(debtorDocRef, cleanUpdatedData);
          
          toast({
              title: "¡Contacto Vinculado!",
              description: `Ahora estás conectado con ${updatedData.name}. ${privateDebts?.filter(d => d.debtorId === debtorId && !d.isShared).length > 0 ? 'Las deudas existentes se sincronizarán automáticamente.' : ''}`,
          });

          // ✅ Sincronizar deudas solo si hay deudas privadas que sincronizar
          if (privateDebts?.filter(d => d.debtorId === debtorId && !d.isShared).length > 0) {
              // Esperar un momento para que el estado se actualice
              setTimeout(async () => {
                  try {
                      await handleSyncDebts(debtorId);
                  } catch (e) {
                      console.error('Error syncing debts:', e);
                      // No mostrar error al usuario ya que la vinculación fue exitosa
                  }
              }, 1000);
          }

      } catch (e: any) {
          console.error('❌ ERROR creando el contacto espejo:', e);
          console.error('Error code:', e.code);
          console.error('Error message:', e.message);
          
          toast({
              variant: 'destructive',
              title: 'Error al Vincular',
              description: e.code === 'permission-denied' 
                  ? 'El usuario no existe o no se pudo crear el contacto. Verifica que el código de usuario sea correcto.'
                  : `No se pudo completar la vinculación: ${e.message}`,
          });
      }
  } else {
      // Solo actualizar sin crear espejo
      await updateDocumentNonBlocking(debtorDocRef, cleanUpdatedData);
      
      toast({
          title: "Contacto Actualizado",
          description: `La información de ${updatedData.name} ha sido guardada.`,
      });
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
      const newSharedDebtRef = doc(collection(firestore, 'debts_shared'));

      const newSharedDebtData: Omit<Debt, 'id'> = {
        ...debt,
        isShared: true,
        participants: participants,
        userOneId: participants[0],
        userTwoId: participants[1],
      };

      batch.set(newSharedDebtRef, newSharedDebtData);

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
    
    const nonRejectedDebts = debts.filter(d => d.status !== 'rejected');
    const query = searchQuery.toLowerCase();
    
    return nonRejectedDebts.filter(debt => {
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


  const isLoading = isLoadingDebtors || isLoadingPrivateDebts || isLoadingSharedDebts || isLoadingSettlements || isEnriching;
  
  const handleViewDebt = (debt: Debt) => {
    setDebtToView(debt);
  };

  const { totalIOwe, totalOwedToMe } = useMemo(() => {
    if (!debts) return { totalIOwe: 0, totalOwedToMe: 0 };
    
    const activeApprovedDebts = debts.filter(d => d.status !== 'pending' && d.status !== 'rejected');

    const totals = activeApprovedDebts.reduce((acc, debt) => {
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
            user={user}
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
        user={user}
        onAddPayment={handleAddPayment} 
        onEditDebt={handleEditDebt}
        onDeleteDebt={handleDeleteDebt}
        onEditPayment={handleEditPayment}
        onDeletePayment={handleDeletePayment}
        onApproveDebt={handleApproveDebt}
        onRejectDebt={handleRejectDebt}
        onConfirmDeletion={handleConfirmDeletion}
        onCancelDeletionRequest={handleCancelDeletionRequest}
        isLoading={isLoading}
        showSettled={isSettled}
      />;
  };

  const TABS_CONFIG = [
      { value: "overview", label: "Resumen" },
      { value: "all-debts", label: "Deudas" },
      { value: "activity", label: "Actividad" },
      { value: "history", label: "Historial" },
      { value: "debtors", label: "Contactos" },
  ];


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
                {/* Mobile Select */}
                <div className="md:hidden w-full">
                    <Select value={activeTab} onValueChange={setActiveTab}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {TABS_CONFIG.map(tab => (
                               <SelectItem key={tab.value} value={tab.value}>{tab.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {/* Desktop Tabs */}
                <TabsList className="hidden md:inline-flex">
                    {TABS_CONFIG.map(tab => (
                       <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
                    ))}
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
            <TabsContent value="activity" forceMount={activeTab === 'activity'}>
              <ActivityFeed debts={debts} debtors={debtors || []} onViewDebt={handleViewDebt}/>
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
        {debtToView && (
            <ViewDebtDialog 
                debt={debtToView}
                onEditPayment={handleEditPayment}
                onDeletePayment={handleDeletePayment}
                open={!!debtToView}
                onOpenChange={(open) => !open && setDebtToView(null)}
            >
              <div />
            </ViewDebtDialog>
        )}
      </main>
    </div>
  );
}
