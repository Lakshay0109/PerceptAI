import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context';
import { ImagePicker } from './ImagePicker';
import { SchemaEditor } from './SchemaEditor';
import { OutputPanel } from './OutputPanel';
import { DetectionCanvas } from './DetectionCanvas';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { 
  Search, 
  Loader2, 
  Box, 
  ListOrdered, 
  AlertTriangle, 
  FileDown, 
  TrendingUp,
  Image as ImageIcon,
  LayoutDashboard
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

const DEFAULT_SHELF_SCHEMA = `{
  "type": "object",
  "properties": {
    "detections": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "box_2d": {
            "type": "array",
            "items": { "type": "number" },
            "description": "[ymin, xmin, ymax, xmax] normalized to 0-1000"
          },
          "label": { "type": "string" }
        },
        "required": ["box_2d", "label"]
      }
    },
    "counts": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "label": { "type": "string" },
          "count": { "type": "number" }
        },
        "required": ["label", "count"]
      }
    },
    "missing_or_low_stock": {
      "type": "array",
      "items": { "type": "string" }
    }
  },
  "required": ["detections", "counts"]
}`;

const COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', 
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
];

export function ShelfAuditTab() {
  const { settings, showToast, addHistory } = useAppContext();
  const [image, setImage] = useState<string | null>(null);
  const [schemaValid, setSchemaValid] = useState<boolean>(true);
  const [schemaObj, setSchemaObj] = useState<any>(JSON.parse(DEFAULT_SHELF_SCHEMA));
  const [schemaString, setSchemaString] = useState<string>(DEFAULT_SHELF_SCHEMA);
  const [detectionClasses, setDetectionClasses] = useState('Coca-Cola bottles, Pepsi bottles, Sprite bottles, Diet Coke cans, empty space');
  const [isAuditing, setIsAuditing] = useState(false);
  const [outputJson, setOutputJson] = useState<any>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const handleSchemaValid = (isValid: boolean, parsed?: any) => {
    setSchemaValid(isValid);
    if (isValid && parsed) {
      setSchemaObj(parsed);
    }
  };

  const handleAudit = async () => {
    if (!image || !schemaValid) return;
    setIsAuditing(true);
    setOutputJson(null);
    
    try {
      const apiKey = settings.apiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("No API key configured. Check Settings.");

      const ai = new GoogleGenAI({ apiKey });
      const base64Image = image.split(',')[1];
      const mimeType = image.split(';')[0].split(':')[1];

      const promptText = `Detect every instance of the following classes in the image:
        ${detectionClasses}.
        Return each detection as box_2d in [y_min,x_min,y_max,x_max] normalised to 0–1000. 
        Aggregate counts per label.
        If you observe a class absent or under-stocked, list it in missing_or_low_stock.`;

      // Transform schema for Gemini API
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
      showToast("Shelf Audit Complete!");
      
      const totalItems = parsedOutput.detections?.length || 0;
      addHistory({
        tab: 'Shelf Audit',
        summary: `Audited ${totalItems} items. Labels: ${parsedOutput.counts?.map((c: any) => c.label).join(', ')}`
      });
      
    } catch (err: any) {
      showToast(err.message || 'Audit failed');
      console.error(err);
    } finally {
      setIsAuditing(false);
    }
  };

  const chartData = useMemo(() => {
    if (!outputJson?.counts) return [];
    return outputJson.counts;
  }, [outputJson]);

  const boxes = useMemo(() => {
    if (!outputJson?.detections) return [];
    
    // Create a stable mapping of labels to colors
    const labelList = outputJson.counts?.map((c: any) => c.label) || [];
    
    return outputJson.detections.map((d: any, idx: number) => {
      const [ymin, xmin, ymax, xmax] = d.box_2d;
      const colorIdx = labelList.indexOf(d.label);
      
      return {
        x: xmin / 1000,
        y: ymin / 1000,
        w: (xmax - xmin) / 1000,
        h: (ymax - ymin) / 1000,
        label: d.label,
        color: COLORS[colorIdx % COLORS.length] || '#10b981'
      };
    });
  }, [outputJson]);

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 h-full">
      {/* Left Column */}
      <div className="col-span-1 lg:col-span-4 xl:col-span-3 flex flex-col gap-4 lg:overflow-hidden">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col shrink-0">
          <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-bold">Shelf Photo</label>
          <ImagePicker onImageChange={setImage} mode="upload" />
        </div>
        
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col shrink-0">
          <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-bold">What classes to detect?</label>
          <textarea 
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-300 focus:border-emerald-500 outline-none resize-none h-20"
            placeholder="e.g. Cola, Pepsi, Sprite..."
            value={detectionClasses}
            onChange={e => setDetectionClasses(e.target.value)}
          />
        </div>

        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col min-h-[200px] lg:overflow-hidden">
          <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-bold">Detection Schema</label>
          <div className="flex-1 lg:overflow-hidden flex flex-col">
             <SchemaEditor 
               initialSchema={DEFAULT_SHELF_SCHEMA} 
               onValidSchema={handleSchemaValid} 
               onChange={setSchemaString}
             />
          </div>
        </div>

        <button 
          onClick={handleAudit}
          disabled={!image || !schemaValid || isAuditing}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors shrink-0 shadow-lg shadow-emerald-900/30"
        >
          {isAuditing ? (
            <><Loader2 className="animate-spin" size={18} /> Auditing...</>
          ) : (
            <><Search size={18} /> Start Shelf Audit</>
          )}
        </button>
      </div>

      {/* Right Column */}
      <div className="col-span-1 lg:col-span-8 xl:col-span-9 flex flex-col gap-4 lg:overflow-hidden">
        {/* Main Display Area */}
        <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-4 lg:overflow-hidden">
          
          {/* Visual Canvas Block */}
          <div className="xl:col-span-8 bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col lg:overflow-hidden relative">
            <div className="flex justify-between items-center mb-2">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center gap-2">
                <Box size={12} /> Visual Audit Results
              </label>
              {outputJson && (
                <div className="flex gap-2">
                   <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-500/30">
                    {outputJson.detections?.length || 0} ITEMS DETECTED
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex-1 lg:overflow-hidden relative bg-slate-950 rounded border border-slate-800 group shadow-inner">
               <DetectionCanvas 
                 image={image || undefined}
                 boxes={boxes}
               />
               {!outputJson && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-sm">
                   <Box className="w-12 h-12 text-slate-700 mb-2" />
                   <p className="text-sm text-slate-400 max-w-[260px] text-center px-4">
                     Perform an audit to see bounded boxes overlayed on your shelf photo with label highlighting.
                   </p>
                 </div>
               )}
            </div>
          </div>

          {/* Insights & Raw Output */}
          <div className="xl:col-span-4 flex flex-col gap-4 lg:overflow-hidden">
             {/* Raw JSON / OutputPanel */}
             <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col h-[40%] lg:overflow-hidden">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-bold flex items-center gap-2">
                <LayoutDashboard size={12} className="text-blue-400" /> Analysis Data
              </label>
              <div className="flex-1 lg:overflow-hidden">
                <OutputPanel 
                  json={outputJson}
                  text={!outputJson ? "Waiting for audit data..." : undefined}
                />
              </div>
            </div>

            {/* Chart */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col flex-1 lg:overflow-hidden min-h-[150px]">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-bold flex items-center gap-2">
                <TrendingUp size={12} /> Distribution
              </label>
              <div className="flex-1 w-full mt-2">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ left: -20, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                      <XAxis type="number" stroke="#64748b" fontSize={10} hide />
                      <YAxis dataKey="label" type="category" stroke="#94a3b8" fontSize={10} width={80} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                        itemStyle={{ color: '#10b981', fontSize: '10px' }}
                        labelStyle={{ color: '#94a3b8', fontSize: '10px' }}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {chartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-600 text-xs italic">
                    Run audit to see chart
                  </div>
                )}
              </div>
            </div>

            {/* Missing Stock */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col h-[20%] min-h-[100px] lg:overflow-hidden shrink-0">
              <label className="text-[10px] uppercase tracking-widest text-red-400 mb-2 font-bold flex items-center gap-2">
                <AlertTriangle size={12} /> Low Stock
              </label>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                {outputJson?.missing_or_low_stock && outputJson.missing_or_low_stock.length > 0 ? (
                  outputJson.missing_or_low_stock.map((item: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 p-1.5 rounded text-[10px] text-red-200">
                      <AlertTriangle size={8} /> {item}
                    </div>
                  ))
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-600 text-[10px] italic">
                    {outputJson ? "Stocked" : "Empty"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Details Table */}
        <div className="h-48 bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col shrink-0 lg:overflow-hidden">
          <div className="flex justify-between items-center mb-2">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center gap-2">
              <ListOrdered size={12} /> Detection Inventory
            </label>
            {outputJson && (
              <div className="flex gap-2">
                <button className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold tracking-widest uppercase bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded transition-colors">
                  <FileDown size={14} /> CSV
                </button>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-auto border border-slate-800 rounded bg-slate-950/50 custom-scrollbar">
            <table className="w-full text-[10px] text-left border-collapse">
              <thead className="sticky top-0 bg-slate-900 text-slate-400 uppercase tracking-tighter shadow-sm z-10">
                <tr>
                  <th className="p-2 border-b border-slate-800">#</th>
                  <th className="p-2 border-b border-slate-800">Label</th>
                  <th className="p-2 border-b border-slate-800">Box [Ymin, Xmin, Ymax, Xmax]</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {outputJson?.detections ? outputJson.detections.map((det: any, i: number) => (
                  <tr 
                    key={i} 
                    className={`hover:bg-slate-800/50 transition-colors cursor-default ${hoveredIdx === i ? 'bg-emerald-500/10' : ''}`}
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    <td className="p-2 font-mono text-slate-500">{i + 1}</td>
                    <td className="p-2 font-bold text-slate-200">{det.label}</td>
                    <td className="p-2 font-mono text-slate-400">[{det.box_2d.join(', ')}]</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-slate-600 italic">No inventory data available yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
