import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Coins, Users, Zap } from 'lucide-react';
import { User } from '../types';

interface LuckyBagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (amount: number, recipients: number) => void;
  userCoins: number;
}

const LuckyBagModal: React.FC<LuckyBagModalProps> = ({ isOpen, onClose, onSend, userCoins }) => {
  const [amount, setAmount] = useState<number>(20000);
  const [recipients, setRecipients] = useState<number>(10);

  if (!isOpen) return null;

  const handleSend = () => {
    if (amount < 20000) {
      alert('الحد الأدنى لدعم الحقيبة هو 20,000 كوينز');
      return;
    }
    if (userCoins < amount) {
      alert('رصيدك لا يكفي لإرسال هذه الحقيبة');
      return;
    }
    onSend(amount, recipients);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm bg-slate-900 border border-amber-500/30 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-amber-900/20"
      >
        <div className="p-6 text-center border-b border-white/5">
           <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-amber-500/20">
              <span className="text-4xl">💰</span>
           </div>
           <h2 className="text-2xl font-black text-amber-500">حقيبة الحظ العالمية</h2>
           <p className="text-xs text-slate-400 mt-1">انشر الفرح في جميع أنحاء بوبو لايف</p>
        </div>

        <div className="p-8 space-y-6">
           <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 px-2 flex items-center gap-2">
                 <Coins size={12} /> إجمالي مبلغ الدعم (الحد الأدنى 20,000)
              </label>
              <div className="relative">
                 <input 
                   type="number" 
                   value={amount}
                   onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value) || 0))}
                   className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-yellow-400 font-black outline-none focus:border-amber-500/50"
                 />
                 <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-slate-500">🪙</span>
              </div>
           </div>

           <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 px-2 flex items-center gap-2">
                 <Users size={12} /> عدد المستلمين المحظوظين
              </label>
              <div className="flex gap-2">
                 {[5, 10, 20, 50].map(num => (
                    <button 
                      key={num}
                      onClick={() => setRecipients(num)}
                      className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${recipients === num ? 'bg-amber-500 text-black shadow-lg shadow-amber-900/40' : 'bg-white/5 text-slate-400'}`}
                    >
                       {num}
                    </button>
                 ))}
                 <input 
                    type="number" 
                    value={recipients}
                    onChange={(e) => setRecipients(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 bg-black/40 border border-white/10 rounded-xl text-center text-white text-xs font-black outline-none"
                 />
              </div>
           </div>

           <div className="bg-black/40 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
              <span className="text-xs text-slate-500">رصيدك الحالي:</span>
              <span className="text-sm font-black text-yellow-500">{userCoins.toLocaleString()} 🪙</span>
           </div>

           <button 
              onClick={handleSend}
              className="w-full py-5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-2xl text-black font-black text-sm shadow-xl shadow-amber-900/40 active:scale-95 transition-all flex items-center justify-center gap-3"
           >
              <Zap size={20} fill="currentColor" /> إطلاق الحقيبة الآن
           </button>
           
           <button onClick={onClose} className="w-full text-slate-500 text-xs font-bold py-2">تراجع</button>
        </div>
      </motion.div>
    </div>
  );
};

export default LuckyBagModal;