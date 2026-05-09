import React, { useState } from 'react';
import { ImagePicker } from './ImagePicker';
import { SchemaEditor } from './SchemaEditor';
import { OutputPanel } from './OutputPanel';
import { useAppContext } from '../context';
import { BarChart as BarIcon, Target, Download, Copy, AlertTriangle, ArrowRight, Table } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, ScatterChart, Scatter, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

interface ImageSource {
  data: string;
  mimeType: string;
}

const DEFAULT_CHART_SCHEMA = `{
  "type": "object",
  "properties": {
    "chart_type":  {"type": "string",
                    "enum": ["line", "bar", "pie", "scatter", "area", "table", "other"]},
    "title":       {"type": "string"},
    "x_axis_label":{"type": "string"},
    "y_axis_label":{"type": "string"},
    "units":       {"type": "string"},
    "series": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name":   {"type": "string"},
          "points": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "x": {"type": ["string", "number"]},
                "y": {"type": "number"}
              },
              "required": ["x", "y"]
            }
          }
        },
     "required": ["name", "points"]
      }
    },
    "insights": {"type": "array", "items": {"type": "string"},
                  "description": "1-3 short observations about the data"},
    "estimated":  {"type": "boolean", 
                    "description": "True if values were read off the axes (not from labels)"}
  },
  "required": ["chart_type", "series"]
}`;

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export function ChartExtractorTab() {
  const [imageSource, setImageSource] = useState<ImageSource | null>(null);
  const [schemaText, setSchemaText] = useState(DEFAULT_CHART_SCHEMA);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [outputJson, setOutputJson] = useState<any>(null);
  const [refinementText, setRefinementText] = useState('');
  const { showToast, addHistory } = useAppContext();

  const handleImageChange = (dataUrl: string) => {
    const [header, base64] = dataUrl.split(',');
    const mimeType = header.split(';')[0].split(':')[1];
    setImageSource({
      data: base64,
      mimeType: mimeType
    });
    showToast("Chart image loaded");
  };

  const handleExtract = async (isRefinement = false) => {
    if (!imageSource) {
      showToast('Please select a chart image first.');
      return;
    }

    try {
      if (isRefinement) {
        setIsRefining(true);
      } else {
        setIsExtracting(true);
      }
      
      const schemaObj = JSON.parse(schemaText);
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      let promptText = `You are a data-extraction analyst. Read the chart in
              the image and extract every data point.
              - Read exact values from labels when present.
              - When values are not labelled, estimate them from the
                axis and set 'estimated' to true.
              - Preserve the chart type, axis labels, and units.
              - Add 1-3 short insights about the data.`;

      if (isRefinement && outputJson && refinementText) {
         promptText += `\
\
Here is your previous extraction:
         ${JSON.stringify(outputJson, null, 2)}
         
         The user has provided the following correction/refinement:
         "${refinementText}"
         
         Please return the full updated JSON incorporating this feedback.`;
      }

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
        if (!isRefinement) {
          addHistory({
            tab: "Chart Extractor",
            summary: `Extracted "${parsed.title || 'Chart'}"`
          });
        }
        showToast(isRefinement ? "Extraction refined successfully!" : "Chart extracted successfully!");
        if (isRefinement) {
          setRefinementText('');
        }
      }

    } catch (err: any) {
      console.error(err);
      showToast(`Extraction failed: ${err.message}`);
    } finally {
      setIsExtracting(false);
      setIsRefining(false);
    }
  };

  // Process data for Recharts
  const processChartData = () => {
    if (!outputJson || !outputJson.series) return [];
    
    // For pie charts, format differently
    if (outputJson.chart_type === 'pie') {
      const pieData = [];
      if (outputJson.series[0] && outputJson.series[0].points) {
        outputJson.series[0].points.forEach((p: any) => {
          pieData.push({ name: p.x, value: Number(p.y) });
        });
      }
      return pieData;
    }

    // Line, Bar, Area etc - combine data by X axis
    const uniqueXs = new Set<string | number>();
    outputJson.series.forEach((s: any) => {
      s.points?.forEach((p: any) => {
        uniqueXs.add(p.x);
      });
    });

    const combinedData = Array.from(uniqueXs).map(x => {
      const dataPoint: any = { name: String(x) };
      outputJson.series.forEach((s: any) => {
        const pt = s.points?.find((p: any) => String(p.x) === String(x));
        if (pt) {
          dataPoint[s.name] = Number(pt.y);
        }
      });
      return dataPoint;
    });

    // Optionally sort if 'name' is numeric or a date... we'll just keep order mostly
    return combinedData;
  };

  const getCsvContent = () => {
    if (!outputJson || !outputJson.series) return "";
    
    // Headers
    let csv = "X";
    outputJson.series.forEach((s: any) => {
      csv += `,${s.name || "Y"}`;
    });
    csv += "\
";
    
    const combinedData = processChartData();
    if (outputJson.chart_type === 'pie') {
      // It's just {name, value} mapped above
      const pieData = combinedData as any[];
      pieData.forEach(p => {
         csv += `"${p.name}",${p.value}\
`;
      });
      return csv;
    }
    
    combinedData.forEach(p => {
      let row = `"${p.name}"`;
      outputJson.series.forEach((s: any) => {
         row += `,${p[s.name] ?? ""}`;
      });
      csv += row + "\
";
    });
    
    return csv;
  };

  const downloadCsv = () => {
    const csv = getCsvContent();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(outputJson?.title || 'chart_data').replace(/[\\s/\\\\:]/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Downloaded CSV!");
  };

  const copyMarkdown = () => {
    if (!outputJson || !outputJson.series) return;
    const combinedData = processChartData();

    let md = `## ${outputJson.title || 'Extracted Data'}\
\
`;
    
    if (outputJson.chart_type === 'pie') {
      md += `| Category | Value |\
|---|---|\
`;
      const pieData = combinedData as any[];
      pieData.forEach(p => {
         md += `| ${p.name} | ${p.value} |\
`;
      });
    } else {
      let headers = `| ${outputJson.x_axis_label || 'X'} |`;
      let sep = `|---|`;
      outputJson.series.forEach((s: any) => {
        headers += ` ${s.name || 'Y'} |`;
        sep += `---|`;
      });
      md += headers + "\
" + sep + "\
";

      combinedData.forEach((p: any) => {
        let row = `| ${p.name} |`;
        outputJson.series.forEach((s: any) => {
           row += ` ${p[s.name] ?? ""} |`;
        });
        md += row + "\
";
      });
    }

    navigator.clipboard.writeText(md);
    showToast("Markdown copied to clipboard!");
  };

  const renderChart = () => {
    if (!outputJson || !outputJson.series) return null;
    const data = processChartData();
    const type = outputJson.chart_type;

    if (data.length === 0) return <div className="text-sm text-slate-500 italic p-4 text-center">No data points to render.</div>;

    const renderComponents = (Component: any, DataChild: any) => (
      <ResponsiveContainer width="100%" height={300}>
        <Component data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis dataKey="name" stroke="#64748b" tick={{fill: '#94a3b8', fontSize: 12}} />
          <YAxis stroke="#64748b" tick={{fill: '#94a3b8', fontSize: 12}} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
            itemStyle={{ color: '#e2e8f0' }}
          />
          <Legend wrapperStyle={{ fontSize: '12px' }} />
          {outputJson.series.map((s: any, idx: number) => (
            <DataChild 
              key={s.name} 
              type="monotone" 
              dataKey={s.name} 
              name={s.name} 
              fill={COLORS[idx % COLORS.length]} 
              stroke={COLORS[idx % COLORS.length]} 
              strokeWidth={2}
            />
          ))}
        </Component>
      </ResponsiveContainer>
    );

    switch(type) {
      case 'bar':
        return renderComponents(BarChart, Bar);
      case 'area':
        return renderComponents(AreaChart, Area);
      case 'scatter':
        // Scatter needs slightly different mapping for multiple series, but we can fake it or use a specialized one.
        // For simplicity, we just render line with dots if scatter structure isn't perfect, or use scatter.
        return (
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis type="category" dataKey="name" name="X" stroke="#64748b" tick={{fill: '#94a3b8', fontSize: 12}} />
              <YAxis type="number" stroke="#64748b" tick={{fill: '#94a3b8', fontSize: 12}} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              {outputJson.series.map((s: any, idx: number) => (
                <Scatter key={s.name} name={s.name} data={processChartData()} fill={COLORS[idx % COLORS.length]} />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        );
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        );
      case 'line':
      case 'other':
      default:
        return renderComponents(LineChart, Line);
    }
  };

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 h-full">
      {/* Left Column */}
      <div className="col-span-1 lg:col-span-4 xl:col-span-3 flex flex-col gap-4 lg:overflow-hidden">
        
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col gap-3 shrink-0">
          <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Chart Source</label>
          <div className="h-48">
             <ImagePicker onImageChange={handleImageChange} />
          </div>
        </div>

        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col min-h-[300px] lg:overflow-hidden gap-3">
          <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Extraction Schema</label>
          <div className="flex-1 flex flex-col pt-2 lg:overflow-hidden relative">
            <SchemaEditor initialSchema={schemaText} onChange={setSchemaText} />
          </div>
        </div>
        
        <button
          onClick={() => handleExtract(false)}
          disabled={!imageSource || isExtracting || isRefining}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-3 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-colors shrink-0"
        >
          {isExtracting && !isRefining ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              <span>Extracting Data...</span>
            </div>
          ) : (
            <>
              <BarIcon size={18} />
              <span>Extract Data</span>
            </>
          )}
        </button>

      </div>

      {/* Right Column */}
      <div className="col-span-1 lg:col-span-8 xl:col-span-9 flex flex-col gap-4 lg:overflow-hidden h-full"> 
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col lg:overflow-hidden">
          <div className="flex justify-between items-center mb-3 shrink-0">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Extraction Results</label>
            {outputJson && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={downloadCsv}
                  className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold hover:text-emerald-300 flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-800 hover:border-emerald-500/30 transition-colors"
                >
                  <Download size={14} /> Download CSV
                </button>
                <button 
                  onClick={copyMarkdown}
                  className="text-[10px] uppercase tracking-widest text-blue-400 font-bold hover:text-blue-300 flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-800 hover:border-blue-500/30 transition-colors"
                >
                  <Copy size={14} /> Copy Markdown
                </button>
              </div>
            )}
          </div>
          
          <div className="flex-1 lg:overflow-y-auto space-y-6 pr-2 custom-scrollbar">
            {!outputJson && !isExtracting && !isRefining ? (
              <OutputPanel text="Upload a chart image to extract data, series, and insights..." />
            ) : (isExtracting || isRefining) && !outputJson ? (
              <OutputPanel text="Analyzing chart layout and reading values..." />
            ) : outputJson && (
              <div className="flex flex-col gap-6 animate-in fade-in pb-4">
                 
                 {/* Header info */}
                 <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded font-mono text-[10px] uppercase font-bold tracking-widest">
                        {outputJson.chart_type || "UNKNOWN TYPE"} CHART
                      </span>
                      {outputJson.estimated && (
                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded font-mono text-[10px] uppercase font-bold flex items-center gap-1">
                          <AlertTriangle size={10} /> Estimated Data
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-white mt-1">{outputJson.title || "Untitled Chart"}</h2>
                    <div className="flex gap-4 text-xs text-slate-400 mt-1">
                      {outputJson.x_axis_label && <div><span className="font-bold text-slate-500">X-Axis:</span> {outputJson.x_axis_label}</div>}
                      {outputJson.y_axis_label && <div><span className="font-bold text-slate-500">Y-Axis:</span> {outputJson.y_axis_label}</div>}
                      {outputJson.units && <div><span className="font-bold text-slate-500">Units:</span> {outputJson.units}</div>}
                    </div>
                 </div>

                 {/* Redrawn Chart */}
                 <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 md:p-6 shadow-inner">
                    <h3 className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-4 text-center">Interactive Reconstruction</h3>
                    {renderChart()}
                 </div>

                 {/* Insights */}
                 {outputJson.insights && outputJson.insights.length > 0 && (
                   <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 md:p-6">
                     <h3 className="text-[10px] uppercase tracking-widest text-emerald-500 font-bold mb-3 flex items-center gap-2">
                        <Target size={14} /> Key Insights
                     </h3>
                     <ul className="space-y-2">
                       {outputJson.insights.map((insight: string, idx: number) => (
                         <li key={idx} className="flex gap-3 text-sm text-slate-300">
                           <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500/50 shrink-0" />
                           <span className="leading-relaxed">{insight}</span>
                         </li>
                       ))}
                     </ul>
                   </div>
                 )}

                 {/* Data Table */}
                 <div className="flex flex-col gap-2">
                   <h3 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center gap-2 px-1">
                      <Table size={14} className="text-slate-400" /> Extracted Master Data
                   </h3>
                   <div className="overflow-x-auto border border-slate-800 rounded-lg">
                      <table className="w-full text-sm text-left">
                         <thead className="text-[10px] uppercase tracking-wider text-slate-400 bg-slate-950">
                            <tr>
                               <th className="px-4 py-3 font-medium border-b border-slate-800 border-r">{outputJson.chart_type === 'pie' ? 'Category' : (outputJson.x_axis_label || 'X')}</th>
                               {outputJson.chart_type === 'pie' ? (
                                 <th className="px-4 py-3 font-medium border-b border-slate-800">Value</th>
                               ) : (
                                 outputJson.series?.map((s: any, idx: number) => (
                                    <th key={idx} className="px-4 py-3 font-medium border-b border-slate-800 border-r last:border-r-0">
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                                        {s.name || `Series ${idx + 1}`}
                                      </div>
                                    </th>
                                 ))
                               )}
                            </tr>
                         </thead>
                         <tbody>
                            {outputJson.chart_type === 'pie' ? (
                               (processChartData() as any[]).map((row, idx) => (
                                 <tr key={idx} className="border-b border-slate-800/50 bg-slate-900/50 hover:bg-slate-800/50 transition-colors last:border-b-0">
                                    <td className="px-4 py-2 font-mono text-xs text-slate-300 border-r border-slate-800/50">{row.name}</td>
                                    <td className="px-4 py-2 font-mono text-xs text-slate-300">{row.value}</td>
                                 </tr>
                               ))
                            ) : (
                               processChartData().map((row: any, idx) => (
                                 <tr key={idx} className="border-b border-slate-800/50 bg-slate-900/50 hover:bg-slate-800/50 transition-colors last:border-b-0">
                                    <td className="px-4 py-2 font-mono text-xs text-slate-400 border-r border-slate-800/50">{row.name}</td>
                                    {outputJson.series?.map((s: any, sIdx: number) => (
                                       <td key={sIdx} className="px-4 py-2 font-mono text-xs text-slate-300 border-r border-slate-800/50 last:border-r-0">
                                          {row[s.name] !== undefined ? row[s.name] : <span className="text-slate-600">-</span>}
                                       </td>
                                    ))}
                                 </tr>
                               ))
                            )}
                         </tbody>
                      </table>
                   </div>
                 </div>

                 {/* Refinement */}
                 <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 md:p-6 mt-4">
                   <h3 className="text-[10px] uppercase tracking-widest text-blue-500 font-bold mb-3">Refine Extraction</h3>
                   <p className="text-xs text-slate-500 mb-3">Notice a mistake? Provide feedback and re-extract.</p>
                   <div className="flex flex-col gap-3">
                     <textarea 
                       className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-300 focus:border-blue-500 outline-none resize-none h-20 placeholder:text-slate-600 custom-scrollbar"
                       placeholder="e.g. 'The third bar should be 2024 not 2023', 'Also extract the legend as a separate series'"
                       value={refinementText}
                       onChange={(e) => setRefinementText(e.target.value)}
                     />
                     <button
                       onClick={() => handleExtract(true)}
                       disabled={isRefining || isExtracting || !refinementText.trim()}
                       className="self-end bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-2 px-6 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-colors text-sm"
                     >
                       {isRefining ? 'Refining...' : 'Apply Correction'} <ArrowRight size={16} />
                     </button>
                   </div>
                 </div>

              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
