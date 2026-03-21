
import React from 'react';
import { motion } from 'framer-motion';
import { X, Check, Crown, ArrowUpCircle, Coins } from 'lucide-react';
import { VIPPackage, User } from '../types';

interface VIPModalProps {
  user: User;
  vipLevels: VIPPackage[];
  onClose: () => void;
  onBuy: (vip: VIPPackage) => void;
}

const VIPModal: React.FC<VIPModalProps> = ({ user, vipLevels, onClose, onBuy }) => {
  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose}></div>
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-sm bg-gradient-to-br from-slate-900 via-[#1a1f35] to-slate-900 rounded-[2.5rem] border border-amber-500/30 shadow-[0_0_60px_rgba(245,158,11,0.2)] overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="relative p-8 text-center border-b border-white/5 bg-white/5">
          <button onClick={onClose} className="absolute top-6 right-6 p-2 text-white/30 hover:text-white transition active:scale-90">
             <X size={24} />
          </button>
          <div className="inline-block p-4 rounded-full bg-amber-500/10 mb-3 border border-amber-500/20 shadow-inner">
             <Crown size={36} className="text-amber-500" />
          </div>
          <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-600 uppercase tracking-tight">
             مركز العضوية الملكية
          </h2>
          
          <div className="mt-5 bg-black/60 rounded-2xl p-2.5 flex items-center justify-between px-6 border border-white/5">
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">رصيدك الحالي</span>
             <div className="flex items-center gap-1.5">
                <span className="font-black text-yellow-400 text-lg">
                   {(user.coins ?? 0).toLocaleString()}
                </span>
                <Coins size={16} className="text-yellow-500" />
             </div>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
           {vipLevels.length === 0 ? (
             <div className="text-center py-20 text-slate-500 text-xs font-bold">لا توجد مستويات VIP متاحة حالياً.. ترقبوا القادم!</div>
           ) : (
             vipLevels.sort((a,b) => a.level - b.level).map((vip) => {
               const isCurrentLevel = user.isVip && user.vipLevel === vip.level;
               // تم تعديل المنطق: لا يوجد شيء اسمه مستوى "أعلى" يغلق البقية، الجميع متاح للشراء
               const canAfford = Number(user.coins || 0) >= vip.cost;

               return (
                 <div 
                   key={vip.level} 
                   className={`relative rounded-[2.2rem] p-4 border transition-all duration-500 overflow-hidden group ${
                     isCurrentLevel 
                       ? 'bg-amber-950/20 border-amber-500/60 shadow-xl shadow-amber-900/20' 
                       : 'bg-slate-900/60 border-white/10 hover:border-amber-500/30'
                   }`}
                 >
                   <div className="flex items-center gap-5 relative z-10">
                      <div className="relative w-20 h-20 flex-shrink-0">
                         <div className="absolute inset-1 rounded-full border border-white/10 bg-black/40 overflow-hidden">
                            <img src={user.avatar} className="w-full h-full rounded-full opacity-30 grayscale" alt="preview" />
                         </div>
                         <img src={vip.frameUrl} className="absolute inset-0 w-full h-full object-contain pointer-events-none drop-shadow-2xl scale-[1.3] group-hover:scale-[1.4] transition-transform duration-500" alt={vip.name} />
                         <div className="absolute -bottom-1 -right-1 bg-amber-600 text-white text-[9px] px-2 py-0.5 rounded-full border border-white/20 font-black shadow-lg">
                            LV.{vip.level}
                         </div>
                      </div>

                      <div className="flex-1 text-right">
                         <h3 className={`font-black text-xl mb-0.5 ${vip.color}`}>{vip.name}</h3>
                         <p className="text-[10px] text-slate-400 font-bold leading-tight">عضوية ملكية شاملة + إطار حصري</p>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                         {isCurrentLevel ? (
                           <button 
                             onClick={() => {
                               if(confirm(`ترغب في تجديد رتبة ${vip.name} مقابل ${vip.cost.toLocaleString()} كوينز؟`)) {
                                   onBuy(vip);
                               }
                             }}
                             className="px-4 py-2 bg-emerald-500/20 text-emerald-400 text-[10px] font-black rounded-xl flex flex-col items-center gap-0.5 border border-emerald-500/30 active:scale-95"
                           >
                              <span className="flex items-center gap-1"><Check size={12} strokeWidth={3} /> مفعّل</span>
                              <span className="text-[8px] opacity-70">إعادة تفعيل</span>
                           </button>
                         ) : (
                           <button 
                              disabled={!canAfford}
                              onClick={() => {
                                  if(confirm(`تفعيل رتبة ${vip.name} مقابل ${vip.cost.toLocaleString()} كوينز؟`)) {
                                      onBuy(vip);
                                  }
                              }}
                              className={`px-5 py-2.5 rounded-[1.2rem] text-[11px] font-black flex flex-col items-center min-w-[100px] transition-all active:scale-95 shadow-lg ${
                                 canAfford 
                                   ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-black border-t border-white/20' 
                                   : 'bg-slate-700 text-slate-500 opacity-50'
                              }`}
                           >
                              <span className="flex items-center gap-1 mb-0.5 uppercase tracking-tighter">
                                تفعيل <ArrowUpCircle size={12}/>
                              </span>
                              <span className="text-[10px] opacity-90">{vip.cost.toLocaleString()} 🪙</span>
                           </button>
                         )}
                      </div>
                   </div>
                 </div>
               );
             })
           )}
        </div>
        
        <div className="p-4 bg-black/80 border-t border-white/5 text-center flex-shrink-0">
           <p className="text-[8px] text-slate-600 font-bold uppercase tracking-[0.3em]">Vivo Official Royal System</p>
        </div>
      </motion.div>
    </div>
  );
};

export default VIPModal;
