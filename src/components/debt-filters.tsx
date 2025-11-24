
"use client";

import { Debtor, Category } from "@/lib/types";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Search, X, Calendar as CalendarIcon, ArrowDown, ArrowUp, ListFilter } from "lucide-react";
import { Input } from "./ui/input";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "./ui/calendar";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { useState } from "react";

export type SortOrder = 'createdAt_asc' | 'createdAt_desc';
export type Status = 'approved' | 'pending' | 'rejected';


export interface Filters {
  types: ('iou' | 'uome')[];
  statuses: Status[];
  debtorId: string;
  categoryId: string;
  date: DateRange;
}

interface DebtFiltersProps {
  filters: Filters;
  onFilterChange: (filters: Filters) => void;
  debtors: Debtor[];
  categories: Category[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortOrder: SortOrder;
  onSortOrderChange: (order: SortOrder) => void;
}

export function DebtFilters({ 
  filters, 
  onFilterChange, 
  debtors, 
  categories, 
  searchQuery, 
  onSearchChange,
  sortOrder,
  onSortOrderChange
}: DebtFiltersProps) {
  const [calendarMonth, setCalendarMonth] = useState<Date | undefined>(filters.date?.from);

  const handleFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const handleDateSelect = (range: DateRange | undefined) => {
    const newRange = range || { from: undefined, to: undefined };
    handleFilter('date', newRange);
    if (newRange.from && !newRange.to) {
      setCalendarMonth(newRange.from);
    }
  };

  const clearFilters = () => {
    onFilterChange({
      types: ['iou', 'uome'],
      statuses: ['approved', 'pending', 'rejected'],
      debtorId: 'all',
      categoryId: 'all',
      date: { from: undefined, to: undefined },
    });
    onSearchChange("");
    setCalendarMonth(undefined);
    onSortOrderChange('createdAt_asc');
  };

  const hasActiveFilters = 
    filters.types.length < 2 || 
    filters.statuses.length < 3 || 
    filters.debtorId !== 'all' || 
    filters.categoryId !== 'all' || 
    searchQuery !== "" || 
    filters.date.from || 
    filters.date.to || 
    sortOrder !== 'createdAt_asc';

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
        <ToggleGroup
            type="multiple"
            value={filters.types}
            onValueChange={(value: ('iou' | 'uome')[]) => {
              if (value.length > 0) handleFilter('types', value);
            }}
            className="gap-1"
        >
            <ToggleGroupItem value="iou" aria-label="Tú debes" className="hover:bg-accent/50 data-[state=on]:bg-red-500/10 data-[state=on]:border-red-500/50 data-[state=on]:text-red-700 dark:data-[state=on]:text-red-300">
                <ArrowDown className="h-3 w-3 mr-1"/>
                Debes
            </ToggleGroupItem>
            <ToggleGroupItem value="uome" aria-label="Te deben" className="hover:bg-accent/50 data-[state=on]:bg-green-500/10 data-[state=on]:border-green-500/50 data-[state=on]:text-green-700 dark:data-[state=on]:text-green-300">
                <ArrowUp className="h-3 w-3 mr-1"/>
                Te Deben
            </ToggleGroupItem>
        </ToggleGroup>
        
        <ToggleGroup
            type="multiple"
            variant="outline"
            value={filters.statuses}
            onValueChange={(value: Status[]) => {
                if (value.length > 0) handleFilter('statuses', value);
            }}
            className="gap-1"
        >
            <ToggleGroupItem value="approved" aria-label="Activas" className="hover:bg-accent/50">Activas</ToggleGroupItem>
            <ToggleGroupItem value="pending" aria-label="Pendientes" className="hover:bg-accent/50">Pendientes</ToggleGroupItem>
            <ToggleGroupItem value="rejected" aria-label="Rechazadas" className="hover:bg-accent/50">Rechazadas</ToggleGroupItem>
        </ToggleGroup>
        
        <div className="flex gap-2">
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
            
            <Select value={filters.categoryId} onValueChange={(value) => handleFilter('categoryId', value)}>
              <SelectTrigger className="w-full sm:w-auto flex-1 md:flex-none md:w-[180px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category.id} value={category.id}>
                    <div className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full", category.color)}></span>
                        {category.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
        </div>
        
        <div className="flex gap-2">
            <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                      "w-full sm:w-auto flex-1 md:flex-none md:w-[260px] justify-start text-left font-normal",
                      !filters.date.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.date.from ? (
                      filters.date.to ? (
                        <>
                          {format(filters.date.from, "LLL dd, y", { locale: es })} -{" "}
                          {format(filters.date.to, "LLL dd, y", { locale: es })}
                        </>
                      ) : (
                        format(filters.date.from, "LLL dd, y", { locale: es })
                      )
                    ) : (
                      <span>Elige una fecha</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    month={calendarMonth}
                    onMonthChange={setCalendarMonth}
                    selected={filters.date}
                    onSelect={handleDateSelect}
                    numberOfMonths={2}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>

            <Select value={sortOrder} onValueChange={(value) => onSortOrderChange(value as SortOrder)}>
              <SelectTrigger className="w-full sm:w-auto flex-1 md:flex-none md:w-[180px]">
                <ListFilter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt_desc">Más recientes primero</SelectItem>
                <SelectItem value="createdAt_asc">Más antiguas primero</SelectItem>
              </SelectContent>
            </Select>
        </div>


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
