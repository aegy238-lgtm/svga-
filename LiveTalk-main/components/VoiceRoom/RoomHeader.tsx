
import React, { useState } from 'react';
import { ChevronDown, LogOut, Minimize2, Users as UsersIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Room } from '../../types';

interface RoomHeaderProps {
  room: Room;
  onLeave: () => void;
  onMinimize: () => void;
  onShowMembers?: () => void;
  isVisible?: boolean; 
  listenerCount?: number; // مضاف لاستلام العدد الفعلي
}

const RoomHeader: React.FC<RoomHeaderProps> = ({ room, onLeave, onMinimize, onShowMembers, isVisible = true, listenerCount }) => {
  const [showExitDropdown, setShowExitDropdown] = useState(false);

  return (
    <div className="flex justify-between items-center p-4 pt-12 bg-gradient-to-b from-black/80 to-transparent shrink-0 z-[1000] relative">
      <div className="flex items-center gap-3 relative">
        <button onClick={() => setShowExitDropdown(!showExitDropdown)} className="w-9 h-9 flex items-center justify-center bg-black/40 rounded-xl active:scale-95 transition-transform">
          <ChevronDown size={20} className={`text-white transition-transform duration-300 ${showExitDropdown ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence>
          {showExitDropdown && (
            <>
              <div className="fixed inset-0 z-[190]" onClick={() => setShowExitDropdown(false)}></div>
              <motion.div 
                initial={{ opacity: 0, y: -10, scale: 0.95 }} 
                animate={{ opacity: 1, y: 0, scale: 1 }} 
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="absolute top-12 right-0 w-44 bg-[#0f172a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[200] overflow-hidden text-right" 
                dir="rtl"
              >
                <button 
                  onClick={() => { onLeave(); setShowExitDropdown(false); }} 
                  className="w-full p-4 flex items-center gap-3 border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  <LogOut size={16} className="text-red-500" />
                  <span className="text-xs font-black text-white">خروج</span>
                </button>
                <button 
                  onClick={() => { onMinimize(); setShowExitDropdown(false); }} 
                  className="w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-colors"
                >
                  <Minimize2 size={16} className="text-amber-500" />
                  <span className="text-xs font-black text-white">تصغير</span>
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
        <div className="text-white text-right" dir="rtl">
          <h2 className="font-black text-sm truncate max-w-[120px] drop-shadow-md">{room.title}</h2>
          <p className="text-[10px] opacity-60 font-bold">ID: {room.hostCustomId || room.hostId}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <button 
          onClick={onShowMembers}
          className="bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full flex items-center gap-2 border border-white/10 shadow-lg active:scale-95 transition-all hover:bg-black/60"
        >
          <UsersIcon size={12} className="text-emerald-400" />
          <span className="text-xs font-black text-white">{listenerCount ?? room.listeners ?? 0}</span>
        </button>
      </div>
    </div>
  );
};

export default RoomHeader;
