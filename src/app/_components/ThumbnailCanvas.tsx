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
const TEXT_FONT_SIZE = 48; // Reduced font size for better wrapping

// Define fixed logo dimensions on the canvas
const TARGET_LOGO_HEIGHT = 294; // Target height for the logo

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
  },
  ref
) => {
  const stageRef = useRef<Konva.Stage>(null);
  
  const [defaultLogoDetails, setDefaultLogoDetails] = useState<LogoDetails | null>(null);
  const [customLogoDetails, setCustomLogoDetails] = useState<LogoDetails | null>(null);

  // Load default logo image
  useEffect(() => {
    if (logoUrl) {
      const img = new window.Image();
      img.src = logoUrl;
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        let scaledWidth = TARGET_LOGO_HEIGHT; // Default to square if natural dims are 0
        if (img.naturalWidth && img.naturalHeight) {
          const aspectRatio = img.naturalWidth / img.naturalHeight;
          scaledWidth = TARGET_LOGO_HEIGHT * aspectRatio;
        }
        setDefaultLogoDetails({ image: img, calculatedWidth: scaledWidth });
      };
      img.onerror = () => {
        console.error("Failed to load default logo image:", logoUrl);
        setDefaultLogoDetails(null);
      };
    } else {
      setDefaultLogoDetails(null);
    }
  }, [logoUrl]);

  // Load custom logo image
  useEffect(() => {
    if (customLogoUrl) {
      const img = new window.Image();
      img.src = customLogoUrl;
      img.crossOrigin = 'Anonymous'; 
      img.onload = () => {
        let scaledWidth = TARGET_LOGO_HEIGHT;
        if (img.naturalWidth && img.naturalHeight) {
          const aspectRatio = img.naturalWidth / img.naturalHeight;
          scaledWidth = TARGET_LOGO_HEIGHT * aspectRatio;
        }
        setCustomLogoDetails({ image: img, calculatedWidth: scaledWidth });
      };
      img.onerror = () => {
        console.error("Failed to load custom logo image:", customLogoUrl);
        setCustomLogoDetails(null);
      };
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

  return (
    <Stage width={canvasWidth} height={canvasHeight} ref={stageRef} id="konva-stage">
      {/* Layer for Card Art - Using Group for each quadrant to handle positioning */}
      <Layer name="art-layer">
        <Group x={0} y={0} clip={{ x: 0, y: 0, width: quadrantWidth, height: quadrantHeight }}>
          <QuadrantImage src={topLeftArtUrl} width={quadrantWidth} height={quadrantHeight}/>
        </Group>
        <Group x={quadrantWidth} y={0} clip={{ x: 0, y: 0, width: quadrantWidth, height: quadrantHeight }}>
          <QuadrantImage src={topRightArtUrl} width={quadrantWidth} height={quadrantHeight}/>
        </Group>
        <Group x={0} y={quadrantHeight} clip={{ x: 0, y: 0, width: quadrantWidth, height: quadrantHeight }}>
          <QuadrantImage src={bottomLeftArtUrl} width={quadrantWidth} height={quadrantHeight}/>
        </Group>
        <Group x={quadrantWidth} y={quadrantHeight} clip={{ x: 0, y: 0, width: quadrantWidth, height: quadrantHeight }}>
          <QuadrantImage src={bottomRightArtUrl} width={quadrantWidth} height={quadrantHeight}/>
        </Group>
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
            wrap="word" // Enable word wrapping
            fontSize={TEXT_FONT_SIZE}
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
            wrap="word" // Enable word wrapping
            fontSize={TEXT_FONT_SIZE}
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
            {/* Stream Date */}
            <KonvaText
              text={(streamDate ?? '').toUpperCase()}
              x={middleX - logoToDisplay.calculatedWidth / 2}
              y={middleY - 200} // Adjust positioning as needed
              width={logoToDisplay.calculatedWidth}
              fontSize={TEXT_FONT_SIZE * 1.2} // Slightly smaller
              fontFamily={TEXT_FONT_FAMILY}
              fontStyle="bold"
              fill={TEXT_COLOR}
              stroke={TEXT_STROKE_COLOR}
              strokeWidth={2}
              align="center"
              verticalAlign="middle"
            />
            {/* MODERN FNM */}
            <KonvaText
              text="MODERN FNM"
              x={middleX - logoToDisplay.calculatedWidth / 2}
              y={middleY - 120} // Adjust positioning as needed
              width={logoToDisplay.calculatedWidth}
              fontSize={TEXT_FONT_SIZE * 0.8} // Smaller than date, similar to deck names
              fontFamily={TEXT_FONT_FAMILY}
              fontStyle="bold"
              fill={TEXT_COLOR}
              stroke={TEXT_STROKE_COLOR}
              strokeWidth={1.8}
              align="center"
              verticalAlign="middle"
            />
            {/* LIVE! */}
            <KonvaText
              text="LIVE!"
              x={middleX - logoToDisplay.calculatedWidth / 2}
              y={middleY + 190} // Below logo, adjust spacing
              width={logoToDisplay.calculatedWidth}
              fontSize={TEXT_FONT_SIZE * 1.5} // Big letters
              fontFamily={TEXT_FONT_FAMILY}
              fontStyle="bold"
              fill={TEXT_COLOR}
              stroke={TEXT_STROKE_COLOR}
              strokeWidth={2.5}
              align="center"
              verticalAlign="middle"
            />
          </>
        )}
      </Layer>
    </Stage>
  );
});

ThumbnailCanvas.displayName = 'ThumbnailCanvas';

export default ThumbnailCanvas; 