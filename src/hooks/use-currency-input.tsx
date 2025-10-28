
"use client";

import { useState, useEffect, useCallback } from 'react';

// This utility function removes any non-digit characters from the string.
const getNumericValue = (value: string) => value.replace(/[^0-9]/g, '');

interface UseCurrencyInputProps {
  initialValue?: number;
  onChangeRHF?: (value: number | undefined) => void;
}

export const useCurrencyInput = ({ initialValue, onChangeRHF }: UseCurrencyInputProps) => {
  const [displayValue, setDisplayValue] = useState('');
  const [numericValue, setNumericValue] = useState<number | undefined>(initialValue);

  // This effect synchronizes the component's state with an external initialValue.
  useEffect(() => {
    if (initialValue !== undefined) {
        const formatted = new Intl.NumberFormat('es-CO').format(initialValue);
        setDisplayValue(`$ ${formatted}`);
        setNumericValue(initialValue);
    } else {
        setDisplayValue('');
        setNumericValue(undefined);
    }
  }, [initialValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const newNumericValue = getNumericValue(rawValue);

    if (newNumericValue === '') {
      setDisplayValue('');
      setNumericValue(undefined);
      if (onChangeRHF) onChangeRHF(undefined);
      return;
    }

    const numberValue = parseInt(newNumericValue, 10);
    const formatted = new Intl.NumberFormat('es-CO').format(numberValue);

    setDisplayValue(`$ ${formatted}`);
    setNumericValue(numberValue);
    if (onChangeRHF) onChangeRHF(numberValue);
  };

  const handleBlur = () => {
    if (numericValue !== undefined) {
        const formatted = new Intl.NumberFormat('es-CO').format(numericValue);
        setDisplayValue(`$ ${formatted}`);
    } else {
        setDisplayValue('');
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if(numericValue !== undefined) {
        e.target.select();
    }
  };


  return {
    inputProps: {
      value: displayValue,
      onChange: handleChange,
      onBlur: handleBlur,
      onFocus: handleFocus,
      placeholder: '$ 0',
      className:"text-right",
    },
    numericValue,
  };
};
