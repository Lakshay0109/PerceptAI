import React, { useState } from 'react';
import { useAppContext } from '../context';
import { Plus, Database, Code } from 'lucide-react';
import { SchemaEditor } from '../components/SchemaEditor';

// Mock list as an example for Phase 1
export function SchemaLibraryTab() {
  const { schemas, saveSchema, showToast } = useAppContext();
  const [isAdding, setIsAdding] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftSchema, setDraftSchema] = useState('');

  const handleSave = () => {
    if (!draftName.trim()) {
      showToast('Please enter a schema name');
      return;
    }
    saveSchema({
      id: crypto.randomUUID(),
      name: draftName,
      schemaValid: true,
      content: draftSchema,
    });
    showToast('Schema saved locally');
    setIsAdding(false);
    setDraftName('');
    setDraftSchema('');
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto w-full h-full">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold border-b border-emerald-500/30 pb-2 inline-flex items-center gap-2 text-emerald-50">
            <Database className="text-emerald-500" /> Schema Library
          </h2>
          <p className="text-slate-400 mt-2 text-sm">Create and manage reusable JSON schemas for structured extraction.</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-sm rounded-lg flex items-center gap-2 transition-colors font-medium shadow-sm"
        >
          {isAdding ? "Cancel" : <><Plus size={16} /> Add new</>}
        </button>
      </div>

      {isAdding && (
        <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <h3 className="text-lg font-semibold text-slate-200 mb-4">New Schema</h3>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Schema Name</label>
              <input 
                type="text" 
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                placeholder="e.g. Receipt Extraction V2" 
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-200 placeholder-slate-600 focus:border-emerald-500 outline-none transition-colors"
              />
            </div>
            <div>
               <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Definition</label>
               <SchemaEditor initialSchema={draftSchema} onValidSchema={(isValid, parsed) => setDraftSchema(isValid ? JSON.stringify(parsed, null, 2) : '')} />
            </div>
            <div className="flex justify-end pt-2">
               <button 
                 onClick={handleSave}
                 className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-medium transition-colors"
               >
                 Save Schema
               </button>
            </div>
          </div>
        </div>
      )}

      {schemas.length === 0 && !isAdding ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-700 rounded-2xl">
          <Code className="text-slate-600 w-16 h-16 mb-4" />
          <h3 className="text-xl font-medium text-slate-300 mb-2">No schemas saved yet</h3>
          <p className="text-slate-500 text-center max-w-md">Click "Add new" to create your first JSON extraction schema. They will be saved in your browser storage.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {schemas.map(schema => (
            <div key={schema.id} className="bg-slate-800 border border-slate-700 p-5 rounded-xl hover:border-emerald-500/50 transition-colors">
              <h4 className="font-semibold text-emerald-400 text-lg mb-1">{schema.name}</h4>
              <p className="text-xs text-slate-500 mb-4 font-mono">ID: {schema.id.split('-')[0]}</p>
              <pre className="text-xs text-slate-400 bg-slate-900 p-3 rounded-lg overflow-hidden h-24 truncate whitespace-pre-wrap leading-relaxed border border-slate-800">
                {schema.content}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
