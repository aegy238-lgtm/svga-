import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic } from 'lucide-react';
import { User } from '../../types';

interface SeatProps {
  index: number;
  speaker: User | null;
  onClick: (index: number) => void;
  currentUser: User;
  sizeClass: string;
  customSkin?: string;
  isHost?: boolean;
}

const Seat: React.FC<SeatProps> = ({ index, speaker, onClick, currentUser, sizeClass, customSkin, isHost }) => {
  const isUrlEmoji = speaker?.activeEmoji?.startsWith('http') || speaker?.activeEmoji?.startsWith('data:');

  return (
    <div className={`relative flex items-center justify-center ${sizeClass} shrink-0 overflow-visible`}>
      <button 
        onClick={() => onClick(index)} 
        className="w-full h-full relative group transition-transform active:scale-90 flex items-center justify-center overflow-visible"
      >
        {speaker ? (
          <div className="relative w-full h-full p-0.5 flex flex-col items-center justify-center overflow-visible">
            
            {/* 1. التوهج عند التحدث (Speaking Glow) - الطبقة السفلى */}
            {!speaker.isMuted && (
              <motion.div 
                animate={{ 
                  scale: [1, 1.2, 1], 
                  opacity: [0.4, 0.7, 0.4],
                  boxShadow: [
                    "0 0 0px rgba(251,191,36,0)",
                    "0 0 25px rgba(251,191,36,0.5)",
                    "0 0 0px rgba(251,191,36,0)"
                  ]
                }}
                transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                className="absolute inset-0 z-0 rounded-full bg-amber-400/20"
              />
            )}

            {/* 2. دائرة البروفايل (Avatar) - الطبقة z-10 */}
            <div className={`relative z-10 w-[88%] h-[88%] rounded-full overflow-hidden border bg-slate-900 shadow-2xl flex items-center justify-center ${isHost ? 'border-amber-500/60' : 'border-white/25'}`}>
              <img src={speaker.avatar} className="w-full h-full object-cover" alt={speaker.name} />
            </div>

            {/* 3. الإطارات الملكية - الطبقة z-[120] (فوق الآفاتار وتحت الإيموجي) */}
            {speaker.frame && (
              <img 
                src={speaker.frame} 
                className="absolute inset-0 w-full h-full object-contain z-[120] scale-[1.18] pointer-events-none" 
                alt="VIP Frame"
              />
            )}

            {/* 4. الإيموجي المتحرك - الطبقة z-[130] (أعلى شيء لضمان ظهوره فوق الإطار) */}
            <AnimatePresence mode="wait">
              {speaker.activeEmoji && (
                <motion.div
                  key={`${speaker.id}-${speaker.activeEmoji}`}
                  initial={{ opacity: 0, scale: 0, y: 10 }}
                  animate={{ 
                    opacity: 1, 
                    scale: [0, 1.2, 1.1],
                    y: 0
                  }}
                  exit={{ opacity: 0, scale: 1.5, filter: 'blur(10px)' }}
                  transition={{ type: "spring", damping: 10, stiffness: 200 }}
                  className="absolute inset-0 z-[130] flex items-center justify-center pointer-events-none"
                >
                  <div className="relative w-full h-full flex items-center justify-center">
                    {isUrlEmoji ? (
                       <motion.img 
                         animate={{ y: [0, -5, 0] }}
                         transition={{ repeat: Infinity, duration: 2 }}
                         src={speaker.activeEmoji} 
                         className="w-[95%] h-[95%] object-contain drop-shadow-[0_0_15px_rgba(0,0,0,0.8)] filter brightness-110" 
                         alt="Emoji Reaction" 
                       />
                    ) : (
                       <span className="text-4xl drop-shadow-[0_5px_15px_rgba(0,0,0,0.9)]">
                         {speaker.activeEmoji}
                       </span>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 5. شارة الاسم والكاريزما */}
            <div className="absolute -bottom-7 left-0 right-0 flex flex-col items-center gap-0.5 pointer-events-none z-[140]">
               <span className={`text-[7px] font-black truncate drop-shadow-md px-2 py-0.5 rounded-full max-w-[52px] border leading-none shadow-sm ${isHost ? 'bg-amber-500 text-black border-amber-600' : 'bg-black/80 text-white border-white/10'}`}>
                  {speaker.name}
               </span>
               
               <motion.div 
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 className="flex items-center gap-0.5 px-2 py-0.5 bg-black/70 border border-white/20 rounded-full shadow-xl backdrop-blur-md"
               >
                  <span className="text-white font-black text-[6px] leading-none tracking-tighter">
                     {(Number(speaker.charm || 0)).toLocaleString()}
                  </span>
                  <div className={`w-0.5 h-0.5 rounded-full animate-pulse ${isHost ? 'bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,1)]' : 'bg-white shadow-[0_0_5px_white]'}`}></div>
               </motion.div>
            </div>
          </div>
        ) : (
          /* المقاعد الفارغة */
          <div className="w-full h-full relative flex items-center justify-center">
            {customSkin ? (
               <img src={customSkin} className="w-full h-full object-contain filter drop-shadow-lg group-hover:scale-110 transition-all opacity-85" alt="Mic Skin" />
            ) : (
              <div className="w-full h-full rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-inner group-hover:bg-white/20 transition-all">
                 <span className="text-lg filter grayscale opacity-40"> 🎙️ </span>
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
               <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md border border-white/30">
                  <Mic size={12} className="text-white" />
               </div>
            </div>
          </div>
        )}
      </button>
    </div>
  );
};

export default Seat;