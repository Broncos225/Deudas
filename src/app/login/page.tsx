
"use client";

import { useAuth, useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInWithEmailAndPassword } from "firebase/auth";
import { HandCoins } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  username: z.string().min(1, { message: "El usuario es requerido." }),
  password: z.string().min(1, { message: "La contraseña es requerida." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
    const auth = useAuth();
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const { toast } = useToast();

    const form = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            username: "",
            password: "",
        },
    });

    useEffect(() => {
        if (!isUserLoading && user) {
            router.push('/');
        }
    }, [user, isUserLoading, router]);

    const handleLogin = async (data: LoginFormValues) => {
        if (!auth) return;
        const email = `${data.username}@playground.com`;
        try {
            await signInWithEmailAndPassword(auth, email, data.password);
            router.push('/');
        } catch (error) {
            console.error("Error signing in", error);
            toast({
                variant: "destructive",
                title: "Error de inicio de sesión",
                description: "Usuario o contraseña incorrectos. Por favor, inténtalo de nuevo.",
            });
        }
    };

    if (isUserLoading || user) {
        return null; // O un spinner de carga
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
            <Card className="w-full max-w-sm">
                <CardHeader className="text-center">
                    <div className="flex justify-center mb-4">
                        <HandCoins className="h-10 w-10 text-primary" />
                    </div>
                    <CardTitle className="text-2xl">Bienvenido a Deudas</CardTitle>
                    <CardDescription>
                        Inicia sesión para gestionar tus deudas y pagos.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="username"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Usuario</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Input placeholder="tu-usuario" {...field} />
                                                <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-sm text-muted-foreground">
                                                    @playground.com
                                                </span>
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Contraseña</FormLabel>
                                        <FormControl>
                                            <Input type="password" placeholder="••••••••" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? "Iniciando sesión..." : "Iniciar Sesión"}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </main>
    );
}
