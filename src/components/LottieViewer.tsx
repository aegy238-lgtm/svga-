import React, { useState, useEffect, useRef } from 'react';
import lottie from 'lottie-web';
import { motion, AnimatePresence } from 'motion/react';
import { X, Play, Pause, RotateCcw, Download, Info } from 'lucide-react';

// Custom Lottie Player component to avoid lottie-react hook issues in React 19
const LottiePlayer: React.FC<{ 
    animationData: any; 
    loop?: boolean; 
    autoplay?: boolean; 
    className?: string;
    animKey?: number;
}> = ({ animationData, loop = true, autoplay = true, className, animKey }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const animRef = useRef<any>(null);

    useEffect(() => {
        if (containerRef.current && animationData) {
            // Destroy previous animation if it exists
            if (animRef.current) {
                animRef.current.destroy();
            }

            animRef.current = lottie.loadAnimation({
                container: containerRef.current,
                renderer: 'svg',
                loop: loop,
                autoplay: autoplay,
                animationData: animationData
            });

            return () => {
                if (animRef.current) {
                    animRef.current.destroy();
                }
            };
        }
    }, [animationData, loop, autoplay, animKey]);

    return <div ref={containerRef} className={className} />;
};

interface LottieViewerProps {
  animationData: any;
  onClose: () => void;
  fileName?: string;
}

export const LottieViewer: React.FC<LottieViewerProps> = ({ animationData, onClose, fileName }) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [key, setKey] = useState(0);

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(animationData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'animation.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 sm:p-8"
    >
      <div className="relative w-full max-w-4xl bg-slate-900/50 rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-bottom border-white/5 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/20 flex items-center justify-center border border-sky-500/30">
              <Play className="text-sky-400" size={24} />
            </div>
            <div>
              <h2 className="text-white font-black text-xl uppercase tracking-tight">معاينة Lottie Quantum</h2>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{fileName || 'animation.json'}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col items-center justify-center p-8 relative">
          <div className="w-full h-full max-w-md aspect-square relative transparency-bg rounded-3xl overflow-hidden border border-white/5 shadow-inner">
            <LottiePlayer 
              animKey={key}
              animationData={animationData} 
              loop={true}
              autoplay={isPlaying}
              className="w-full h-full"
            />
          </div>
          
          {/* Controls */}
          <div className="mt-8 flex items-center gap-4 bg-black/40 p-2 rounded-2xl border border-white/10">
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-12 h-12 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-all"
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button 
              onClick={() => setKey(prev => prev + 1)}
              className="w-12 h-12 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-all"
            >
              <RotateCcw size={20} />
            </button>
            <div className="h-8 w-px bg-white/10 mx-2" />
            <button 
              onClick={handleDownload}
              className="px-6 py-3 bg-sky-500 text-white rounded-xl text-xs font-black uppercase shadow-glow-sky flex items-center gap-2"
            >
              <Download size={16} /> تحميل الملف
            </button>
          </div>
        </div>

        {/* Info Footer */}
        <div className="p-6 bg-black/20 border-t border-white/5 flex items-center gap-3">
          <Info className="text-sky-400" size={16} />
          <p className="text-[10px] text-slate-500 font-bold uppercase leading-relaxed">
            تنبيه: هذه المعاينة تستخدم محرك Lottie القياسي. إذا كانت هناك مشاكل في الحركة أو الطبقات، يرجى التأكد من أن ملف SVGA الأصلي سليم.
          </p>
        </div>
      </div>
    </motion.div>
  );
};
