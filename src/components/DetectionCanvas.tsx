import React, { useRef, useEffect, useState } from 'react';

export interface BoundingBox {
  x: number;     // 0-1 percentage of width
  y: number;     // 0-1 percentage of height
  w: number;     // 0-1 percentage of width
  h: number;     // 0-1 percentage of height
  label: string;
  color?: string;
}

interface DetectionCanvasProps {
  image?: string;
  boxes?: BoundingBox[];
  className?: string;
}

export function DetectionCanvas({ image, boxes, className = "" }: DetectionCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Handle Resize
  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setDimensions({ width, height });
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Handle Drawing
  useEffect(() => {
    if (!image || !canvasRef.current || dimensions.width === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = image;
    img.onload = () => {
      // Calculate aspect ratio fit
      const scale = Math.min(dimensions.width / img.width, dimensions.height / img.height);
      const x = (dimensions.width / 2) - (img.width / 2) * scale;
      const y = (dimensions.height / 2) - (img.height / 2) * scale;
      const drawWidth = img.width * scale;
      const drawHeight = img.height * scale;

      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // Draw image
      ctx.drawImage(img, x, y, drawWidth, drawHeight);

      // Draw boxes
      if (boxes && boxes.length > 0) {
        boxes.forEach(box => {
          const boxColor = box.color || '#10b981';
          
          // Map relative coords to scaled image coords
          const bx = x + (box.x * drawWidth);
          const by = y + (box.y * drawHeight);
          const bw = box.w * drawWidth;
          const bh = box.h * drawHeight;

          // Box style
          ctx.strokeStyle = boxColor;
          ctx.lineWidth = 2;
          ctx.strokeRect(bx, by, bw, bh);

          // Fill for focus
          ctx.fillStyle = boxColor + '20'; // 12% opacity
          ctx.fillRect(bx, by, bw, bh);

          // Label
          ctx.font = 'bold 10px Inter, sans-serif';
          const textWidth = ctx.measureText(box.label).width;
          
          ctx.fillStyle = boxColor;
          ctx.fillRect(bx, by - 14, textWidth + 8, 14);

          ctx.fillStyle = '#000000';
          ctx.fillText(box.label, bx + 4, by - 4);
        });
      }
    };
  }, [image, boxes, dimensions]);

  return (
    <div 
      ref={containerRef} 
      className={`relative w-full h-full bg-slate-950 flex items-center justify-center overflow-hidden ${className}`}
    >
      {!image ? (
        <div className="text-slate-600 text-xs italic">No image provided</div>
      ) : (
        <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
      )}
    </div>
  );
}
