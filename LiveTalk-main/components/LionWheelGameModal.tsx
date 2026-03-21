import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, History, Coins, Volume2, VolumeX, HelpCircle, Star, Zap, ChevronLeft, ChevronRight, User as UserIcon } from 'lucide-react';
import WinStrip from './WinStrip';
import { GameSettings } from '../types';

interface LionWheelGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  userCoins: number;
  onUpdateCoins: (newCoins: number) => void;
  gameSettings: GameSettings;
}

const LION_ITEMS = [
  { id: 'chicken', label: 'دجاج', icon: '🍗', multiplier: 45, color: '#f97316' },
  { id: 'octopus', label: 'أخطبوط', icon: '🐙', multiplier: 25, color: '#ec4899' },
  { id: 'fish', label: 'سمك', icon: '🐟', multiplier: 15, color: '#3b82f6' },
  { id: 'meat', label: 'لحم', icon: '🥩', multiplier: 10, color: '#ef4444' },
  { id: 'grapes', label: 'عنب', icon: '🍇', multiplier: 5, color: '#a855f7' },
  { id: 'salad', label: 'سلطة', icon: '🥗', multiplier: 5, color: '#22c55e' },
];

enum GameState {
  BETTING = 'betting',
  SPINNING = 'spinning',
  RESULT = 'result'
}

