
"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface ComboboxProps {
    options: { value: string; label: string }[];
    onSelect: (value: string, label?: string) => void;
    onEnter: (value: string) => void;
    selectedValue?: string;
    placeholder: string;
    searchPlaceholder: string;
    noResultsText: string;
}

export function Combobox({ 
    options, 
    onSelect, 
    onEnter,
    selectedValue,
    placeholder, 
    searchPlaceholder, 
    noResultsText 
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState('');

  const handleSelect = (currentValue: string, label?: string) => {
    setInputValue(''); // Clear input after selection
    setOpen(false);
    onSelect(currentValue, label);
  }
  
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && inputValue) {
        // Find if the input value matches an option's label
        const matchingOption = options.find(option => option.label.toLowerCase() === inputValue.toLowerCase());
        if (matchingOption) {
            handleSelect(matchingOption.value, matchingOption.label);
        } else {
            // It's a new value
            onEnter(inputValue);
            setInputValue('');
        }
        event.preventDefault();
        setOpen(false);
    }
  };
  
  const displayLabel = selectedValue
    ? options.find((option) => option.value === selectedValue)?.label || selectedValue
    : placeholder;


  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder={searchPlaceholder} 
            value={inputValue}
            onValueChange={setInputValue}
            onKeyDown={handleKeyDown}
          />
          <CommandList>
            <CommandEmpty>{noResultsText}</CommandEmpty>
            <CommandGroup>
              {options
                .filter(option => option.label.toLowerCase().includes(inputValue.toLowerCase()))
                .map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={(currentValue) => {
                    handleSelect(currentValue, option.label);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedValue === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

    