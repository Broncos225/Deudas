"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Debt } from "@/lib/types";

interface DebtsChartProps {
  debts: Debt[];
}

export function DebtsChart({ debts }: DebtsChartProps) {
  // This chart will now show two bars per person: one for what you owe, and one for what they owe you.
  const chartData = debts.reduce((acc, debt) => {
    let existingEntry = acc.find((d) => d.name === debt.debtorName);
    if (!existingEntry) {
      existingEntry = { name: debt.debtorName, iou: 0, uome: 0 };
      acc.push(existingEntry);
    }
    
    // Fake conversion rate for demo purposes
    const rate = debt.currency === 'USD' ? 4000 : 1;
    const remainingInCop = (debt.amount - debt.payments.reduce((sum, p) => sum + p.amount, 0)) * rate;

    if (remainingInCop > 0) {
      if (debt.type === 'iou') {
        existingEntry.iou += remainingInCop;
      } else {
        existingEntry.uome += remainingInCop;
      }
    }
    
    return acc;
  }, [] as { name: string; iou: number; uome: number }[]).filter(d => d.iou > 0 || d.uome > 0);

  if (chartData.length === 0) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Resumen de Deudas por Persona</CardTitle>
                <CardDescription>
                Deuda restante por persona (en COP aprox.).
                </CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center">
                <p className="text-muted-foreground">No hay datos suficientes para mostrar el gráfico.</p>
            </CardContent>
        </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumen de Deudas por Persona</CardTitle>
        <CardDescription>
          Deuda restante por persona (en COP aprox.).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <XAxis
              dataKey="name"
              stroke="hsl(var(--foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="hsl(var(--foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${new Intl.NumberFormat('es-CO').format(value)}`}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--secondary))" }}
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
              formatter={(value: number, name: string) => {
                const formattedValue = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
                return [formattedValue, name === 'iou' ? 'Tú debes' : 'Te deben'];
              }}
            />
            <Bar
              dataKey="iou"
              stackId="a"
              name="Tú debes"
              fill="hsl(var(--destructive))"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="uome"
              stackId="a"
              name="Te deben"
              fill="hsl(var(--accent))"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
