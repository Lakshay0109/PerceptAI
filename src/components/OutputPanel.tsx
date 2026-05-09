import React, { useEffect, useRef } from 'react';

export interface BoundingBox {
  x: number;     // 0-1 percentage of width
  y: number;     // 0-1 percentage of height
  w: number;     // 0-1 percentage of width
  h: number;     // 0-1 percentage of height
  label: string;
  color?: string;
}

interface OutputPanelProps {
  text?: string;
  json?: any;
  image?: string;
  boxes?: BoundingBox[];
}

export function OutputPanel({ text, json, image, boxes }: OutputPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!image || !boxes || !boxes.length || !canvasRef.current || !containerRef.current) return;
    
    const imgElement = new Image();
    imgElement.src = image;
    imgElement.onload = () => {
       const canvas = canvasRef.current;
       const container = containerRef.current;
       if(!canvas || !container) return;
       
       const { width, height } = container.getBoundingClientRect();
       canvas.width = width;
       canvas.height = height;
       
       const ctx = canvas.getContext('2d');
       if(!ctx) return;
       ctx.clearRect(0, 0, width, height);

       boxes.forEach(b => {
         const boxColor = b.color || '#10b981';
         ctx.strokeStyle = boxColor;
         ctx.lineWidth = 2;
         ctx.font = 'bold 10px Inter, sans-serif';
         
         const px = b.x * width;
         const py = b.y * height;
         const pw = b.w * width;
         const ph = b.h * height;
         
         // Subtle fill
         ctx.fillStyle = boxColor + '15'; // 15% opacity
         ctx.fillRect(px, py, pw, ph);
         
         // Stroke
         ctx.strokeRect(px, py, pw, ph);
         
         // Label bg
         const textWidth = ctx.measureText(b.label).width;
         ctx.fillStyle = boxColor;
         ctx.fillRect(px, py - 14, textWidth + 8, 14);
         
         // Label text
         ctx.fillStyle = '#000000';
         ctx.fillText(b.label, px + 4, py - 4);
       });
    };
  }, [image, boxes]);

  return (
    <div className="flex flex-1 gap-4 overflow-hidden w-full">
      <div className="flex-1 bg-slate-950 rounded border border-slate-800 p-3 text-xs text-slate-400 italic overflow-auto flex flex-col">
        {text && (
          <div className="text-slate-300 whitespace-pre-wrap flex-1">{text}</div>
        )}
        {json && (
          <pre className="font-mono text-emerald-300 mt-2 flex-1">
            {JSON.stringify(json, null, 2)}
          </pre>
        )}
        {!text && !json && (
          <div className="flex-1 shrink-0">
             Ready for analysis output...
          </div>
        )}
      </div>
      
      <div className="w-32 md:w-48 bg-slate-950 rounded border border-slate-800 flex flex-col items-center justify-center p-2 relative shrink-0">
        {image ? (
          <>
            <img src={image} className="w-full h-full object-contain absolute inset-0 mix-blend-screen p-2" alt="Output Reference" />
            {boxes && boxes.length > 0 && (
               <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none w-full h-full p-2" />
            )}
            <span className="absolute bottom-2 text-[8px] text-slate-500 uppercase tracking-widest font-bold bg-slate-950/80 px-1 rounded">Visual</span>
          </>
        ) : (
          <>
            <div className="w-16 h-12 border-2 border-slate-800 rounded bg-slate-900 mb-1"></div>
            <span className="text-[10px] text-slate-600 uppercase tracking-widest font-bold">Visual Overlay</span>
          </>
        )}
      </div>
    </div>
  );
}
