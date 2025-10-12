"use client";

import Image from 'next/image';
import { HandCoins, LogOut, PlusCircle, User as UserIcon } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { useAuth, useUser } from '@/firebase';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { ReactNode } from 'react';

interface DashboardHeaderProps {
    addDebtDialog: ReactNode;
}

export default function DashboardHeader({ addDebtDialog }: DashboardHeaderProps) {
    const auth = useAuth();
    const { user } = useUser();
    const router = useRouter();

    const handleSignOut = async () => {
        if(auth) {
            await signOut(auth);
            router.push('/login');
        }
    }

    const getUsername = (email: string | null | undefined) => {
        if (!email) return 'Usuario';
        return email.split('@')[0];
    }
    
    const getInitials = (email: string | null | undefined) => {
        if (!email) return 'U';
        const username = getUsername(email);
        return username.substring(0, 2).toUpperCase();
    }


    return (
        <header className="sticky top-0 flex h-14 md:h-16 items-center gap-4 border-b bg-background px-2 md:px-6 z-10">
            <a href="#" className="flex items-center gap-2 font-semibold">
                <HandCoins className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                <span className="font-headline text-base md:text-lg">Deudas</span>
            </a>
            <div className="ml-auto flex items-center gap-2">
                {addDebtDialog}
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
                        <DropdownMenuContent className="w-56" align="end" forceMount>
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none">{getUsername(user.email)}</p>
                                    <p className="text-xs leading-none text-muted-foreground">
                                        {user.email}
                                    </p>
                                </div>
                            </DropdownMenuLabel>
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
