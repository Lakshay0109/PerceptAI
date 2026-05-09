import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useAppContext } from '../context';

export function ToastContainer() {
  const { toasts } = useAppContext();

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none w-full max-w-md px-4 items-center">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="bg-emerald-600 text-emerald-50 px-4 py-2 rounded-lg shadow-lg font-medium text-sm text-center shadow-emerald-900/50"
          >
            {toast.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
