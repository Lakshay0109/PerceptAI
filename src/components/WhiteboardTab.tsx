import React, { useState } from 'react';
import { ImagePicker } from './ImagePicker';
import { SchemaEditor } from './SchemaEditor';
import { OutputPanel } from './OutputPanel';
import { useAppContext } from '../context';
import { AlertCircle, Target, ArrowRight, Save, Download } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

interface ImageSource {
  data: string;
  mimeType: string;
}

const DEFAULT_WHITEBOARD_SCHEMA = `{
  "type": "object",
  "properties": {
    "title":    {"type": "string"},
    "summary":  {"type": "string", "description": "1-2 sentence gist"},
    "phases": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name":      {"type": "string"},
          "owner":     {"type": "string"},
          "deadline":  {"type": "string", "description": "ISO date or null"},
          "tasks":     {"type": "array", "items": {"type": "string"}},
          "depends_on":{"type": "array", "items": {"type": "string"},
                        "description": "Names of phases this depends on"}
        },
        "required": ["name"]
      }
    },
    "decisions":      {"type": "array", "items": {"type": "string"}},
    "open_questions": {"type": "array", "items": {"type": "string"}},
    "risks":          {"type": "array", "items": {"type": "string"}}
  },
  "required": ["title", "phases"]
}`;

const FORMAT_PRESETS = [
  'Action plan',
  'Kanban',
  'Brainstorm',
  'Roadmap',
  'Custom'
];

