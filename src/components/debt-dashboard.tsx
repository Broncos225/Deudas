

"use client";

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Debt, Payment, Debtor, Settlement, ActivityLog, Category } from '@/lib/types';
import DashboardHeader from '@/components/dashboard-header';
import { DebtsGrid } from '@/components/debts-grid';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownLeft, ArrowUpRight, LayoutGrid, List, Loader, PlusCircle, FileDown, Bell, XCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFirestore, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, useUser, setDocumentNonBlocking } from '@/firebase';
import { collection, doc, Timestamp, writeBatch, query, where, getDocs, addDoc, arrayUnion, deleteField, getDoc, onSnapshot } from 'firebase/firestore';
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
import { DebtFilters, type Filters, type SortOrder } from './debt-filters';
import { exportToCSV, exportToPDF } from '@/lib/export';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { ActivityFeed } from './activity-feed';
import { ViewDebtDialog } from './view-debt-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useAppData } from '@/contexts/app-data-context';
import { DateRange } from 'react-day-picker';
import { isWithinInterval } from 'date-fns';
import { CategoryManager } from './category-manager';
import { useRecurringDebts } from '@/hooks/useRecurringDebts';


export default function DebtDashboard() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const { 
    debtors, 
    allDebts: debts,
    privateDebts, 
    settlements,
    categories, 
    isLoading: isAppDataLoading,
    addActivityLog
  } = useAppData();

  const { isProcessing: isProcessingRecurring, toggleRecurrenceStatus } = useRecurringDebts(privateDebts);
  
  const [activeTab, setActiveTab] = useState("overview");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>('createdAt_asc');
  const [filters, setFilters] = useState<Filters>({
    types: ['iou', 'uome'],
    statuses: ['approved', 'pending', 'rejected'],
    debtorId: 'all',
    categoryId: 'all',
    date: { from: undefined, to: undefined },
  });
  const [debtToView, setDebtToView] = useState<Debt | null>(null);

  const isLoading = isAppDataLoading || isProcessingRecurring;

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);
  
  const formatCurrency = (amount: number, currency: string) => new Intl.NumberFormat('es-CO', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);

  const getUsername = (email: string | null | undefined) => {
    if (!email) return 'Usuario';
    const username = email.split('@')[0];
    return username.charAt(0).toUpperCase() + username.slice(1);
  }

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

    addActivityLog(message, debt.id, debt.participants, user.photoURL);
};

