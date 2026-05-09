import React, { useState } from 'react';
import { useAppContext } from '../context';
import { ImagePicker } from './ImagePicker';
import { SchemaEditor } from './SchemaEditor';
import { OutputPanel } from './OutputPanel';
import { FileDown, Save, Loader2, Sparkles } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

const DEFAULT_RECEIPT_SCHEMA = `{
  "type": "object",
  "properties": {
    "merchant_name": { "type": "string" },
    "date": { "type": "string", "description": "YYYY-MM-DD" },
    "total_amount": { "type": "number" },
    "tax_amount": { "type": "number" },
    "line_items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "description": { "type": "string" },
          "quantity": { "type": "number" },
          "price": { "type": "number" }
        }
      }
    }
  },
  "required": ["merchant_name", "total_amount"]
}`;

export function ReceiptsTab() {
  const { settings, saveSchema, showToast, addHistory } = useAppContext();
  const [image, setImage] = useState<string | null>(null);
  const [schemaValid, setSchemaValid] = useState<boolean>(true);
  const [schemaObj, setSchemaObj] = useState<any>(JSON.parse(DEFAULT_RECEIPT_SCHEMA));
  const [schemaString, setSchemaString] = useState<string>(DEFAULT_RECEIPT_SCHEMA);
  const [instructions, setInstructions] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [outputJson, setOutputJson] = useState<any>(null);
  
  const handleSchemaValid = (isValid: boolean, parsed?: any) => {
    setSchemaValid(isValid);
    if (isValid && parsed) {
      setSchemaObj(parsed);
    }
  };

  const handleSaveSchema = () => {
    const name = prompt("Enter a name for this schema:");
    if (!name) return;
    saveSchema({
      id: crypto.randomUUID(),
      name,
      schemaValid: true,
      content: schemaString
    });
    showToast(`Schema "${name}" saved to library`);
  };
  
  const handleExtract = async () => {
    if (!image || !schemaValid) return;
    setIsExtracting(true);
    setOutputJson(null);
    
    try {
      const apiKey = settings.apiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("No API key configured. Check Settings.");
      }

      const ai = new GoogleGenAI({ apiKey });

      const base64Image = image.split(',')[1];
      const mimeType = image.split(';')[0].split(':')[1];

      const promptText = `Extract every field defined in the schema from this receipt. Return only data matching the schema. If a field is unknown, use null. Do not invent values.\n\nAdditional instructions: ${instructions}`;

      // Helper to transform lowercase types to uppercase for Gemini API
      const transformSchema = (schema: any): any => {
        if (typeof schema !== 'object' || schema === null) return schema;
        const result = { ...schema };
        if (result.type && typeof result.type === 'string') {
          result.type = result.type.toUpperCase();
        }
        if (result.properties) {
          const newProps: any = {};
          for (const [key, val] of Object.entries(result.properties)) {
            newProps[key] = transformSchema(val);
          }
          result.properties = newProps;
        }
        if (result.items) {
          result.items = transformSchema(result.items);
        }
        return result;
      };

      const finalSchema = transformSchema(schemaObj);

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            role: "user",
            parts: [
              { text: promptText },
              {
                inlineData: {
                  data: base64Image,
                  mimeType: mimeType
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: finalSchema
        }
      });

      const extractedText = response.text;
      if (!extractedText) throw new Error("No output generated");
      
      const parsedOutput = JSON.parse(extractedText);
      setOutputJson(parsedOutput);
      showToast("Extraction complete!");
      
      addHistory({
        tab: 'Receipts',
        summary: `Extracted receipt from ${parsedOutput.merchant_name || 'unknown merchant'} for $${parsedOutput.total_amount || 0}`
      });
      
    } catch (err: any) {
      showToast(err.message || 'Error occurred');
      console.error(err);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDownloadCsv = () => {
    if (!outputJson) return;
    
    const baseFields: Record<string, any> = {};
    const lists: Record<string, any[]> = {};
    
    for (const [key, val] of Object.entries(outputJson)) {
      if (Array.isArray(val)) {
        lists[key] = val;
      } else if (typeof val !== 'object') {
        baseFields[key] = val;
      }
    }
    
    const lines: string[] = [];
    const listKeys = Object.keys(lists);
    
    if (listKeys.length > 0) {
      const listName = listKeys[0];
      const listItems = lists[listName];
      if (listItems.length > 0) {
        const itemKeys = Object.keys(listItems[0]);
        const header = [...Object.keys(baseFields), ...itemKeys].join(',');
        lines.push(header);
        
        for (const item of listItems) {
          const row = [
            ...Object.values(baseFields).map(v => `"${v || ''}"`),
            ...itemKeys.map(k => `"${item[k] || ''}"`)
          ];
          lines.push(row.join(','));
        }
      } else {
        const header = Object.keys(baseFields).join(',');
        lines.push(header);
        lines.push(Object.values(baseFields).map(v => `"${v || ''}"`).join(','));
      }
    } else {
      const header = Object.keys(baseFields).join(',');
      lines.push(header);
      lines.push(Object.values(baseFields).map(v => `"${v || ''}"`).join(','));
    }
    
    const csvStr = lines.join('\n');
    const blob = new Blob([csvStr], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'receipt_extraction.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 h-full">
      {/* Left Column */}
      <div className="col-span-1 lg:col-span-4 xl:col-span-3 flex flex-col gap-4 lg:overflow-hidden">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col shrink-0">
          <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-bold">Image Source</label>
          <ImagePicker onImageChange={setImage} />
        </div>
        
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col min-h-[250px] lg:overflow-hidden">
          <div className="flex justify-between items-center mb-2">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">JSON Schema</label>
            <button 
              onClick={handleSaveSchema}
              className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold tracking-widest uppercase bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded transition-colors"
            >
              <Save size={12} /> Save
            </button>
          </div>
          <div className="flex-1 lg:overflow-hidden flex flex-col relative w-full">
             <SchemaEditor 
               initialSchema={DEFAULT_RECEIPT_SCHEMA} 
               onValidSchema={handleSchemaValid} 
               onChange={setSchemaString}
             />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col shrink-0">
          <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-bold">Extra Instructions</label>
          <textarea 
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-300 focus:border-emerald-500 outline-none resize-none h-16"
            placeholder="e.g. Determine the likely category..."
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
          />
        </div>

        <button 
          onClick={handleExtract}
          disabled={!image || !schemaValid || isExtracting}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors shrink-0 shadow-lg shadow-emerald-900/30"
        >
          {isExtracting ? (
            <><Loader2 className="animate-spin" size={18} /> Processing...</>
          ) : (
            <><Sparkles size={18} /> Extract Data</>
          )}
        </button>
      </div>

      {/* Right Column */}
      <div className="col-span-1 lg:col-span-8 xl:col-span-9 flex flex-col gap-4 lg:overflow-hidden">
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col lg:overflow-hidden relative">
          <div className="flex justify-between items-center mb-2">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center gap-2">
              Extraction Output
              <span className="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded text-[9px]">Receipt-to-Expense v1.0</span>
            </label>
            {outputJson && (
              <button 
                onClick={handleDownloadCsv}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold tracking-widest uppercase bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded transition-colors"
              >
                <FileDown size={14} /> Download CSV
              </button>
            )}
          </div>
          
          <div className="flex-1 flex gap-4 lg:overflow-hidden">
             <OutputPanel 
               json={outputJson} 
               image={image || undefined}
               text={!outputJson ? "Upload an image and run extraction to see results." : undefined}
             />
          </div>
        </div>
      </div>
    </div>
  );
}