export function WhiteboardTab() {
  const [imageSource, setImageSource] = useState<ImageSource | null>(null);
  const [schemaText, setSchemaText] = useState(DEFAULT_WHITEBOARD_SCHEMA);
  const [activeFormat, setActiveFormat] = useState('Action plan');
  const [isExtracting, setIsExtracting] = useState(false);
  const [outputJson, setOutputJson] = useState<any>(null);
  const { showToast, addHistory, saveSchema } = useAppContext();

  const handleImageChange = (dataUrl: string) => {
    const [header, base64] = dataUrl.split(',');
    const mimeType = header.split(';')[0].split(':')[1];
    setImageSource({
      data: base64,
      mimeType: mimeType
    });
    showToast("Image loaded");
  };

  const handleExtract = async () => {
    if (!imageSource) {
      showToast('Please select or capture a whiteboard image first.');
      return;
    }

    try {
      setIsExtracting(true);
      setOutputJson(null);
      const schemaObj = JSON.parse(schemaText);

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const promptText = `You are reading a photo of a whiteboard from a planning
              session. Identify the title (top of the board, usually
              underlined), then extract every distinct phase / column /
              cluster. For each phase capture the listed tasks, the
              owner if written next to the phase, and any deadline.
              Note any arrows between phases as depends_on. Capture
              decisions, open questions, and risks separately.
              If handwriting is ambiguous, your best guess is fine —
              the user will edit.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            role: 'user',
            parts: [
               { inlineData: { data: imageSource.data, mimeType: imageSource.mimeType } },
               { text: promptText }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: schemaObj,
          temperature: 0.1
        }
      });

      const text = response.text;
      if (text) {
        const parsed = JSON.parse(text);
        setOutputJson(parsed);
        addHistory({
          tab: "Whiteboard",
          summary: `Extracted "${parsed.title || 'Untitled'}"`
        });
        showToast("Whiteboard extracted successfully!");
      }

    } catch (err: any) {
      console.error(err);
      showToast(`Extraction failed: ${err.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveSchema = () => {
    try {
      JSON.parse(schemaText); // validate
      saveSchema({
        id: crypto.randomUUID(),
        name: `Whiteboard - ${activeFormat}`,
        schemaValid: true,
        content: schemaText
      });
      showToast("Schema saved to library");
    } catch {
      showToast("Cannot save invalid schema");
    }
  };

  const exportToMarkdown = () => {
    if (!outputJson) return;
    
    let md = `# ${outputJson.title || 'Whiteboard Extraction'}\n\n`;
    if (outputJson.summary) md += `**Summary:** ${outputJson.summary}\n\n`;
    
    if (outputJson.phases && outputJson.phases.length > 0) {
      md += `## Phases\n\n`;
      outputJson.phases.forEach((p: any) => {
        md += `### ${p.name}\n`;
        if (p.owner) md += `- **Owner:** ${p.owner}\n`;
        if (p.deadline) md += `- **Deadline:** ${p.deadline}\n`;
        if (p.depends_on && p.depends_on.length > 0) {
           md += `- **Depends On:** ${p.depends_on.join(', ')}\n`;
        }
        if (p.tasks && p.tasks.length > 0) {
          md += `\n**Tasks:**\n`;
          p.tasks.forEach((t: string) => {
            md += `- [ ] ${t}\n`;
          });
        }
        md += `\n`;
      });
    }

    if (outputJson.decisions && outputJson.decisions.length > 0) {
      md += `## Decisions\n`;
      outputJson.decisions.forEach((d: string) => {
        md += `- ${d}\n`;
      });
      md += `\n`;
    }

    if (outputJson.open_questions && outputJson.open_questions.length > 0) {
      md += `## Open Questions\n`;
      outputJson.open_questions.forEach((q: string) => {
        md += `- ${q}\n`;
      });
      md += `\n`;
    }

    if (outputJson.risks && outputJson.risks.length > 0) {
      md += `## Risks\n`;
      outputJson.risks.forEach((r: string) => {
        md += `- ${r}\n`;
      });
      md += `\n`;
    }

    navigator.clipboard.writeText(md);
    showToast("Copied Markdown to clipboard!");
  };

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 h-full">
      {/* Left Column */}
      <div className="col-span-1 lg:col-span-4 xl:col-span-3 flex flex-col gap-4 lg:overflow-hidden">
        
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col gap-3 shrink-0">
          <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Whiteboard Source</label>
          <div className="h-48">
             <ImagePicker onImageChange={handleImageChange} />
          </div>
        </div>

        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col min-h-[300px] lg:overflow-hidden gap-3">
          <div className="flex justify-between items-center shrink-0">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Format Options</label>
            <button
               onClick={handleSaveSchema}
               className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold hover:text-emerald-300 flex items-center gap-1"
            >
               <Save size={12} /> Save Schema
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 shrink-0">
            {FORMAT_PRESETS.map(preset => (
              <button
                key={preset}
                onClick={async () => {
                  setActiveFormat(preset);
                  // Optionally modify schema based on preset
                  if (preset === 'Kanban') {
                     setSchemaText(DEFAULT_WHITEBOARD_SCHEMA.replace(/"phases"/g, '"columns"').replace(/"name":      {"type": "string"}/g, '"name": {"type": "string", "enum": ["To Do", "In Progress", "Done"] }'));
                  } else {
                     setSchemaText(DEFAULT_WHITEBOARD_SCHEMA);
                  }
                }}
                className={`px-2 py-1 rounded text-[10px] uppercase tracking-tighter transition-all font-bold ${
                  activeFormat === preset ? 'bg-emerald-500 text-slate-900' : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-600'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
          <div className="flex-1 flex flex-col pt-2 lg:overflow-hidden relative">
            <SchemaEditor initialSchema={schemaText} onChange={setSchemaText} />
          </div>
        </div>
        
        <button
          onClick={handleExtract}
          disabled={!imageSource || isExtracting}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-3 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-colors shrink-0"
        >
          {isExtracting ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              <span>Extracting...</span>
            </div>
          ) : (
            <>
              <Target size={18} />
              <span>Extract Details</span>
            </>
          )}
        </button>

      </div>

      {/* Right Column */}
      <div className="col-span-1 lg:col-span-8 xl:col-span-9 flex flex-col gap-4 lg:overflow-hidden h-full"> 
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col lg:overflow-hidden">
          <div className="flex justify-between items-center mb-3 shrink-0">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Action Plan</label>
            {outputJson && (
              <button 
                onClick={exportToMarkdown}
                className="text-[10px] uppercase tracking-widest text-blue-400 font-bold hover:text-blue-300 flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-800"
              >
                <Download size={14} /> Export Markdown
              </button>
            )}
          </div>
          
          <div className="flex-1 lg:overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {!outputJson && !isExtracting ? (
              <OutputPanel text="Upload a whiteboard image to generate an action plan..." />
            ) : isExtracting ? (
              <OutputPanel text="Analyzing image..." />
            ) : outputJson && (
              <div className="flex flex-col gap-6 animate-in fade-in">
                 {/* Title Card */}
                 <div className="bg-slate-950 border border-slate-800 p-6 rounded-xl relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-10">
                     <Target size={64} />
                   </div>
                   <h2 className="text-2xl font-bold text-white mb-2">{outputJson.title || "Untitled Project"}</h2>
                   {outputJson.summary && (
                     <p className="text-sm text-slate-400 italic">"{outputJson.summary}"</p>
                   )}
                 </div>

                 {/* Phases */}
                 {outputJson.phases && outputJson.phases.length > 0 && (
                   <div className="space-y-3">
                     <h3 className="text-xs uppercase tracking-widest text-slate-500 font-bold px-2">Phases / Columns</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                       {outputJson.phases.map((phase: any, idx: number) => (
                         <div key={idx} className="bg-slate-900 border border-slate-800 rounded-lg flex flex-col p-4 shadow-sm hover:border-emerald-500/30 transition-colors">
                           <div className="flex justify-between items-start mb-4 border-b border-slate-800 pb-3">
                             <h4 className="text-sm font-bold text-slate-200">{phase.name}</h4>
                             {(phase.owner || phase.deadline) && (
                               <div className="flex flex-col items-end gap-1">
                                  {phase.owner && <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">{phase.owner}</span>}
                                  {phase.deadline && <span className="text-[10px] text-slate-500 tabular-nums">ETA: {phase.deadline}</span>}
                               </div>
                             )}
                           </div>
                           
                           {phase.tasks && phase.tasks.length > 0 ? (
                             <ul className="flex flex-col gap-2 flex-1">
                               {phase.tasks.map((task: string, tidx: number) => (
                                 <li key={tidx} className="flex items-start gap-2 text-xs text-slate-300">
                                    <div className="mt-0.5 w-3 h-3 rounded-[3px] border border-slate-600 shrink-0" />
                                    <span>{task}</span>
                                 </li>
                               ))}
                             </ul>
                           ) : (
                             <p className="text-xs text-slate-600 italic">No tasks listed.</p>
                           )}
                         </div>
                       ))}
                     </div>
                   </div>
                 )}

                 {/* Graph View / Dependencies */}
                 {outputJson.phases && outputJson.phases.some((p:any) => p.depends_on && p.depends_on.length > 0) && (
                    <div className="bg-slate-950 p-4 border border-slate-800 rounded-lg">
                      <h3 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3 flex items-center gap-2">
                        <ArrowRight size={12} className="text-emerald-500" /> Dependencies
                      </h3>
                      <div className="flex flex-wrap gap-2 items-center text-xs text-slate-400">
                         {outputJson.phases.map((phase: any, idx: number) => {
                             if (!phase.depends_on || phase.depends_on.length === 0) return null;
                             return (
                               <div key={idx} className="flex flex-col gap-1 bg-slate-900 border border-slate-800 px-3 py-2 rounded">
                                  <div className="text-[10px] text-slate-500 mb-1">{phase.name} requires:</div>
                                  <div className="flex gap-2">
                                     {phase.depends_on.map((dep: string) => (
                                       <span key={dep} className="px-2 py-0.5 bg-slate-800 rounded-full text-slate-300 text-[10px] font-bold tracking-tight">
                                          {dep}
                                       </span>
                                     ))}
                                  </div>
                               </div>
                             );
                         })}
                      </div>
                    </div>
                 )}

                 {/* Extra Info */}
                 {( (outputJson.decisions?.length > 0) || (outputJson.risks?.length > 0) || (outputJson.open_questions?.length > 0) ) && (
                   <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {outputJson.decisions?.length > 0 && (
                        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                           <h3 className="text-[10px] uppercase tracking-widest text-emerald-500 font-bold mb-2">Decisions</h3>
                           <ul className="list-disc pl-4 text-xs text-slate-400 space-y-1">
                             {outputJson.decisions.map((d: string, i: number) => <li key={i}>{d}</li>)}
                           </ul>
                        </div>
                      )}
                      {outputJson.open_questions?.length > 0 && (
                        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                           <h3 className="text-[10px] uppercase tracking-widest text-blue-500 font-bold mb-2">Open Questions</h3>
                           <ul className="list-disc pl-4 text-xs text-slate-400 space-y-1">
                             {outputJson.open_questions.map((q: string, i: number) => <li key={i}>{q}</li>)}
                           </ul>
                        </div>
                      )}
                      {outputJson.risks?.length > 0 && (
                        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                           <h3 className="text-[10px] uppercase tracking-widest text-red-500 font-bold mb-2 flex items-center gap-1">
                             <AlertCircle size={10} /> Risks
                           </h3>
                           <ul className="list-disc pl-4 text-xs text-slate-400 space-y-1">
                             {outputJson.risks.map((r: string, i: number) => <li key={i}>{r}</li>)}
                           </ul>
                        </div>
                      )}
                   </div>
                 )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
