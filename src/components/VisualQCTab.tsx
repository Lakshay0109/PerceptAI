import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context';
import { ImagePicker } from './ImagePicker';
import { SchemaEditor } from './SchemaEditor';
import { OutputPanel } from './OutputPanel';
import { FileDown, ShieldCheck, ShieldAlert, ShieldQuestion, Loader2, Play, Square, History, Camera } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

const DEFAULT_QC_SCHEMA = `{
  "type": "object",
  "properties": {
    "verdict": { 
      "type": "string", 
      "enum": ["Pass", "Needs Review", "Fail"],
      "description": "The inspection result"
    },
    "certainty": { 
      "type": "number",
      "description": "Confidence level from 0 to 1"
    },
    "defects_found": { 
      "type": "boolean"
    },
    "reasoning": { 
      "type": "string",
      "description": "One sentence explaining the verdict"
    },
    "issues": {
      "type": "array",
      "items": { "type": "string" },
      "description": "List of specific anomalies found"
    }
  },
  "required": ["verdict", "reasoning"]
}`;

interface DefectEntry {
  timestamp: string;
  verdict: "Pass" | "Needs Review" | "Fail";
  reasoning: string;
  thumbnail: string;
}

export function VisualQCTab() {
  const { settings, showToast, addHistory } = useAppContext();
  const [unitImage, setUnitImage] = useState<string | null>(null);
  const [refImage, setRefImage] = useState<string | null>(null);
  const [schemaValid, setSchemaValid] = useState<boolean>(true);
  const [schemaObj, setSchemaObj] = useState<any>(JSON.parse(DEFAULT_QC_SCHEMA));
  const [schemaString, setSchemaString] = useState<string>(DEFAULT_QC_SCHEMA);
  const [isInspecting, setIsInspecting] = useState(false);
  const [outputJson, setOutputJson] = useState<any>(null);
  const [defectLog, setDefectLog] = useState<DefectEntry[]>([]);
  const [liveMode, setLiveMode] = useState(false);
  const [lastVerdict, setLastVerdict] = useState<string | null>(null);

  const liveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSchemaValid = (isValid: boolean, parsed?: any) => {
    setSchemaValid(isValid);
    if (isValid && parsed) {
      setSchemaObj(parsed);
    }
  };

  const handleInspect = async (silent = false) => {
    if (!unitImage || !schemaValid) return;
    if (!silent) setIsInspecting(true);
    
    try {
      const apiKey = settings.apiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("No API key configured. Check Settings.");

      const ai = new GoogleGenAI({ apiKey });

      const unitBase64 = unitImage.split(',')[1];
      const unitMime = unitImage.split(';')[0].split(':')[1];

      const parts: any[] = [];
      
      // If reference image exists, add it first
      if (refImage) {
        parts.push({
          inlineData: {
            data: refImage.split(',')[1],
            mimeType: refImage.split(';')[0].split(':')[1]
          }
        });
      }

      // Unit under test
      parts.push({
        inlineData: {
          data: unitBase64,
          mimeType: unitMime
        }
      });

      const promptText = "You are a quality-control inspector. Classify the unit in the " + 
        (refImage ? "second" : "first") + 
        " image against the schema. " + 
        (refImage ? "If a reference image is provided (first image), compare against it. " : "") + 
        "Be strict but fair.";

      parts.push({ text: promptText });

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
        contents: [{ role: "user", parts }],
        config: {
          responseMimeType: "application/json",
          responseSchema: finalSchema
        }
      });

      const text = response.text;
      if (!text) throw new Error("No response from AI");

      const result = JSON.parse(text);
      setOutputJson(result);
      setLastVerdict(result.verdict);

      // Add to defect log
      const newEntry: DefectEntry = {
        timestamp: new Date().toLocaleTimeString(),
        verdict: result.verdict,
        reasoning: result.reasoning,
        thumbnail: unitImage
      };
      setDefectLog(prev => [newEntry, ...prev].slice(0, 50));

      if (!silent) {
        showToast(`Inspection Complete: ${result.verdict}`);
        addHistory({
          tab: 'Visual QC',
          summary: `QC result: ${result.verdict} - ${result.reasoning}`
        });
      }

    } catch (err: any) {
      if (!silent) showToast(err.message || "Error during inspection");
      console.error(err);
    } finally {
      if (!silent) setIsInspecting(false);
    }
  };

  // Live mode timer
  useEffect(() => {
    if (liveMode) {
      liveTimerRef.current = setInterval(() => {
        handleInspect(true);
      }, 2000);
    } else {
      if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    }
    return () => {
      if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    };
  }, [liveMode, unitImage, schemaValid, refImage, schemaObj]);

  const handleDownloadCsv = () => {
    if (defectLog.length === 0) return;
    const header = "Timestamp,Verdict,Reasoning\n";
    const rows = defectLog.map(entry => `"${entry.timestamp}","${entry.verdict}","${entry.reasoning.replace(/"/g, '""')}"`).join("\n");
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qc_defect_log.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getVerdictStyles = (verdict: string) => {
    switch (verdict) {
      case 'Pass': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'Needs Review': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'Fail': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const getVerdictIcon = (verdict: string) => {
    switch (verdict) {
      case 'Pass': return <ShieldCheck size={24} />;
      case 'Needs Review': return <ShieldQuestion size={24} />;
      case 'Fail': return <ShieldAlert size={24} />;
      default: return null;
    }
  };

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 h-full">
      {/* Left Column */}
      <div className="col-span-1 lg:col-span-4 xl:col-span-3 flex flex-col gap-4 lg:overflow-hidden">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col shrink-0">
          <div className="flex justify-between items-center mb-2">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Unit Under Test</label>
            {liveMode && (
              <span className="flex items-center gap-1 text-[9px] text-red-400 font-bold animate-pulse">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span> LIVE
              </span>
            )}
          </div>
          <ImagePicker 
            onImageChange={setUnitImage} 
            mode={liveMode ? 'camera' : 'both'} 
          />
          <div className="mt-3 flex items-center justify-between bg-slate-950 p-2 rounded border border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Live Inspection</span>
            <button 
              onClick={() => setLiveMode(!liveMode)}
              className={`p-1.5 rounded transition-colors ${liveMode ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-400'}`}
              title={liveMode ? "Stop Live Mode" : "Start Live Mode"}
            >
              {liveMode ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
            </button>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col shrink-0">
          <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-bold">Reference Image (Optional)</label>
          <div className="h-32">
            <ImagePicker onImageChange={setRefImage} hideWebcam />
          </div>
        </div>
        
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col min-h-[200px] lg:overflow-hidden">
          <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-bold">QC Criteria Schema</label>
          <div className="flex-1 lg:overflow-hidden flex flex-col relative w-full">
             <SchemaEditor 
               initialSchema={DEFAULT_QC_SCHEMA} 
               onValidSchema={handleSchemaValid} 
               onChange={setSchemaString}
             />
          </div>
        </div>

        <button 
          onClick={() => handleInspect()}
          disabled={!unitImage || !schemaValid || isInspecting || liveMode}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors shrink-0 shadow-lg shadow-emerald-900/30"
        >
          {isInspecting ? (
            <><Loader2 className="animate-spin" size={18} /> Inspecting...</>
          ) : (
            <><ShieldCheck size={18} /> Run Inspection</>
          )}
        </button>
      </div>

      {/* Right Column */}
      <div className="col-span-1 lg:col-span-8 xl:col-span-9 flex flex-col gap-4 lg:overflow-hidden">
        {/* Verdict Banner */}
        <div className={`p-4 rounded-lg border flex items-center justify-between transition-all duration-500 ${getVerdictStyles(outputJson?.verdict || 'Ready')}`}>
          <div className="flex items-center gap-4">
            <div className="bg-slate-950/50 p-2 rounded-full">
              {getVerdictIcon(outputJson?.verdict)}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest font-bold opacity-70">Verdict</div>
              <div className="text-2xl font-bold italic">{outputJson?.verdict || "Waiting for signal..."}</div>
            </div>
          </div>
          {outputJson && (
            <div className="text-right hidden md:block">
              <div className="text-[10px] uppercase tracking-widest font-bold opacity-70">Confidence</div>
              <div className="text-xl font-mono">{(outputJson.certainty * 100).toFixed(1)}%</div>
            </div>
          )}
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:overflow-hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col lg:overflow-hidden relative">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-bold">Analysis Details</label>
            <div className="flex-1 flex flex-col gap-3 lg:overflow-hidden">
              {outputJson?.reasoning && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded text-sm text-emerald-100 italic">
                   "{outputJson.reasoning}"
                </div>
              )}
              <div className="flex-1 lg:overflow-hidden">
                <OutputPanel 
                  json={outputJson} 
                  image={unitImage || undefined}
                  text={!outputJson ? "Perform an inspection to see details." : undefined}
                />
              </div>
            </div>
          </div>

          {/* Defect Log */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col lg:overflow-hidden">
            <div className="flex justify-between items-center mb-2">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center gap-2">
                <History size={12} /> Defect Log
              </label>
              <button 
                onClick={handleDownloadCsv}
                disabled={defectLog.length === 0}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 disabled:text-slate-600 flex items-center gap-1 font-bold tracking-widest uppercase bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded transition-colors"
              >
                <FileDown size={14} /> Export CSV
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {defectLog.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-600 text-xs italic">
                  No inspections logged yet.
                </div>
              ) : (
                defectLog.map((entry, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 p-2 rounded flex gap-3 items-center group hover:border-slate-700 transition-colors">
                    <img src={entry.thumbnail} alt="QC thumb" className="w-12 h-12 object-cover rounded border border-slate-800" />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${getVerdictStyles(entry.verdict)}`}>
                          {entry.verdict}
                        </span>
                        <span className="text-[9px] text-slate-500 font-mono">{entry.timestamp}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">{entry.reasoning}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
