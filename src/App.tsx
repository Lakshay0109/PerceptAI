import React, { useState } from 'react';
import { AppProvider, useAppContext, TABS } from './context';
import { ToastContainer } from './components/Toast';
import { HistoryDrawer } from './components/HistoryDrawer';
import { SchemaLibraryTab } from './components/SchemaLibraryTab';
import { SettingsTab } from './components/SettingsTab';
import { ReceiptsTab } from './components/ReceiptsTab';
import { VisualQCTab } from './components/VisualQCTab';
import { ShelfAuditTab } from './components/ShelfAuditTab';
import { SiteInspectorTab } from './components/SiteInspectorTab';
import { ImagePicker } from './components/ImagePicker';
import { FilePicker } from './components/FilePicker';
import { DocumentQATab } from './components/DocumentQATab';
import { WhiteboardTab } from './components/WhiteboardTab';
import { ChartExtractorTab } from './components/ChartExtractorTab';
import { SchemaEditor } from './components/SchemaEditor';
import { OutputPanel } from './components/OutputPanel';
import { History as HistoryIcon, Menu, X } from 'lucide-react';

function GenericTab({ name, phase }: { name: string, phase: number }) {
  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 h-full">
      {/* Left Column */}
      <div className="col-span-1 lg:col-span-4 xl:col-span-3 flex flex-col gap-4 lg:overflow-hidden">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col shrink-0">
          <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-bold">ImagePicker</label>
          <ImagePicker onImageChange={() => {}} />
        </div>
        
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col shrink-0">
          <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-bold">FilePicker</label>
          <FilePicker onFileChange={() => {}} />
        </div>

        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col min-h-[250px] lg:overflow-hidden">
          <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-bold">SchemaEditor</label>
          <div className="flex-1 lg:overflow-hidden flex flex-col">
             <SchemaEditor />
          </div>
        </div>
      </div>

      {/* Right Column */}
      <div className="col-span-1 lg:col-span-8 xl:col-span-9 flex flex-col gap-4 lg:overflow-hidden">
        <div className="flex-1 bg-slate-900 border border-emerald-500/20 rounded-xl relative flex items-center justify-center overflow-hidden min-h-[300px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-500/5 via-transparent to-transparent"></div>
          <div className="text-center z-10">
            <div className="bg-slate-950 p-8 rounded-2xl border border-slate-800 shadow-2xl max-w-sm mx-auto">
              <h2 className="text-xl font-bold text-white mb-2 italic">{name} Analysis</h2>
              <p className="text-slate-400 text-sm mb-6">Advanced OCR & Entity Extraction engine.</p>
              <div className="inline-block px-4 py-2 bg-emerald-900/40 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-mono uppercase tracking-tighter animate-pulse">
                Sub-app coming in Phase {phase}
              </div>
            </div>
          </div>
        </div>

        <div className="h-auto lg:h-64 xl:h-72 bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col shrink-0">
          <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-bold">OutputPanel</label>
          <div className="flex-1 flex gap-4 lg:overflow-hidden min-h-[160px]">
            <OutputPanel 
              text="Ready for analysis output..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function MainLayout() {
  const { activeTab, setActiveTab, setHistoryOpen } = useAppContext();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
      {/* Header */}
      <header className="bg-[#0a192f] border-b border-slate-800 px-4 h-16 flex items-center shrink-0 justify-between z-30">
        <div className="flex items-center gap-3 mr-8 h-full">
          <div className="w-8 h-8 rounded bg-emerald-500 text-slate-900 flex items-center justify-center font-bold text-xl flex-shrink-0">
            P
          </div>
          <h1 className="text-lg font-bold tracking-tight text-white pr-4">
            PerceptAI <span className="text-emerald-400 font-medium">Workbench</span>
          </h1>
        </div>

        <nav className="hidden lg:flex gap-1 h-full pt-4 overflow-x-auto w-full items-end" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap px-3 py-2 text-xs font-semibold rounded-t-md transition-all ${
                activeTab === tab 
                  ? 'bg-slate-800 text-emerald-400 border-b-2 border-emerald-500' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3 pl-4">
          <button 
            onClick={() => setHistoryOpen(true)}
            className="hidden lg:flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-slate-400 bg-slate-900/50 hover:bg-slate-800 px-3 py-1.5 rounded transition-colors border border-slate-800 shrink-0"
          >
            <HistoryIcon size={14} className="text-emerald-500" /> History
          </button>
          
          <button 
            className="lg:hidden text-slate-300 p-2 shrink-0"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="absolute top-16 left-0 right-0 border-t border-slate-800 bg-slate-900 py-2 px-4 shadow-xl max-h-[70vh] overflow-y-auto z-40">
            <div className="flex flex-col gap-1">
              {TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); setMobileMenuOpen(false); }}
                  className={`text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab 
                      ? 'bg-emerald-500/10 text-emerald-400' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {tab}
                </button>
              ))}
              <div className="h-px bg-slate-800 my-2" />
              <button 
                onClick={() => { setHistoryOpen(true); setMobileMenuOpen(false); }}
                className="text-left px-4 py-3 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 flex items-center gap-2"
              >
                <HistoryIcon size={16} className="text-emerald-500" /> View History
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 w-full max-w-[1600px] mx-auto overflow-y-auto lg:overflow-hidden flex flex-col">
          {activeTab === 'Schema Library' ? (
            <SchemaLibraryTab />
          ) : activeTab === 'Settings' ? (
            <SettingsTab />
          ) : activeTab === 'Receipts' ? (
            <ReceiptsTab />
          ) : activeTab === 'Visual QC' ? (
            <VisualQCTab />
          ) : activeTab === 'Shelf Audit' ? (
            <ShelfAuditTab />
          ) : activeTab === 'Site Inspector' ? (
            <SiteInspectorTab />
          ) : activeTab === 'Document Q&A' ? (
            <DocumentQATab />
          ) : activeTab === 'Whiteboard' ? (
            <WhiteboardTab />
          ) : activeTab === 'Chart Extractor' ? (
            <ChartExtractorTab />
          ) : (
            <GenericTab name={activeTab} phase={TABS.indexOf(activeTab) + 2} />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 h-8 border-t border-slate-800 px-4 flex items-center justify-between text-[10px] text-slate-500 shrink-0">
        <div className="flex gap-4">
          <span>Model: <span className="text-slate-300 font-mono">gemini-3-flash-preview</span></span>
          <span>API Status: <span className="text-emerald-500">●</span> Connected</span>
        </div>
        <div className="flex gap-4 items-center">
          <label className="flex items-center gap-1 cursor-pointer">
            <div className="w-6 h-3 bg-emerald-600 rounded-full relative">
              <div className="absolute right-0.5 top-0.5 w-2 h-2 bg-white rounded-full"></div>
            </div>
            Resize on Upload (1024px)
          </label>
          <span className="text-slate-400 font-medium">v0.8.2-beta</span>
        </div>
      </footer>

      <HistoryDrawer />
      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
