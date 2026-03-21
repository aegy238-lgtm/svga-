
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Coins, ChevronDown, Check, Star, Flame, Trophy, Gift as GiftIcon, Video, Image as ImageIcon } from 'lucide-react';
import { Gift, User } from '../types';

interface GiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  gifts: Gift[];
  userCoins: number;
  speakers: User[];
  selectedRecipientIds: string[];
  onSelectRecipient: (ids: string[]) => void;
  onSend: (gift: Gift, quantity: number) => void;
  categoryLabels?: {
    popular: string;
    exclusive: string;
    lucky: string;
    trend: string;
  };
}

const QUANTITIES = [1, 10, 77, 99, 188, 520, 999, 1314];

const GiftModal: React.FC<GiftModalProps> = ({
  isOpen, onClose, gifts, userCoins, speakers, selectedRecipientIds, onSelectRecipient, onSend,
  categoryLabels
}) => {
  const [activeTab, setActiveTab] = useState<Gift['category']>('popular');
  const [selectedGift, setSelectedGift] = useState<Gift | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [showQtyDropdown, setShowQtyDropdown] = useState(false);

  if (!isOpen) return null;

  const labels = categoryLabels || {
    popular: 'شائع',
    exclusive: 'حصري',
    lucky: 'الحظ',
    trend: 'ترند'
  };

  const filteredGifts = gifts.filter(g => g.category === activeTab || (!g.category && activeTab === 'popular'));

  const isVideoUrl = (url: string) => {
    if (!url) return false;
    return url.match(/\.(mp4|webm|ogg|mov|m4v)$/i) || url.includes('video');
  };

  const toggleRecipient = (id: string) => {
    if (selectedRecipientIds.includes(id)) {
      onSelectRecipient(selectedRecipientIds.filter(rid => rid !== id));
    } else {
      onSelectRecipient([...selectedRecipientIds, id]);
    }
  };

  const selectAll = () => {
    onSelectRecipient(speakers.map(s => s.id));
  };

  const handleSend = () => {
    if (!selectedGift) return;
    if (selectedRecipientIds.length === 0) return alert('اختر مستلماً أولاً');
    onSend(selectedGift, quantity);
  };

  const renderIcon = (gift: Gift) => {
    const iconUrl = gift.catalogIcon || gift.icon || '';
    if (!iconUrl) return <ImageIcon className="text-slate-700" size={24} />;
    
    if (isVideoUrl(iconUrl)) {
      return (
        <div className="relative w-full h-full flex items-center justify-center">
           <Video size={32} className="text-pink-500 opacity-40 absolute z-0" />
           <video src={iconUrl} muted className="w-full h-full object-contain relative z-10" />
        </div>
      );
    }
    const isImage = iconUrl.includes('http') || iconUrl.includes('data:image') || iconUrl.includes('base64');
    if (isImage) {
      return <img src={iconUrl} className="w-full h-full object-contain drop-shadow-md" alt="gift" />;
    }
    return <span className="text-3xl drop-shadow-md">{iconUrl}</span>;
  };

  const tabs: { id: Gift['category']; label: string; icon: any }[] = [
    { id: 'popular', label: labels.popular, icon: Flame },
    { id: 'exclusive', label: labels.exclusive, icon: Star },
    { id: 'lucky', label: labels.lucky, icon: Trophy },
    { id: 'trend', label: labels.trend, icon: Star },
  ];

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center pointer-events-none">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose} 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" 
      />
      
      <motion.div 
        initial={{ y: "100%" }} 
        animate={{ y: 0 }} 
        exit={{ y: "100%" }} 
        className="relative w-full max-w-md bg-[#0a0a0b] rounded-t-[2.5rem] border-t border-white/10 flex flex-col h-[70vh] pointer-events-auto shadow-2xl overflow-hidden"
      >
        <div className="p-4 border-b border-white/5 bg-white/5">
           <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                 <Users size={12} /> إرسال إلى:
              </span>
              <button onClick={selectAll} className="text-[10px] font-black text-amber-500">اختيار الكل</button>
           </div>
           <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {speakers.map(speaker => (
                 <button 
                  key={speaker.id} 
                  onClick={() => toggleRecipient(speaker.id)}
                  className="flex flex-col items-center gap-1 shrink-0 group relative"
                 >
                    <div className={`w-12 h-12 rounded-full p-0.5 border-2 transition-all ${selectedRecipientIds.includes(speaker.id) ? 'border-amber-500 scale-110' : 'border-transparent opacity-60'}`}>
                       <img src={speaker.avatar} className="w-full h-full rounded-full object-cover" alt="" />
                    </div>
                    <span className="text-[8px] text-white font-bold truncate max-w-[48px]">{speaker.name}</span>
                 </button>
              ))}
           </div>
        </div>

        <div className="flex border-b border-white/5">
           {tabs.map(tab => (
              <button 
                key={tab.id} 
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-4 text-[11px] font-black transition-all relative ${activeTab === tab.id ? 'text-white' : 'text-slate-500'}`}
              >
                 {tab.label}
                 {activeTab === tab.id && <motion.div layoutId="tab-active" className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />}
              </button>
           ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-4 gap-3 scrollbar-hide">
           {filteredGifts.map(gift => (
              <button 
                key={gift.id} 
                onClick={() => setSelectedGift(gift)}
                className={`flex flex-col items-center gap-1 p-2 rounded-2xl border transition-all relative group h-28 ${selectedGift?.id === gift.id ? 'bg-amber-500/10 border-amber-500/50 shadow-lg' : 'bg-white/5 border-transparent hover:bg-white/10'}`}
              >
                 <div className="w-14 h-14 flex items-center justify-center group-hover:scale-110 transition-transform mb-1 overflow-hidden rounded-xl bg-black/20">
                    {renderIcon(gift)}
                 </div>
                 <span className="text-[9px] font-black text-white truncate w-full text-center">{gift.name}</span>
                 <div className="flex items-center gap-0.5 mt-auto">
                    <span className="text-[9px] font-bold text-yellow-500">{gift.cost}</span>
                    <Coins size={8} className="text-yellow-500" />
                 </div>
              </button>
           ))}
        </div>

        <div className="p-4 bg-black/60 border-t border-white/5 flex items-center justify-between gap-4">
           <div className="flex flex-col">
              <span className="text-[9px] text-slate-500 font-bold mb-0.5 uppercase tracking-tighter">رصيدك الحالي</span>
              <div className="flex items-center gap-1">
                 <span className="text-lg font-black text-yellow-500 tracking-tight">
                   {Number(userCoins || 0).toLocaleString()}
                 </span>
                 <Coins size={14} className="text-yellow-500" />
              </div>
           </div>

           <div className="flex gap-2 flex-1">
              <div className="relative">
                 <button 
                   onClick={() => setShowQtyDropdown(!showQtyDropdown)}
                   className="h-12 px-3 bg-white/5 border border-white/10 rounded-xl text-white font-black text-xs flex items-center gap-2"
                 >
                    x{quantity} <ChevronDown size={14} />
                 </button>
                 <AnimatePresence>
                   {showQtyDropdown && (
                     <motion.div 
                       initial={{ opacity: 0, y: 10 }} 
                       animate={{ opacity: 1, y: 0 }} 
                       exit={{ opacity: 0, y: 10 }}
                       className="absolute bottom-14 left-0 w-32 bg-[#1a1a1c] border border-white/10 rounded-2xl shadow-2xl p-2 z-50 grid grid-cols-2 gap-1"
                     >
                        {QUANTITIES.map(q => (
                           <button 
                            key={q} 
                            onClick={() => { setQuantity(q); setShowQtyDropdown(false); }}
                            className="p-2 text-[10px] font-black text-white hover:bg-amber-500 hover:text-black rounded-lg transition-colors"
                           >
                              x{q}
                           </button>
                        ))}
                     </motion.div>
                   )}
                 </AnimatePresence>
              </div>

              <button 
                onClick={handleSend}
                disabled={!selectedGift || selectedRecipientIds.length === 0}
                className="h-12 flex-1 bg-gradient-to-r from-amber-500 to-orange-600 text-black font-black text-sm rounded-xl shadow-xl active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
              >
                 إرسال <GiftIcon size={16} fill="currentColor" />
              </button>
           </div>
        </div>
      </motion.div>
    </div>
  );
};

export default GiftModal;
