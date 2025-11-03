
"use client";

import { useCollection, useMemoFirebase, useUser } from "@/firebase";
import { ActivityLog, Debt, Debtor } from "@/lib/types";
import { collection, query, where } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Loader, MessageSquareText, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface ActivityFeedProps {
    debts: Debt[];
    debtors: Debtor[];
    onViewDebt: (debt: Debt) => void;
}

export function ActivityFeed({ debts, debtors, onViewDebt }: ActivityFeedProps) {
    const { user } = useUser();
    const firestore = useFirestore();

    const activityLogsQuery = useMemoFirebase(() => {
        if (!firestore || !user?.uid) {
          return null;
        }
        
        const q = query(
            collection(firestore, 'activity_logs'),
            where('participants', 'array-contains', user.uid)
        );
        
        return q;
    }, [firestore, user?.uid]);

    const { data: activityLogs, isLoading } = useCollection<ActivityLog>(activityLogsQuery);

    const sortedLogs = useMemo(() => {
        if (!activityLogs) return [];
        return [...activityLogs].sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
    }, [activityLogs]);
    
    const userAvatars = useMemo(() => {
        const avatarMap = new Map<string, string | null>();
        if (user && user.photoURL) {
            avatarMap.set(user.uid, user.photoURL);
        }
        
        debtors.forEach(debtor => {
            if (debtor.isAppUser && debtor.appUserId && debtor.appUserPhotoUrl) {
                 avatarMap.set(debtor.appUserId, debtor.appUserPhotoUrl);
            }
        });
        return avatarMap;
    }, [user, debtors]);


    const getInitials = (name: string) => {
        if (!name) return '??';
        const parts = name.split(' ');
        if (parts.length > 1 && parts[0] && parts[1]) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex items-center justify-center p-8">
                    <Loader className="h-6 w-6 animate-spin text-primary" />
                </div>
            );
        }

        if (!sortedLogs || sortedLogs.length === 0) {
            return (
                <div className="text-center py-10">
                    <MessageSquareText className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="text-muted-foreground mt-4">No hay actividad compartida reciente.</p>
                    <p className="text-muted-foreground text-sm">Crea o interactúa con una deuda compartida para ver la actividad aquí.</p>
                </div>
            );
        }

        return (
            <ul className="space-y-2">
                {sortedLogs.map((log) => {
                    const timeAgo = formatDistanceToNow(log.timestamp.toDate(), { addSuffix: true, locale: es });
                    const isCurrentUser = log.userId === user?.uid;
                    const isDestructive = /eliminó|rechazó|canceló/.test(log.message);

                    const debt = debts?.find(d => d.id === log.debtId);
                    const canViewDebt = !!debt;
                    
                    const logUserAvatar = log.userPhotoUrl || userAvatars.get(log.userId) || `https://avatar.vercel.sh/${log.userId}.png`;


                    return (
                        <li 
                            key={log.id} 
                            className={cn(
                                "flex items-start gap-4 p-3 rounded-lg",
                                canViewDebt && "hover:bg-muted/50 cursor-pointer",
                                isDestructive && "bg-destructive/5 text-destructive-foreground/80"
                            )}
                            onClick={() => {
                                if (debt) {
                                    onViewDebt(debt);
                                }
                            }}
                            role={canViewDebt ? "button" : undefined}
                            tabIndex={canViewDebt ? 0 : -1}
                            onKeyDown={(e) => { 
                                if ((e.key === 'Enter' || e.key === ' ') && debt) {
                                    onViewDebt(debt);
                                }
                             }}
                        >
                            <Avatar>
                                <AvatarImage src={logUserAvatar} alt={log.userName} />
                                <AvatarFallback>{getInitials(log.userName)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <p className="text-sm">
                                    {isCurrentUser ? (
                                        <>
                                            <span className="font-semibold">Tú</span>
                                            {' '}{log.message
                                                .replace(new RegExp(`^${log.userName}\\s+`, 'i'), '')
                                                .replace(/^creó/, 'creaste')
                                                .replace(/^editó/, 'editaste')
                                                .replace(/^eliminó/, 'eliminaste')
                                                .replace(/^registró/, 'registraste')
                                                .replace(/^rechazó/, 'rechazaste')
                                                .replace(/^aceptó/, 'aceptaste')
                                                .replace(/^envió/, 'enviaste')
                                                .replace(/^canceló/, 'cancelaste')
                                                .replace(/^completó/, 'completaste')
                                                .replace(/^actualizó/, 'actualizaste')
                                                .replace(/^solicitó/, 'solicitaste')
                                                .replace(/^confirmó/, 'confirmaste')
                                                .replace(/^aprobó/, 'aprobaste')
                                                .replace(/^generó/, 'generaste')
                                                .replace(/ y activó/, ' y activaste')
                                            }
                                        </>
                                    ) : (
                                        <>
                                            <span className="font-semibold">{log.userName}</span>
                                            {' '}{log.message.replace(new RegExp(`^${log.userName}\\s+`, 'i'), '')}
                                        </>
                                    )}
                                </p>
                                <p className="text-xs text-muted-foreground">{timeAgo}</p>
                            </div>
                        </li>
                    );
                })}
            </ul>
        );
    };

    return (
        <Card className="mt-4">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileText />
                    Historial de Actividad Compartida
                </CardTitle>
                <CardDescription>
                    Un registro de las acciones recientes en tus deudas compartidas. Haz clic para ver la deuda.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {renderContent()}
            </CardContent>
        </Card>
    );
}
