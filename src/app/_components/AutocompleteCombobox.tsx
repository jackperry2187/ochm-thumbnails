'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '~/lib/utils'; // Standard shadcn/ui util
import { Button } from '~/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '~/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import { api } from '~/trpc/react';
import { useDebounce } from '~/hooks/useDebounce'; // Corrected import path

interface AutocompleteComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  emptyResultText?: string;
  disabled?: boolean;
}

export function AutocompleteCombobox({
  value,
  onValueChange,
  placeholder = 'Select card...',
  emptyResultText = 'No card found.',
  disabled = false,
}: AutocompleteComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const { data: suggestions, isLoading, error } = api.scryfall.autocompleteCardName.useQuery(
    { query: debouncedSearchQuery },
    {
      enabled: !!debouncedSearchQuery && debouncedSearchQuery.length >= 2 && open,
      staleTime: 1000 * 60 * 5,
      placeholderData: (previousData) => previousData, // Corrected option
    }
  );

  const handleSelect = (currentValue: string) => {
    onValueChange(currentValue === value ? '' : currentValue);
    setSearchQuery('');
    setOpen(false);
  };

  // Handle error state from tRPC query
  if (error) {
    console.error("Autocomplete error:", error);
  }

  const handleButtonClick = () => {
    if (value && !open) setSearchQuery(value);
    setOpen(!open);
  };

  const showLoading = isLoading && debouncedSearchQuery && debouncedSearchQuery.length > 0;
  const showEmpty = !isLoading && debouncedSearchQuery && debouncedSearchQuery.length > 1 && (!suggestions || suggestions.length === 0);
  const showSuggestions = suggestions && suggestions.length > 0;
  const showCurrentValue = !debouncedSearchQuery && value;
  const showKeepTyping = !isLoading && debouncedSearchQuery && debouncedSearchQuery.length > 0 && debouncedSearchQuery.length < 2;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
          onClick={handleButtonClick}
        >
          {value ? value : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false} className="w-full"> {/* Disable default filtering, we use API results */}
          <CommandInput 
            placeholder={placeholder} 
            value={searchQuery} 
            onValueChange={setSearchQuery} 
            disabled={disabled || isLoading}
          />
          <CommandList>
            {showLoading && <CommandItem disabled>Loading...</CommandItem>}
            {showEmpty && <CommandEmpty>{emptyResultText}</CommandEmpty>}
            
            {showSuggestions && (
              <CommandGroup>
                {suggestions.map((suggestion) => (
                  <CommandItem
                    key={suggestion}
                    value={suggestion}
                    onSelect={() => handleSelect(suggestion)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === suggestion ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {suggestion}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            
            {showCurrentValue && (
              <CommandItem
                key={value}
                value={value}
                onSelect={() => handleSelect(value)}
              >
                <Check className={cn('mr-2 h-4 w-4', value ? 'opacity-100' : 'opacity-0')}/>
                {value}
              </CommandItem>
            )}
            
            {showKeepTyping && (
              <CommandItem disabled>Keep typing to search...</CommandItem>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
} 