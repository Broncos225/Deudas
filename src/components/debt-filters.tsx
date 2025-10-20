
"use client";

import { Debtor } from "@/lib/types";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Search, X } from "lucide-react";
import { Input } from "./ui/input";

export interface Filters {
  type: 'all' | 'iou' | 'uome';
  currency: 'all' | 'COP' | 'USD' | 'EUR';
  debtorId: string;
}

interface DebtFiltersProps {
  filters: Filters;
  onFilterChange: (filters: Filters) => void;
  debtors: Debtor[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function DebtFilters({ filters, onFilterChange, debtors, searchQuery, onSearchChange }: DebtFiltersProps) {

  const handleFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFilterChange({
      type: 'all',
      currency: 'all',
      debtorId: 'all',
    });
    onSearchChange("");
  };

  const hasActiveFilters = filters.type !== 'all' || filters.currency !== 'all' || filters.debtorId !== 'all' || searchQuery !== "";

  return (
    <div className="flex flex-col md:flex-row flex-wrap items-center gap-2 mt-4 p-4 bg-muted/50 rounded-lg">
      <div className="relative flex-1 w-full md:w-auto md:grow">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
              type="search"
              placeholder="Buscar por concepto, persona, ítem..."
              className="w-full rounded-lg bg-background pl-8"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
          />
      </div>
      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
        <Select value={filters.type} onValueChange={(value) => handleFilter('type', value as Filters['type'])}>
          <SelectTrigger className="w-full sm:w-auto flex-1 md:flex-none md:w-[150px]">
            <SelectValue placeholder="Tipo de deuda" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="iou">Tú debes</SelectItem>
            <SelectItem value="uome">Te deben</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.currency} onValueChange={(value) => handleFilter('currency', value as Filters['currency'])}>
          <SelectTrigger className="w-full sm:w-auto flex-1 md:flex-none md:w-[150px]">
            <SelectValue placeholder="Moneda" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las monedas</SelectItem>
            <SelectItem value="COP">COP</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
            <SelectItem value="EUR">EUR</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.debtorId} onValueChange={(value) => handleFilter('debtorId', value)}>
          <SelectTrigger className="w-full sm:w-auto flex-1 md:flex-none md:w-[180px]">
            <SelectValue placeholder="Persona" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las personas</SelectItem>
            {debtors.map(debtor => (
              <SelectItem key={debtor.id} value={debtor.id}>{debtor.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearFilters} className="gap-1 text-muted-foreground">
            <X className="h-4 w-4" />
            Limpiar
          </Button>
        )}
      </div>
    </div>
  );
}
