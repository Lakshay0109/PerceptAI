import React, { useState, useRef } from 'react';
import { useAppContext } from '../context';
import { ImagePicker, ImagePickerRef } from './ImagePicker';
import { SchemaEditor } from './SchemaEditor';
import { OutputPanel } from './OutputPanel';
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  FileJson, 
  Save, 
  Loader2, 
  ChevronDown,
  ChevronUp,
  Upload,
  Camera,
  Info
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

const SCHEMAS = {
  Construction: `{
  "type": "object",
  "properties": {
    "overall_status": { "type": "string", "enum": ["Safe", "Caution", "Hazardous"] },
    "scene_summary": { "type": "string" },
    "hazards": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "description": { "type": "string" },
          "severity": { "type": "string", "enum": ["Low", "Medium", "High"] },
          "ppe_missing": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "ppe_compliance": { "type": "boolean" }
  },
  "required": ["overall_status", "scene_summary"]
}`,
  Warehouse: `{
  "type": "object",
  "properties": {
    "overall_status": { "type": "string", "enum": ["Safe", "Caution", "Hazardous"] },
    "scene_summary": { "type": "string" },
    "hazards": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "description": { "type": "string" },
          "severity": { "type": "string", "enum": ["Low", "Medium", "High"] },
          "hazard_type": { "type": "string" }
        }
      }
    }
  },
  "required": ["overall_status", "scene_summary"]
}`,
  Lab: `{
  "type": "object",
  "properties": {
    "overall_status": { "type": "string", "enum": ["Safe", "Caution", "Hazardous"] },
    "scene_summary": { "type": "string" },
    "lab_specific": {
      "type": "object",
      "properties": {
        "glassware_status": { "type": "string" },
        "chemical_storage_check": { "type": "string" }
      }
    },
    "hazards": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "description": { "type": "string" },
          "severity": { "type": "string", "enum": ["Low", "Medium", "High"] }
        }
      }
    }
  },
  "required": ["overall_status", "scene_summary"]
}`,
  Custom: `{
  "type": "object",
  "properties": {
    "overall_status": { "type": "string", "enum": ["Safe", "Caution", "Hazardous"] },
    "scene_summary": { "type": "string" },
    "hazards": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "description": { "type": "string" },
          "severity": { "type": "string", "enum": ["Low", "Medium", "High"] }
        }
      }
    }
  }
}`
};

type Industry = 'Construction' | 'Warehouse' | 'Lab' | 'Custom';

