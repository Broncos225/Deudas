
"use client";

import Image from 'next/image';
import { HandCoins, LogOut, PlusCircle, User as UserIcon, Users, Clipboard, ClipboardCheck } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { useAuth, useUser } from '@/firebase';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { ReactNode, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

interface DashboardHeaderProps {
    addDebtDialog: ReactNode;
}

export default function DashboardHeader({ addDebtDialog }: DashboardHeaderProps) {
    const auth = useAuth();
    const { user } = useUser();
    const router = useRouter();
    const { toast } = useToast();
    const [copied, setCopied] = useState(false);

    const handleSignOut = async () => {
        if(auth) {
            await signOut(auth);
            router.push('/login');
        }
    }

    const getUsername = (email: string | null | undefined) => {
        if (!email) return 'Usuario';
        const username = email.split('@')[0];
        return username.charAt(0).toUpperCase() + username.slice(1);
    }
    
    const getInitials = (email: string | null | undefined) => {
        if (!email) return 'U';
        const username = email.split('@')[0];
        return username.substring(0, 2).toUpperCase();
    }

    const handleCopyUserId = () => {
        if (!user) return;
        navigator.clipboard.writeText(user.uid).then(() => {
            setCopied(true);
            toast({
                title: '¡Copiado!',
                description: 'Tu código de usuario ha sido copiado al portapapeles.',
            });
            setTimeout(() => setCopied(false), 2000);
        }).catch(err => {
            console.error('Error al copiar el ID de usuario: ', err);
            toast({
                variant: "destructive",
                title: "Error al Copiar",
                description: "No se pudo copiar el código.",
            });
        });
    };


    return (
        <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-10">
            <a href="/" className="flex items-center gap-2 font-semibold text-lg">
                <HandCoins className="h-6 w-6 text-primary" />
                <span className="font-headline hidden md:inline-block">Deudas</span>
            </a>
            <div className="flex w-full flex-1 items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
                <div className="flex-1 ml-auto md:grow-0">
                  {/* Search bar removed from here */}
                </div>
                {addDebtDialog}
                <Button asChild variant="outline" size="sm" className="gap-1 text-xs md:text-sm">
                    <Link href="/split-expenses">
                        <Users className="h-4 w-4" />
                        <span className="hidden md:inline">Dividir Gastos</span>
                    </Link>
                </Button>
                <ThemeToggle />
                {user && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                                <Avatar className="h-8 w-8">
                                    {user.photoURL ? (
                                        <AvatarImage src={user.photoURL} alt={getUsername(user.email)} />
                                    ) : (
                                        <AvatarImage src={`https://avatar.vercel.sh/${user.uid}.png`} alt={getUsername(user.email)} />
                                    )}
                                    <AvatarFallback>{getInitials(user.email)}</AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64" align="end" forceMount>
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none">{getUsername(user.email)}</p>
                                    <p className="text-xs leading-none text-muted-foreground">
                                        {user.email}
                                    </p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                             <div className="px-2 py-1.5">
                                <span className="text-xs font-semibold text-muted-foreground">Tu Código de Usuario</span>
                                <div className="flex items-center justify-between mt-1">
                                    <code className="text-xs bg-muted text-muted-foreground rounded-sm px-2 py-1 truncate">{user.uid}</code>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopyUserId}>
                                        {copied ? <ClipboardCheck className="h-4 w-4 text-green-500" /> : <Clipboard className="h-4 w-4" />}
                                        <span className="sr-only">Copiar código de usuario</span>
                                    </Button>
                                </div>
                            </div>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleSignOut} className="gap-2 cursor-pointer">
                                <LogOut className="h-4 w-4" />
                                Cerrar sesión
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </header>
    );
}
