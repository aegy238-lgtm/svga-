
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Trophy, Wallet, Share2, ShieldCheck, Zap, RotateCcw, Mic, LayoutGrid, Sparkles, Trash2 } from 'lucide-react';

interface RoomToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAction: (action: string) => void;
  isHost: boolean;
}

const RoomToolsModal: React.FC<RoomToolsModalProps> = ({ isOpen, onClose, onAction, isHost }) => {
  if (!isOpen) return null;

  // قائمة جميع الأدوات
  const allTools = [
    { id: 'settings', label: 'إعدادات الغرفة', icon: Settings, color: 'bg-blue-500' },
    { id: 'rank', label: 'ترتيب الكاريزما', icon: Trophy, color: 'bg-amber-500' },
    { id: 'luckybag', label: 'صندوق الحظ', icon: Wallet, color: 'bg-emerald-500' },
    { id: 'mic_layout', label: 'تبديل المقاعد', icon: LayoutGrid, color: 'bg-indigo-600' },
    { id: 'reset_charm', label: 'تصفير الكاريزما', icon: RotateCcw, color: 'bg-rose-500' },
    { id: 'clear_chat', label: 'حذف الدردشة', icon: Trash2, color: 'bg-red-600' },
  ];

  // تصفية الأدوات: صاحب الغرفة يرى الكل، المستخدم العادي يرى صندوق الحظ والترتيب فقط
  const tools = isHost 
    ? allTools 
    : allTools.filter(t => t.id === 'luckybag' || t.id === 'rank');

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center pointer-events-none">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose} 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto" 
      />
      <motion.div 
        initial={{ y: "100%" }} 
        animate={{ y: 0 }} 
        exit={{ y: "100%" }} 
        className="relative w-full max-w-md bg-[#0f172a] rounded-t-[2.5rem] border-t border-white/10 p-6 pb-12 pointer-events-auto shadow-2xl"
      >
        <div className="flex justify-between items-center mb-8">
           <div className="flex items-center gap-2">
              <Zap size={18} className="text-amber-500" />
              <h3 className="text-lg font-black text-white text-right">
                {isHost ? 'امتيازات الغرفة' : 'خيارات الغرفة'}
              </h3>
           </div>
           <button onClick={onClose} className="p-2 bg-white/5 rounded-full"><X size={20} className="text-slate-400" /></button>
        </div>

        <div className={`grid ${tools.length <= 2 ? 'grid-cols-2' : 'grid-cols-3'} gap-y-8 gap-x-4`}>
           {tools.map(tool => (
              <button 
                key={tool.id} 
                onClick={() => onAction(tool.id)}
                className="flex flex-col items-center gap-2 group active:scale-90 transition-all"
              >
                 <div className={`w-16 h-16 ${tool.color} rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:brightness-110 border border-white/10 relative overflow-hidden`}>
                    <tool.icon size={28} />
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
                 </div>
                 <span className="text-[10px] font-bold text-slate-300 text-center leading-tight">{tool.label}</span>
              </button>
           ))}
        </div>
        
        {!isHost && (
          <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-center gap-2 opacity-30">
            <Sparkles size={12} className="text-amber-500" />
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Vivo Live Room Experience</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default RoomToolsModal;