export function SiteInspectorTab() {
  const { settings, showToast, addHistory } = useAppContext();
  const [image, setImage] = useState<string | null>(null);
  const [industry, setIndustry] = useState<Industry>('Construction');
  const [schemaString, setSchemaString] = useState(SCHEMAS.Construction);
  const [schemaObj, setSchemaObj] = useState<any>(JSON.parse(SCHEMAS.Construction));
  const [schemaValid, setSchemaValid] = useState(true);
  const [isInspecting, setIsInspecting] = useState(false);
  const [outputJson, setOutputJson] = useState<any>(null);
  const [showJson, setShowJson] = useState(false);
  
  const imagePickerRef = useRef<ImagePickerRef>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const handleIndustryChange = (ind: Industry) => {
    setIndustry(ind);
    setSchemaString(SCHEMAS[ind]);
    try {
       setSchemaObj(JSON.parse(SCHEMAS[ind]));
       setSchemaValid(true);
    } catch (e) {
       setSchemaValid(false);
    }
  };

  const handleSchemaValid = (isValid: boolean, parsed?: any) => {
    setSchemaValid(isValid);
    if (isValid && parsed) {
      setSchemaObj(parsed);
    }
  };

  const handleCaptureFrame = () => {
    if (imagePickerRef.current?.isCameraOpen) {
      imagePickerRef.current.takePhoto();
      showToast("Frame captured!");
    } else {
      imagePickerRef.current?.openCamera();
    }
  };

  const handleInspect = async () => {
    if (!image || !schemaValid) return;
    setIsInspecting(true);
    setOutputJson(null);

    try {
      const apiKey = settings.apiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("No API key configured. Check Settings.");

      const ai = new GoogleGenAI({ apiKey });
      const base64Image = image.split(',')[1];
      const mimeType = image.split(';')[0].split(':')[1];

      const promptText = "You are a workplace safety inspector. Analyse this image strictly against the given schema. Be specific in hazard descriptions. If unsure, use 'Caution' rather than 'OK'.";

      // Helper to transform types to uppercase
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
      showToast("Inspection Complete!");

      addHistory({
        tab: 'Site Inspector',
        summary: `Status: ${parsedOutput.overall_status}. Identified ${parsedOutput.hazards?.length || 0} hazards.`
      });

    } catch (err: any) {
      showToast(err.message || 'Inspection failed');
      console.error(err);
    } finally {
      setIsInspecting(false);
    }
  };

  const handleSaveReport = () => {
    if (!outputJson) return;
    
    const report = {
      timestamp: new Date().toISOString(),
      industry,
      schema: schemaString,
      result: outputJson,
      imagePreviewSnippet: image?.slice(0, 100)
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `site_report_${industry.toLowerCase()}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Report exported successfully");
  };

  const handleImportReport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const report = JSON.parse(event.target?.result as string);
        if (report.result) {
          setOutputJson(report.result);
          if (report.industry) setIndustry(report.industry);
          if (report.schema) setSchemaString(report.schema);
          showToast("Report imported successfully");
        }
      } catch (err) {
        showToast("Invalid report file");
      }
    };
    reader.readAsText(file);
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'Safe': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'Caution': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'Hazardous': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const getSeverityStyles = (sev: string) => {
    switch (sev) {
      case 'High': return 'text-red-400 border-red-500/30 bg-red-500/5';
      case 'Medium': return 'text-amber-400 border-amber-500/30 bg-amber-500/5';
      case 'Low': return 'text-blue-400 border-blue-500/30 bg-blue-500/5';
      default: return 'text-slate-400 border-slate-700 bg-slate-800/20';
    }
  };

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 h-full">
      {/* Left Column - Vertical Stack */}
      <div className="col-span-1 lg:col-span-4 xl:col-span-3 flex flex-col gap-4 lg:overflow-hidden h-full">
        {/* Top: ImagePicker */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col shrink-0">
          <div className="flex justify-between items-center mb-2">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Site Visual</label>
            <button 
              onClick={handleCaptureFrame}
              className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded-sm hover:bg-emerald-500/20 transition-colors flex items-center gap-1 font-bold"
            >
              <Camera size={14} /> Capture Frame
            </button>
          </div>
          <ImagePicker 
            ref={imagePickerRef}
            onImageChange={setImage} 
            mode="both" 
          />
        </div>
        
        {/* Middle: SchemaEditor */}
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col lg:overflow-hidden min-h-[200px]">
          <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-bold">Compliance Schema</label>
          <div className="flex-1 lg:overflow-hidden flex flex-col">
             <SchemaEditor 
               initialSchema={schemaString} 
               onValidSchema={handleSchemaValid} 
               onChange={setSchemaString}
             />
          </div>
        </div>

        {/* Below: Inspect + Preset Dropdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 font-bold block">Industry Preset</label>
              <select 
                value={industry}
                onChange={(e) => handleIndustryChange(e.target.value as Industry)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs p-2 rounded outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="Construction">Construction</option>
                <option value="Warehouse">Warehouse</option>
                <option value="Lab">Lab</option>
                <option value="Custom">Custom</option>
              </select>
            </div>
            <div className="pt-4">
               <button 
                 onClick={() => importFileRef.current?.click()}
                 className="p-2 text-slate-500 hover:text-emerald-400 bg-slate-950 border border-slate-800 rounded transition-colors"
                 title="Import Report"
               >
                 <Upload size={18} />
                 <input 
                   type="file" 
                   ref={importFileRef} 
                   className="hidden" 
                   accept=".json"
                   onChange={handleImportReport}
                 />
               </button>
            </div>
          </div>

          <button 
            onClick={handleInspect}
            disabled={!image || !schemaValid || isInspecting}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-900/30"
          >
            {isInspecting ? (
              <><Loader2 className="animate-spin" size={18} /> Analyzing...</>
            ) : (
              <><Shield size={18} /> Inspect Site</>
            )}
          </button>
        </div>
      </div>

      {/* Right Column */}
      <div className="col-span-1 lg:col-span-8 xl:col-span-9 flex flex-col gap-4 lg:overflow-hidden h-full">
        {/* Status Banner */}
        <div className={`p-4 rounded-lg border flex items-center justify-between transition-all duration-500 shadow-xl ${getStatusStyles(outputJson?.overall_status || 'Waiting')}`}>
          <div className="flex items-center gap-4">
            <div className="bg-slate-950/40 p-2.5 rounded-full ring-2 ring-emerald-500/20">
              {outputJson?.overall_status === 'Safe' ? <ShieldCheck size={32} /> : 
               outputJson?.overall_status === 'Hazardous' ? <ShieldAlert size={32} /> : <AlertTriangle size={32} />}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest font-bold opacity-60 flex items-center gap-1">
                <Info size={10} /> Overall Safety Assessment
              </div>
              <div className="text-3xl font-bold tracking-tight">{outputJson?.overall_status || "System Standby"}</div>
            </div>
          </div>
          {outputJson && (
            <button 
              onClick={handleSaveReport}
              className="bg-emerald-500 text-slate-950 px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-400 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-emerald-900/40"
            >
              <Save size={16} /> Save report
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 lg:overflow-hidden flex-1">
          {/* Summary & Hazards */}
          <div className="xl:col-span-7 flex flex-col gap-4 lg:overflow-hidden">
            {/* Scene Summary Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 shadow-sm">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-3 block font-bold">Scene Summary</label>
              <p className="text-base text-slate-200 leading-relaxed font-medium">
                {outputJson?.scene_summary || "Automated workplace safety analysis. Please capture or upload a site photo to begin."}
              </p>
            </div>

            {/* Hazards List - Card per Hazard */}
            <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col lg:overflow-hidden">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-3 block font-bold flex items-center justify-between">
                <span>Identified Risks / Hazards</span>
                <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 font-mono text-emerald-400">
                  {outputJson?.hazards?.length || 0} ITEMS
                </span>
              </label>
              
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                {outputJson?.hazards && outputJson.hazards.length > 0 ? (
                  outputJson.hazards.map((hazard: any, idx: number) => (
                    <div key={idx} className={`p-4 rounded-lg border-l-4 transition-all duration-300 hover:translate-x-1 ${getSeverityStyles(hazard.severity)} shadow-sm`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={14} className={hazard.severity === 'High' ? 'text-red-500' : 'text-amber-500'} />
                          <span className="text-[11px] font-bold uppercase tracking-widest">
                            {hazard.severity} Severity
                          </span>
                        </div>
                        {hazard.hazard_type && (
                          <span className="text-[10px] bg-slate-950 px-2 py-1 rounded-full border border-slate-800 font-bold uppercase tracking-tighter text-slate-400">
                            {hazard.hazard_type}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-200 mb-2 font-semibold">{hazard.description}</p>
                      {hazard.ppe_missing && hazard.ppe_missing.length > 0 && (
                        <div className="mt-3">
                           <div className="text-[9px] uppercase font-bold text-red-400 mb-1.5 opacity-80">Missing Protective Equipment:</div>
                           <div className="flex flex-wrap gap-1.5">
                            {hazard.ppe_missing.map((ppe: string, i: number) => (
                              <span key={i} className="text-[9px] bg-red-950/40 text-red-200 border border-red-500/30 px-2 py-0.5 rounded font-bold">
                                {ppe}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : outputJson ? (
                   <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
                     <div className="p-6 rounded-full bg-emerald-500/5 ring-1 ring-emerald-500/10">
                        <ShieldCheck className="text-emerald-500/40" size={64} />
                     </div>
                     <div className="text-center">
                        <p className="text-sm font-bold text-slate-400 mb-1 uppercase tracking-widest">Clear Site</p>
                        <p className="text-xs italic text-slate-500">No immediate hazards detected in visible area.</p>
                     </div>
                   </div>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-slate-600 text-xs italic tracking-widest uppercase font-bold opacity-50">Awaiting Signal...</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* JSON Area - Collapsible */}
          <div className="xl:col-span-5 flex flex-col gap-4 lg:overflow-hidden">
            <div className={`bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col transition-all duration-300 ${showJson ? 'flex-1' : 'h-12'}`}>
              <div 
                className="flex justify-between items-center cursor-pointer" 
                onClick={() => setShowJson(!showJson)}
              >
                <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center gap-2">
                  <FileJson size={12} /> Raw JSON Matrix
                </label>
                {showJson ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
              </div>
              {showJson && (
                <div className="flex-1 lg:overflow-hidden mt-3 border-t border-slate-800 pt-3">
                  <OutputPanel 
                    json={outputJson}
                    image={image || undefined}
                  />
                </div>
              )}
            </div>
            
            {/* Contextual Info / Help */}
            {!showJson && (
              <div className="bg-slate-950 border border-slate-900 rounded-lg p-4 text-xs text-slate-500 italic flex-1 border-dashed">
                <p>Hazard classification is performed using Gemini Vision models. All assessments should be verified by a human inspector.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
