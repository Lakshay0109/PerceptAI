import React from 'react';
import { useAppContext } from '../context';
import { Settings as SettingsIcon, Save, Key, AppWindow } from 'lucide-react';

export function SettingsTab() {
  const { settings, setSettings, showToast } = useAppContext();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    setSettings({
      apiKey: formData.get('apiKey') as string || '',
      defaultModel: formData.get('defaultModel') as string || 'gemini-3-flash-preview',
      resizeOnUpload: formData.get('resizeOnUpload') === 'on',
    });
    showToast('Settings saved successfully');
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto w-full h-full">
      <div>
        <h2 className="text-2xl font-bold border-b border-emerald-500/30 pb-2 flex items-center gap-2 text-emerald-50">
          <SettingsIcon className="text-emerald-500" /> Workbench Settings
        </h2>
        <p className="text-slate-400 mt-2 text-sm">Configuration is saved locally in your browser.</p>
      </div>

      <form onSubmit={handleSave} className="bg-slate-800/80 border border-slate-700 p-6 md:p-8 rounded-xl flex flex-col gap-6">
        
        {/* API Key */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2">
            <Key size={16} className="text-emerald-400" /> Gemini API Key
          </label>
          <input 
            type="password" 
            name="apiKey"
            defaultValue={settings.apiKey}
            placeholder="AIzaSy..." 
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-200 placeholder-slate-600 focus:border-emerald-500 outline-none transition-colors font-mono text-sm"
          />
          <p className="text-xs text-slate-500 mt-2 flex items-start gap-1">
             <span className="text-amber-500">Note:</span> Uses explicitly provided key first. Otherwise falls back to environment key if deployed.
          </p>
        </div>

        <div className="h-px bg-slate-700 w-full" />

        {/* Default Model */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2">
            <AppWindow size={16} className="text-emerald-400" /> Default Model
          </label>
          <select 
            name="defaultModel"
            defaultValue={settings.defaultModel}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-200 focus:border-emerald-500 outline-none transition-colors appearance-none"
          >
            <option value="gemini-3-flash-preview">gemini-3-flash-preview</option>
            <option value="gemini-2.5-flash">gemini-2.5-flash</option>
            <option value="gemini-1.5-pro">gemini-1.5-pro</option>
          </select>
        </div>

        <div className="h-px bg-slate-700 w-full" />

        {/* Resize Option */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer group">
             <div className="relative flex items-center justify-center">
                <input 
                  type="checkbox" 
                  name="resizeOnUpload"
                  defaultChecked={settings.resizeOnUpload}
                  className="peer appearance-none w-5 h-5 border-2 border-slate-600 rounded bg-slate-900 checked:bg-emerald-500 checked:border-emerald-500 transition-colors"
                />
                <svg className="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
             </div>
             <div>
               <p className="text-sm font-semibold text-slate-300 group-hover:text-emerald-400 transition-colors">Resize images on upload</p>
               <p className="text-xs text-slate-500 mt-0.5">Automatically downscale large images to 1024px maximum edge to save bandwidth and compute.</p>
             </div>
          </label>
        </div>

        <div className="mt-4 flex justify-end">
          <button 
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-lg font-medium shadow-lg shadow-emerald-900/30 transition-colors flex items-center gap-2"
          >
            <Save size={18} /> Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}
