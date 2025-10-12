"use client";
import DebtDashboard from "@/components/debt-dashboard";
import { useUser } from "@/firebase";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || !user) {
    return null; // O un componente de carga
  }

  return (
    <main className="min-h-screen w-full">
      <DebtDashboard />
    </main>
  );
}
