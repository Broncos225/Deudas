
"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Debt } from "./types";

const formatCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency, minimumFractionDigits: 0 }).format(amount);

const formatDate = (date: any) => {
    if (!date) return 'N/A';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return format(dateObj, "dd/MM/yyyy", { locale: es });
};

// --- CSV Export ---
const toCSV = (data: Debt[]): string => {
    const headers = [
        "Concepto",
        "Persona",
        "Tipo",
        "Monto Original",
        "Moneda",
        "Abonado",
        "Restante",
        "Fecha Creación",
        "Fecha Vencimiento",
        "Ítems",
        "Estado",
    ];

    const rows = data.map(debt => {
        const paid = debt.payments.reduce((acc, p) => acc + p.amount, 0);
        const remaining = debt.amount - paid;
        const status = remaining <= 0.01 ? "Saldada" : "Pendiente";
        const items = debt.items?.map(item => `${item.name} (${formatCurrency(item.value, debt.currency)})`).join('; ') || 'N/A';

        const row = [
            `"${debt.concept.replace(/"/g, '""')}"`,
            `"${debt.debtorName.replace(/"/g, '""')}"`,
            debt.type === "iou" ? "Pagar" : "Cobrar",
            debt.amount,
            debt.currency,
            paid,
            remaining,
            formatDate(debt.createdAt),
            formatDate(debt.dueDate),
            `"${items.replace(/"/g, '""')}"`,
            status,
        ];
        return row.join(",");
    });

    return [headers.join(","), ...rows].join("\n");
};

export const exportToCSV = (data: Debt[]) => {
    const csvString = toCSV(data);
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `deudas_${format(new Date(), "yyyyMMdd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};


// --- PDF Export ---
export const exportToPDF = (data: Debt[], totals: { totalIOwe: number, totalOwedToMe: number }) => {
    const doc = new jsPDF();
    const tableColumns = ["Concepto", "Persona", "Tipo", "Total", "Abonado", "Restante", "Creación", "Vencimiento"];
    
    const pendingDebts = data.filter(d => (d.amount - d.payments.reduce((s, p) => s + p.amount, 0)) > 0.01);
    const settledDebts = data.filter(d => (d.amount - d.payments.reduce((s, p) => s + p.amount, 0)) <= 0.01);

    const generateTableRows = (debts: Debt[]) => {
        return debts.map(debt => {
            const paid = debt.payments.reduce((acc, p) => acc + p.amount, 0);
            const remaining = debt.amount - paid;
            return [
                debt.concept,
                debt.debtorName,
                debt.type === 'iou' ? 'Pagar' : 'Cobrar',
                formatCurrency(debt.amount, debt.currency),
                formatCurrency(paid, debt.currency),
                formatCurrency(remaining, debt.currency),
                formatDate(debt.createdAt),
                formatDate(debt.dueDate),
            ];
        });
    };

    // Header
    doc.setFontSize(18);
    doc.text("Reporte de Deudas", 14, 22);
    doc.setFontSize(11);
    doc.text(`Fecha: ${format(new Date(), "d 'de' MMMM, yyyy", { locale: es })}`, 14, 30);

    // Summary (only for pending debts)
    doc.setFontSize(12);
    doc.text("Resumen de Saldos Pendientes (aproximado en COP):", 14, 40);
    autoTable(doc, {
        startY: 42,
        head: [['Total por Pagar', 'Total por Cobrar', 'Balance General']],
        body: [[
            formatCurrency(totals.totalIOwe, 'COP'),
            formatCurrency(totals.totalOwedToMe, 'COP'),
            { 
              content: formatCurrency(totals.totalOwedToMe - totals.totalIOwe, 'COP'),
              styles: { fontStyle: 'bold' }
            }
        ]],
        theme: 'grid',
        styles: {
            cellPadding: 2,
            fontSize: 10,
        },
        headStyles: {
            fillColor: [41, 128, 185],
            textColor: [255, 255, 255],
        }
    });

    let finalY = (doc as any).lastAutoTable.finalY;

    // Pending Debts Table
    if (pendingDebts.length > 0) {
        doc.setFontSize(14);
        doc.text("Deudas Pendientes", 14, finalY + 15);
        autoTable(doc, {
            head: [tableColumns],
            body: generateTableRows(pendingDebts),
            startY: finalY + 20,
            theme: 'striped',
            headStyles: {
                fillColor: [207, 88, 54],
                textColor: 255,
                fontStyle: 'bold',
            },
            styles: {
                fontSize: 8,
                cellPadding: 2,
            },
            alternateRowStyles: {
                fillColor: [250, 250, 250],
            },
        });
        finalY = (doc as any).lastAutoTable.finalY;
    }

    // Settled Debts Table
    if (settledDebts.length > 0) {
        doc.setFontSize(14);
        doc.text("Deudas Saldadas (Historial)", 14, finalY + 15);
        autoTable(doc, {
            head: [tableColumns],
            body: generateTableRows(settledDebts),
            startY: finalY + 20,
            theme: 'striped',
            headStyles: {
                fillColor: [110, 170, 110], 
                textColor: 255,
                fontStyle: 'bold',
            },
             styles: {
                fontSize: 8,
                cellPadding: 2,
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245],
            },
        });
    }

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 25, doc.internal.pageSize.height - 10);
    }
    
    doc.save(`reporte_deudas_${format(new Date(), "yyyyMMdd")}.pdf`);
};
