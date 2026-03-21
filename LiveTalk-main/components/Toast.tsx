import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
}

interface ToastProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[70] flex flex-col gap-2 w-full max-w-xs pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="bg-slate-800/90 backdrop-blur-md border border-white/10 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 pointer-events-auto"
          >
            <div className={`p-1 rounded-full ${
              toast.type === 'success' ? 'bg-green-500/20 text-green-400' : 
              toast.type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
            }`}>
              {toast.type === 'success' && <Check size={14} strokeWidth={3} />}
              {toast.type === 'error' && <X size={14} strokeWidth={3} />}
              {toast.type === 'info' && <Info size={14} strokeWidth={3} />}
            </div>
            <span className="text-sm font-medium">{toast.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default Toast;