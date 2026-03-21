
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Zap, Coins } from 'lucide-react';

interface LuckyBagActiveProps {
  bag: {
    id: string;
    senderName: string;
    totalAmount: number;
    remainingAmount: number;
  };
  onClaim: () => void;
  isClaimed: boolean;
}

const LuckyBagActive: React.FC<LuckyBagActiveProps> = ({ bag, onClaim, isClaimed }) => {
  const [countdown, setCountdown] = useState(10);
  const [status, setStatus] = useState<'waiting' | 'ready'>('waiting');

  useEffect(() => {
    // إذا تم استلام الحقيبة، لا نحتاج لتشغيل المؤقت
    if (isClaimed) return;

    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setStatus('ready');
    }
  }, [countdown, isClaimed]);

  // هام: يجب وضع جملة الإرجاع المبكر (return null) بعد تعريف كافة الـ hooks
  // لضمان توافق عدد استدعاءات الـ hooks في كل عملية رندرة وتجنب خطأ Error #300
  if (isClaimed) return null;

  const handleClick = () => {
    if (status === 'ready') {
      onClaim();
    }
  };

  return (
    <motion.div 
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      className="absolute inset-0 z-[120] flex items-center justify-center pointer-events-none"
    >
      <div className="relative pointer-events-auto">
        {/* Glow Effect */}
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute inset-0 bg-yellow-500 blur-[50px] rounded-full"
        />

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleClick}
          className={`relative w-32 h-32 md:w-40 md:h-40 rounded-full flex flex-col items-center justify-center border-4 shadow-[0_0_30px_rgba(245,158,11,0.5)] overflow-hidden transition-all duration-500 ${
            status === 'ready' 
              ? 'bg-gradient-to-br from-amber-400 via-yellow-300 to-orange-500 border-white' 
              : 'bg-black/60 border-amber-500/50 backdrop-blur-xl'
          }`}
        >
          {status === 'waiting' && (
            <>
              <span className="text-4xl md:text-5xl mb-1">💰</span>
              <span className="text-2xl md:text-3xl font-black text-amber-500 font-mono tracking-tighter">
                {countdown}s
              </span>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">جاري التجهيز</p>
            </>
          )}

          {status === 'ready' && (
            <>
              <motion.div 
                animate={{ rotate: [0, 10, -10, 0] }} 
                transition={{ repeat: Infinity, duration: 0.5 }}
                className="text-5xl md:text-6xl mb-1 drop-shadow-xl"
              >
                🎁
              </motion.div>
              <span className="text-[11px] font-black text-amber-950 uppercase bg-white/40 px-3 py-1 rounded-full border border-white/5 shadow-inner">
                افتح الآن!
              </span>
              <motion.div 
                animate={{ scale: [1, 1.5], opacity: [1, 0] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="absolute inset-0 border-4 border-white rounded-full"
              />
            </>
          )}

          {/* Particle Effects */}
          <div className="absolute inset-0 pointer-events-none opacity-40">
            <div className="bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] w-full h-full"></div>
          </div>
        </motion.button>

        {/* Sender Info Label */}
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/80 border border-amber-500/30 px-4 py-1.5 rounded-full shadow-xl flex items-center gap-2">
           <Zap size={12} className="text-yellow-400" />
           <span className="text-[10px] font-black text-white">هدية من: {bag.senderName}</span>
        </div>
      </div>
    </motion.div>
  );
};

export default LuckyBagActive;
