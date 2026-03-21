import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DEFAULT_REACTIONS } from '../../constants/emojis';
import { X } from 'lucide-react';

interface ReactionPickerProps {
  isOpen: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
  emojis?: string[]; 
}

const ReactionPicker: React.FC<ReactionPickerProps> = ({ isOpen, onSelect, onClose, emojis = [] }) => {
  const listToRender = emojis.length > 0 ? emojis : DEFAULT_REACTIONS;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[2000] flex items-end justify-center px-6 pb-24">
          {/* Overlay الشفاف - عند الضغط عليه تغلق النافذة */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/10 backdrop-blur-[1px]" 
            onClick={onClose} 
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 50 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="relative w-full max-w-[320px] bg-black/40 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.7)] overflow-hidden"
          >
            {/* الديكور العلوي - العنوان وزر الإغلاق */}
            <div className="flex items-center justify-between mb-3 px-1">
               <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse shadow-[0_0_8px_#f59e0b]"></div>
                 <span className="text-[10px] font-black text-slate-200 uppercase tracking-[0.15em]">التفاعلات</span>
               </div>
               <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors text-slate-500">
                 <X size={16} />
               </button>
            </div>

            {/* شبكة الأيقونات المنسقة - تم تصغير الفجوات قليلاً */}
            <div className="grid grid-cols-4 gap-3 overflow-y-auto max-h-[40vh] scrollbar-hide p-1">
              {listToRender.map((emoji, idx) => {
                const isUrl = emoji.startsWith('http') || emoji.startsWith('data:');
                return (
                  <motion.button 
                    key={idx}
                    whileHover={{ scale: 1.1, y: -2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => { onSelect(emoji); onClose(); }}
                    className="aspect-square flex items-center justify-center bg-white/5 hover:bg-amber-500/10 rounded-2xl transition-all p-1.5 border border-white/5 group relative"
                  >
                    {/* لمعة داخلية خفيفة */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
                    
                    {isUrl ? (
                      <img 
                        src={emoji} 
                        className="w-full h-full object-contain filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.4)] z-10" 
                        alt="emoji" 
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-3xl z-10 filter drop-shadow-md">{emoji}</span>
                    )}
                  </motion.button>
                );
              })}
            </div>
            
            {/* تم إزالة التذييل النصي (Engine Label) بناءً على طلبك لتبسيط المظهر */}

            {/* تأثير ضوئي خلفي هادئ جداً */}
            <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-amber-500/5 blur-[40px] pointer-events-none rounded-full"></div>
            <div className="absolute -top-10 -left-10 w-24 h-24 bg-blue-500/5 blur-[40px] pointer-events-none rounded-full"></div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ReactionPicker;