
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet, Gem, Coins, ArrowRightLeft, TrendingUp, Search, UserCheck, CheckCircle2, AlertCircle, Zap } from 'lucide-react';
import { User } from '../types';
import { db } from '../services/firebase';
import { doc, updateDoc, increment, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onExchange: (diamonds: number) => void;
}

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose, user, onExchange }) => {
  const [activeTab, setActiveTab] = useState<'exchange' | 'agent_transfer'>('exchange');
  const [exchangeAmount, setExchangeAmount] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [agentId, setAgentId] = useState<string>('');
  const [targetAgent, setTargetAgent] = useState<User | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // رصيد للعرض الفوري (Optimistic)
  const [displayDiamonds, setDisplayDiamonds] = useState<number>(Number(user.diamonds || 0));

  useEffect(() => {
    setDisplayDiamonds(Number(user.diamonds || 0));
  }, [user.diamonds]);

  // البحث عن الوكيل
  useEffect(() => {
    const search = async () => {
      if (!agentId.trim()) {
        setTargetAgent(null);
        return;
      }
      setIsSearching(true);
      try {
        const q = query(collection(db, 'users'), where('customId', '==', agentId.trim()));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const data = snap.docs[0].data() as User;
          if (data.isAgency) {
            setTargetAgent({ ...data, id: snap.docs[0].id });
          } else {
            setTargetAgent(null);
          }
        } else {
          setTargetAgent(null);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsSearching(false);
      }
    };
    const timer = setTimeout(search, 600);
    return () => clearTimeout(timer);
  }, [agentId]);

  if (!isOpen) return null;

  const MIN_TRANSFER = 70000;
  const CONVERSION_RATE = 80000 / 70000; // الـ 70 ألف تصبح 80 ألف

  const handleExchange = () => {
    const amount = Number(exchangeAmount);
    if (isNaN(amount) || amount <= 0) return;
    if (amount > displayDiamonds) {
      alert('رصيد الألماس غير كافٍ!');
      return;
    }
    onExchange(amount);
    setExchangeAmount('');
  };

  const handleAgentTransfer = async () => {
    const amount = Number(transferAmount);
    if (isNaN(amount) || amount < MIN_TRANSFER) {
      alert(`الحد الأدنى للتحويل هو ${MIN_TRANSFER.toLocaleString()} ألماسة`);
      return;
    }
    if (amount > displayDiamonds) {
      alert('رصيد الألماس غير كافٍ!');
      return;
    }
    if (!targetAgent) return;

    // 1. التحديث الفوري في الواجهة (Optimistic)
    const previousDiamonds = displayDiamonds;
    setDisplayDiamonds(prev => prev - amount);
    setIsProcessing(true);

    try {
      const coinsToAgent = Math.floor(amount * CONVERSION_RATE);
      const batch = writeBatch(db);

      // خصم من المستخدم
      batch.update(doc(db, 'users', user.id), {
        diamonds: increment(-amount)
      });

      // إضافة لرصيد وكالة الوكيل
      batch.update(doc(db, 'users', targetAgent.id), {
        agencyBalance: increment(coinsToAgent)
      });

      await batch.commit();
      
      alert(`تم بنجاح تحويل ${amount.toLocaleString()} ألماسة إلى الوكيل ${targetAgent.name}.\nسيحصل الوكيل على ${coinsToAgent.toLocaleString()} كوينز في رصيده ✅`);
      
      setTransferAmount('');
      setAgentId('');
      setTargetAgent(null);
    } catch (e) {
      setDisplayDiamonds(previousDiamonds);
      alert('فشلت عملية التحويل، يرجى التحقق من اتصالك بالإنترنت');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md font-cairo">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-sm bg-[#0f172a] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="p-6 bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border-b border-white/5 relative text-center">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 text-white/50 hover:text-white transition">
            <X size={20} />
          </button>
          <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-3 border border-indigo-500/30 mx-auto">
            <Wallet size={28} className="text-indigo-400" />
          </div>
          <h2 className="text-xl font-black text-white">محفظتي</h2>
          <div className="flex bg-black/40 p-1 rounded-xl mt-4 w-full border border-white/5">
            <button onClick={() => setActiveTab('exchange')} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${activeTab === 'exchange' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>استبدال كوينز</button>
            <button onClick={() => setActiveTab('agent_transfer')} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${activeTab === 'agent_transfer' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500'}`}>تحويل لوكيل</button>
          </div>
        </div>

        {/* Balances */}
        <div className="p-6 grid grid-cols-2 gap-3">
          <div className="bg-slate-900/50 border border-white/5 p-4 rounded-3xl text-center">
            <div className="flex items-center justify-center gap-1.5 text-yellow-500 mb-1">
              <Coins size={16} />
              <span className="text-[10px] font-bold">الكوينز</span>
            </div>
            <div className="text-lg font-black text-white">{(Number(user.coins || 0)).toLocaleString()}</div>
          </div>
          <div className="bg-slate-900/50 border border-white/5 p-4 rounded-3xl text-center relative overflow-hidden">
            <div className="flex items-center justify-center gap-1.5 text-blue-400 mb-1">
              <Gem size={16} />
              <span className="text-[10px] font-bold">الراتب (ألماس)</span>
            </div>
            <motion.div key={displayDiamonds} initial={{ scale: 1.2 }} animate={{ scale: 1 }} className="text-lg font-black text-white">
              {displayDiamonds.toLocaleString()}
            </motion.div>
          </div>
        </div>

        <div className="px-6 pb-8 overflow-y-auto max-h-[50vh] scrollbar-hide">
          <AnimatePresence mode="wait">
            {activeTab === 'exchange' ? (
              <motion.div key="view-ex" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="bg-slate-900 rounded-[2rem] p-5 border border-white/5">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold text-slate-300">استبدال الراتب بالكوينز</h3>
                    <div className="px-2 py-1 bg-blue-500/10 text-blue-400 text-[8px] font-black rounded-full border border-blue-500/20">نسبة 50%</div>
                  </div>
                  <div className="relative mb-4">
                    <input type="number" placeholder="كمية الألماس..." value={exchangeAmount} onChange={(e) => setExchangeAmount(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pr-12 pl-4 text-sm text-white outline-none focus:border-blue-500/50 text-right font-black" />
                    <Gem size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-400" />
                    <button onClick={() => setExchangeAmount(String(displayDiamonds))} className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-blue-500 bg-blue-500/10 px-2 py-1 rounded-lg">الكل</button>
                  </div>
                  <div className="bg-black/20 rounded-2xl p-4 flex justify-between items-center border border-dashed border-white/10 mb-4">
                    <span className="text-xs font-bold text-slate-400">ستحصل على:</span>
                    <div className="text-lg font-black text-yellow-500">{Math.floor((Number(exchangeAmount) || 0) * 0.5).toLocaleString()} 🪙</div>
                  </div>
                  <button onClick={handleExchange} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 py-4 rounded-2xl text-white font-black text-sm active:scale-95 transition-all">تأكيد الاستبدال فوري</button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="view-ag" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="bg-slate-900 rounded-[2rem] p-5 border border-orange-500/20 space-y-4">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="text-xs font-bold text-orange-400">تحويل الراتب لوكيل</h3>
                    <Zap size={14} className="text-orange-500" />
                  </div>
                  
                  <div className="space-y-3">
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="ID الوكيل..." 
                        value={agentId} 
                        onChange={(e) => setAgentId(e.target.value)} 
                        className="w-full bg-black/40 border border-white/10 rounded-2xl py-3.5 pr-12 text-xs text-white outline-none focus:border-orange-500/50 text-right" 
                      />
                      <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
                      {isSearching && <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>}
                    </div>

                    <AnimatePresence>
                      {targetAgent && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-3 flex items-center gap-3">
                          <img src={targetAgent.avatar} className="w-10 h-10 rounded-xl object-cover border border-orange-500/20" alt="" />
                          <div className="flex-1 text-right">
                             <p className="text-xs font-black text-white truncate">{targetAgent.name}</p>
                             <p className="text-[10px] text-orange-400 font-bold">ID: {targetAgent.customId}</p>
                          </div>
                          <div className="bg-orange-500 p-1 rounded-full shadow-lg"><UserCheck size={12} className="text-black" /></div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="relative">
                      <input 
                        type="number" 
                        placeholder="كمية الألماس (70,000+)..." 
                        value={transferAmount} 
                        onChange={(e) => setTransferAmount(e.target.value)} 
                        className="w-full bg-black/40 border border-white/10 rounded-2xl py-3.5 pr-12 text-xs text-white outline-none focus:border-orange-500/50 text-right font-black" 
                      />
                      <Gem size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-400" />
                    </div>

                    <div className="bg-orange-950/20 p-3 rounded-xl border border-orange-500/10 space-y-1">
                      <div className="flex items-center gap-2 text-orange-500">
                        <AlertCircle size={14} />
                        <p className="text-[9px] font-bold">كل 70 ألف ألماس = 80 ألف للوكيل</p>
                      </div>
                      {Number(transferAmount) >= MIN_TRANSFER && targetAgent && (
                        <div className="flex justify-between items-center text-[10px] font-black text-emerald-400 px-1 mt-1 border-t border-white/5 pt-1">
                          <span>سيصل للوكيل:</span>
                          <span>{Math.floor(Number(transferAmount) * CONVERSION_RATE).toLocaleString()} 🪙</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button 
                    disabled={isProcessing || !targetAgent || Number(transferAmount) < MIN_TRANSFER}
                    onClick={handleAgentTransfer} 
                    className={`w-full py-4 rounded-2xl text-white font-black text-sm active:scale-95 transition-all flex items-center justify-center gap-2 ${!targetAgent || Number(transferAmount) < MIN_TRANSFER ? 'bg-slate-800 text-slate-500' : 'bg-gradient-to-r from-orange-500 to-orange-700 shadow-xl shadow-orange-900/20'}`}
                  >
                    {isProcessing ? 'جاري التحويل...' : <><ArrowRightLeft size={18} /> تحويل للوكيل الآن</>}
                  </button>
                  <p className="text-[8px] text-slate-500 text-center font-bold">بمجرد الضغط سيتم خصم الألماس من راتبك فوراً ومزامنة بيانات الوكيل.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default WalletModal;
