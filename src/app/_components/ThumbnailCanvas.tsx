'use client';

import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Stage, Layer, Rect, Line, Text as KonvaText, Image as KonvaImage, Group } from 'react-konva';
import type Konva from 'konva'; // Import Konva namespace for types if needed, or direct class usage
import QuadrantImage from './QuadrantImage'; // Import the new component
import type { ThumbnailType } from '../page'; // Import ThumbnailType

interface ThumbnailCanvasProps {
  leftDeckName: string;
  rightDeckName: string;
  topLeftArtUrl: string | null;
  bottomLeftArtUrl: string | null;
  topRightArtUrl: string | null;
  bottomRightArtUrl: string | null;
  canvasWidth?: number;
  canvasHeight?: number;
  logoUrl?: string; // Existing default logo prop
  customLogoUrl?: string | null; // New: For custom uploaded logo
  logoX?: number; // New: X position for custom logo
  logoY?: number; // New: Y position for custom logo
  logoYOffset?: number; // New: Y offset for custom logo
  thumbnailType: ThumbnailType;
  streamDate?: string;
  eventName?: string;
}

export interface ThumbnailCanvasHandle {
  getStageInstance: () => Konva.Stage | null;
}

const CANVAS_WIDTH_DEFAULT = 960; // 1920 / 2
const CANVAS_HEIGHT_DEFAULT = 540; // 1080 / 2
const PURPLE_BAR_HEIGHT = 98; // Adjust as needed
const PURPLE_COLOR = '#6A0DAD'; // Example purple, adjust to match reference
const TEXT_COLOR = 'white';
const TEXT_STROKE_COLOR = 'black';
const TEXT_FONT_FAMILY = 'Calibri, sans-serif'; // Bold, impactful font
const TEXT_FONT_SIZE_MAX = 48; // Maximum font size
const TEXT_FONT_SIZE_MIN = 24; // Minimum font size

// Define fixed logo dimensions on the canvas
const TARGET_LOGO_HEIGHT = 294; // Target height for the logo

// Helper function to calculate optimal font size for multi-line text that fits within given width and height
const calculateOptimalFontSize = (
  text: string,
  maxWidth: number,
  maxHeight: number,
  maxFontSize: number = TEXT_FONT_SIZE_MAX,
  minFontSize: number = TEXT_FONT_SIZE_MIN,
  fontFamily: string = TEXT_FONT_FAMILY,
  fontStyle = 'bold'
): number => {
  // Check if we're running on the client side
  if (typeof document === 'undefined') {
    return maxFontSize; // Return max font size for SSR
  }

  // Create a temporary canvas to measure text
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return maxFontSize;

  // Helper function to simulate word wrapping and calculate total height
  const calculateTextHeight = (fontSize: number): number => {
    context.font = `${fontStyle} ${fontSize}px ${fontFamily}`;
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = context.measureText(testLine).width;

      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          // Single word is too wide, use it anyway
          lines.push(word);
          currentLine = '';
        }
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    // Calculate total height: number of lines * line height
    // Line height is typically 1.2 times the font size
    const lineHeight = fontSize * 1.2;
    return lines.length * lineHeight;
  };

  // Binary search for optimal font size
  let low = minFontSize;
  let high = maxFontSize;
  let optimalSize = maxFontSize;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const textHeight = calculateTextHeight(mid);

    if (textHeight <= maxHeight) {
      optimalSize = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return optimalSize;
};

interface LogoDetails {
  image: HTMLImageElement;
  calculatedWidth: number;
}

