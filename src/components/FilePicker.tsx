import React, { useRef, useState, useCallback } from 'react';
import { FileUp, FileText, X } from 'lucide-react';
import { useAppContext } from '../context';

interface FilePickerProps {
  onFileChange?: (file: File | null) => void;
  accept?: string;
}

export function FilePicker({ onFileChange, accept = ".pdf,application/pdf" }: FilePickerProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useAppContext();

  const handleFile = (file: File | null) => {
    console.log(`[DEBUG] File selected:`, file ? { name: file.name, type: file.type, size: file.size } : 'null');
    
    if (file) {
      const isPdfMime = file.type === 'application/pdf';
      const isPdfExt = file.name.toLowerCase().endsWith('.pdf');
      
      if (!isPdfMime && !isPdfExt && accept.includes('pdf')) {
         showToast('Only PDF files are supported here.');
         return;
      }
    }
    
    setSelectedFile(file);
    onFileChange?.(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0] || null);
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);

  return (
    <div 
      className={`flex flex-col gap-2 h-full rounded-lg transition-all ${isDragging ? 'ring-2 ring-emerald-500 bg-emerald-500/5' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {selectedFile ? (
        <div className="flex flex-col items-center justify-center gap-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4 h-full relative group shadow-sm">
           <div className="bg-emerald-500/10 p-2 rounded-full">
              <FileText className="w-6 h-6 text-emerald-400" />
           </div>
           <div className="text-center overflow-hidden w-full">
              <p className="font-bold text-slate-200 text-xs truncate whitespace-nowrap px-4">{selectedFile.name}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-tighter">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
           </div>
           <button 
             type="button"
             onClick={(e) => { e.stopPropagation(); handleFile(null); }}
             className="absolute top-2 right-2 p-1.5 bg-slate-900 border border-slate-800 rounded-md text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shadow-xl"
           >
             <X className="w-3 h-3" />
           </button>
           <button 
             type="button"
             onClick={() => inputRef.current?.click()}
             className="mt-2 text-[10px] text-emerald-400 hover:text-emerald-300 uppercase tracking-widest font-bold"
           >
             Change File
           </button>
        </div>
      ) : (
        <button 
          type="button"
          onClick={() => {
            console.log("[DEBUG] FilePicker button clicked");
            inputRef.current?.click();
          }}
          className={`flex-1 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-3 transition-all group ${
            isDragging 
              ? 'border-emerald-500 bg-emerald-500/10' 
              : 'border-slate-700 bg-slate-950/50 hover:bg-slate-900 hover:border-slate-600'
          }`}
        >
          <div className={`p-3 rounded-full transition-transform ${isDragging ? 'bg-emerald-500/20 scale-110' : 'bg-slate-900 group-hover:scale-110'}`}>
            <FileUp className={`w-6 h-6 ${isDragging ? 'text-emerald-400' : 'text-slate-500 group-hover:text-emerald-500'}`} />
          </div>
          <div className="text-center px-4">
            <p className={`text-[10px] font-bold uppercase tracking-widest ${isDragging ? 'text-emerald-400' : 'text-slate-400'}`}>
              {isDragging ? 'Drop File Here' : 'Select PDF Document'}
            </p>
            <p className="text-[9px] text-slate-600 mt-1">Drag & drop or click to browse</p>
          </div>
        </button>
      )}
      <input 
        type="file" 
        ref={inputRef} 
        onChange={handleFileChange}
        accept={accept}
        className="hidden" 
      />
    </div>
  );
}
