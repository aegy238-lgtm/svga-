
import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, RefreshCw, Coins } from 'lucide-react';
import { SLOT_ITEMS as DEFAULT_SLOT_ITEMS } from '../constants';
import { SlotItem, GameSettings } from '../types';
import WinStrip from './WinStrip';

interface SlotsGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  userCoins: number;
  onUpdateCoins: (newCoins: number) => void;
  winRate: number;
  gameSettings: GameSettings;
}

const SlotsGameModal: React.FC<SlotsGameModalProps> = ({ isOpen, onClose, userCoins, onUpdateCoins, winRate, gameSettings }) => {
  const [spinning, setSpinning] = useState(false);
  const CHIPS = useMemo(() => gameSettings.slotsChips || [10000, 1000000, 5000000, 20000000], [gameSettings.slotsChips]);
  const [bet, setBet] = useState(CHIPS[0]);
  const [winAmount, setWinAmount] = useState(0);

  useEffect(() => {
    if (!CHIPS.includes(bet)) {
      setBet(CHIPS[0]);
    }
  }, [CHIPS]);

  const dynamicSlotItems = useMemo(() => {
     return DEFAULT_SLOT_ITEMS.map(item => ({
        ...item,
        multiplier: (item.id === 'seven' || item.id === 'diamond') ? (gameSettings.slotsSevenX || 20) : (gameSettings.slotsFruitX || 5)
     }));
  }, [gameSettings.slotsSevenX, gameSettings.slotsFruitX]);

  const [reels, setReels] = useState<SlotItem[]>([dynamicSlotItems[0], dynamicSlotItems[0], dynamicSlotItems[0]]);

  const spin = () => {
    if (userCoins < bet || spinning) return;
    setSpinning(true);
    setWinAmount(0);
    onUpdateCoins(userCoins - bet); 

    setTimeout(() => {
        const isWin = (Math.random() * 100) < (gameSettings.slotsWinRate || 35);
        let finalReels: SlotItem[] = [];
        if (isWin) {
            const item = dynamicSlotItems[Math.floor(Math.random() * dynamicSlotItems.length)];
            finalReels = [item, item, item];
            const payout = bet * item.multiplier;
            setWinAmount(payout);
            onUpdateCoins((userCoins - bet) + payout + bet); 
        } else {
            const r1 = dynamicSlotItems[Math.floor(Math.random() * dynamicSlotItems.length)];
            const r2 = dynamicSlotItems[Math.floor(Math.random() * dynamicSlotItems.length)];
            let r3 = dynamicSlotItems[Math.floor(Math.random() * dynamicSlotItems.length)];
            while(r1.id === r2.id && r2.id === r3.id) { 
               r3 = dynamicSlotItems[Math.floor(Math.random() * dynamicSlotItems.length)]; 
            }
            finalReels = [r1, r2, r3];
        }
        setReels(finalReels);
        setSpinning(false);
    }, 2000);
  };

  const formatValue = (val: number) => {
      if (val >= 1000000) return (val / 1000000) + 'M';
      if (val >= 1000) return (val / 1000) + 'K';
      return val;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose}></div>
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="relative w-full max-w-[380px] bg-gradient-to-b from-purple-950 to-[#120626] rounded-[35px] border-[4px] border-pink-500 shadow-2xl p-6 flex flex-col overflow-hidden">
        <AnimatePresence>{winAmount > 0 && <WinStrip amount={winAmount} />}</AnimatePresence>
        <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white active:scale-90 transition-all"><X size={22} /></button>
        
        <div className="text-center mb-8 pt-4">
            <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-white to-purple-400 uppercase tracking-tighter italic">Slots Machine</h2>
            <p className="text-[10px] text-pink-300 font-black tracking-widest mt-1">اربح حتى x20 من رهانك!</p>
        </div>

        {/* Reels Container */}
        <div className="bg-black/50 p-4 rounded-[2.5rem] border-2 border-pink-500/20 flex justify-between gap-2.5 mb-8 shadow-inner relative overflow-hidden h-40">
             <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-red-500/40 z-10 shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
             {[0, 1, 2].map((i) => (
                 <div key={i} className="flex-1 bg-slate-50 rounded-2xl flex items-center justify-center text-5xl overflow-hidden relative shadow-inner">
                     {spinning ? (
                       <motion.div animate={{ y: [0, -100] }} transition={{ duration: 0.1, repeat: Infinity, ease: "linear" }} className="flex flex-col gap-8 blur-sm">
                          <span className="filter grayscale opacity-70">🍒</span><span className="filter grayscale opacity-70">💎</span><span className="filter grayscale opacity-70">🍋</span>
                       </motion.div>
                     ) : (
                       <motion.div key={reels[i].id} initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="drop-shadow-2xl">
                          {reels[i].icon}
                       </motion.div>
                     )}
                     <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/10 pointer-events-none"></div>
                 </div>
             ))}
        </div>

        <div className="h-10 mb-6 flex items-center justify-center">
          {winAmount > 0 && (
             <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1.2 }} className="text-yellow-400 font-black text-xl flex items-center gap-2 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]">
                <Trophy size={18} className="text-yellow-500" /> فوز ضخم!
             </motion.div>
          )}
        </div>

        <div className="space-y-6">
             <div className="flex justify-between items-center bg-black/40 p-3 rounded-2xl border border-white/5">
                 <span className="text-slate-500 text-[10px] font-black uppercase tracking-tighter">مبلغ الرهان:</span>
                 <div className="flex gap-1.5">
                     {CHIPS.map(c => ( 
                       <button 
                        key={c} 
                        onClick={() => setBet(c)} 
                        disabled={spinning} 
                        className={`px-2.5 py-1.5 rounded-xl text-[9px] font-black transition-all ${bet === c ? 'bg-pink-600 text-white shadow-lg' : 'bg-white/5 text-slate-400'}`}
                       >
                          {formatValue(c)}
                       </button> 
                     ))}
                 </div>
             </div>
             
             <div className="flex justify-between items-center gap-4">
                 <div className="flex flex-col">
                    <span className="text-[9px] text-slate-500 font-black uppercase mb-1">الرصيد المتاح</span>
                    <div className="flex items-center gap-1.5 text-yellow-400 font-black text-lg">
                       {userCoins.toLocaleString()} <Coins size={16} />
                    </div>
                 </div>
                 <button 
                   onClick={spin} 
                   disabled={spinning || userCoins < bet} 
                   className={`h-16 flex-1 rounded-[1.8rem] font-black text-xl flex items-center justify-center gap-2 transition-all shadow-xl active:scale-95 ${spinning || userCoins < bet ? 'bg-slate-800 text-slate-600' : 'bg-gradient-to-b from-green-400 to-green-600 text-white hover:brightness-110 shadow-green-900/40'}`}
                 >
                    {spinning ? <RefreshCw className="animate-spin" size={24} /> : 'SPIN'}
                 </button>
             </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SlotsGameModal;
