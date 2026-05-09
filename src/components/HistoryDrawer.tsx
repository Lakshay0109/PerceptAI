import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, History as HistoryIcon, Clock } from 'lucide-react';
import { useAppContext } from '../context';

export function HistoryDrawer() {
  const { historyOpen, setHistoryOpen, history } = useAppContext();

  return (
    <AnimatePresence>
      {historyOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setHistoryOpen(false)}
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            className="fixed inset-y-0 right-0 w-80 bg-[#0a192f] border-l border-slate-800 shadow-2xl shadow-black z-50 flex flex-col overflow-hidden"
          >
            <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center shrink-0">
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1">
                <HistoryIcon size={12} className="text-emerald-500" /> HistoryDrawer
              </label>
              <div className="flex items-center gap-2">
                <span className="bg-slate-800 text-emerald-400 px-1.5 py-0.5 rounded text-[10px] font-bold">{history.length} Runs</span>
                <button 
                  onClick={() => setHistoryOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors p-0.5"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <div className="p-3 space-y-3">
                {history.length === 0 ? (
                  <div className="text-center text-slate-500 mt-10 text-xs italic">
                    History is empty. Run an analysis across tabs to see your past runs here.
                  </div>
                ) : (
                  history.map((run, i) => (
                    <div key={run.id} className={`p-2 border-l-2 rounded text-[11px] cursor-pointer transition-colors ${i === 0 ? "bg-slate-900 border-emerald-500" : "hover:bg-slate-800 border-slate-700"}`}>
                      <div className="flex justify-between mb-1">
                        <span className={`font-bold ${i === 0 ? "text-white" : "text-slate-300"}`}>{run.tab} Run</span>
                        <span className="text-slate-500 text-[10px]">
                          {new Date(run.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-slate-500 truncate text-[10px]">
                        {run.summary}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
