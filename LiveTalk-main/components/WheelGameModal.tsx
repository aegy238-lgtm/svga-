import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, History, Coins, Volume2, VolumeX } from 'lucide-react';
import { WHEEL_ITEMS as DEFAULT_WHEEL_ITEMS } from '../constants';
import { WheelItem, GameSettings } from '../types';
import WinStrip from './WinStrip';

interface WheelGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  userCoins: number;
  onUpdateCoins: (newCoins: number) => void;
  winRate: number;
  gameSettings: GameSettings;
}

enum GameStatus {
  BETTING = 'betting', 
  SPINNING = 'spinning',
  RESULT = 'result',
}

const WheelGameModal: React.FC<WheelGameModalProps> = ({ isOpen, onClose, userCoins, onUpdateCoins, winRate, gameSettings }) => {
  const [status, setStatus] = useState<GameStatus>(GameStatus.BETTING);
  const [timeLeft, setTimeLeft] = useState(15);
  
  const CHIPS = useMemo(() => gameSettings.wheelChips || [10000, 1000000, 5000000, 20000000], [gameSettings.wheelChips]);
  const [selectedChip, setSelectedChip] = useState(CHIPS[0]);
  const [bets, setBets] = useState<Record<string, number>>({});
  const [rotation, setRotation] = useState(0);
  const [history, setHistory] = useState<WheelItem[]>([]);
  const [winner, setWinner] = useState<WheelItem | null>(null);
  const [totalWinAmount, setTotalWinAmount] = useState(0);

  // Sync selected chip if CHIPS changes
  useEffect(() => {
    if (!CHIPS.includes(selectedChip)) {
      setSelectedChip(CHIPS[0]);
    }
  }, [CHIPS]);

  const dynamicWheelItems = useMemo(() => {
     return DEFAULT_WHEEL_ITEMS.map(item => ({
        ...item,
        multiplier: item.id === '777' ? (gameSettings.wheelJackpotX || 8) : (gameSettings.wheelNormalX || 2)
     }));
  }, [gameSettings.wheelJackpotX, gameSettings.wheelNormalX]);

  useEffect(() => {
    if (history.length === 0) {
      setHistory(Array(8).fill(null).map(() => dynamicWheelItems[Math.floor(Math.random() * dynamicWheelItems.length)]));
    }
  }, [dynamicWheelItems]);

  useEffect(() => {
    let interval: any;
    if (status === GameStatus.BETTING) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setStatus(GameStatus.SPINNING);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } 
    else if (status === GameStatus.SPINNING) {
      spinWheel();
      setTimeout(() => setStatus(GameStatus.RESULT), 7000);
    }
    else if (status === GameStatus.RESULT) {
       setTimeout(() => {
          setWinner(null);
          setTotalWinAmount(0);
          setBets({});
          setTimeLeft(15);
          setStatus(GameStatus.BETTING);
       }, 5000);
    }
    return () => clearInterval(interval);
  }, [status]);

  const placeBet = (itemId: string) => {
    if (status !== GameStatus.BETTING) return;
    if (userCoins < selectedChip) return;
    onUpdateCoins(userCoins - selectedChip);
    setBets(prev => ({ ...prev, [itemId]: (prev[itemId] || 0) + selectedChip }));
  };

  const spinWheel = () => {
    const isWinOutcome = (Math.random() * 100) < (gameSettings.wheelWinRate || 45);
    let randomIndex;
    const bettedIds = Object.keys(bets).filter(id => bets[id] > 0);

    if (isWinOutcome && bettedIds.length > 0) {
      const winId = bettedIds[Math.floor(Math.random() * bettedIds.length)];
      randomIndex = dynamicWheelItems.findIndex(i => i.id === winId);
    } else {
      const loseOptions = dynamicWheelItems.filter(i => !bettedIds.includes(i.id));
      const selectedIndex = loseOptions.length > 0 
        ? dynamicWheelItems.findIndex(i => i.id === loseOptions[Math.floor(Math.random() * loseOptions.length)].id)
        : Math.floor(Math.random() * dynamicWheelItems.length);
      randomIndex = selectedIndex;
    }

    if (randomIndex === -1) randomIndex = 0;
    const winningItem = dynamicWheelItems[randomIndex];
    setWinner(winningItem);
    const segmentAngle = 360 / dynamicWheelItems.length;
    const targetRotation = rotation + 1800 + (360 - (randomIndex * segmentAngle));
    setRotation(targetRotation);
    
    setTimeout(() => {
       setHistory(prev => [winningItem, ...prev.slice(0, 7)]);
       if (bets[winningItem.id]) {
          const winAmount = bets[winningItem.id] * winningItem.multiplier;
          setTotalWinAmount(winAmount); 
          onUpdateCoins(userCoins + winAmount + bets[winningItem.id]); 
       }
    }, 7000);
  };

  const formatChipValue = (val: number) => {
      if (val >= 1000000) return (val / 1000000) + 'M';
      if (val >= 1000) return (val / 1000) + 'K';
      return val;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="relative w-full max-w-[400px] bg-[#1a0b2e] rounded-[30px] border-[3px] border-amber-500 shadow-2xl overflow-hidden flex flex-col" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/stardust.png")' }}>
         <AnimatePresence>{status === GameStatus.RESULT && totalWinAmount > 0 && <WinStrip amount={totalWinAmount} />}</AnimatePresence>
         
         {/* Header */}
         <div className="flex justify-between items-center p-4 bg-black/30 border-b border-white/5">
            <div className="flex gap-1 overflow-hidden h-8 items-center bg-black/40 rounded-full px-3">
               <History size={14} className="text-slate-400 mr-1" />
               {history.map((item, i) => ( 
                  <div key={i} className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] border border-white/10" style={{ backgroundColor: item.color }}>{item.icon}</div> 
               ))}
            </div>
            <button onClick={onClose} className="p-2 bg-red-500/20 text-red-400 rounded-full active:scale-90 transition-transform"><X size={18} /></button>
         </div>

         {/* Timer & Info */}
         <div className="flex justify-center mt-3 relative z-20">
            <div className="bg-black/60 px-6 py-1.5 rounded-full border border-white/5">
               {status === GameStatus.BETTING ? (
                 <span className="text-yellow-400 font-black text-sm animate-pulse tracking-widest uppercase">وقت الرهان: {timeLeft} ثانية</span>
               ) : status === GameStatus.SPINNING ? (
                 <span className="text-green-400 font-black text-sm uppercase">جاري السحب...</span>
               ) : (
                 <div className="flex items-center gap-2">
                    <Trophy size={14} className="text-yellow-500" />
                    <span className="text-white font-black text-sm">{winner?.label} هو الفائز!</span>
                 </div>
               )}
            </div>
         </div>

         {/* Wheel UI */}
         <div className="relative w-64 h-64 mx-auto my-6">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-30 w-6 h-8 filter drop-shadow-lg">
               <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[16px] border-t-yellow-400"></div>
            </div>
            <div className="absolute inset-[-12px] rounded-full border-[6px] border-amber-600/50 bg-[#2e1065] shadow-inner"></div>
            <motion.div 
               className="w-full h-full rounded-full relative overflow-hidden border-[4px] border-yellow-500 shadow-2xl" 
               style={{ background: `conic-gradient(${dynamicWheelItems.map((item, i) => { const start = (i / dynamicWheelItems.length) * 100; const end = ((i + 1) / dynamicWheelItems.length) * 100; return `${item.color} ${start}% ${end}%`; }).join(', ')})` }} 
               animate={{ rotate: rotation }} 
               transition={{ duration: 7, ease: [0.25, 1, 0.5, 1] }}
            >
               {dynamicWheelItems.map((item, i) => { 
                  const angle = (360 / dynamicWheelItems.length) * i + (360 / dynamicWheelItems.length) / 2; 
                  return ( 
                    <div key={i} className="absolute w-full h-full flex justify-center pt-3 top-0 left-0" style={{ transform: `rotate(${angle}deg)` }}>
                       <span className="text-xl transform -rotate-90" style={{ transform: `rotate(${-angle}deg)` }}>{item.icon}</span>
                    </div> 
                  ); 
               })}
               <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
            </motion.div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-amber-500 rounded-full border-4 border-[#1a0b2e] shadow-xl flex items-center justify-center z-10">
               <div className="w-4 h-4 bg-white/20 rounded-full animate-pulse"></div>
            </div>
         </div>

         {/* Betting Controls */}
         <div className="bg-black/60 p-4 pt-6 space-y-4 rounded-t-[2.5rem] border-t border-white/10 mt-auto">
             <div className="flex justify-center gap-2 mb-2">
                 {Array.from(new Set(dynamicWheelItems.map(i => i.id))).map(id => dynamicWheelItems.find(i => i.id === id)!).map((item) => (
                    <button 
                       key={item.id} 
                       onClick={() => placeBet(item.id)} 
                       disabled={status !== GameStatus.BETTING} 
                       className="relative flex-1 h-20 rounded-2xl border-b-4 transition-all active:scale-95 flex flex-col items-center justify-center gap-1 overflow-hidden" 
                       style={{ backgroundColor: `${item.color}20`, borderColor: item.color, boxShadow: `0 4px 0 ${item.color}60` }}
                    >
                       <div className="text-2xl filter drop-shadow-md">{item.icon}</div>
                       <div className="text-[8px] font-black text-white/60">X{item.multiplier}</div>
                       {bets[item.id] > 0 && <div className="absolute top-1 right-1 bg-yellow-400 text-black text-[8px] font-black px-1.5 rounded-full shadow-lg animate-bounce">{formatChipValue(bets[item.id])}</div>}
                    </button>
                 ))}
             </div>

             <div className="flex items-center justify-between">
                 <div className="flex flex-col">
                    <span className="text-[9px] text-slate-500 font-black uppercase mb-1">الرصيد</span>
                    <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-full border border-yellow-500/20 shadow-inner">
                       <span className="text-yellow-400 font-black text-xs">{userCoins.toLocaleString()}</span>
                       <Coins size={12} className="text-yellow-500" />
                    </div>
                 </div>
                 <div className="flex gap-1.5">
                    {CHIPS.map(chip => ( 
                       <button 
                         key={chip} 
                         onClick={() => setSelectedChip(chip)} 
                         className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-[8px] font-black shadow-lg transition-all ${selectedChip === chip ? 'border-yellow-400 scale-110' : 'border-slate-700 bg-slate-800/50'}`}
                       >
                          {formatChipValue(chip)}
                       </button> 
                    ))}
                 </div>
             </div>
         </div>
      </motion.div>
    </div>
  );
};

export default WheelGameModal;