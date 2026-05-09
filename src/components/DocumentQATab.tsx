import React, { useState, useCallback, useRef } from 'react';
import { useAppContext } from '../context';
import { ImagePicker } from './ImagePicker';
import { FilePicker } from './FilePicker';
import { SchemaEditor } from './SchemaEditor';
import { OutputPanel } from './OutputPanel';
import { 
  BookOpen, 
  MessageSquare, 
  Send, 
  Quote, 
  ArrowRight, 
  RotateCcw, 
  Loader2, 
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

const DEFAULT_QA_SCHEMA = `{
  "type": "object",
  "properties": {
    "answer":            {"type": "string"},
    "confidence":        {"type": "string", "enum": ["High", "Medium", "Low"]},
    "citations": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "quote":      {"type": "string", "description": "Exact text from the document"},
          "page":       {"type": "integer", "description": "Page number, 1-indexed"},
          "section":    {"type": "string", "description": "Heading or section name"}
        },
        "required": ["quote"]
      }
    },
    "follow_up_questions": {"type": "array", "items": {"type": "string"}}
  },
  "required": ["answer", "confidence"]
}`;

const PRESETS = [
  "Summarise",
  "Key dates",
  "Key numbers",
  "Risks",
  "Action items"
];

interface DocumentSource {
  data: string; // base64
  mimeType: string;
  name: string;
}

export function DocumentQATab() {
  const { settings, showToast, addHistory } = useAppContext();
  const [docSource, setDocSource] = useState<DocumentSource | null>(null);
  const [question, setQuestion] = useState("");
  const [schemaObj, setSchemaObj] = useState<any>(JSON.parse(DEFAULT_QA_SCHEMA));
  const [schemaValid, setSchemaValid] = useState(true);
  const [isAsking, setIsAsking] = useState(false);
  const [outputJson, setOutputJson] = useState<any>(null);

  // Persistence
  React.useEffect(() => {
    const cached = localStorage.getItem('last_doc_source');
    if (cached) {
      try {
        setDocSource(JSON.parse(cached));
      } catch (e) {
        console.error("Failed to load cached doc", e);
      }
    }
  }, []);

  const handleFileChange = (file: File | null) => {
    if (!file) {
      setDocSource(null);
      localStorage.removeItem('last_doc_source');
      return;
    }
    
    if (file.size === 0) {
      showToast("Error: The selected file is empty (0 bytes).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(',')[1];
      const source = {
        data: base64,
        mimeType: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'),
        name: file.name
      };
      setDocSource(source);
      
      try {
        if (base64.length < 5 * 1024 * 1024) {
          localStorage.setItem('last_doc_source', JSON.stringify(source));
        }
      } catch (err) {
        console.warn("Could not cache file:", err);
      }
      
      showToast(`Document loaded: ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  const handleImageChange = (dataUrl: string) => {
    const [header, base64] = dataUrl.split(',');
    const mimeType = header.split(';')[0].split(':')[1];
    const source = {
      data: base64,
      mimeType: mimeType,
      name: "Image Document"
    };
    setDocSource(source);
    if (base64.length < 5 * 1024 * 1024) {
      localStorage.setItem('last_doc_source', JSON.stringify(source));
    }
    showToast("Image document loaded");
  };

  const handleSchemaValid = (isValid: boolean, parsed?: any) => {
    setSchemaValid(isValid);
    if (isValid && parsed) {
      setSchemaObj(parsed);
    }
  };

  const handleAsk = async () => {
    if (!docSource || !question || !schemaValid) return;
    setIsAsking(true);
    
    try {
      const apiKey = settings.apiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("No API key configured. Check Settings.");

      const ai = new GoogleGenAI({ apiKey });
      
      const promptText = `You are a careful research assistant.
              Question: ${question}
              Answer ONLY using the document. If the document does not
              contain the answer, say so and set confidence to Low.
              Always include the exact quote from the document for
              every claim, with the page number where possible.`;

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

      console.log(`[DEBUG] Sending request to Gemini...`, {
        mimeType: docSource.mimeType,
        base64Size: docSource.data.length,
        question: question
      });

      if (docSource.data.length > 20 * 1024 * 1024) {
        throw new Error("File is too large for inline analysis (max ~15MB PDF). Use a smaller file.");
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  data: docSource.data,
                  mimeType: docSource.mimeType
                }
              },
              { text: promptText }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: finalSchema
        }
      });

      const extractedText = response.text;
      if (!extractedText) throw new Error("No response from AI");

      const result = JSON.parse(extractedText);
      setOutputJson(result);
      
      addHistory({
        tab: 'Document Q&A',
        summary: `Question: ${question.slice(0, 50)}... | Confidence: ${result.confidence}`
      });

    } catch (err: any) {
      showToast(err.message || "Failed to get answer");
      console.error(err);
    } finally {
      setIsAsking(false);
    }
  };

  const handleReset = () => {
    setOutputJson(null);
    setQuestion("");
  };

  const getConfidenceStyles = (conf: string) => {
    switch (conf) {
      case 'High': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'Medium': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'Low': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 h-full">
      {/* Left Column */}
      <div className="col-span-1 lg:col-span-4 xl:col-span-3 flex flex-col gap-4 lg:overflow-hidden">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col gap-3 shrink-0">
          <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Document Source</label>
          <div className="flex flex-col gap-2">
            <div className="h-32">
              <FilePicker onFileChange={handleFileChange} />
            </div>
            <div className="h-28">
              <ImagePicker onImageChange={handleImageChange} hideWebcam />
            </div>
          </div>
          {docSource && (
            <div className="flex flex-col gap-1 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-medium">
                <FileText size={12} /> {docSource.name}
              </div>
              <div className="flex justify-between items-center text-[8px] text-slate-500 uppercase tracking-tighter">
                <span>{docSource.mimeType}</span>
                <span>{(docSource.data.length * 0.75 / 1024 / 1024).toFixed(2)} MB</span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col gap-3 shrink-0">
          <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Ask a Question</label>
          <textarea 
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-300 focus:border-emerald-500 outline-none resize-none h-24"
            placeholder="What is the termination clause?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <div className="flex flex-wrap gap-1.5 mt-1">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setQuestion(`Please ${p.toLowerCase()} the document.`)}
                className="text-[9px] bg-slate-950 border border-slate-800 hover:border-slate-600 text-slate-400 hover:text-slate-200 px-2 py-1 rounded-full transition-colors uppercase tracking-tighter"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col min-h-[200px] lg:overflow-hidden">
          <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-bold">Response Schema</label>
          <div className="flex-1 lg:overflow-hidden flex flex-col">
             <SchemaEditor 
               initialSchema={DEFAULT_QA_SCHEMA} 
               onValidSchema={handleSchemaValid} 
             />
          </div>
        </div>

        <button 
          onClick={handleAsk}
          disabled={!docSource || !question || !schemaValid || isAsking}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors shrink-0 shadow-lg shadow-emerald-900/40"
        >
          {isAsking ? (
            <><Loader2 className="animate-spin" size={18} /> Analyzing...</>
          ) : (
            <><Send size={18} /> Ask Question</>
          )}
        </button>
      </div>

      {/* Right Column */}
      <div className="col-span-1 lg:col-span-8 xl:col-span-9 flex flex-col gap-4 lg:overflow-hidden h-full">
        {/* Answer Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col gap-4 relative shadow-sm min-h-[200px]">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500/10 p-2 rounded-full">
                <BookOpen className="text-emerald-500" size={24} />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white leading-tight">Response</h2>
            </div>
            {outputJson && (
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${getConfidenceStyles(outputJson.confidence)}`}>
                {outputJson.confidence} Confidence
              </span>
            )}
          </div>
          
          <div className="flex-1">
            {outputJson ? (
              <p className="text-base text-slate-200 leading-relaxed font-medium bg-slate-950/40 p-4 rounded-lg border border-slate-800/50">
                {outputJson.answer}
              </p>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 italic py-8">
                <MessageSquare size={48} className="opacity-20 mb-3" />
                <p className="text-sm">Upload a document and ask a question to see analysis.</p>
              </div>
            )}
          </div>

          {outputJson && (
            <div className="flex justify-end pt-2">
                 <button 
                  onClick={handleReset}
                  className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-emerald-400 transition-colors"
                >
                  <RotateCcw size={14} /> New question on same doc
                </button>
            </div>
          )}
        </div>

        <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-4 lg:overflow-hidden">
          {/* Citations Column */}
          <div className="xl:col-span-7 flex flex-col gap-3 lg:overflow-hidden">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center gap-2 px-1">
              <Quote size={14} className="text-emerald-500" /> Evidence & Citations
            </label>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
              {outputJson?.citations && outputJson.citations.length > 0 ? (
                outputJson.citations.map((cite: any, idx: number) => (
                  <div key={idx} className="bg-slate-950/50 border border-slate-800 rounded-lg p-4 group hover:border-emerald-500/30 transition-colors shadow-inner">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                        {cite.section || 'Reference Point'}
                      </span>
                      <span className="text-[9px] bg-slate-800/80 px-2 py-0.5 rounded text-slate-500 font-mono">
                        {cite.page ? `PAGE ${cite.page}` : 'GENERAL'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 italic border-l-2 border-slate-700 pl-4 leading-relaxed group-hover:text-slate-300 transition-colors">
                      "{cite.quote}"
                    </p>
                  </div>
                ))
              ) : (
                <div className="h-40 bg-slate-900/50 border border-slate-800 border-dashed rounded-lg flex items-center justify-center text-slate-600 text-xs italic">
                  Citations will appear here.
                </div>
              )}
            </div>
          </div>

          {/* Follow-ups & Raw Data */}
          <div className="xl:col-span-5 flex flex-col gap-4 lg:overflow-hidden">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col gap-3">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center gap-2">
                <ArrowRight size={14} className="text-blue-500" /> Follow-up Questions
              </label>
              <div className="flex flex-wrap gap-2">
                {outputJson?.follow_up_questions ? (
                  outputJson.follow_up_questions.map((q: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setQuestion(q)}
                      className="text-left px-3 py-2 rounded-full bg-slate-950 border border-slate-800 hover:border-emerald-500/50 text-[10px] text-slate-400 hover:text-emerald-400 transition-all flex items-center gap-2 group whitespace-normal max-w-full"
                    >
                      <span className="truncate">{q}</span>
                      <ArrowRight size={10} className="shrink-0 opacity-0 group-hover:opacity-100 transition-all" />
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-slate-600 italic">No suggestions available yet.</p>
                )}
              </div>
            </div>

            <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col lg:overflow-hidden h-full">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-bold flex items-center gap-2">
                 Data Matrix
              </label>
              <div className="flex-1 lg:overflow-hidden">
                <OutputPanel 
                  json={outputJson}
                  text={!outputJson ? "Waiting for system response..." : undefined}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
