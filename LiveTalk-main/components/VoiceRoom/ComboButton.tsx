
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift } from '../../types';
import { Zap } from 'lucide-react';

interface ComboButtonProps {
  gift: Gift;
  count: number;
  onHit: () => void;
  duration: number; // 5000ms
}

const ComboButton: React.FC<ComboButtonProps> = ({ gift, count, onHit, duration }) => {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    setTimeLeft(duration);
  }, [count, duration]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 50));
    }, 50);
    return () => clearInterval(timer);
  }, []);

  const renderGiftIcon = () => {
    const isImage = gift.icon.includes('http') || gift.icon.includes('data:image') || gift.icon.includes('base64');
    if (isImage) {
      return <img src={gift.icon} className="w-14 h-14 object-contain drop-shadow-xl" alt="" />;
    }
    return <span className="text-4xl drop-shadow-xl">{gift.icon}</span>;
  };

  return (
    <motion.div 
      initial={{ scale: 0, rotate: -45, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      exit={{ scale: 0, rotate: 45, opacity: 0 }}
      className="fixed bottom-36 right-8 z-[200] flex flex-col items-center"
    >
      {/* تم حذف عداد الضربات الطائر العلوي لتنظيف الواجهة */}
      
      <button 
        onClick={onHit}
        className="relative w-24 h-24 flex items-center justify-center group active:scale-90 transition-transform"
      >
        <div className="relative w-20 h-20 bg-[#1a1c2e] rounded-full flex flex-col items-center justify-center border-2 border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden group-hover:bg-[#252845] transition-colors">
           <motion.div 
             animate={{ opacity: [0.05, 0.15, 0.05] }} 
             transition={{ repeat: Infinity, duration: 1.5 }}
             className="absolute inset-0 bg-white/5"
           />
           
           <div className="relative z-10 transform group-hover:scale-110 transition-transform duration-300">
              {renderGiftIcon()}
           </div>

           <div className="absolute bottom-1.5 bg-amber-500 text-black font-black text-[7px] px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-lg">
              <Zap size={6} fill="currentColor" /> COMBO X{count}
           </div>
        </div>

        <AnimatePresence>
           {timeLeft < 1500 && (
             <motion.div 
               initial={{ opacity: 0, scale: 1 }}
               animate={{ opacity: [0, 0.2, 0], scale: 1.2 }}
               exit={{ opacity: 0 }}
               transition={{ repeat: Infinity, duration: 0.5 }}
               className="absolute inset-0 bg-red-500 rounded-full pointer-events-none"
             />
           )}
        </AnimatePresence>
      </button>
    </motion.div>
  );
};

export default ComboButton;
