'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Image as KonvaImage, Rect } from 'react-konva';
import type Konva from 'konva';
import { api } from '~/trpc/react'; // Import tRPC API hook

interface QuadrantImageProps {
  src: string | null; // This will now be the original Scryfall URL
  width: number;
  height: number;
}

const QuadrantImage: React.FC<QuadrantImageProps> = ({
  src: originalSrc,
  width,
  height,
}) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const imageRef = useRef<Konva.Image>(null);
  const [imgPos, setImgPos] = useState({ x: 0, y: 0 });
  const [imgScale, setImgScale] = useState({ scaleX: 1, scaleY: 1 });

  // Use tRPC query to get proxied image data as base64
  const { data: proxiedImageData, isLoading, error: proxyError } = api.scryfall.proxyImage.useQuery(
    { imageUrl: originalSrc! }, // Assert originalSrc is not null due to 'enabled' flag
    { 
      enabled: !!originalSrc, // Only run query if originalSrc is provided
      staleTime: Infinity, // Proxied image data is unlikely to change for the same URL
      retry: 1, // Retry once on failure
    }
  );

  useEffect(() => {
    if (proxyError) {
      console.error("Failed to proxy image:", originalSrc, proxyError);
      setImage(null);
      return;
    }
    if (!proxiedImageData || isLoading) {
      // Still loading or no data yet, or src was cleared
      if (!originalSrc) setImage(null); // Explicitly clear if originalSrc is nullified
      return;
    }

    const img = new window.Image();
    img.src = proxiedImageData; // Use base64 data from tRPC
    // crossOrigin = 'Anonymous' is not needed for data URIs
    img.onload = () => {
      setImage(img);
      const aspectRatio = img.width / img.height;
      const quadrantAspectRatio = width / height;
      let initialScale = 1;
      let initialX = 0;
      let initialY = 0;
      if (aspectRatio > quadrantAspectRatio) {
        initialScale = height / img.height;
        initialX = (width - img.width * initialScale) / 2;
      } else {
        initialScale = width / img.width;
        initialY = (height - img.height * initialScale) / 2;
      }
      setImgPos({ x: initialX, y: initialY });
      setImgScale({ scaleX: initialScale, scaleY: initialScale });
       // Ensure the Konva image updates if it was already rendered
      if (imageRef.current) {
        imageRef.current.cache(); // Clear cache and redraw
        imageRef.current.getLayer()?.batchDraw();
      }
    };
    img.onerror = () => {
      console.error("Failed to load image from proxied data:", originalSrc);
      setImage(null);
    };
    return () => {
        img.onload = null;
        img.onerror = null;
    };
  }, [proxiedImageData, isLoading, proxyError, originalSrc, width, height]);

  const clipFunc = (ctx: Konva.Context) => {
    ctx.rect(0, 0, width, height);
  };

  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target as Konva.Image;
    let newX = node.x();
    let newY = node.y();
    const currentImage = image; // Use the image from state

    const scaledWidth = (currentImage?.width ?? 0) * node.scaleX();
    const scaledHeight = (currentImage?.height ?? 0) * node.scaleY();

    if (newX > 0) newX = 0;
    if (newX + scaledWidth < width) newX = width - scaledWidth;
    if (newY > 0) newY = 0;
    if (newY + scaledHeight < height) newY = height - scaledHeight;
    
    if (scaledWidth < width) newX = (width - scaledWidth) / 2;
    if (scaledHeight < height) newY = (height - scaledHeight) / 2;

    node.position({ x: newX, y: newY });
    setImgPos({ x: newX, y: newY });
  };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage || !imageRef.current) return;
    const currentImage = image; // Use the image from state

    const scaleBy = 1.1;
    const oldScale = imageRef.current.scaleX();
    const pointer = stage.getPointerPosition(); // pointer is relative to the stage
    if (!pointer) return;

    // To get pointer position relative to the Group/Quadrant:
    const group = imageRef.current.getParent(); // Assuming image is in a Group at quadrant x,y
    const pointerRelativeToGroup = group?.getRelativePointerPosition() ?? pointer;

    const mousePointTo = {
      x: (pointerRelativeToGroup.x - imageRef.current.x()) / oldScale,
      y: (pointerRelativeToGroup.y - imageRef.current.y()) / oldScale,
    };

    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    
    const minScaleX = width / (currentImage?.width ?? width);
    const minScaleY = height / (currentImage?.height ?? height);
    const actualMinScale = Math.max(minScaleX, minScaleY);
    const effectiveNewScale = Math.max(newScale, actualMinScale);

    const newPos = {
      x: pointerRelativeToGroup.x - mousePointTo.x * effectiveNewScale,
      y: pointerRelativeToGroup.y - mousePointTo.y * effectiveNewScale,
    };
    
    const scaledWidth = (currentImage?.width ?? 0) * effectiveNewScale;
    const scaledHeight = (currentImage?.height ?? 0) * effectiveNewScale;

    if (newPos.x > 0) newPos.x = 0;
    if (newPos.x + scaledWidth < width) newPos.x = width - scaledWidth;
    if (newPos.y > 0) newPos.y = 0;
    if (newPos.y + scaledHeight < height) newPos.y = height - scaledHeight;

    if (scaledWidth < width) newPos.x = (width - scaledWidth) / 2;
    if (scaledHeight < height) newPos.y = (height - scaledHeight) / 2;

    imageRef.current.scale({ x: effectiveNewScale, y: effectiveNewScale });
    imageRef.current.position(newPos);
    setImgScale({ scaleX: effectiveNewScale, scaleY: effectiveNewScale });
    setImgPos(newPos);
  };

  // Determine what to render
  if (!originalSrc) {
    return null; // No source URL provided
  }

  if (isLoading) {
    return <Rect x={0} y={0} width={width} height={height} fill="#e0e0e0" listening={false} cornerRadius={4} />; 
  }
  
  if (!image && !isLoading) { // Should be covered by first condition, but as a fallback
      return null;
  }
  
  // If image is loaded, render it
  if (image) {
    return (
      <KonvaImage
        ref={imageRef}
        image={image} // This is HTMLImageElement
        x={imgPos.x}
        y={imgPos.y}
        width={image.width}
        height={image.height}
        scaleX={imgScale.scaleX}
        scaleY={imgScale.scaleY}
        draggable
        onDragMove={handleDragMove}
        onWheel={handleWheel}
        clipFunc={clipFunc}
      />
    );
  }
  
  return null; // Should be unreachable if logic above is complete, but acts as a final fallback
};

export default QuadrantImage; 