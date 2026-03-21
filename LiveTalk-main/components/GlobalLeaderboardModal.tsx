
import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Medal, Sparkles, Coins, Crown, Star, ChevronLeft } from 'lucide-react';
import { User } from '../types';

interface GlobalLeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
}

const GlobalLeaderboardModal: React.FC<GlobalLeaderboardModalProps> = ({ isOpen, onClose, users }) => {
  // فرز المستخدمين حسب الثروة (إجمالي الدعم)
  const topSupporters = useMemo(() => {
    return [...users]
      .filter(u => Number(u.wealth || 0) > 0)
      .sort((a, b) => Number(b.wealth || 0) - Number(a.wealth || 0))
      .slice(0, 50);
  }, [users]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-0 md:p-4 bg-black/90 backdrop-blur-md font-cairo">
      <motion.div 
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        className="relative w-full max-w-md h-full md:h-[90vh] bg-[#020617] border-x border-t border-amber-500/20 rounded-t-[2.5rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col"
        dir="rtl"
      >
        {/* Header Section */}
        <div className="relative shrink-0 pt-12 pb-6 px-6 bg-gradient-to-b from-amber-600/20 via-slate-900 to-[#020617] border-b border-white/5">
          <button onClick={onClose} className="absolute top-6 left-6 p-2 bg-white/5 rounded-full text-white/50 hover:text-white">
            <X size={24} />
          </button>
          
          <div className="flex flex-col items-center">
            <motion.div 
              animate={{ rotateY: [0, 360], scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 4 }}
              className="w-20 h-20 bg-gradient-to-br from-amber-400 to-yellow-600 rounded-full flex items-center justify-center mb-4 shadow-[0_0_40px_rgba(245,158,11,0.4)] border-4 border-amber-300/30"
            >
              <Trophy size={40} className="text-white drop-shadow-lg" fill="currentColor" />
            </motion.div>
            <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-600 uppercase tracking-tighter">قائمة الملوك والداعمين</h2>
            <p className="text-[10px] text-slate-500 font-bold mt-1 tracking-widest uppercase">Global Supporters Leaderboard</p>
          </div>
        </div>

        {/* Podium Area (Top 3) */}
        <div className="flex justify-center items-end gap-2 px-4 py-8 bg-black/20 shrink-0">
          {/* Second Place */}
          {topSupporters[1] && (
            <div className="flex flex-col items-center flex-1">
               <div className="relative mb-2">
                  <div className="w-16 h-16 rounded-full border-2 border-slate-300 overflow-hidden shadow-lg"><img src={topSupporters[1].avatar} className="w-full h-full object-cover" /></div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-slate-300 rounded-full flex items-center justify-center text-black font-black text-[10px]">2</div>
               </div>
               <span className="text-[10px] font-black text-slate-300 truncate w-20 text-center">{topSupporters[1].name}</span>
               <div className="flex items-center gap-0.5 text-yellow-500/80 mt-1">
                  <span className="text-[9px] font-black">{Number(topSupporters[1].wealth).toLocaleString()}</span>
                  <Coins size={8} />
               </div>
            </div>
          )}

          {/* First Place */}
          {topSupporters[0] && (
            <div className="flex flex-col items-center flex-1 -translate-y-4">
               <div className="relative mb-2">
                  <motion.div animate={{ y: [-5, 0, -5] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute -top-6 left-1/2 -translate-x-1/2 text-yellow-400"><Crown size={24} fill="currentColor" /></motion.div>
                  <div className="w-20 h-20 rounded-full border-4 border-amber-500 overflow-hidden shadow-[0_0_25px_rgba(245,158,11,0.5)] scale-110"><img src={topSupporters[0].avatar} className="w-full h-full object-cover" /></div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-black font-black text-xs shadow-lg">1</div>
               </div>
               <span className="text-xs font-black text-white truncate w-24 text-center mt-2">{topSupporters[0].name}</span>
               <div className="flex items-center gap-1 text-yellow-400 mt-1 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                  <span className="text-[10px] font-black">{Number(topSupporters[0].wealth).toLocaleString()}</span>
                  <Coins size={10} />
               </div>
            </div>
          )}

          {/* Third Place */}
          {topSupporters[2] && (
            <div className="flex flex-col items-center flex-1">
               <div className="relative mb-2">
                  <div className="w-16 h-16 rounded-full border-2 border-amber-700 overflow-hidden shadow-lg"><img src={topSupporters[2].avatar} className="w-full h-full object-cover" /></div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-amber-700 rounded-full flex items-center justify-center text-white font-black text-[10px]">3</div>
               </div>
               <span className="text-[10px] font-black text-amber-600 truncate w-20 text-center">{topSupporters[2].name}</span>
               <div className="flex items-center gap-0.5 text-yellow-500/80 mt-1">
                  <span className="text-[9px] font-black">{Number(topSupporters[2].wealth).toLocaleString()}</span>
                  <Coins size={8} />
               </div>
            </div>
          )}
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide bg-gradient-to-b from-black/40 to-[#020617]">
          {topSupporters.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full opacity-30 gap-3">
              <Star size={48} className="text-slate-500" />
              <p className="text-sm font-black">لا توجد بيانات دعم بعد</p>
            </div>
          ) : (
            topSupporters.slice(3).map((supporter, index) => (
              <motion.div 
                key={supporter.id}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white/5 rounded-2xl p-3 flex items-center gap-4 border border-white/5 hover:bg-white/10 transition-all group"
              >
                <div className="w-8 flex justify-center shrink-0">
                  <span className="text-xs font-black text-slate-500">#{index + 4}</span>
                </div>

                <div className="relative shrink-0">
                   <img src={supporter.avatar} className="w-11 h-11 rounded-xl object-cover border border-white/10 shadow-md" alt="" />
                   {supporter.isVip && <div className="absolute -top-1 -right-1 bg-amber-500 text-[6px] font-black p-0.5 rounded-sm shadow-sm">VIP</div>}
                </div>

                <div className="flex-1 min-w-0">
                   <h4 className="text-sm font-black text-white truncate flex items-center gap-1.5">
                     {supporter.name}
                     {supporter.badge && <img src={supporter.badge} className="h-3 object-contain" alt="" />}
                   </h4>
                   <p className="text-[9px] text-slate-500 font-bold">ID: {supporter.customId || supporter.id}</p>
                </div>

                <div className="shrink-0 flex flex-col items-end">
                   <div className="flex items-center gap-1 bg-yellow-500/10 px-2 py-1 rounded-lg border border-yellow-500/20">
                      <span className="text-[11px] font-black text-yellow-500 tracking-tighter">
                        {Number(supporter.wealth || 0).toLocaleString()}
                      </span>
                      <Coins size={10} className="text-yellow-500" />
                   </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="p-4 bg-black/60 border-t border-white/5 text-center flex items-center justify-center gap-2">
           <Sparkles size={12} className="text-amber-500" />
           <p className="text-[8px] text-slate-600 font-bold uppercase tracking-[0.2em]">Vivo Network Royal Ranking System</p>
        </div>
      </motion.div>
    </div>
  );
};

export default GlobalLeaderboardModal;
