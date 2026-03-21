
import React from 'react';
import { motion } from 'framer-motion';
import { X, Maximize2, Mic, MicOff, LogOut } from 'lucide-react';
import { Room } from '../types';

interface MiniPlayerProps {
  room: Room;
  onExpand: () => void;
  onLeave: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

const MiniPlayer: React.FC<MiniPlayerProps> = ({ room, onExpand, onLeave, isMuted, onToggleMute }) => {
  return (
    <motion.div 
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="absolute bottom-[84px] left-4 right-4 bg-slate-900/95 backdrop-blur-3xl border border-white/10 rounded-2xl p-3 flex items-center justify-between shadow-2xl z-40 h-16"
    >
      <div className="flex items-center gap-3 flex-1 overflow-hidden" onClick={onExpand}>
        <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer shadow-lg">
           <img src={room.thumbnail} className="w-full h-full object-cover" alt="Room" />
           <div className="absolute inset-0 bg-black/40 flex items-end justify-center gap-0.5 pb-1">
              <div className="w-0.5 bg-amber-500 animate-[bounce_1s_infinite] h-3"></div>
              <div className="w-0.5 bg-amber-500 animate-[bounce_1.2s_infinite] h-5"></div>
              <div className="w-0.5 bg-amber-500 animate-[bounce_0.8s_infinite] h-2"></div>
           </div>
        </div>
        <div className="flex flex-col cursor-pointer flex-1 min-w-0">
           <h4 className="font-black text-xs text-white truncate pr-2">{room.title}</h4>
           <p className="text-[9px] text-amber-500 font-bold">الغرفة قيد التشغيل 🎙️</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 pr-1">
         <button 
            onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
            className={`w-9 h-9 rounded-xl transition-all active:scale-90 flex items-center justify-center border ${isMuted ? 'bg-slate-800 text-slate-500 border-white/5' : 'bg-blue-600/20 text-blue-400 border-blue-500/20 shadow-lg shadow-blue-900/10'}`}
         >
            {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
         </button>
         
         <button 
            onClick={onExpand}
            className="w-9 h-9 bg-amber-600/10 text-amber-500 rounded-xl border border-amber-500/20 flex items-center justify-center hover:bg-amber-600 hover:text-white transition-all active:scale-90"
         >
            <Maximize2 size={16} />
         </button>

         <button 
            onClick={(e) => { e.stopPropagation(); onLeave(); }}
            className="w-9 h-9 bg-red-600/10 text-red-500 rounded-xl border border-red-500/20 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all active:scale-90"
         >
            <LogOut size={16} />
         </button>
      </div>
    </motion.div>
  );
};

export default MiniPlayer;