const handleAddDebt = useCallback(async (newDebtData: Omit<Debt, 'id' | 'payments' | 'debtorName'>, debtorName: string) => {
    if (!firestore || !user || !debtors) return;

    let debtorId = newDebtData.debtorId;
    let debtor = debtors.find(d => d.id === debtorId);

    // If debtor not found by ID, it means it's a new one by name
    if (!debtor) {
        const newDebtor: Omit<Debtor, 'id'| 'userId'> = {
            name: debtorName,
            type: 'person',
            isAppUser: false,
        };
        const debtorsRef = collection(firestore, 'users', user.uid, 'debtors');
        const docRef = await addDocumentNonBlocking(debtorsRef, { ...newDebtor, userId: user.uid });
        debtorId = docRef.id;
    }

    const debtToAdd: any = {
        ...newDebtData,
        debtorId: debtorId,
        debtorName: debtorName,
        payments: [],
        isSettled: false,
    };
    
    debtor = debtors.find(d => d.id === debtorId); // Re-fetch debtor in case it's an existing one

    if (debtor?.isAppUser && debtor?.appUserId) {
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

    addDocumentNonBlocking(collectionRef, debtToAdd).then(docRef => {
        if (debtToAdd.isShared && docRef && debtToAdd.participants && debtToAdd.participants.length > 0) {
            addActivityLog(
                `${getUsername(user.email)} creó una nueva deuda compartida "${debtToAdd.concept}" con ${debtorName} (pendiente de aprobación).`, 
                docRef.id, 
                debtToAdd.participants,
                user.photoURL
            );
        }
    });
  }, [firestore, user, debtors, getUsername, addActivityLog]);
  
  const handleEditDebt = (debtId: string, updatedDebt: Partial<Omit<Debt, 'id'>>, debtorName: string) => {
    if (!firestore || !user || !debts) return;
    const debt = debts.find(d => d.id === debtId);
    if (!debt) return;
    
    const collectionPath = debt.isShared ? 'debts_shared' : `users/${user.uid}/debts`;
    const debtDocRef = doc(firestore, collectionPath, debtId);

    const { debtorName: localName, ...globalUpdateData } = updatedDebt;

    if (globalUpdateData.dueDate === undefined) delete globalUpdateData.dueDate;
    if (globalUpdateData.items === undefined) delete globalUpdateData.items;
    if (globalUpdateData.receiptUrl === undefined) delete globalUpdateData.receiptUrl;


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
      addActivityLog(message, debtId, debt.participants, user.photoURL);
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
      addActivityLog(`${getUsername(user.email)} rechazó la deuda "${debt.concept}". Motivo: ${reason}`, debtId, debt.participants, user.photoURL);
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
                debt.participants,
                user.photoURL
            );
        }
        toast({
            title: 'Solicitud de Eliminación Enviada',
            description: 'La otra parte debe confirmar para eliminar la deuda permanentemente.',
        });
    } else {
        const collectionPath = `users/${user.uid}/debts`;
        const debtDocRef = doc(firestore, collectionPath, debtId);
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
        debt.participants,
        user.photoURL
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
        debt.participants,
        user.photoURL
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
            debt.participants,
            user.photoURL
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
            debt.participants,
            user.photoURL
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
          debt.participants,
          user.photoURL
      );
    }
  };
  
  const handleSettleDebts = async (debtorId: string, iouTotal: number, uomeTotal: number, currency: string) => {
    if (!firestore || !user || !debtors) return;
  
    const debtor = debtors.find(d => d.id === debtorId);
    if (!debtor || !debtor.appUserId) return;
  
    const participants = [user.uid, debtor.appUserId].sort();
    const settlementId = doc(collection(firestore, 'dummy')).id;
    
    const newSettlement: Omit<Settlement, 'id'> = {
      debtorId,
      date: Timestamp.now(),
      amountSettled: Math.min(iouTotal, uomeTotal),
      currency,
      proposerId: user.uid,
      participants,
      status: 'pending',
    };
  
    const settlementRef = doc(firestore, 'settlements', settlementId);
    setDocumentNonBlocking(settlementRef, { ...newSettlement, id: settlementId });
  
    toast({
        title: "Propuesta de Cruce Enviada",
        description: "Se ha enviado una propuesta de cruce de cuentas. La otra parte debe aprobarla.",
    });
  };

  const handleApproveSettlement = async (settlement: Settlement) => {
    if (!firestore || !user || !debts) return;

    const batch = writeBatch(firestore);
    const settlementRef = doc(firestore, 'settlements', settlement.id);
    const settlementPaymentId = doc(collection(firestore, 'dummy')).id;

    const debtsToSettle = debts.filter(d => 
        d.status === 'approved' && 
        d.isShared && 
        d.participants?.includes(settlement.proposerId) && 
        d.participants?.includes(user.uid)
    );

    let settledAmount = settlement.amountSettled;

    const processDebts = (type: 'iou' | 'uome') => {
        const debtsOfType = debtsToSettle.filter(d => d.type === type);
        for (const debt of debtsOfType) {
            if (settledAmount <= 0) break;
            const remainingOnDebt = debt.amount - debt.payments.reduce((s, p) => s + p.amount, 0);
            const paymentAmount = Math.min(settledAmount, remainingOnDebt);
            
            if (paymentAmount > 0) {
                const payment: Payment = {
                    id: settlementPaymentId,
                    amount: paymentAmount,
                    date: Timestamp.now(),
                    isSettlement: true,
                    settlementId: settlement.id,
                    createdBy: user.uid,
                };
                const debtRef = doc(firestore, 'debts_shared', debt.id);
                batch.update(debtRef, { payments: arrayUnion(payment) });
                settledAmount -= paymentAmount;
            }
        }
    };
    
    // Settle debts where the current user owes the proposer
    processDebts('iou');
    
    settledAmount = settlement.amountSettled; // Reset settled amount for the other direction
    
    // Settle debts where the proposer owes the current user
    processDebts('uome');

    batch.update(settlementRef, { status: 'approved' });

    try {
        await batch.commit();
        toast({ title: "Cruce Aprobado", description: "Las cuentas han sido cruzadas exitosamente." });
    } catch (e: any) {
        toast({ variant: 'destructive', title: "Error al Aprobar", description: e.message });
    }
  };

  const handleRejectSettlement = (settlement: Settlement) => {
    if (!firestore || !user) return;
    const settlementRef = doc(firestore, 'settlements', settlement.id);
    
    if (settlement.status === 'pending') {
        // Proposer is cancelling OR receiver is rejecting a pending proposal.
        // In both cases, we delete it.
        deleteDocumentNonBlocking(settlementRef);
        toast({ title: 'Propuesta Cancelada' });
    }
  };
  
  const handleRequestReversal = (settlement: Settlement) => {
      if (!firestore || !user) return;
      const settlementRef = doc(firestore, 'settlements', settlement.id);
      updateDocumentNonBlocking(settlementRef, { status: 'reversal_pending' });
      toast({ title: 'Solicitud de Reversión Enviada' });
  };
  
  const handleApproveReversal = async (settlement: Settlement) => {
    if (!firestore || !user || !debts) return;
  
    const batch = writeBatch(firestore);
  
    const relatedDebts = debts.filter(d => d.payments.some(p => p.settlementId === settlement.id));
  
    for (const debt of relatedDebts) {
      const updatedPayments = debt.payments.filter(p => p.settlementId !== settlement.id);
      const collectionPath = debt.isShared ? 'debts_shared' : `users/${user.uid}/debts`;
      const debtRef = doc(firestore, collectionPath, debt.id);
      batch.update(debtRef, { payments: updatedPayments });
    }
  
    const settlementRef = doc(firestore, 'settlements', settlement.id);
    batch.delete(settlementRef);
  
    try {
        await batch.commit();
        toast({
          title: "Cruce Revertido",
          description: "El cruce de cuentas ha sido deshecho exitosamente.",
        });
    } catch(e) {
        const error = new FirestorePermissionError({
            path: `settlements/${settlement.id}`,
            operation: 'delete',
            requestResourceData: settlement
        });
        errorEmitter.emit('permission-error', error);
    }
  };

  const handleAddDebtor = async (newDebtorData: Omit<Debtor, 'id' | 'userId'>) => {
    if (!user || !firestore) return;
  
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
  
    const isLinkingToAppUser = newDebtorData.isAppUser && linkedUserId;
    const debtorsRef = collection(firestore, 'users', user.uid, 'debtors');
  
    if (isLinkingToAppUser) {
        try {
            console.log('🔗 Creando nuevo contacto vinculado...');
            const linkRequestData = {
              fromUserId: user.uid,
              fromUserEmail: user.email,
              fromUserName: getUsername(user.email),
              fromUserPhoto: user.photoURL || null,
              toUserId: linkedUserId,
              contactName: newDebtorData.name,
              status: 'pending',
              createdAt: Timestamp.now(),
            };
            
            const linkRequestsRef = collection(firestore, 'link_requests');
            await addDocumentNonBlocking(linkRequestsRef, linkRequestData);
    
            const localDebtorData: any = {
              name: newDebtorData.name,
              type: newDebtorData.type,
              isAppUser: true,
              appUserId: linkedUserId,
              userId: user.uid,
              appUserPhotoUrl: null, // This will be updated via listener
            };
            
            if (newDebtorData.contact) localDebtorData.contact = newDebtorData.contact;
            if (newDebtorData.paymentMethod) localDebtorData.paymentMethod = newDebtorData.paymentMethod;
            if (newDebtorData.paymentInfo) localDebtorData.paymentInfo = newDebtorData.paymentInfo;
    
            await addDocumentNonBlocking(debtorsRef, localDebtorData);
            
            toast({
              title: "¡Solicitud de Vinculación Enviada!",
              description: `${newDebtorData.name} recibirá la vinculación automáticamente.`,
            });
      
        } catch (e: any) {
          console.error('❌ ERROR creando la solicitud de vinculación:', e);
          toast({
            variant: 'destructive',
            title: 'Error al Enviar Solicitud',
            description: `No se pudo completar la solicitud: ${e.message}`,
          });
        }
    } else {
        const debtorToAdd: any = {
          name: newDebtorData.name,
          type: newDebtorData.type,
          userId: user.uid,
          isAppUser: false,
        };
        
        if (newDebtorData.contact) debtorToAdd.contact = newDebtorData.contact;
        if (newDebtorData.paymentMethod) debtorToAdd.paymentMethod = newDebtorData.paymentMethod;
        if (newDebtorData.paymentInfo) debtorToAdd.paymentInfo = newDebtorData.paymentInfo;
        
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
    const debtorsRef = collection(firestore, 'users', user.uid, 'debtors');
    const linkedUserId = updatedData.appUserId;

    if (linkedUserId && linkedUserId === user.uid) {
        toast({ variant: 'destructive', title: 'Error', description: 'No puedes vincularte a ti mismo.' });
        return;
    }

    if (linkedUserId) {
        const isAlreadyLinked = debtors.some(
            (d) => d.id !== debtorId && d.appUserId === linkedUserId
        );
        if (isAlreadyLinked) {
            toast({ variant: 'destructive', title: 'Error', description: 'Este usuario ya está vinculado.' });
            return;
        }
    }
    
    const wasJustLinked = updatedData.isAppUser && linkedUserId;
    const isNewLink = wasJustLinked && (!originalDebtor.isAppUser || originalDebtor.appUserId !== linkedUserId);

    if (isNewLink) {
        try {
            const linkRequestData = {
                fromUserId: user.uid,
                fromUserEmail: user.email,
                fromUserName: getUsername(user.email),
                fromUserPhoto: user.photoURL || null,
                toUserId: linkedUserId,
                contactName: updatedData.name,
                status: 'pending',
                createdAt: Timestamp.now(),
            };
            
            await addDocumentNonBlocking(collection(firestore, 'link_requests'), linkRequestData);

            const localUpdateData: any = { ...updatedData };
            delete localUpdateData.id;
            delete localUpdateData.userId;
            
            if (!localUpdateData.isAppUser) {
                localUpdateData.appUserId = deleteField();
                localUpdateData.appUserPhotoUrl = deleteField();
            }

            await updateDocumentNonBlocking(doc(debtorsRef, debtorId), localUpdateData);

            toast({
                title: "¡Solicitud de Vinculación Enviada!",
                description: `${updatedData.name} recibirá una notificación para confirmar.`,
            });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error al Vincular', description: e.message });
        }
    } else {
        const localUpdateData: any = { ...updatedData };
        if (!localUpdateData.isAppUser) {
            localUpdateData.appUserId = deleteField();
            localUpdateData.appUserPhotoUrl = deleteField();
        }
        delete localUpdateData.id;
        delete localUpdateData.userId;
        
        await updateDocumentNonBlocking(doc(debtorsRef, debtorId), localUpdateData);
        
        toast({
            title: "Contacto Actualizado",
            description: `La información de ${updatedData.name} ha sido guardada.`,
        });
    }
};

  const handleSyncDebts = async (debtorId: string) => {
    if (!firestore || !user || !debtors || !debts) {
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

    const privateDebtsToSync = debts.filter(d => d.debtorId === debtorId && !d.isShared);

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
        userId: undefined, // Clear old user ID
        creatorId: user.uid,
        status: 'pending', // Require approval after sync
        approvedBy: [user.uid],
      };
      
      delete newSharedDebtData.userId;

      batch.set(newSharedDebtRef, newSharedDebtData);

      const oldPrivateDebtRef = doc(firestore, 'users', user.uid, 'debts', debt.id);
      batch.delete(oldPrivateDebtRef);
    }
    
    try {
      await batch.commit();
      toast({
        title: "¡Sincronización Completa!",
        description: `${privateDebtsToSync.length} deudas ahora son compartidas con ${debtor.name} y esperan su aprobación.`,
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

  const handleSetDebtCategory = (debtId: string, categoryId: string | null) => {
    if (!firestore || !user) return;
    const metadataId = `${user.uid}_${debtId}`;
    const metadataRef = doc(firestore, 'debt_user_metadata', metadataId);

    if (categoryId) {
        setDocumentNonBlocking(metadataRef, {
            userId: user.uid,
            debtId: debtId,
            categoryId: categoryId,
        });
    } else {
        deleteDocumentNonBlocking(metadataRef);
    }
    toast({ title: "Categoría actualizada" });
  };


  const applyFiltersAndSort = useCallback((debtsToFilter: Debt[]) => {
      if (!debtsToFilter) return [];
      const query = searchQuery.toLowerCase();
      
      const filtered = debtsToFilter.filter(debt => {
          const matchesSearch = query === "" ||
              debt.concept.toLowerCase().includes(query) ||
              debt.debtorName.toLowerCase().includes(query) ||
              (debt.items && debt.items.some(item => item.name.toLowerCase().includes(query)));

          const matchesType = filters.types.length === 0 || filters.types.includes(debt.type);
          const matchesStatus = filters.statuses.length === 0 || filters.statuses.includes(debt.status || 'approved');
          const matchesDebtor = filters.debtorId === 'all' || debt.debtorId === filters.debtorId;
          const matchesCategory = filters.categoryId === 'all' || debt.categoryId === filters.categoryId;
          
          const debtDate = debt.createdAt.toDate();
          const matchesDate = !filters.date.from || (
              filters.date.to 
                ? isWithinInterval(debtDate, { start: filters.date.from, end: filters.date.to })
                : debtDate >= filters.date.from
          );

          return matchesSearch && matchesType && matchesStatus && matchesDebtor && matchesCategory && matchesDate;
      });

      return filtered.sort((a, b) => {
          if (sortOrder === 'createdAt_asc') {
              return a.createdAt.toMillis() - b.createdAt.toMillis();
          } else {
              return b.createdAt.toMillis() - a.createdAt.toMillis();
          }
      });

  }, [searchQuery, filters, sortOrder]);

  const activeDebts = useMemo(() => {
    if (!debts) return [];
    const outstandingDebts = debts.filter(d => (d.amount - d.payments.reduce((s, p) => s + p.amount, 0)) > 0.01);
    return applyFiltersAndSort(outstandingDebts);
  }, [debts, applyFiltersAndSort]);

  const historicalDebts = useMemo(() => {
    if (!debts) return [];
    const settledOrRejected = debts.filter(d => (d.amount - d.payments.reduce((s, p) => s + p.amount, 0)) <= 0.01 || d.status === 'rejected');
    return applyFiltersAndSort(settledOrRejected);
  }, [debts, applyFiltersAndSort]);



  const handleViewDebt = (debt: Debt) => {
    setDebtToView(debt);
  };
  
  const handleFilterClick = (status: 'pending' | 'rejected') => {
    setFilters(prev => ({
      ...prev,
      statuses: [status],
      types: ['iou', 'uome'], // Reset other filters for clarity
      debtorId: 'all',
      categoryId: 'all',
      date: { from: undefined, to: undefined },
    }));
    setActiveTab('all-debts');
  };

  const { totalIOwe, totalOwedToMe, pendingApprovalCount, rejectedCount } = useMemo(() => {
    if (!debts || !user) return { totalIOwe: 0, totalOwedToMe: 0, pendingApprovalCount: 0, rejectedCount: 0 };
    
    const activeApprovedDebts = debts.filter(d => d.status === 'approved');

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

    const pending = debts.filter(d => 
        d.isShared && 
        d.status === 'pending' && 
        d.participants?.includes(user.uid) && 
        !d.approvedBy?.includes(user.uid)
    ).length;

    const rejected = debts.filter(d => 
        d.isShared && 
        d.status === 'rejected' && 
        d.participants?.includes(user.uid)
    ).length;
    
    return { ...totals, pendingApprovalCount: pending, rejectedCount: rejected };
  }, [debts, user]);


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
        <Button size="sm" className="gap-1 bg-accent hover:bg-accent/90 text-accent-foreground text-xs md:text-sm">
            <PlusCircle className="h-4 w-4" />
            <span className="hidden md:inline">Agregar Deuda</span>
        </Button>
    </AddDebtDialog>
  );
  
  const renderContentForDebts = (debtsToRender: Debt[], isSettledView: boolean) => {
    if (viewMode === 'list') {
        return <DebtsList
            debts={debtsToRender}
            debtors={debtors || []}
            user={user}
            onAddPayment={handleAddPayment}
            onEditDebt={handleEditDebt}
            onDeleteDebt={handleDeleteDebt}
            onEditPayment={handleEditPayment}
            onDeletePayment={handleDeletePayment}
            isLoading={isLoading}
            onViewDebt={handleViewDebt}
        />;
    }
    
    return <DebtsGrid 
        debts={debtsToRender}
        debtors={debtors || []}
        categories={categories || []}
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
        onSetDebtCategory={handleSetDebtCategory}
        onViewDebt={handleViewDebt}
        isLoading={isLoading}
        showSettled={isSettledView}
        onToggleRecurrence={toggleRecurrenceStatus}
      />;
  };

  const TABS_CONFIG = [
      { value: "overview", label: "Resumen" },
      { value: "all-debts", label: "Deudas" },
      { value: "activity", label: "Actividad" },
      { value: "history", label: "Historial" },
      { value: "debtors", label: "Contactos" },
      { value: "categories", label: "Categorías" },
  ];


  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <DashboardHeader addDebtDialog={addDebtDialog} />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="grid gap-4 md:grid-cols-3">
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
           <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Acciones Pendientes</CardTitle>
               <Bell className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent className="pt-2">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-6 w-1/2" />
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <Button variant="link" className="p-0 h-auto text-base text-foreground" onClick={() => handleFilterClick('pending')}>
                    <span className="font-bold mr-2">{pendingApprovalCount}</span> Deudas por Aprobar
                  </Button>
                   <Button variant="link" className="p-0 h-auto text-sm text-muted-foreground" onClick={() => handleFilterClick('rejected')}>
                    <span className="font-semibold mr-2">{rejectedCount}</span> Deudas Rechazadas
                  </Button>
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
                                <DropdownMenuItem onSelect={() => exportToPDF(activeTab === 'all-debts' ? activeDebts : historicalDebts, { totalIOwe, totalOwedToMe })}>
                                    Exportar a PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => exportToCSV(activeTab === 'all-debts' ? activeDebts : historicalDebts)}>
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
                categories={categories || []}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                sortOrder={sortOrder}
                onSortOrderChange={setSortOrder}
              />
            )}
            <TabsContent value="overview" forceMount={activeTab === 'overview'}>
              <div className="space-y-4">
                <DebtsByPerson
                  user={user}
                  debts={debts}
                  debtors={debtors || []}
                  categories={categories || []}
                  settlements={settlements || []}
                  onAddPayment={handleAddPayment}
                  onEditDebt={handleEditDebt}
                  onDeleteDebt={handleDeleteDebt}
                  onEditPayment={handleEditPayment}
                  onDeletePayment={handleDeletePayment}
                  onSettleDebts={handleSettleDebts}
                  onApproveSettlement={handleApproveSettlement}
                  onRejectSettlement={handleRejectSettlement}
                  onRequestReversal={handleRequestReversal}
                  onApproveReversal={handleApproveReversal}
                  onApproveDebt={handleApproveDebt}
                  onRejectDebt={handleRejectDebt}
                  onConfirmDeletion={handleConfirmDeletion}
                  onCancelDeletionRequest={handleCancelDeletionRequest}
                  onSetDebtCategory={handleSetDebtCategory}
                  onViewDebt={handleViewDebt}
                  isLoading={isLoading}
                  onToggleRecurrence={toggleRecurrenceStatus}
                />
                <DebtsChart debts={debts} />
              </div>
            </TabsContent>
            <TabsContent value="all-debts" forceMount={activeTab === 'all-debts'}>
              {renderContentForDebts(activeDebts, false)}
            </TabsContent>
            <TabsContent value="activity" forceMount={activeTab === 'activity'}>
              <ActivityFeed debts={debts} debtors={debtors || []} onViewDebt={handleViewDebt}/>
            </TabsContent>
             <TabsContent value="history" forceMount={activeTab === 'history'}>
              {renderContentForDebts(historicalDebts, true)}
            </TabsContent>
            <TabsContent value="debtors" forceMount={activeTab === 'debtors'}>
              <DebtorDetails
                debtors={debtors || []}
                onAddDebtor={handleAddDebtor}
                onEditDebtor={handleEditDebtorAndCreateMirror}
                onDeleteDebtor={handleDeleteDebtor}
                onSyncDebts={handleSyncDebts}
                isLoading={isLoading}
              />
            </TabsContent>
             <TabsContent value="categories" forceMount={activeTab === 'categories'}>
              <CategoryManager categories={categories || []} isLoading={isLoading} />
            </TabsContent>
        </Tabs>
        {debtToView && (
            <ViewDebtDialog 
                debt={debtToView}
                categories={categories}
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

