import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type TabName = 
  | 'Receipts' 
  | 'Visual QC' 
  | 'Shelf Audit' 
  | 'Site Inspector' 
  | 'Document Q&A' 
  | 'Whiteboard' 
  | 'Chart Extractor' 
  | 'Schema Library' 
  | 'Settings';

export const TABS: TabName[] = [
  'Receipts', 
  'Visual QC', 
  'Shelf Audit', 
  'Site Inspector', 
  'Document Q&A', 
  'Whiteboard', 
  'Chart Extractor', 
  'Schema Library', 
  'Settings'
];

interface Settings {
  apiKey: string;
  defaultModel: string;
  resizeOnUpload: boolean;
}

interface RunHistory {
  id: string;
  tab: string;
  timestamp: number;
  summary: string;
}

interface SchemaDef {
  id: string;
  name: string;
  schemaValid: boolean;
  content: string;
}

interface ToastMessage {
  id: string;
  message: string;
}

interface AppContextType {
  activeTab: TabName;
  setActiveTab: (tab: TabName) => void;
  settings: Settings;
  setSettings: (s: Settings) => void;
  history: RunHistory[];
  addHistory: (h: Omit<RunHistory, 'id' | 'timestamp'>) => void;
  historyOpen: boolean;
  setHistoryOpen: (open: boolean) => void;
  schemas: SchemaDef[];
  saveSchema: (s: SchemaDef) => void;
  toasts: ToastMessage[];
  showToast: (msg: string) => void;
  removeToast: (id: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<TabName>('Receipts');
  
  const [settings, setSettingsState] = useState<Settings>(() => {
    try {
      const saved = localStorage.getItem('percept_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      apiKey: '',
      defaultModel: 'gemini-3-flash-preview',
      resizeOnUpload: true,
    };
  });

  const [history, setHistory] = useState<RunHistory[]>(() => {
    try {
      const saved = localStorage.getItem('percept_history');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  const [schemas, setSchemas] = useState<SchemaDef[]>(() => {
    try {
      const saved = localStorage.getItem('percept_schemas');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  const [historyOpen, setHistoryOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Sync state to localStorage
  useEffect(() => localStorage.setItem('percept_settings', JSON.stringify(settings)), [settings]);
  useEffect(() => localStorage.setItem('percept_history', JSON.stringify(history)), [history]);
  useEffect(() => localStorage.setItem('percept_schemas', JSON.stringify(schemas)), [schemas]);

  const setSettings = (newSettings: Settings) => setSettingsState(newSettings);

  const addHistory = (item: Omit<RunHistory, 'id' | 'timestamp'>) => {
    setHistory(prev => {
      const newItem = { ...item, id: crypto.randomUUID(), timestamp: Date.now() };
      return [newItem, ...prev].slice(0, 10);
    });
  };

  const saveSchema = (schema: SchemaDef) => {
    setSchemas(prev => {
      const exists = prev.findIndex(s => s.id === schema.id);
      if (exists >= 0) {
        const next = [...prev];
        next[exists] = schema;
        return next;
      }
      return [schema, ...prev];
    });
  };

  const showToast = (message: string) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => removeToast(id), 3000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <AppContext.Provider value={{
      activeTab, setActiveTab,
      settings, setSettings,
      history, addHistory,
      historyOpen, setHistoryOpen,
      schemas, saveSchema,
      toasts, showToast, removeToast
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
