import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { useAppContext } from '../context';

interface SchemaEditorProps {
  initialSchema?: string;
  onValidSchema?: (isValid: boolean, parsed?: any) => void;
  onChange?: (value: string) => void;
}

export function SchemaEditor({ initialSchema = '{\n  "type": "object",\n  "properties": {}\n}', onValidSchema, onChange }: SchemaEditorProps) {
  const [content, setContent] = useState(initialSchema);
  const [isValid, setIsValid] = useState<boolean | null>(true);
  const [errorMsg, setErrorMsg] = useState('');
  const { showToast } = useAppContext();

  useEffect(() => {
    setContent(initialSchema);
  }, [initialSchema]);

  useEffect(() => {
    try {
      const parsed = JSON.parse(content);
      setIsValid(true);
      setErrorMsg('');
      onValidSchema?.(true, parsed);
    } catch (err: any) {
      setIsValid(false);
      setErrorMsg(err.message || 'Invalid JSON');
      onValidSchema?.(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  const validate = () => {
    try {
      const parsed = JSON.parse(content);
      setIsValid(true);
      setErrorMsg('');
      showToast('Schema is valid JSON');
      onValidSchema?.(true, parsed);
    } catch (err: any) {
      setIsValid(false);
      setErrorMsg(err.message || 'Invalid JSON');
      showToast('Schema validation failed');
      onValidSchema?.(false);
    }
  };

  return (
    <div className={`flex flex-col gap-2 h-full ${isValid === false ? 'ring-1 ring-red-500/50 rounded p-1' : ''}`}>
      <div className="flex-1 bg-slate-950 rounded border border-slate-800 focus-within:border-emerald-500 transition-colors overflow-hidden flex flex-col">
        <textarea 
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            onChange?.(e.target.value);
            setIsValid(null);
            onValidSchema?.(false);
          }}
          className="w-full flex-1 p-2 bg-transparent text-emerald-300 font-mono text-[10px] resize-none outline-none leading-relaxed"
          spellCheck={false}
          placeholder="Paste your JSON schema here..."
        />
      </div>
      <button 
        onClick={validate}
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] py-1.5 rounded font-bold transition-colors uppercase tracking-widest shrink-0"
      >
        Validate Schema
      </button>
      {isValid !== null && (
        <div className={`text-[10px] font-bold uppercase tracking-widest text-center shrink-0 ${isValid ? 'text-emerald-400' : 'text-red-400'}`} title={errorMsg}>
           {isValid ? "Valid Schema" : "Invalid: " + errorMsg}
        </div>
      )}
    </div>
  );
}
