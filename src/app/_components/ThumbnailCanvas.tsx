'use client';

import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Stage, Layer, Rect, Line, Text as KonvaText, Image as KonvaImage, Group } from 'react-konva';
import type Konva from 'konva'; // Import Konva namespace for types if needed, or direct class usage
import QuadrantImage from './QuadrantImage'; // Import the new component

interface ThumbnailCanvasProps {
  leftDeckName: string;
  rightDeckName: string;
  topLeftArtUrl: string | null;
  bottomLeftArtUrl: string | null;
  topRightArtUrl: string | null;
  bottomRightArtUrl: string | null;
  canvasWidth?: number;
  canvasHeight?: number;
  logoUrl?: string; // Added logoUrl prop
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
// const LOGO_DISPLAY_WIDTH = 180; // Adjust as needed - Will be dynamic now
// const LOGO_DISPLAY_HEIGHT = 90; // Adjust as needed to maintain aspect ratio - Will be dynamic now
const TARGET_LOGO_HEIGHT = 294; // Target height for the logo, e.g. 60px

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
  },
  ref
) => {
  const stageRef = useRef<Konva.Stage>(null);
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);
  const [calculatedLogoWidth, setCalculatedLogoWidth] = useState(TARGET_LOGO_HEIGHT); // Default to square for initial calc

  // Load logo image
  useEffect(() => {
    if (logoUrl) {
      const img = new window.Image();
      img.src = logoUrl;
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) {
          const aspectRatio = img.naturalWidth / img.naturalHeight;
          setCalculatedLogoWidth(TARGET_LOGO_HEIGHT * aspectRatio);
        } else {
          setCalculatedLogoWidth(TARGET_LOGO_HEIGHT); // Fallback if natural dims are 0
        }
        setLogoImage(img);
      };
      img.onerror = () => {
        console.error("Failed to load logo image:", logoUrl);
        setLogoImage(null); // Clear if error
      };
    }
  }, [logoUrl]);

  // Dimensions for elements
  const middleX = canvasWidth / 2;
  const middleY = canvasHeight / 2;
  const purpleBarY = middleY - PURPLE_BAR_HEIGHT / 2;

  // Quadrant dimensions
  const quadrantWidth = canvasWidth / 2;
  const quadrantHeight = canvasHeight / 2;

  // Logo position and dimensions (dynamic width based on aspect ratio)
  const finalLogoHeight = TARGET_LOGO_HEIGHT;
  const finalLogoWidth = calculatedLogoWidth;
  const logoX = middleX - finalLogoWidth / 2;
  const logoY_offset = 18;
  const logoY = purpleBarY - PURPLE_BAR_HEIGHT / 2 + logoY_offset;

  // Dynamic text width calculation based on logo position
  const deckNameTextPadding = 20;
  const leftTextWidth = logoX - deckNameTextPadding * 2; // Max width for left text
  const rightTextX = logoX + finalLogoWidth + deckNameTextPadding; // Start X for right text
  const rightTextWidth = canvasWidth - rightTextX - deckNameTextPadding; // Max width for right text

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
          <QuadrantImage src={topLeftArtUrl} x={0} y={0} width={quadrantWidth} height={quadrantHeight} quadrantId="topLeft" />
        </Group>
        <Group x={quadrantWidth} y={0} clip={{ x: 0, y: 0, width: quadrantWidth, height: quadrantHeight }}>
          <QuadrantImage src={topRightArtUrl} x={0} y={0} width={quadrantWidth} height={quadrantHeight} quadrantId="topRight" />
        </Group>
        <Group x={0} y={quadrantHeight} clip={{ x: 0, y: 0, width: quadrantWidth, height: quadrantHeight }}>
          <QuadrantImage src={bottomLeftArtUrl} x={0} y={0} width={quadrantWidth} height={quadrantHeight} quadrantId="bottomLeft" />
        </Group>
        <Group x={quadrantWidth} y={quadrantHeight} clip={{ x: 0, y: 0, width: quadrantWidth, height: quadrantHeight }}>
          <QuadrantImage src={bottomRightArtUrl} x={0} y={0} width={quadrantWidth} height={quadrantHeight} quadrantId="bottomRight" />
        </Group>
      </Layer>

      {/* Layer for Static Template Elements */}
      <Layer name="template-layer">
        {/* Semi-transparent purple horizontal bar */}
        <Rect
          x={0}
          y={purpleBarY}
          width={canvasWidth}
          height={PURPLE_BAR_HEIGHT}
          fill={PURPLE_COLOR}
          opacity={0.63} // Adjust opacity to match reference
          listening={false}
        />
        
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

        {/* Actual Logo Image */}
        {logoImage && (
          <KonvaImage
            image={logoImage}
            x={logoX}
            y={logoY}
            width={finalLogoWidth}
            height={finalLogoHeight}
            draggable={false} // Typically logo is not draggable
            listening={false}
          />
        )}
      </Layer>

      {/* Layer for Deck Name Texts */}
      <Layer name="text-layer" listening={false}>
        {/* Left Deck Name */}
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
        {/* Right Deck Name */}
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
      </Layer>
    </Stage>
  );
});

ThumbnailCanvas.displayName = 'ThumbnailCanvas';

export default ThumbnailCanvas; 