const ThumbnailCanvas = forwardRef<ThumbnailCanvasHandle, ThumbnailCanvasProps>((
  {
    leftDeckName,
    rightDeckName,
    topLeftArtUrl,
    bottomLeftArtUrl,
    topRightArtUrl,
    bottomRightArtUrl,
    canvasWidth = CANVAS_WIDTH_DEFAULT,
    canvasHeight = CANVAS_HEIGHT_DEFAULT,
    logoUrl = '/logo_512.png', // Default to the provided logo path
    customLogoUrl, // New prop
    logoX: customLogoXFromProp, // New prop, renamed for clarity
    logoY: customLogoYFromProp, // New prop, renamed for clarity
    logoYOffset: customLogoYOffsetFromProp, // New prop, renamed for clarity
    thumbnailType,
    streamDate,
    eventName,
  },
  ref
) => {
  const stageRef = useRef<Konva.Stage>(null);
  
  const [defaultLogoDetails, setDefaultLogoDetails] = useState<LogoDetails | null>(null);
  const [customLogoDetails, setCustomLogoDetails] = useState<LogoDetails | null>(null);

  const loadLogo = (url: string, setLogoDetails: React.Dispatch<React.SetStateAction<LogoDetails | null>>, isCustom = false) => {
    const img = new window.Image();
    img.src = url;
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      let scaledWidth = TARGET_LOGO_HEIGHT;
      if (img.naturalWidth && img.naturalHeight) {
        const aspectRatio = img.naturalWidth / img.naturalHeight;
        scaledWidth = TARGET_LOGO_HEIGHT * aspectRatio;
      }
      setLogoDetails({ image: img, calculatedWidth: scaledWidth });
    };
    img.onerror = () => {
      console.error(`Failed to load ${isCustom ? 'custom' : 'default'} logo image:`, url);
      setLogoDetails(null);
    };
  };

  useEffect(() => {
    if (logoUrl) {
      loadLogo(logoUrl, setDefaultLogoDetails);
    } else {
      setDefaultLogoDetails(null);
    }
  }, [logoUrl]);

  useEffect(() => {
    if (customLogoUrl) {
      loadLogo(customLogoUrl, setCustomLogoDetails, true);
    } else {
      setCustomLogoDetails(null);
    }
  }, [customLogoUrl]);

  // Dimensions for elements
  const middleX = canvasWidth / 2;
  const middleY = canvasHeight / 2;
  const purpleBarY = middleY - PURPLE_BAR_HEIGHT / 2;

  // Quadrant dimensions
  const quadrantWidth = canvasWidth / 2;
  const quadrantHeight = canvasHeight / 2;

  // Determine logo to display and its properties
  const logoToDisplay = customLogoDetails ?? defaultLogoDetails;
  const isCustomLogoDisplayed = !!customLogoDetails;

  // Default logo position calculations (used for text layout and default logo rendering)
  const defaultLogoLayoutWidth = defaultLogoDetails?.calculatedWidth ?? TARGET_LOGO_HEIGHT; // Fallback for layout if default not loaded
  const defaultLogoCenteredX = middleX - defaultLogoLayoutWidth / 2;
  const logoYOffsetConstant = 18; // Original offset for default logo
  const defaultLogoCenteredY = purpleBarY - PURPLE_BAR_HEIGHT / 2 + logoYOffsetConstant;

  // Dynamic text width calculation based on default logo's centered position
  const deckNameTextPadding = 20;
  const leftTextWidth = defaultLogoCenteredX - deckNameTextPadding * 2;
  const rightTextX = defaultLogoCenteredX + defaultLogoLayoutWidth + deckNameTextPadding;
  const rightTextWidth = canvasWidth - rightTextX - deckNameTextPadding;

  // Calculate optimal font sizes for deck names
  const leftDeckOptimalFontSize = calculateOptimalFontSize(
    leftDeckName.toUpperCase(),
    leftTextWidth,
    PURPLE_BAR_HEIGHT,
    TEXT_FONT_SIZE_MAX,
    TEXT_FONT_SIZE_MIN
  );
  
  const rightDeckOptimalFontSize = calculateOptimalFontSize(
    rightDeckName.toUpperCase(),
    rightTextWidth,
    PURPLE_BAR_HEIGHT,
    TEXT_FONT_SIZE_MAX,
    TEXT_FONT_SIZE_MIN
  );

  // Dynamically size event name font based on length
  const getEventFontSize = (name: string) => {
    if (!name) return TEXT_FONT_SIZE_MAX * 0.8;
    const base = TEXT_FONT_SIZE_MAX * 0.8;
    if (name.length <= 10) return base;
    if (name.length <= 18) return base * 0.9;
    if (name.length <= 28) return base * 0.8;
    return base * 0.7;
  };

  const streamTexts = [
    {
      text: (streamDate ?? '').toUpperCase(),
      y: middleY - 200,
      fontSize: TEXT_FONT_SIZE_MAX * 1.2,
      strokeWidth: 2,
    },
    {
      text: (eventName ?? 'MODERN FNM').toUpperCase(),
      y: middleY - 120,
      fontSize: getEventFontSize(eventName ?? 'MODERN FNM'),
      strokeWidth: 1.8,
    },
    {
      text: "LIVE!",
      y: middleY + 190,
      fontSize: TEXT_FONT_SIZE_MAX * 1.5,
      strokeWidth: 2.5,
    },
  ];

  // Determine final X and Y for the logo to be rendered
  let finalLogoX: number;
  let finalLogoY: number;

  if (logoToDisplay) { // Check if there is any logo to display
    if (isCustomLogoDisplayed) {
      finalLogoX = customLogoXFromProp ?? (middleX - logoToDisplay.calculatedWidth / 2);
      const baseY = customLogoYFromProp ?? defaultLogoCenteredY;
      finalLogoY = baseY + (customLogoYOffsetFromProp ?? 0);
    } else { // It's the default logo
      finalLogoX = middleX - logoToDisplay.calculatedWidth / 2;
      finalLogoY = defaultLogoCenteredY;
    }
  } else {
    // Should not happen if logic is correct, but provide fallbacks
    finalLogoX = middleX;
    finalLogoY = middleY;
  }

  useEffect(() => {
    // You can access the stage instance via stageRef.current here if needed
    // For example, to re-draw or update layers manually, though react-konva handles most of this.
  }, [leftDeckName, rightDeckName, canvasWidth, canvasHeight]);

  useImperativeHandle(ref, () => ({
    getStageInstance: () => stageRef.current,
  }));

  const quadrants = [
    { src: topLeftArtUrl, x: 0, y: 0 },
    { src: topRightArtUrl, x: quadrantWidth, y: 0 },
    { src: bottomLeftArtUrl, x: 0, y: quadrantHeight },
    { src: bottomRightArtUrl, x: quadrantWidth, y: quadrantHeight },
  ];

  return (
    <Stage width={canvasWidth} height={canvasHeight} ref={stageRef} id="konva-stage">
      {/* Layer for Card Art - Using Group for each quadrant to handle positioning */}
      <Layer name="art-layer">
        {quadrants.map((quadrant, index) => (
          <Group key={index} x={quadrant.x} y={quadrant.y} clip={{ x: 0, y: 0, width: quadrantWidth, height: quadrantHeight }}>
            <QuadrantImage src={quadrant.src} width={quadrantWidth} height={quadrantHeight}/>
          </Group>
        ))}
      </Layer>

      {/* Layer for Static Template Elements */}
      <Layer name="template-layer">
        {/* Semi-transparent purple horizontal bar (Video mode only) */}
        {thumbnailType === "Video" && (
          <Rect
            x={0}
            y={purpleBarY}
            width={canvasWidth}
            height={PURPLE_BAR_HEIGHT}
            fill={PURPLE_COLOR}
            opacity={0.63}
            listening={false}
          />
        )}
        
        {/* Vertical Purple Bar (Stream mode only) */}
        {thumbnailType === "Stream" && logoToDisplay && (
          <Rect
            x={middleX - logoToDisplay.calculatedWidth / 2}
            y={0}
            width={logoToDisplay.calculatedWidth}
            height={canvasHeight}
            fill={PURPLE_COLOR}
            opacity={0.63}
            listening={false}
          />
        )}

        {/* Black outer border */}
        <Rect
          x={0}
          y={0}
          width={canvasWidth}
          height={canvasHeight}
          stroke="black"
          strokeWidth={10} // Adjust border width as needed
          listening={false}
        />

        {/* Black vertical line down the exact center */}
        <Line
          points={[middleX, 0, middleX, canvasHeight]}
          stroke="black"
          strokeWidth={10} // Match border width or adjust
          listening={false}
        />

        {/* Actual Logo Image: Conditional rendering based on custom or default logo */}
        {logoToDisplay && (
          <KonvaImage
            image={logoToDisplay.image}
            x={finalLogoX}
            y={finalLogoY}
            width={logoToDisplay.calculatedWidth}
            height={TARGET_LOGO_HEIGHT}
            draggable={false}
            listening={false}
          />
        )}
      </Layer>

      {/* Layer for Deck Name Texts */}
      <Layer name="text-layer" listening={false}>
        {/* Left Deck Name (Video Mode Only)*/}
        {thumbnailType === "Video" && (
          <KonvaText
            text={leftDeckName.toUpperCase()} // Match styling from reference if uppercased
            x={deckNameTextPadding}
            y={purpleBarY} // New y, verticalAlign will handle centering within the bar height
            width={leftTextWidth}
            height={PURPLE_BAR_HEIGHT} // Set height for verticalAlign
            wrap="word" // Enable word wrapping for multi-line text
            fontSize={leftDeckOptimalFontSize}
            fontFamily={TEXT_FONT_FAMILY}
            fontStyle="bold"
            fill={TEXT_COLOR}
            stroke={TEXT_STROKE_COLOR}
            strokeWidth={2.3} // Slightly thicker stroke can look better
            align="center"
            verticalAlign="middle"
            draggable={false} // Typically not draggable, but can be enabled
          />
        )}
        {/* Right Deck Name (Video Mode Only) */}
        {thumbnailType === "Video" && (
          <KonvaText
            text={rightDeckName.toUpperCase()} // Match styling from reference if uppercased
            x={rightTextX}
            y={purpleBarY} // New y
            width={rightTextWidth}
            height={PURPLE_BAR_HEIGHT} // Set height for verticalAlign
            wrap="word" // Enable word wrapping for multi-line text
            fontSize={rightDeckOptimalFontSize}
            fontFamily={TEXT_FONT_FAMILY}
            fontStyle="bold"
            fill={TEXT_COLOR}
            stroke={TEXT_STROKE_COLOR}
            strokeWidth={2.3}
            align="center"
            verticalAlign="middle"
            draggable={false}
          />
        )}

        {/* Stream Mode Texts */}
        {thumbnailType === "Stream" && logoToDisplay && (
          <>
            {streamTexts.map((textConfig, index) => (
              <KonvaText
                key={index}
                text={textConfig.text}
                x={middleX - logoToDisplay.calculatedWidth / 2}
                y={textConfig.y}
                width={logoToDisplay.calculatedWidth}
                fontSize={textConfig.fontSize}
                fontFamily={TEXT_FONT_FAMILY}
                fontStyle="bold"
                fill={TEXT_COLOR}
                stroke={TEXT_STROKE_COLOR}
                strokeWidth={textConfig.strokeWidth}
                align="center"
                verticalAlign="middle"
              />
            ))}
          </>
        )}
      </Layer>
    </Stage>
  );
});

ThumbnailCanvas.displayName = 'ThumbnailCanvas';

export default ThumbnailCanvas;