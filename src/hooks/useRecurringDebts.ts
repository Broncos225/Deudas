
"use client";

import { useEffect, useState } from 'react';
import { useFirestore, useUser, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { Debt, Recurrence } from '@/lib/types';
import { Timestamp, collection, doc, writeBatch, getDoc } from 'firebase/firestore';
import { useToast } from './use-toast';
import { add, isBefore, startOfDay, isEqual } from 'date-fns';

const getNextOccurrenceDate = (currentDate: Date, recurrence: Recurrence): Date => {
    switch (recurrence.frequency) {
        case 'daily':
            return add(currentDate, { days: 1 });
        case 'weekly':
            return add(currentDate, { weeks: 1 });
        case 'biweekly':
            return add(currentDate, { weeks: 2 });
        case 'monthly':
            const dayOfMonth = recurrence.dayOfMonth || currentDate.getDate();
            const nextMonth = add(currentDate, { months: 1 });
            const daysInNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
            
            return new Date(
                nextMonth.getFullYear(),
                nextMonth.getMonth(),
                Math.min(dayOfMonth, daysInNextMonth)
            );
        case 'yearly':
            return add(currentDate, { years: 1 });
        default:
            return add(currentDate, { days: 1 }); // Fallback
    }
};

export const useRecurringDebts = (privateDebts: Debt[]) => {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(true);

    useEffect(() => {
        if (!user || !firestore || privateDebts.length === 0) {
            setIsProcessing(false);
            return;
        }

        const processRecurringDebts = async () => {
            const today = startOfDay(new Date());
            const recurringTemplates = privateDebts.filter(
                (d) => d.isRecurring && d.recurrence?.status === 'active'
            );

            if (recurringTemplates.length === 0) {
                setIsProcessing(false);
                return;
            }

            const generatedDebts: string[] = [];
            const batch = writeBatch(firestore);

            for (const template of recurringTemplates) {
                if (!template.recurrence) continue;

                let { nextOccurrenceDate, lastGeneratedDate, endDate, activeDebtId } = template.recurrence;
                const nextOccurrence = nextOccurrenceDate.toDate();

                const hasBeenGeneratedForThisCycle = lastGeneratedDate && isEqual(startOfDay(lastGeneratedDate.toDate()), startOfDay(nextOccurrence));

                if (isBefore(nextOccurrence, today) || isEqual(nextOccurrence, today) && !hasBeenGeneratedForThisCycle) {
                    if (endDate && isBefore(endDate.toDate(), today)) {
                        const templateRef = doc(firestore, 'users', user.uid, 'debts', template.id);
                        batch.update(templateRef, { 'recurrence.status': 'paused' });
                        continue;
                    }
                    
                    let activeDebt: Debt | null = null;
                    if (activeDebtId) {
                        const activeDebtRef = doc(firestore, 'users', user.uid, 'debts', activeDebtId);
                        const activeDebtSnap = await getDoc(activeDebtRef);
                        if (activeDebtSnap.exists()) {
                            activeDebt = activeDebtSnap.data() as Debt;
                        }
                    }

                    const isPreviousDebtPaid = !activeDebt || (activeDebt.amount - activeDebt.payments.reduce((s, p) => s + p.amount, 0)) <= 0.01;

                    let newActiveDebtId = activeDebtId;

                    if (isPreviousDebtPaid && activeDebt) {
                        // "Recycle" the existing debt
                        const debtRef = doc(firestore, 'users', user.uid, 'debts', activeDebt.id);
                        batch.update(debtRef, {
                            createdAt: Timestamp.now(),
                            payments: []
                        });
                        generatedDebts.push(`${template.concept} (actualizada)`);
                    } else {
                        // Create a new debt instance
                        const newDebtData: Omit<Debt, 'id'> = {
                            ...template,
                            isRecurring: false,
                            createdAt: Timestamp.now(),
                            dueDate: template.dueDate ? Timestamp.fromDate(add(new Date(), { days: 7 })) : undefined,
                            payments: [],
                            generatedFromRecurringId: template.id,
                        };
                        delete newDebtData.recurrence;
                        delete newDebtData.id;

                        const newDebtRef = doc(collection(firestore, 'users', user.uid, 'debts'));
                        batch.set(newDebtRef, newDebtData);
                        newActiveDebtId = newDebtRef.id;
                        generatedDebts.push(`${template.concept} (nueva)`);
                    }

                    // Update template with next occurrence date and new active debt id
                    const newNextOccurrenceDate = getNextOccurrenceDate(nextOccurrence, template.recurrence);
                    const templateRef = doc(firestore, 'users', user.uid, 'debts', template.id);
                    batch.update(templateRef, {
                        'recurrence.nextOccurrenceDate': Timestamp.fromDate(newNextOccurrenceDate),
                        'recurrence.lastGeneratedDate': Timestamp.fromDate(nextOccurrence),
                        'recurrence.activeDebtId': newActiveDebtId,
                    });
                }
            }

            if (generatedDebts.length > 0) {
                try {
                    await batch.commit();
                    toast({
                        title: 'Deudas Recurrentes Generadas',
                        description: `Se procesaron ${generatedDebts.length} deudas: ${generatedDebts.join(', ')}.`,
                    });
                } catch (error) {
                    console.error("Error processing recurring debts batch:", error);
                    toast({
                        variant: 'destructive',
                        title: 'Error al generar deudas recurrentes',
                    });
                }
            }
            setIsProcessing(false);
        };

        processRecurringDebts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, firestore, privateDebts]);

    const toggleRecurrenceStatus = (debt: Debt, status: 'active' | 'paused') => {
        if (!user || !firestore || !debt.recurrence) return;

        const debtRef = doc(firestore, 'users', user.uid, 'debts', debt.id);
        updateDocumentNonBlocking(debtRef, { 'recurrence.status': status });
        toast({
            title: `Recurrencia ${status === 'active' ? 'Reanudada' : 'Pausada'}`,
            description: `La deuda recurrente "${debt.concept}" ha sido ${status === 'active' ? 'reanudada' : 'pausada'}.`,
        });
    };

    return { isProcessing, toggleRecurrenceStatus };
};
