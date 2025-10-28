
"use client";

import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Trash2, PercentIcon } from 'lucide-react';
import { useCurrencyInput } from '@/hooks/use-currency-input';

interface Participant {
  id: string;
  name: string;
  amountPaid: number;
  percentageToPay?: number;
  fixedAmountToPay?: number;
}

interface ParticipantInputRowProps {
  participant: Participant;
  onUpdate: (newValues: Partial<Omit<Participant, 'id'>>) => void;
  onRemove: () => void;
  index: number;
}

const ParticipantInputRowComponent = ({ participant, onUpdate, onRemove, index }: ParticipantInputRowProps) => {
  const { inputProps: amountPaidInputProps } = useCurrencyInput({
    initialValue: participant.amountPaid,
    onChangeRHF: (amount) => onUpdate({ amountPaid: amount || 0 }),
  });

  const { inputProps: fixedAmountInputProps } = useCurrencyInput({
    initialValue: participant.fixedAmountToPay,
    onChangeRHF: (fixedAmount) => onUpdate({ fixedAmountToPay: fixedAmount, percentageToPay: undefined }),
  });

  const handlePercentageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "") {
        onUpdate({ percentageToPay: undefined, fixedAmountToPay: undefined });
        return;
    }
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
        onUpdate({ percentageToPay: numValue, fixedAmountToPay: undefined });
    } else if (isNaN(numValue) && value.trim() !== "") {
        // Allow typing, but don't update state if invalid partial input (e.g. "abc")
    } else if (numValue < 0) {
        onUpdate({ percentageToPay: 0, fixedAmountToPay: undefined });
    } else if (numValue > 100) {
        onUpdate({ percentageToPay: 100, fixedAmountToPay: undefined });
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-2 p-3 border rounded-md bg-card hover:shadow-sm">
      <div className="flex-grow space-y-1 min-w-[120px] sm:min-w-[150px]">
        <Label htmlFor={`participantName-${participant.id}`} className="text-xs">Participante #{index + 1}</Label>
        <Input
          id={`participantName-${participant.id}`}
          type="text"
          placeholder="Nombre"
          value={participant.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="h-9 text-sm"
        />
      </div>
      <div className="w-32 space-y-1">
        <Label htmlFor={`participantAmount-${participant.id}`} className="text-xs">Pagó</Label>
        <Input
          id={`participantAmount-${participant.id}`}
          {...amountPaidInputProps}
          className="h-9 text-sm"
        />
      </div>
      <div className="w-32 space-y-1">
        <Label htmlFor={`participantFixed-${participant.id}`} className="text-xs">Monto Fijo</Label>
        <Input
          id={`participantFixed-${participant.id}`}
          {...fixedAmountInputProps}
          className="h-9 text-sm"
        />
      </div>
      <div className="w-28 space-y-1">
        <Label htmlFor={`participantPercentage-${participant.id}`} className="text-xs">Porcentaje (%)</Label>
        <div className="flex items-center">
            <Input
            id={`participantPercentage-${participant.id}`}
            type="number"
            min="0"
            max="100"
            step="0.01"
            placeholder="Ej: 20"
            value={participant.percentageToPay === undefined ? '' : participant.percentageToPay}
            onChange={handlePercentageInputChange}
            className="h-9 text-sm rounded-r-none"
            />
            <span className="flex h-9 items-center justify-center rounded-r-md border border-l-0 border-input bg-muted px-2 text-sm text-muted-foreground">
                <PercentIcon className="h-4 w-4" />
            </span>
        </div>
      </div>
      <Button onClick={onRemove} variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive flex-shrink-0">
        <Trash2 className="h-4 w-4" />
         <span className="sr-only">Eliminar {participant.name}</span>
      </Button>
    </div>
  );
};

export const ParticipantInputRow = React.memo(ParticipantInputRowComponent);
