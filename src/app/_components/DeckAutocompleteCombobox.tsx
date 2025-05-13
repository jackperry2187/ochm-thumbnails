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
      enabled: !!debouncedSearchQuery && open, // Query when search term exists and popover is open
      staleTime: 1000 * 60, // 1 minute
      placeholderData: (previousData) => previousData,
    }
  );

  const handleSelect = (currentValue: string) => {
    onValueChange(currentValue); // Set the name
    setSearchQuery(''); // Clear search query after selection
    setOpen(false);
  };
  
  const handleInputChange = (inputValue: string) => {
    setSearchQuery(inputValue);
    // If user types a new name not in suggestions, we still want to update the input field
    // The actual saving of new deck names will happen on thumbnail download.
    // So, we directly call onValueChange to update the displayed name in the input.
    onValueChange(inputValue); 
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between"
          )}
          disabled={disabled}
          onClick={() => {
            // When opening, if there's a value, populate search to show it / similar items
            if (value && !open) setSearchQuery(value); 
            setOpen(!open);
          }}
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
            value={searchQuery} // Controlled input for search
            onValueChange={handleInputChange} // Update search query and main value
            disabled={disabled}
          />
          <CommandList>
            {isLoading && debouncedSearchQuery && <CommandItem disabled>Loading...</CommandItem>}
            {!isLoading && debouncedSearchQuery && (!suggestions || suggestions.length === 0) && (
              <CommandEmpty>{emptyResultText}</CommandEmpty>
            )}
            {suggestions && suggestions.length > 0 && (
              <CommandGroup>
                {suggestions.map((deck) => (
                  <CommandItem
                    key={deck.name}
                    value={deck.name} // Important for Command internals if not filtering
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
            {/* Option to show the currently typed text if it's not in suggestions, allowing creation */}
            {!isLoading && searchQuery && (!suggestions?.find(s => s.name.toLowerCase() === searchQuery.toLowerCase())) && (
                <CommandItem
                    key={searchQuery} // Unique key for the current typed value
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