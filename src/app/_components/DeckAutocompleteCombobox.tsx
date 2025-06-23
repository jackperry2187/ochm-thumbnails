'use client';

import * as React from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '~/lib/utils';
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
import { useDebounce } from '~/hooks/useDebounce';

interface DeckAutocompleteComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  emptyResultText?: string;
  disabled?: boolean;
}

export function DeckAutocompleteCombobox({
  value,
  onValueChange,
  placeholder = 'Select deck...',
  emptyResultText = 'No deck found. Type to create.',
  disabled = false,
}: DeckAutocompleteComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const { data: suggestions, isLoading } = api.deck.autocompleteDeckName.useQuery(
    { query: debouncedSearchQuery },
    {
      enabled: !!debouncedSearchQuery && open,
      staleTime: 1000 * 60,
      placeholderData: (previousData) => previousData,
    }
  );

  const handleSelect = (currentValue: string) => {
    onValueChange(currentValue);
    setSearchQuery('');
    setOpen(false);
  };
  
  const handleInputChange = (inputValue: string) => {
    setSearchQuery(inputValue);
    onValueChange(inputValue); 
  };

  const handleButtonClick = () => {
    if (value && !open) setSearchQuery(value); 
    setOpen(!open);
  };

  const showLoading = isLoading && debouncedSearchQuery;
  const showEmpty = !isLoading && debouncedSearchQuery && (!suggestions || suggestions.length === 0);
  const showSuggestions = suggestions && suggestions.length > 0;
  const showCreateOption = !isLoading && searchQuery && (!suggestions?.find(s => s.name.toLowerCase() === searchQuery.toLowerCase()));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between")}
          disabled={disabled}
          onClick={handleButtonClick}
        >
          {value ? (
            <span className="truncate text-slate-50">{value}</span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 text-slate-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder={placeholder} 
            value={searchQuery}
            onValueChange={handleInputChange}
            disabled={disabled}
          />
          <CommandList>
            {showLoading && <CommandItem disabled>Loading...</CommandItem>}
            {showEmpty && <CommandEmpty>{emptyResultText}</CommandEmpty>}
            
            {showSuggestions && (
              <CommandGroup>
                {suggestions.map((deck) => (
                  <CommandItem
                    key={deck.name}
                    value={deck.name}
                    onSelect={() => handleSelect(deck.name)}
                    className="flex justify-between"
                  >
                    <span>{deck.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {format(new Date(deck.lastUsedAt), 'P')}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            
            {showCreateOption && (
              <CommandItem
                key={searchQuery}
                value={searchQuery}
                onSelect={() => handleSelect(searchQuery)}
              >
                Create &quot;{searchQuery}&quot;
              </CommandItem>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
} 