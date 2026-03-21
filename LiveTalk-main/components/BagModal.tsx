import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingBag, Check, MessageSquare, Image as ImageIcon, Coins, Sparkles, Wand2, Trash2, LogIn, Video } from 'lucide-react';
import { StoreItem, User, ItemType } from '../types';

interface BagModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: StoreItem[];
  user: User;
  onBuy: (item: StoreItem) => void;
  onEquip: (item: StoreItem) => void;
}

const BagModal: React.FC<BagModalProps> = ({ isOpen, onClose, items, user, onBuy, onEquip }) => {
  const [activeTab, setActiveTab] = useState<'frame' | 'bubble' | 'entry'>('frame');
  const [actionEffect, setActionEffect] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredItems = items.filter(item => item.type === activeTab);

  const tabs: { id: 'frame' | 'bubble' | 'entry', label: string, icon: any }[] = [
    { id: 'frame', label: 'الإطارات', icon: ImageIcon },
    { id: 'bubble', label: 'الفقاعات', icon: MessageSquare },
    { id: 'entry', label: 'الدخوليات', icon: LogIn }
  ];

  const handleInstantBuy = (item: StoreItem) => {
    const userCoins = Number(user.coins || 0);
    const itemPrice = Number(item.price || 0);

    // فحص أمني إضافي في الواجهة
    if (userCoins < itemPrice) {
      alert('❌ عذراً، رصيدك غير كافٍ لشراء هذا المنتج');
      return;
    }

    setActionEffect(item.id);
    onBuy(item);
    
    setTimeout(() => {
      setActionEffect(null);
    }, 1500);
  };

  const handleInstantEquip = (item: StoreItem) => {
    setActionEffect(item.id);
    onEquip(item);
    setTimeout(() => setActionEffect(null), 1500);
  };

  const handleUnequip = (type: 'frame' | 'bubble' | 'entry') => {
    onEquip({ type, url: '' } as any);
  };

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose}></div>
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-sm bg-gradient-to-br from-[#0f172a] via-[#1a1f35] to-[#020617] rounded-[2.5rem] border border-blue-500/30 shadow-[0_0_60px_rgba(37,99,235,0.25)] overflow-hidden flex flex-col h-[80vh] font-cairo"
        dir="rtl"
      >
        {/* Header Section */}
        <div className="relative p-6 text-center border-b border-white/5 flex-shrink-0 bg-white/5">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 text-white/30 hover:text-white transition-colors active:scale-90">
             <X size={22} />
          </button>
          <div className="inline-block p-3 rounded-2xl bg-blue-600/20 mb-2 border border-blue-500/30 shadow-inner">
             <ShoppingBag size={28} className="text-blue-400" />
          </div>
          <h2 className="text-xl font-black text-white">متجر فيفو المتميز</h2>
          
          <div className="mt-4 bg-black/40 rounded-2xl p-2.5 flex items-center justify-between px-5 border border-white/10">
             <span className="text-[10px] font-black text-slate-500">رصيدك الحالي</span>
             <div className="flex items-center gap-1.5">
                <span className="font-black text-yellow-400 text-sm">
                   {Number(user.coins ?? 0).toLocaleString()}
                </span>
                <Coins size={14} className="text-yellow-500" />
             </div>
          </div>
        </div>

        {/* Tabs Control */}
        <div className="flex p-2.5 gap-2 bg-black/20 flex-shrink-0">
           {tabs.map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 rounded-2xl text-[11px] font-black flex items-center justify-center gap-2 transition-all active:scale-95 ${
                   activeTab === tab.id 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'bg-white/5 text-slate-500 hover:text-slate-300'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
           ))}
        </div>

        {/* Content Grid */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-hide min-h-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
           <div className="grid grid-cols-2 gap-3.5 pb-20">
             {filteredItems.map((item) => {
               const isOwned = Array.isArray(user.ownedItems) && user.ownedItems.includes(item.id);
               const itemPrice = Number(item.price || 0);
               const userCoins = Number(user.coins || 0);
               
               let isEquipped = false;
               if (item.type === 'frame') isEquipped = user.frame === item.url && item.url !== '';
               if (item.type === 'bubble') isEquipped = user.activeBubble === item.url && item.url !== '';
               if (item.type === 'entry') isEquipped = user.activeEntry === item.url && item.url !== '';

               const canAfford = userCoins >= itemPrice;
               const isActivating = actionEffect === item.id;

               return (
                 <div 
                   key={item.id} 
                   className={`relative rounded-[2.2rem] p-3.5 border transition-all duration-300 flex flex-col items-center gap-3 group shadow-xl ${
                     isEquipped 
                       ? 'bg-blue-600/10 border-blue-500/60 ring-1 ring-blue-500/20' 
                       : isOwned 
                          ? 'bg-slate-800/80 border-white/10' 
                          : 'bg-slate-900/40 border-white/5'
                   }`}
                 >
                   {/* Item Preview */}
                   <div className="relative w-20 h-20 flex-shrink-0 flex items-center justify-center bg-black/40 rounded-full shadow-inner border border-white/5 group-hover:scale-105 transition-transform duration-500">
                      {item.type === 'frame' ? (
                         <div className="relative w-16 h-16">
                            <img src={user.avatar} className="absolute inset-1 rounded-full w-[88%] h-[88%] object-cover opacity-30 grayscale" alt="preview" />
                            <img src={item.url} className="absolute inset-0 w-full h-full object-contain drop-shadow-2xl scale-[1.25]" alt={item.name} />
                         </div>
                      ) : item.type === 'bubble' ? (
                         <div 
                           className="w-16 h-12 rounded-xl flex items-center justify-center text-[8px] text-white font-black shadow-lg border border-white/10 overflow-hidden text-center bg-cover bg-center"
                           style={{ backgroundImage: `url(${item.url})` }}
                         >
                            {item.name}
                         </div>
                      ) : (
                         <div className="relative w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center bg-slate-800">
                            <img src={item.thumbnailUrl || item.url} className="w-full h-full object-cover opacity-80" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20"><Video size={16} className="text-white" /></div>
                         </div>
                      )}
                      
                      <AnimatePresence>
                        {isActivating && (
                          <motion.div 
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1.8, opacity: 1 }}
                            exit={{ scale: 2.2, opacity: 0 }}
                            className="absolute inset-0 flex items-center justify-center text-yellow-400 z-30 pointer-events-none"
                          >
                             <Sparkles size={45} fill="currentColor" className="drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                   </div>

                   <div className="text-center w-full">
                      <h3 className="font-black text-[11px] text-white truncate px-1">{item.name}</h3>
                   </div>

                   <div className="w-full mt-auto">
                      {isEquipped ? (
                         <button 
                            onClick={() => handleUnequip(item.type as any)}
                            className="w-full py-2.5 bg-red-500/20 text-red-400 text-[10px] font-black rounded-xl border border-red-500/20 flex items-center justify-center gap-1.5 shadow-inner hover:bg-red-500/30 transition-all active:scale-95"
                         >
                            <Trash2 size={12} /> إزالة
                         </button>
                      ) : isOwned ? (
                         <button 
                            onClick={() => handleInstantEquip(item)}
                            className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white text-[10px] font-black rounded-xl shadow-lg active:scale-90 transition-all border border-white/10 flex items-center justify-center gap-2"
                         >
                            <Wand2 size={12} /> استخدام
                         </button>
                      ) : (
                         <button 
                            disabled={!canAfford}
                            onClick={() => handleInstantBuy(item)}
                            className={`w-full py-2.5 rounded-xl text-[10px] font-black transition-all active:scale-90 flex flex-col items-center justify-center gap-0.5 border ${
                               canAfford 
                                 ? 'bg-gradient-to-r from-amber-400 to-orange-600 text-black border-amber-300 shadow-lg shadow-amber-900/30' 
                                 : 'bg-slate-800 text-slate-500 border-white/5 opacity-50 cursor-not-allowed'
                            }`}
                         >
                            <span className="uppercase tracking-tighter opacity-80">{canAfford ? 'شراء فوراً' : 'رصيد غير كافٍ'}</span>
                            <div className="flex items-center gap-1 text-[12px] font-black">
                               <span>{itemPrice.toLocaleString()}</span>
                               <Coins size={11} fill="currentColor" />
                            </div>
                         </button>
                      )}
                   </div>
                 </div>
               );
             })}
           </div>
        </div>

        <div className="p-3 bg-black/60 border-t border-white/5 text-center flex-shrink-0">
           <p className="text-[8px] text-slate-600 font-bold uppercase tracking-[0.2em]">Vivo Live PWA Official System</p>
        </div>
      </motion.div>
    </div>
  );
};

export default BagModal;