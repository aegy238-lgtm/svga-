
import React from 'react';
import { motion } from 'framer-motion';
import { LuckyBag } from '../types';
import { Zap, ChevronLeft, Sparkles } from 'lucide-react';

interface GlobalLuckyBagBannerProps {
  bag: LuckyBag;
  onJoin: (roomId: string) => void;
}

const GlobalLuckyBagBanner: React.FC<GlobalLuckyBagBannerProps> = ({ bag, onJoin }) => {
  return (
    <motion.div 
      initial={{ y: -100, opacity: 0, x: "-50%" }}
      animate={{ y: 0, opacity: 1, x: "-50%" }}
      exit={{ y: -100, opacity: 0, x: "-50%" }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="fixed top-24 left-1/2 z-[2500] w-[95%] max-w-[380px] pointer-events-auto"
    >
      <button 
        onClick={() => onJoin(bag.roomId)}
        className="w-full bg-gradient-to-r from-amber-600 via-yellow-400 to-orange-600 p-[1px] rounded-full shadow-[0_10px_30px_rgba(245,158,11,0.4)] active:scale-95 transition-transform"
      >
        <div className="bg-[#020617]/90 backdrop-blur-2xl rounded-full px-4 py-2.5 flex items-center gap-3 relative overflow-hidden">
           {/* Shimmer effect */}
           <motion.div 
             animate={{ x: ['-100%', '200%'] }} 
             transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
             className="absolute top-0 bottom-0 w-24 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12"
           />

           <div className="relative">
              <div className="w-11 h-11 bg-gradient-to-br from-amber-400 to-orange-600 rounded-full flex items-center justify-center shrink-0 border-2 border-white/20 shadow-lg animate-bounce">
                 <span className="text-2xl">💰</span>
              </div>
           </div>

           <div className="flex-1 text-right overflow-hidden relative z-10">
              <div className="flex items-center gap-1 justify-end">
                 <h4 className="text-[11px] font-black text-white truncate">حقيبة حظ من {bag.senderName}</h4>
                 <Sparkles size={8} className="text-yellow-400" />
              </div>
              <p className="text-[9px] text-slate-300 font-bold">
                 بمبلغ <span className="text-yellow-400">{(bag.totalAmount || 0).toLocaleString()}</span> كوينز
              </p>
           </div>

           <div className="flex items-center gap-1 bg-amber-500/20 px-2 py-1 rounded-full border border-amber-500/30 text-amber-400 animate-pulse">
              <span className="text-[9px] font-black whitespace-nowrap">انطلق الآن</span>
              <ChevronLeft size={14} />
           </div>
        </div>
      </button>
    </motion.div>
  );
};

export default GlobalLuckyBagBanner;