const LionWheelGameModal: React.FC<LionWheelGameModalProps> = ({ isOpen, onClose, userCoins, onUpdateCoins, gameSettings }) => {
  const [state, setState] = useState<GameState>(GameState.BETTING);
  const [timer, setTimer] = useState(15);
  
  const CHIPS = useMemo(() => gameSettings?.lionChips || [100, 1000, 10000, 100000], [gameSettings?.lionChips]);
  const [selectedChip, setSelectedChip] = useState(CHIPS[0]);
  const [bets, setBets] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<typeof LION_ITEMS>([]);
  const [winner, setWinner] = useState<typeof LION_ITEMS[0] | null>(null);
  const [winAmount, setWinAmount] = useState(0);
  const [selectorRotation, setSelectorRotation] = useState(0); 

  useEffect(() => {
    if (!CHIPS.includes(selectedChip)) {
      setSelectedChip(CHIPS[0]);
    }
  }, [CHIPS, selectedChip]);

  const WHEEL_RADIUS = 90; 
  const POD_WIDTH = 62;
  const POD_HEIGHT = 48;

  useEffect(() => {
    if (history.length === 0) {
      setHistory(Array(4).fill(null).map(() => LION_ITEMS[Math.floor(Math.random() * LION_ITEMS.length)]));
    }
  }, [history.length]);

  useEffect(() => {
    let interval: any;
    if (state === GameState.BETTING) {
      interval = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            setState(GameState.SPINNING);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (state === GameState.SPINNING) {
      startSelection();
    } else if (state === GameState.RESULT) {
      setTimeout(() => {
        setWinner(null);
        setWinAmount(0);
        setBets({});
        setTimer(15); 
        setState(GameState.BETTING);
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [state]);

  const startSelection = () => {
    const bettedIds = Object.keys(bets).filter(id => bets[id] > 0);
    const winRate = gameSettings?.lionWinRate || 35;
    const isWin = (Math.random() * 100) < winRate;
    let winIndex;

    if (isWin && bettedIds.length > 0) {
      const winId = bettedIds[Math.floor(Math.random() * bettedIds.length)];
      winIndex = LION_ITEMS.findIndex(i => i.id === winId);
    } else {
      winIndex = Math.floor(Math.random() * LION_ITEMS.length);
    }

    const winningItem = LION_ITEMS[winIndex];
    const segmentAngle = 360 / LION_ITEMS.length;
    const targetRotation = selectorRotation + 1440 + (winIndex * segmentAngle);
    
    setSelectorRotation(targetRotation);
    setWinner(winningItem);

    setTimeout(() => {
      setHistory(prev => [winningItem, ...prev.slice(0, 3)]);
      if (bets[winningItem.id]) {
        const payout = bets[winningItem.id] * winningItem.multiplier;
        setWinAmount(payout);
        onUpdateCoins(userCoins + payout + bets[winningItem.id]);
      }
      setState(GameState.RESULT);
    }, 5500); 
  };

  const handlePlaceBet = (itemId: string) => {
    if (state !== GameState.BETTING || userCoins < selectedChip) return;
    onUpdateCoins(userCoins - selectedChip);
    setBets(prev => ({ ...prev, [itemId]: (prev[itemId] || 0) + selectedChip }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-0 overflow-hidden bg-black/85 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose}></div>
      
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        className="relative w-full max-w-[360px] h-[90vh] bg-[#38BDF8] shadow-2xl overflow-hidden rounded-[2.5rem] flex flex-col font-cairo border border-white/20"
      >
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#0EA5E9] via-[#7DD3FC] to-[#FFEDD5]"></div>
        
        <AnimatePresence>{state === GameState.RESULT && winAmount > 0 && <WinStrip amount={winAmount} />}</AnimatePresence>

        <div className="relative z-10 flex justify-between items-center p-3 pt-4 px-4">
           <button onClick={onClose} className="w-8 h-8 bg-black/20 rounded-full flex items-center justify-center text-white active:scale-90 border border-white/10"><ChevronLeft size={20} /></button>
           <div className="flex flex-col items-center">
              <div className="flex items-center gap-1.5 text-[8px] font-black text-white bg-black/40 px-3 py-1 rounded-full border border-white/10">
                 <Zap size={10} className="text-yellow-400" /> ROUND: 2025
              </div>
           </div>
           <div className="flex gap-1.5">
              <button className="w-8 h-8 bg-black/20 rounded-full flex items-center justify-center text-white border border-white/10"><Volume2 size={16}/></button>
              <button className="w-8 h-8 bg-black/20 rounded-full flex items-center justify-center text-white border border-white/10"><HelpCircle size={16}/></button>
           </div>
        </div>

        <div className="relative z-10 px-4 flex justify-between items-start mt-1">
           <div className="bg-black/30 backdrop-blur-xl rounded-xl p-1 border border-white/10 w-11 shadow-lg">
              <span className="text-[6px] font-black text-white/50 text-center block mb-0.5 uppercase">History</span>
              <div className="flex flex-col gap-1 items-center">
                 {history.slice(0, 3).map((h, i) => (
                    <div key={i} className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] relative transition-all ${i === 0 ? 'bg-amber-500 border-yellow-300 scale-105 shadow-md' : 'bg-black/20 border-white/5 opacity-60'}`}>
                       {h.icon}
                    </div>
                 ))}
              </div>
           </div>

           <div className="flex-1 flex justify-center px-2">
              <div className="bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-500 rounded-full px-4 py-1 border border-white shadow-lg flex items-center gap-1.5">
                 <Trophy size={10} className="text-amber-800" />
                 <span className="text-amber-950 font-black text-[9px] tracking-tighter italic">BIG WINNER</span>
              </div>
           </div>

           <div className="w-11 flex flex-col items-center">
              <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center shadow-md border-b-2 border-yellow-600">
                 <Trophy size={16} className="text-amber-800" />
              </div>
           </div>
        </div>

        <div className="relative z-10 flex-1 flex items-center justify-center -mt-6">
            <div className="relative w-[65vw] h-[65vw] max-w-[240px] max-h-[240px] flex items-center justify-center">
                
                <AnimatePresence>
                  {state !== GameState.BETTING && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 1.1 }}
                      animate={{ opacity: 1, scale: 1, rotate: selectorRotation }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={state === GameState.SPINNING ? { duration: 5.5, ease: [0.4, 0.0, 0.2, 1] } : { duration: 0.5 }}
                      className="absolute inset-0 z-40 pointer-events-none"
                    >
                       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full">
                          <div 
                             style={{ transform: `translateY(-${WHEEL_RADIUS}px)` }}
                             className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                          >
                             <div 
                                style={{ width: POD_WIDTH + 6, height: POD_HEIGHT + 6 }}
                                className="bg-white/10 backdrop-blur-[1px] border-[3px] border-white rounded-[1.4rem] shadow-[0_0_15px_white,inset_0_0_8px_white] flex items-center justify-center"
                             >
                                <motion.div animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="absolute inset-1 border border-yellow-300/50 rounded-xl" />
                             </div>
                          </div>
                       </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="absolute inset-0">
                   {LION_ITEMS.map((item, idx) => {
                      const angle = (360 / LION_ITEMS.length) * idx;
                      const x = WHEEL_RADIUS * Math.cos((angle - 90) * (Math.PI / 180));
                      const y = WHEEL_RADIUS * Math.sin((angle - 90) * (Math.PI / 180));
                      const isWinning = winner?.id === item.id && state === GameState.RESULT;

                      return (
                        <motion.button
                           key={item.id}
                           onClick={() => handlePlaceBet(item.id)}
                           style={{ x, y }}
                           className={`absolute left-1/2 top-1/2 -ml-8 -mt-8 w-16 h-16 flex flex-col items-center justify-center transition-all ${isWinning ? 'scale-110 z-50' : 'active:scale-95'}`}
                        >
                           <div 
                              style={{ width: POD_WIDTH, height: POD_HEIGHT }}
                              className={`relative bg-white/95 rounded-t-2xl border-b-[3px] border-amber-700 shadow-lg flex items-center justify-center overflow-visible transition-colors ${isWinning ? 'bg-yellow-50 border-yellow-500 ring-2 ring-yellow-400' : ''}`}
                           >
                              <span className="text-2xl filter drop-shadow-md -mt-8">{item.icon}</span>
                              <div className="absolute -right-2 -top-1.5 bg-gradient-to-br from-amber-400 to-amber-600 text-black text-[7px] font-black italic px-1 rounded-md border border-white/20 shadow-sm">x{item.multiplier}</div>
                           </div>
                           <div 
                              style={{ width: POD_WIDTH }}
                              className="h-2.5 bg-gradient-to-b from-amber-700 to-amber-900 rounded-b-xl shadow-md flex items-center justify-center"
                           >
                              {bets[item.id] > 0 && (
                                <motion.span initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="text-[6px] text-yellow-300 font-black">
                                  +{(bets[item.id] >= 1000 ? (bets[item.id]/1000).toFixed(0)+'K' : bets[item.id])}
                                </motion.span>
                              )}
                           </div>
                        </motion.button>
                      );
                   })}
                </div>

                <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                   <div className="w-20 h-20 relative">
                      <div className="w-full h-full rounded-full border-[5px] border-amber-500 bg-[#FED7AA] shadow-[0_0_25px_rgba(217,119,6,0.3)] flex items-center justify-center relative overflow-hidden">
                         <span className="text-4xl filter drop-shadow-lg">🦁</span>
                         <div className="absolute top-0 left-0 right-0 h-5 bg-white/20 -rotate-3"></div>
                      </div>
                      {/* الدائرة البنية المحسنة للعداد */}
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-amber-800 border-2 border-yellow-400 text-yellow-400 w-12 h-12 rounded-full flex flex-col items-center justify-center font-black shadow-md italic leading-none overflow-hidden">
                         {state === GameState.BETTING ? (
                            <>
                               <span className="text-[14px] mb-0.5">{timer}</span>
                               <span className="text-[7px] opacity-80">ثانية</span>
                            </>
                         ) : (
                            <span className="text-[10px]">{state === GameState.SPINNING ? '...' : 'WIN'}</span>
                         )}
                      </div>
                   </div>
                </div>
            </div>
        </div>

        <div className="relative z-20 bg-[#EF4444] rounded-t-[2.5rem] p-3 border-t-4 border-[#FBBF24] flex flex-col gap-3 shadow-[0_-15px_40px_rgba(0,0,0,0.5)] pb-6 mt-auto">
           
           <div className="flex justify-between items-center gap-1.5 bg-black/20 p-1 rounded-full border border-white/5">
              {CHIPS.map(c => (
                 <button 
                   key={c}
                   onClick={() => setSelectedChip(c)}
                   className={`relative flex-1 h-8 rounded-full border transition-all active:scale-95 flex items-center justify-center font-black text-[8px] shadow-md ${selectedChip === c ? 'bg-yellow-400 border-white text-amber-900 scale-105 z-10 shadow-yellow-500/30' : 'bg-black/30 border-white/5 text-white/50'}`}
                 >
                    {c >= 1000 ? (c/1000)+'K' : c}
                    {selectedChip === c && <motion.div layoutId="lion-chip-active" className="absolute inset-0 bg-white/20 rounded-full" />}
                 </button>
              ))}
           </div>

           <div className="flex items-center justify-between gap-2">
              <div className="flex-1 bg-white/95 rounded-2xl p-1.5 px-3 flex items-center gap-2 border-b-4 border-slate-300 shadow-lg min-w-0">
                 <div className="relative w-8 h-8 rounded-full border-2 border-amber-400 overflow-hidden shadow-sm shrink-0">
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=lion_player" className="w-full h-full object-cover" />
                 </div>
                 <div className="flex-1 min-w-0 text-right">
                    <p className="text-[8px] font-black text-slate-700 truncate leading-none mb-0.5">لاعب فيفو</p>
                    <div className="flex items-center gap-1 text-amber-600 font-black text-[10px] justify-end">
                       <span>{userCoins.toLocaleString()}</span>
                       <Coins size={9} fill="currentColor" />
                    </div>
                 </div>
                 <ChevronRight size={12} className="text-slate-300" />
              </div>

              <div className="bg-white/95 rounded-2xl p-1.5 px-3 flex items-center gap-1.5 border-b-4 border-slate-300 shadow-lg active:scale-95 transition-transform shrink-0">
                 <div className="w-6 h-6 bg-amber-50 rounded-lg flex items-center justify-center text-xs shadow-inner">📝</div>
                 <span className="text-slate-700 font-black text-[9px]">History</span>
              </div>
           </div>

           <div className="flex items-center justify-between border-t border-white/10 pt-2 px-1">
              <div className="flex flex-col items-start leading-none">
                 <span className="text-[7px] font-black text-white/40 uppercase mb-0.5">Profit</span>
                 <div className="bg-black/30 px-2 py-0.5 rounded-full border border-white/5 flex items-center gap-1">
                    <span className="text-yellow-400 font-black text-[9px]">{winAmount.toLocaleString()}</span>
                    <Coins size={9} className="text-yellow-500" />
                 </div>
              </div>

              <button 
                className="h-9 px-6 bg-gradient-to-b from-green-600 to-green-700 text-white font-black text-[9px] rounded-xl shadow-lg active:scale-95 transition-all border-b-2 border-green-800 flex flex-col items-center justify-center"
              >
                 AUTO BET
                 <div className="w-4 h-0.5 bg-green-400/30 rounded-full mt-0.5"></div>
              </button>
           </div>

        </div>
      </motion.div>
    </div>
  );
};

export default LionWheelGameModal;