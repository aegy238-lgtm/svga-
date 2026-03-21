import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Zap, Coins, UserCheck, Smartphone } from 'lucide-react';
import { User } from '../types';

interface AgencyRechargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentUser: User;
  users: User[];
  onCharge: (targetId: string, amount: number) => void;
}

const AgencyRechargeModal: React.FC<AgencyRechargeModalProps> = ({ isOpen, onClose, agentUser, users, onCharge }) => {
  const [targetSearch, setTargetSearch] = useState('');
  const [selectedTarget, setSelectedTarget] = useState<User | null>(null);
  const [chargeAmount, setChargeAmount] = useState<string>('');

  if (!isOpen) return null;

  const filteredUsers = targetSearch.trim() === '' ? [] : users.filter(u => 
    u.customId?.toString() === targetSearch || u.id === targetSearch
  ).slice(0, 3);

  const handleCharge = () => {
    if (!selectedTarget || !chargeAmount) return;
    const amount = parseInt(chargeAmount);
    if (isNaN(amount) || amount <= 0) return;
    
    // التحقق من الرصيد
    if ((agentUser.agencyBalance || 0) < amount) {
      alert('رصيد الوكالة لا يكفي!');
      return;
    }
    
    // تنفيذ الشحن فوراً
    onCharge(selectedTarget.id, amount);
    setChargeAmount('');
    setSelectedTarget(null);
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-sm bg-[#0c101b] border border-orange-500/30 rounded-[2.5rem] overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="p-6 bg-gradient-to-br from-orange-600/20 to-orange-900/20 border-b border-white/5 relative text-center">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 text-white/50 hover:text-white transition">
            <X size={20} />
          </button>
          <div className="w-16 h-16 bg-orange-500/20 rounded-2xl flex items-center justify-center mb-3 border border-orange-500/30 mx-auto">
            <Zap size={32} className="text-orange-500" />
          </div>
          <h2 className="text-xl font-black text-white">مركز الوكالة</h2>
          <p className="text-[10px] text-orange-500/70 font-black uppercase tracking-widest mt-1">توزيع كوينز فيفو لايف</p>
        </div>

        {/* Agency Info */}
        <div className="px-6 pt-6">
           <div className="bg-black/40 rounded-2xl p-4 border border-white/5 flex justify-between items-center">
              <div className="flex flex-col">
                 <span className="text-[9px] font-black text-slate-500 uppercase">رصيد وكالتك المتاح</span>
                 <span className="text-lg font-black text-yellow-500">{(agentUser.agencyBalance || 0).toLocaleString()} <span className="text-xs">🪙</span></span>
              </div>
              <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center"><Coins size={20} className="text-orange-500" /></div>
           </div>
        </div>

        {/* Search Target */}
        <div className="p-6 space-y-5 text-right">
           <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 pr-2">البحث عن المستخدم (الآيدي):</label>
              <div className="relative">
                 <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                 <input 
                   type="text" 
                   value={targetSearch}
                   onChange={(e) => setTargetSearch(e.target.value)}
                   className="w-full bg-black/60 border border-white/5 rounded-2xl py-4 pr-12 pl-4 text-sm text-white outline-none focus:border-orange-500/50"
                   placeholder="ادخل الآيدي هنا..."
                 />
              </div>

              {filteredUsers.length > 0 && (
                 <div className="mt-2 bg-slate-900 border border-white/5 rounded-xl overflow-hidden shadow-xl">
                    {filteredUsers.map(u => (
                       <button key={u.id} onClick={() => { setSelectedTarget(u); setTargetSearch(''); }} className="w-full p-3 flex items-center gap-3 hover:bg-white/5 border-b border-white/5 last:border-0 text-right">
                          <img src={u.avatar} className="w-10 h-10 rounded-lg object-cover" />
                          <div className="flex-1">
                             <div className="text-xs font-black text-white">{u.name}</div>
                             <div className="text-[9px] text-slate-500">ID: {u.customId || u.id}</div>
                          </div>
                          <UserCheck size={16} className="text-emerald-500" />
                       </button>
                    ))}
                 </div>
              )}
           </div>

           {/* Selected Target UI */}
           <AnimatePresence>
              {selectedTarget && (
                 <motion.div 
                   initial={{ opacity: 0, scale: 0.9 }} 
                   animate={{ opacity: 1, scale: 1 }} 
                   exit={{ opacity: 0, scale: 0.9 }}
                   className="bg-orange-500/5 border border-orange-500/20 rounded-3xl p-5 space-y-5"
                 >
                    <div className="flex items-center gap-3">
                       <img src={selectedTarget.avatar} className="w-12 h-12 rounded-xl object-cover" />
                       <div className="flex-1">
                          <div className="text-sm font-black text-white">{selectedTarget.name}</div>
                          <div className="text-[10px] text-orange-500 font-bold">ID: {selectedTarget.customId || selectedTarget.id}</div>
                       </div>
                       <button onClick={() => setSelectedTarget(null)} className="p-1 text-slate-600"><X size={16}/></button>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-500">مبلغ الشحن:</label>
                       <div className="relative">
                          <input 
                            type="number"
                            value={chargeAmount}
                            onChange={(e) => setChargeAmount(e.target.value)}
                            className="w-full bg-black/60 border border-white/10 rounded-2xl py-4 px-6 text-center text-xl font-black text-yellow-500 outline-none"
                            placeholder="0"
                          />
                          <Coins size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700" />
                       </div>
                    </div>

                    <button 
                      disabled={!chargeAmount}
                      onClick={handleCharge}
                      className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl text-black font-black text-sm shadow-xl shadow-orange-900/40 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                       <Smartphone size={18} /> شحن فوراً
                    </button>
                 </motion.div>
              )}
           </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default AgencyRechargeModal;