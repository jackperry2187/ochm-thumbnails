'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Label } from '~/components/ui/label';
import { Button } from '~/components/ui/button';
import ThumbnailCanvas, { type ThumbnailCanvasHandle } from '~/app/_components/ThumbnailCanvas';
import { AutocompleteCombobox } from '~/app/_components/AutocompleteCombobox';
import { DeckAutocompleteCombobox } from './_components/DeckAutocompleteCombobox';
import { api } from '~/trpc/react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogOverlay,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '~/components/ui/dialog';
import Image from 'next/image';

// Define types for card slots for better type safety
type CardSlot = 'topLeft' | 'bottomLeft' | 'topRight' | 'bottomRight';

interface CardState {
  name: string;
  artUrl: string | null;
  scryfallCardId: string | null; // This will now be the Scryfall Print ID
}

const initialCardState: CardState = { name: '', artUrl: null, scryfallCardId: null };

// Matches the output of api.scryfall.getCardArts
interface SelectedArtType {
  artUrl: string;
  set: string;
  scryfallPrintId: string;
}

// Matches the output of api.art.getArtUsage
interface ArtUsageInfoType {
  scryfallArtUrl: string;
  lastUsedAt: Date;
}

export default function HomePage() {
  const [leftDeckName, setLeftDeckName] = useState('');
  const [rightDeckName, setRightDeckName] = useState('');
  const thumbnailCanvasRef = useRef<ThumbnailCanvasHandle>(null);

  const [cardStates, setCardStates] = useState<Record<CardSlot, CardState>>({
    topLeft: { ...initialCardState },
    bottomLeft: { ...initialCardState },
    topRight: { ...initialCardState },
    bottomRight: { ...initialCardState },
  });

  const [isArtDialogOpen, setIsArtDialogOpen] = useState(false);
  const [currentSlotForArtSelection, setCurrentSlotForArtSelection] = useState<CardSlot | null>(null);
  const [artUrlsForSelection, setArtUrlsForSelection] = useState<SelectedArtType[]>([]);
  const [selectedCardNameForArt, setSelectedCardNameForArt] = useState<string>('');
  
  const [artUsageMap, setArtUsageMap] = useState<Record<string, Date | null>>({});

  const cardArtsQuery = api.scryfall.getCardArts.useQuery(
    { cardName: selectedCardNameForArt },
    {
      enabled: !!selectedCardNameForArt && !!currentSlotForArtSelection,
      staleTime: 1000 * 60 * 10, 
    }
  );
  
  const recordArtUsageMutation = api.art.recordArtUsage.useMutation();
  const saveDeckMutation = api.deck.saveOrUpdateDeckName.useMutation();

  const artUsageQueryUrls = artUrlsForSelection.map(art => art.artUrl);
  const artUsageQuery = api.art.getArtUsage.useQuery(
    { artUrls: artUsageQueryUrls },
    {
      enabled: artUsageQueryUrls.length > 0 && isArtDialogOpen, 
      staleTime: 1000 * 60 * 5, 
    }
  );

  useEffect(() => {
    if (artUsageQuery.isSuccess && artUsageQuery.data) {
      const newUsageMap: Record<string, Date | null> = {};
      artUsageQuery.data.forEach((record: ArtUsageInfoType) => {
        newUsageMap[record.scryfallArtUrl] = record.lastUsedAt;
      });
      setArtUsageMap(newUsageMap);
    } else if (artUsageQuery.isError) {
        console.error("Error fetching art usage:", artUsageQuery.error);
        setArtUsageMap({}); 
    }
  }, [artUsageQuery.isSuccess, artUsageQuery.data, artUsageQuery.isError, artUsageQuery.error]);

  const handleCardSelection = useCallback((slot: CardSlot, cardName: string) => {
    setCardStates((prev) => ({
      ...prev,
      [slot]: { ...initialCardState, name: cardName },
    }));
    if (cardName) {
      setSelectedCardNameForArt(cardName);
      setCurrentSlotForArtSelection(slot);
      setArtUrlsForSelection([]); 
      setArtUsageMap({}); 
    } else {
      setSelectedCardNameForArt('');
      setCurrentSlotForArtSelection(null);
      setArtUrlsForSelection([]);
      setIsArtDialogOpen(false);
      setArtUsageMap({});
    }
  }, []);

  useEffect(() => {
    if (cardArtsQuery.isSuccess && cardArtsQuery.data) {
      if (cardArtsQuery.data.length > 0) {
        setArtUrlsForSelection(cardArtsQuery.data);
        if (currentSlotForArtSelection) setIsArtDialogOpen(true);
      } else {
        console.warn("No art found for", selectedCardNameForArt);
        setArtUrlsForSelection([]);
        setArtUsageMap({});
        if (currentSlotForArtSelection) {
            handleCardSelection(currentSlotForArtSelection, '');
        }
      }
    } else if (cardArtsQuery.isError) {
      console.error("Error fetching card arts:", cardArtsQuery.error);
      setArtUrlsForSelection([]);
      setArtUsageMap({});
      if (currentSlotForArtSelection) {
        handleCardSelection(currentSlotForArtSelection, '');
      }
    }
  }, [cardArtsQuery.isSuccess, cardArtsQuery.isError, cardArtsQuery.data, cardArtsQuery.error, selectedCardNameForArt, currentSlotForArtSelection, handleCardSelection]);

  const handleArtSelectionFromDialog = (selectedArt: SelectedArtType) => {
    if (currentSlotForArtSelection && selectedCardNameForArt) {
      setCardStates((prev) => ({
        ...prev,
        [currentSlotForArtSelection]: {
          name: selectedCardNameForArt, 
          artUrl: selectedArt.artUrl,
          scryfallCardId: selectedArt.scryfallPrintId, 
        },
      }));
    }
    closeArtDialogAndReset();
  };

  const closeArtDialogAndReset = () => {
    setIsArtDialogOpen(false);
    setArtUsageMap({});
  };

  const handleDialogClose = (open: boolean) => {
    setIsArtDialogOpen(open);
    if (!open) {
        if (currentSlotForArtSelection && !cardStates[currentSlotForArtSelection].artUrl) {
            handleCardSelection(currentSlotForArtSelection, '');
        }
        setCurrentSlotForArtSelection(null);
        setSelectedCardNameForArt('');
        setArtUrlsForSelection([]); 
        setArtUsageMap({});
    }
  };

  const handleDownload = () => {
    console.log('Download triggered');
    const stage = thumbnailCanvasRef.current?.getStageInstance();

    if (stage) {
      if (leftDeckName.trim()) {
        saveDeckMutation.mutate({ name: leftDeckName.trim() });
      }
      if (rightDeckName.trim()) {
        saveDeckMutation.mutate({ name: rightDeckName.trim() });
      }

      // Record art usage for all selected arts
      Object.values(cardStates).forEach(cardState => {
        if (cardState.artUrl && cardState.scryfallCardId) {
          recordArtUsageMutation.mutate({
            scryfallArtUrl: cardState.artUrl,
            scryfallCardId: cardState.scryfallCardId,
          });
        }
      });

      const dataURL = stage.toDataURL({ pixelRatio: 1.3334 });
      const link = document.createElement('a');
      const safeLeftDeckName = leftDeckName.replace(/[^\w-]/gi, '_').toLowerCase() || 'deck1';
      const safeRightDeckName = rightDeckName.replace(/[^\w-]/gi, '_').toLowerCase() || 'deck2';
      link.download = `thumbnail-${safeLeftDeckName}-vs-${safeRightDeckName}.png`;
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      console.error("Konva stage instance could not be retrieved via ref.");
    }
  };

  return (
    <>
      <main className="grid min-h-screen w-full grid-cols-1 gap-x-4 gap-y-8 p-4 md:grid-cols-[minmax(280px,1fr)_minmax(auto,2fr)_minmax(280px,1fr)] lg:gap-x-8">
        {/* Left Column: Inputs - Centered */}
        <div className="flex flex-col items-center justify-self-center space-y-4 pt-4 md:pt-8">
          <div className="w-full max-w-xs space-y-4">
            <h2 className="text-center text-xl font-semibold">Left Side</h2>
            <div className="space-y-2">
              <Label htmlFor="left-deck">Left Deck Name</Label>
              <DeckAutocompleteCombobox
                value={leftDeckName}
                onValueChange={setLeftDeckName}
                placeholder="Enter Left Deck Name..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="top-left-card">Top Left Card</Label>
              <AutocompleteCombobox
                value={cardStates.topLeft.name}
                onValueChange={(name) => handleCardSelection('topLeft', name)}
                placeholder="Search Top Left Card..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bottom-left-card">Bottom Left Card</Label>
              <AutocompleteCombobox
                value={cardStates.bottomLeft.name}
                onValueChange={(name) => handleCardSelection('bottomLeft', name)}
                placeholder="Search Bottom Left Card..."
              />
            </div>
          </div>
        </div>

        {/* Middle Column: Canvas & Download */}
        <div className="flex flex-col items-center space-y-4">
          <h1 className="text-center text-2xl font-bold">MTG Thumbnail Creator</h1>
          <div
            id="canvas-container-wrapper"
            className="aspect-video w-full border bg-gray-100 dark:bg-gray-800"
          >
            <ThumbnailCanvas 
              ref={thumbnailCanvasRef}
              leftDeckName={leftDeckName}
              rightDeckName={rightDeckName}
              topLeftArtUrl={cardStates.topLeft.artUrl}
              bottomLeftArtUrl={cardStates.bottomLeft.artUrl}
              topRightArtUrl={cardStates.topRight.artUrl}
              bottomRightArtUrl={cardStates.bottomRight.artUrl}
            />
          </div>
          <Button onClick={handleDownload} className='w-full'>Download Thumbnail</Button>
        </div>

        {/* Right Column: Inputs - Centered */}
        <div className="flex flex-col items-center justify-self-center space-y-4 pt-4 md:pt-8">
          <div className="w-full max-w-xs space-y-4">
            <h2 className="text-center text-xl font-semibold">Right Side</h2>
            <div className="space-y-2">
              <Label htmlFor="right-deck">Right Deck Name</Label>
              <DeckAutocompleteCombobox
                value={rightDeckName}
                onValueChange={setRightDeckName}
                placeholder="Enter Right Deck Name..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="top-right-card">Top Right Card</Label>
              <AutocompleteCombobox
                value={cardStates.topRight.name}
                onValueChange={(name) => handleCardSelection('topRight', name)}
                placeholder="Search Top Right Card..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bottom-right-card">Bottom Right Card</Label>
              <AutocompleteCombobox
                value={cardStates.bottomRight.name}
                onValueChange={(name) => handleCardSelection('bottomRight', name)}
                placeholder="Search Bottom Right Card..."
              />
            </div>
          </div>
        </div>
      </main>

      {/* Art Selection Dialog */}
      <Dialog open={isArtDialogOpen} onOpenChange={handleDialogClose}>
        <DialogOverlay className="min-h-[50vh] max-h-[70vh] justify-self-center place-self-center z-50 grid w-full gap-4 border-8 bg-background/90 p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg sm:max-w-[80vw] md:max-w-[60vw] lg:max-w-[50vw] xl:max-w-[40vw]">
          <DialogHeader className='place-self-center'>
            <DialogTitle className='text-center'>Select Art for: {selectedCardNameForArt}</DialogTitle>
            <DialogDescription>
              Click an image to select it for the thumbnail.
              {(cardArtsQuery.isLoading || artUsageQuery.isLoading) && " Loading available arts..."}
              {(cardArtsQuery.isError || artUsageQuery.isError) && " Error loading arts."}
            </DialogDescription>
          </DialogHeader>
          <div className={`flex flex-wrap overflow-y-auto p-1 max-h-[50vh]`}> 
            {artUrlsForSelection.map((art) => (
              <button
                key={art.artUrl} 
                onClick={() => handleArtSelectionFromDialog(art)}
                className="w-32 flex-auto relative rounded-md border-2 border-transparent transition-all hover:border-primary focus:border-primary focus:outline-none group"
              >
                <Image width={512} height={512} src={art.artUrl} alt={`Art for ${selectedCardNameForArt} (Set: ${art.set})`} className="w-full h-full rounded-sm" /> 
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1.5 py-0.5 text-center text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                  Set: {art.set}
                </div>
                {artUsageMap[art.artUrl] && (
                  <div className="absolute top-0 left-0 right-0 bg-black/70 px-1.5 py-0.5 text-center text-xs font-semibold text-red-400 opacity-0 transition-opacity group-hover:opacity-100">
                    Last Used: {format(new Date(artUsageMap[art.artUrl]!), 'P')}
                  </div>
                )}
              </button>
            ))}
            {!cardArtsQuery.isLoading && !artUsageQuery.isLoading && artUrlsForSelection.length === 0 && (
              <p className="col-span-full py-4 text-center text-muted-foreground">
                No art versions found for this card.
              </p>
            )}
          </div>
          <DialogFooter className='justify-self-end place-self-end'>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </DialogOverlay>
      </Dialog>
    </>
  );
}
