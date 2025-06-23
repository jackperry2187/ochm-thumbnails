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
import { Input } from '~/components/ui/input';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';

type CardSlot = 'topLeft' | 'bottomLeft' | 'topRight' | 'bottomRight';

interface CardState {
  name: string;
  artUrl: string | null;
  scryfallCardId: string | null;
}

const initialCardState: CardState = { name: '', artUrl: null, scryfallCardId: null };

interface SelectedArtType {
  artUrl: string;
  set: string;
  scryfallPrintId: string;
  artist?: string;
}

interface ArtUsageInfoType {
  scryfallArtUrl: string;
  lastUsedAt: Date;
}

export type ThumbnailType = "Video" | "Stream";

const STALE_TIME_CARDS = 1000 * 60 * 10;
const STALE_TIME_USAGE = 1000 * 60 * 5;

export default function HomePage() {
  const [leftDeckName, setLeftDeckName] = useState('');
  const [rightDeckName, setRightDeckName] = useState('');
  const thumbnailCanvasRef = useRef<ThumbnailCanvasHandle>(null);

  const [thumbnailType, setThumbnailType] = useState<ThumbnailType>("Video");
  const [streamDate, setStreamDate] = useState('');

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

  // State for custom logo
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(null);
  const [showCustomLogoControls, setShowCustomLogoControls] = useState(false);
  const [logoX, setLogoX] = useState<number | undefined>(undefined);
  const [logoY, setLogoY] = useState<number | undefined>(undefined);
  const [logoYOffset, setLogoYOffset] = useState<number>(18);

  useEffect(() => {
    // Clear card images when thumbnail type changes
    setCardStates({
      topLeft: { ...initialCardState },
      bottomLeft: { ...initialCardState },
      topRight: { ...initialCardState },
      bottomRight: { ...initialCardState },
    });

    if (thumbnailType === "Stream") {
      setLeftDeckName('');
      setRightDeckName('');
    }
  }, [thumbnailType]);

  const cardArtsQuery = api.scryfall.getCardArts.useQuery(
    { cardName: selectedCardNameForArt },
    {
      enabled: !!selectedCardNameForArt && !!currentSlotForArtSelection,
      staleTime: STALE_TIME_CARDS, 
    }
  );
  
  const recordArtUsageMutation = api.art.recordArtUsage.useMutation();
  const saveDeckMutation = api.deck.saveOrUpdateDeckName.useMutation();

  const artUsageQueryUrls = artUrlsForSelection.map(art => art.artUrl);
  const artUsageQuery = api.art.getArtUsage.useQuery(
    { artUrls: artUsageQueryUrls },
    {
      enabled: artUsageQueryUrls.length > 0 && isArtDialogOpen, 
      staleTime: STALE_TIME_USAGE, 
    }
  );

  // Card usage queries
  const cardQueries = {
    topLeft: api.scryfall.getCardArts.useQuery(
      { cardName: cardStates.topLeft.name },
      { enabled: !!cardStates.topLeft.name, staleTime: STALE_TIME_CARDS }
    ),
    bottomLeft: api.scryfall.getCardArts.useQuery(
      { cardName: cardStates.bottomLeft.name },
      { enabled: !!cardStates.bottomLeft.name, staleTime: STALE_TIME_CARDS }
    ),
    topRight: api.scryfall.getCardArts.useQuery(
      { cardName: cardStates.topRight.name },
      { enabled: !!cardStates.topRight.name, staleTime: STALE_TIME_CARDS }
    ),
    bottomRight: api.scryfall.getCardArts.useQuery(
      { cardName: cardStates.bottomRight.name },
      { enabled: !!cardStates.bottomRight.name, staleTime: STALE_TIME_CARDS }
    ),
  };

  const usageQueries = {
    topLeft: api.art.getArtUsage.useQuery(
      { artUrls: cardQueries.topLeft.data?.map(art => art.artUrl) ?? [] },
      { enabled: !!cardQueries.topLeft.data?.length, staleTime: STALE_TIME_USAGE }
    ),
    bottomLeft: api.art.getArtUsage.useQuery(
      { artUrls: cardQueries.bottomLeft.data?.map(art => art.artUrl) ?? [] },
      { enabled: !!cardQueries.bottomLeft.data?.length, staleTime: STALE_TIME_USAGE }
    ),
    topRight: api.art.getArtUsage.useQuery(
      { artUrls: cardQueries.topRight.data?.map(art => art.artUrl) ?? [] },
      { enabled: !!cardQueries.topRight.data?.length, staleTime: STALE_TIME_USAGE }
    ),
    bottomRight: api.art.getArtUsage.useQuery(
      { artUrls: cardQueries.bottomRight.data?.map(art => art.artUrl) ?? [] },
      { enabled: !!cardQueries.bottomRight.data?.length, staleTime: STALE_TIME_USAGE }
    ),
  };

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

  // Helper function to get most recent usage date from usage data
  const getMostRecentUsage = (usageData: ArtUsageInfoType[] | undefined) => {
    if (!usageData || usageData.length === 0) return null;
    
    const dates = usageData
      .map(record => record.lastUsedAt)
      .filter(date => date !== null)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
    return dates.length > 0 ? dates[0] : null;
  };

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
      if (cardArtsQuery.data.length === 1) {
        // Auto-select if only one art option exists
        if (currentSlotForArtSelection) {
          const selectedArt = cardArtsQuery.data[0];
          if (selectedArt) {
            setCardStates((prev) => ({
              ...prev,
              [currentSlotForArtSelection]: {
                ...prev[currentSlotForArtSelection],
                artUrl: selectedArt.artUrl,
                scryfallCardId: selectedArt.scryfallPrintId,
              },
            }));
          }
          // Reset selection state
          setCurrentSlotForArtSelection(null);
          setSelectedCardNameForArt('');
          setArtUrlsForSelection([]);
        }
      } else if (cardArtsQuery.data.length > 1) {
        // Multiple options - show dialog
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
    if (currentSlotForArtSelection) {
      setCardStates((prev) => ({
        ...prev,
        [currentSlotForArtSelection]: {
          ...prev[currentSlotForArtSelection],
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

  const swapCards = useCallback((side: 'left' | 'right') => {
    setCardStates(prev => ({
      ...prev,
      ...(side === 'left' ? {
        topLeft: prev.bottomLeft,
        bottomLeft: prev.topLeft,
      } : {
        topRight: prev.bottomRight,
        bottomRight: prev.topRight,
      })
    }));
  }, []);

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

      // Helper function to convert string to PascalCase
      const toPascalCase = (str: string) => {
        return str
          .replace(/[^\w\s-]/gi, '') // Remove special characters except hyphens and spaces
          .replace(/\s+|-+/g, ' ') // Replace hyphens and multiple spaces with a single space
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join('');
      };

      let fileName = '';
      if (thumbnailType === "Stream") {
        const formattedDate = streamDate.replace(/\//g, '-') || 'NoDate';
        fileName = `Livestream-${formattedDate}.png`;
      } else {
        const pascalLeftDeckName = toPascalCase(leftDeckName || 'Deck1');
        const pascalRightDeckName = toPascalCase(rightDeckName || 'Deck2');
        fileName = `${pascalLeftDeckName}Vs${pascalRightDeckName}.png`;
      }
      link.download = fileName;
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      console.error("Konva stage instance could not be retrieved via ref.");
    }
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomLogoUrl(reader.result as string);
        setShowCustomLogoControls(true);
        setLogoX(undefined);
        setLogoY(undefined);
        setLogoYOffset(18);
      };
      reader.readAsDataURL(file);
    } else {
      setCustomLogoUrl(null);
      setShowCustomLogoControls(false);
    }
  };

  const renderUsageInfo = (slot: CardSlot) => {
    const cardName = cardStates[slot].name;
    const usageData = usageQueries[slot].data;
    const isLoading = usageQueries[slot].isLoading;
    
    if (!cardName || isLoading) return null;

    const mostRecent = getMostRecentUsage(usageData);
    return (
      <div className="text-xs">
        {mostRecent ? (
          <p className="text-amber-400">
            Last used: {format(new Date(mostRecent), 'PPp')}
          </p>
        ) : (
          <p className="text-green-400">Never used</p>
        )}
      </div>
    );
  };

  const renderCardInput = (slot: CardSlot, label: string, placeholder: string) => (
    <div className="space-y-2">
      <Label htmlFor={slot} className='text-indigo-200'>{label}</Label>
      <AutocompleteCombobox
        value={cardStates[slot].name}
        onValueChange={(name) => handleCardSelection(slot, name)}
        placeholder={placeholder}
      />
      {renderUsageInfo(slot)}
    </div>
  );

  const renderSwapButton = (side: 'left' | 'right') => {
    const hasCards = side === 'left' 
      ? cardStates.topLeft.name || cardStates.bottomLeft.name
      : cardStates.topRight.name || cardStates.bottomRight.name;

    return (
      <Button
        onClick={() => swapCards(side)}
        disabled={!hasCards}
        variant="outline"
        size="sm"
        className="w-full border-purple-500/50 text-purple-300 hover:text-purple-200 hover:border-purple-400 bg-purple-500/10 hover:bg-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        ↕️ Swap Top & Bottom
      </Button>
    );
  };

  return (
    <>
      <main className="flex flex-col min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-slate-50">
        {/* Existing grid content wrapped in a div to allow footer below */}
        <div className="flex-grow grid w-full grid-cols-1 gap-x-4 gap-y-8 p-4 md:grid-cols-[minmax(280px,1fr)_minmax(auto,2fr)_minmax(280px,1fr)] lg:gap-x-8">
          {/* Left Column: Inputs - Centered */}
          <div className="flex flex-col items-center justify-self-center space-y-4 pt-4 md:pt-8 bg-slate-800/50 max-h-[80vh] backdrop-blur-sm p-6 rounded-xl shadow-2xl border-2 border-indigo-400/30">
            <div className="w-full max-w-xs space-y-4">
              <h2 className="text-center text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-l from-purple-400 via-pink-400 to-orange-400 border-b border-indigo-400/30 pb-3">Left Side</h2>
              <div className="space-y-2">
                <Label htmlFor="left-deck" className='text-indigo-200'>Left Deck Name</Label>
                <DeckAutocompleteCombobox
                  value={leftDeckName}
                  onValueChange={setLeftDeckName}
                  placeholder="Enter Left Deck Name..."
                  disabled={thumbnailType === "Stream"}
                />
              </div>
              {renderCardInput('topLeft', 'Top Left Card', 'Search Top Left Card...')}
              {renderCardInput('bottomLeft', 'Bottom Left Card', 'Search Bottom Left Card...')}
              {renderSwapButton('left')}

              {/* Custom Logo Upload Section */}
              <div className="space-y-2 border-t border-indigo-400/30 pt-4 mt-4">
                <Label htmlFor="custom-logo-upload" className='text-indigo-200'>Custom Logo</Label>
                <Input
                  id="custom-logo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="w-full text-sm text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-pink-400/20 file:text-pink-300 hover:file:bg-pink-400/30 focus-visible:ring-1 focus-visible:ring-pink-500 focus-visible:ring-offset-0 focus-visible:ring-offset-slate-900"
                />
              </div>

              {showCustomLogoControls && customLogoUrl && (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="logo-x" className='text-xs text-indigo-300'>Logo X</Label>
                    <Input
                      id="logo-x"
                      type="number"
                      value={logoX ?? ''}
                      onChange={(e) => setLogoX(e.target.value === '' ? undefined : Number(e.target.value))}
                      placeholder="Auto (center)"
                      className="bg-slate-700/50 border-indigo-500/50 text-sm h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="logo-y" className='text-xs text-indigo-300'>Logo Y</Label>
                    <Input
                      id="logo-y"
                      type="number"
                      value={logoY ?? ''}
                      onChange={(e) => setLogoY(e.target.value === '' ? undefined : Number(e.target.value))}
                      placeholder="Auto (align with bar)"
                      className="bg-slate-700/50 border-indigo-500/50 text-sm h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="logo-y-offset" className='text-xs text-indigo-300'>Logo Y Offset</Label>
                    <Input
                      id="logo-y-offset"
                      type="number"
                      value={logoYOffset}
                      onChange={(e) => setLogoYOffset(Number(e.target.value))}
                      placeholder="Y offset"
                      className="bg-slate-700/50 border-indigo-500/50 text-sm h-8"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Middle Column: Canvas & Download */}
          <div className="flex flex-col items-center space-y-6">
            <h1 className="text-center text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 pt-4 md:pt-0">OCHM Thumbnail Creator</h1>
            <div
              id="canvas-container-wrapper"
              className="aspect-video rounded-lg overflow-hidden shadow-2xl border-2 border-slate-700 hover:border-indigo-500 transition-all duration-300"
            >
              <ThumbnailCanvas 
                ref={thumbnailCanvasRef}
                leftDeckName={leftDeckName}
                rightDeckName={rightDeckName}
                topLeftArtUrl={cardStates.topLeft.artUrl}
                bottomLeftArtUrl={cardStates.bottomLeft.artUrl}
                topRightArtUrl={cardStates.topRight.artUrl}
                bottomRightArtUrl={cardStates.bottomRight.artUrl}
                customLogoUrl={customLogoUrl}
                logoX={logoX}
                logoY={logoY}
                logoYOffset={logoYOffset}
                thumbnailType={thumbnailType}
                streamDate={streamDate}
              />
            </div>
            <Button onClick={handleDownload} className='w-full bg-gradient-to-r from-pink-400 via-purple-400 to-orange-400 text-indigo-700 hover:text-indigo-900 hover:from-pink-500 hover:via-purple-500 hover:to-orange-500 text-lg font-semibold shadow-md hover:shadow-lg transition-all duration-150 transform hover:scale-105'>Download Thumbnail</Button>
          </div>

          {/* Right Column: Inputs - Centered */}
          <div className="flex flex-col items-center justify-self-center space-y-4 pt-4 md:pt-8 bg-slate-800/50 max-h-[80vh] backdrop-blur-sm p-6 rounded-xl shadow-2xl border-2 border-indigo-400/30">
            <div className="w-full max-w-xs space-y-4">
              <h2 className="text-center text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-l from-purple-400 via-pink-400 to-orange-400 border-b border-indigo-400/30 pb-3">Right Side</h2>
              <div className="space-y-2">
                <Label htmlFor="right-deck" className="text-indigo-200">Right Deck Name</Label>
                <DeckAutocompleteCombobox
                  value={rightDeckName}
                  onValueChange={setRightDeckName}
                  placeholder="Enter Right Deck Name..."
                  disabled={thumbnailType === "Stream"}
                />
              </div>
              {renderCardInput('topRight', 'Top Right Card', 'Search Top Right Card...')}
              {renderCardInput('bottomRight', 'Bottom Right Card', 'Search Bottom Right Card...')}
              {renderSwapButton('right')}

              <div className="space-y-2 border-t border-indigo-400/30 pt-4 mt-4">
                <Label className='text-indigo-200'>Thumbnail Type</Label>
                <RadioGroup
                  defaultValue="Video"
                  onValueChange={(value) => setThumbnailType(value as ThumbnailType)}
                  className="flex space-x-2"
                >
                  <div className="flex items-center space-x-1">
                    <RadioGroupItem value="Video" id="video-type" />
                    <Label htmlFor="video-type" className='text-indigo-300 font-normal'>Video</Label>
                  </div>
                  <div className="flex items-center space-x-1">
                    <RadioGroupItem value="Stream" id="stream-type" />
                    <Label htmlFor="stream-type" className='text-indigo-300 font-normal'>Stream</Label>
                  </div>
                </RadioGroup>
              </div>

              {thumbnailType === "Stream" && (
                <div className="space-y-2">
                  <Label htmlFor="stream-date" className='text-indigo-200'>Stream Date</Label>
                  <Input
                    id="stream-date"
                    type="text"
                    value={streamDate}
                    onChange={(e) => setStreamDate(e.target.value)}
                    placeholder="MM/DD/YY"
                    className="bg-slate-700/50 border-indigo-500/50 text-sm h-8"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="w-full p-4 text-center text-xs text-slate-400 bg-slate-900/50 border-t border-slate-700/50">
          <p>
            Portions of OCHM Thumbnail Creator are unofficial Fan Content permitted under the Wizards of the Coast Fan Content Policy. 
            The literal and graphical information presented on this site about Magic: The Gathering, including card images and mana symbols, 
            is copyright Wizards of the Coast, LLC. OCHM Thumbnail Creator is not produced by or endorsed by Wizards of the Coast.
          </p>
        </footer>
      </main>

      {/* Art Selection Dialog */}
      <Dialog open={isArtDialogOpen} onOpenChange={handleDialogClose}>
        <DialogOverlay className="min-h-[50vh] max-h-[70vh] justify-self-center place-self-center z-50 grid w-full gap-4 p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg sm:max-w-[80vw] md:max-w-[60vw] lg:max-w-[50vw] xl:max-w-[40vw] border-8 border-slate-700 bg-slate-800/95">
          <DialogHeader className='place-self-center'>
            <DialogTitle className='text-center text-xl font-semibold text-indigo-300'>Select Art for: {selectedCardNameForArt}</DialogTitle>
            <DialogDescription className="text-slate-400">
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
                className="w-36 h-auto flex-grow-0 flex-shrink-0 relative rounded-md border-2 border-slate-700 hover:border-indigo-500 focus:border-indigo-500 focus:outline-none group transition-all duration-150 transform hover:scale-105 shadow-md hover:shadow-lg"
              >
                <Image width={512} height={512} src={art.artUrl} alt={`Art for ${selectedCardNameForArt} (Set: ${art.set})`} className="w-full h-full object-cover rounded-sm" /> 
                <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-1.5 py-0.5 text-center text-xs font-medium text-slate-100 opacity-0 transition-opacity group-hover:opacity-100 duration-150">
                  Set: {art.set}
                  {art.artist && <div className="truncate">Artist: {art.artist}</div>}
                </div>
                {artUsageMap[art.artUrl] && (
                  <div className="absolute top-0 left-0 right-0 bg-red-700/90 px-1.5 py-0.5 text-center text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 duration-150">
                    Last Used: {format(new Date(artUsageMap[art.artUrl]!), 'P')}
                  </div>
                )}
              </button>
            ))}
            {!cardArtsQuery.isLoading && !artUsageQuery.isLoading && artUrlsForSelection.length === 0 && (
              <p className="col-span-full py-4 text-center text-slate-400">
                No art versions found for this card.
              </p>
            )}
          </div>
          <DialogFooter className='justify-self-end place-self-end'>
            <DialogClose asChild>
              <Button variant="outline" className='border-indigo-500 hover:text-indigo-400 bg-indigo-500/10 text-indigo-300'>Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </DialogOverlay>
      </Dialog>
    </>
  );
}
