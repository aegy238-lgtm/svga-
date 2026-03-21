
import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface WinStripProps {
  amount: number;
}

const WinStrip: React.FC<WinStripProps> = ({ amount }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  
  useEffect(() => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3');
    audio.volume = 0.4;
    audio.loop = true;
    audioRef.current = audio;

    return () => {
      if (playPromiseRef.current) {
         playPromiseRef.current.then(() => {
            audio.pause();
            audio.currentTime = 0;
         }).catch(() => {});
      } else {
         audio.pause();
         audio.currentTime = 0;
      }
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio && amount >= 5000) {
      if (audio.paused) {
         playPromiseRef.current = audio.play();
         playPromiseRef.current.catch(err => {
            console.warn("Audio play blocked", err);
         });
      }
    }
  }, [amount]);

  return (
    <motion.div 
      initial={{ y: -120, x: "-50%", opacity: 0, scale: 0.5 }}
      animate={{ y: 0, x: "-50%", opacity: 1, scale: 1 }}
      exit={{ y: -60, x: "-50%", opacity: 0, scale: 0.8 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="fixed top-[15vh] left-1/2 z-[200] flex items-center justify-center pointer-events-none w-max"
    >
      <div className="relative bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-500 px-6 md:px-10 py-1.5 md:py-2.5 rounded-full border-2 border-white/70 shadow-[0_10px_40px_rgba(251,191,36,0.6)] flex items-center gap-3 overflow-hidden">
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-40 mix-blend-overlay"></div>
         
         <motion.span 
           animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }} 
           transition={{ repeat: Infinity, duration: 0.6 }}
           className="text-xl md:text-2xl z-10"
         >
           ✨
         </motion.span>
         
         <div className="flex flex-col items-center leading-tight z-10">
            <span className="text-[8px] md:text-[10px] font-black text-amber-900 uppercase tracking-widest mb-0.5 drop-shadow-sm">BIG WINNER</span>
            <span className="font-black text-lg md:text-2xl text-red-600 drop-shadow-sm font-mono tracking-tighter italic">
               +{amount.toLocaleString()} 🪙
            </span>
         </div>

         <motion.span 
           animate={{ rotate: [0, -15, 15, 0], scale: [1, 1.2, 1] }} 
           transition={{ repeat: Infinity, duration: 0.6 }}
           className="text-xl md:text-2xl z-10"
         >
           ✨
         </motion.span>
      </div>
      
      {/* Background Glow */}
      <div className="absolute inset-0 bg-yellow-400 blur-2xl opacity-50 -z-10 rounded-full animate-pulse scale-150"></div>
    </motion.div>
  );
};

export default WinStrip;
