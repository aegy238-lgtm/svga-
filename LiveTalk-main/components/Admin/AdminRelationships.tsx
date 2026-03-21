
import React from 'react';
import { Heart, Users, Upload, Save, Sparkles, XCircle, Coins, Image as ImageIcon } from 'lucide-react';
import { GameSettings } from '../../types';

interface AdminRelationshipsProps {
  gameSettings: GameSettings;
  onUpdateGameSettings: (updates: Partial<GameSettings>) => Promise<void>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, callback: (url: string) => void, w: number, h: number) => void;
}

const AdminRelationships: React.FC<AdminRelationshipsProps> = ({ gameSettings, onUpdateGameSettings, handleFileUpload }) => {
  
  const handleUpdatePrice = (type: 'cp' | 'friend', price: string) => {
    const key = type === 'cp' ? 'cpGiftPrice' : 'friendGiftPrice';
    onUpdateGameSettings({ [key]: parseInt(price) || 0 });
  };

  const renderGiftConfig = (type: 'cp' | 'friend') => {
    const isCp = type === 'cp';
    const currentUrl = isCp ? gameSettings.cpGiftUrl : gameSettings.friendGiftUrl;
    const currentPrice = isCp ? gameSettings.cpGiftPrice : gameSettings.friendGiftPrice;

    return (
      <div className="bg-slate-900/60 p-6 rounded-[2.5rem] border border-white/5 space-y-6 shadow-xl relative overflow-hidden">
        <div className="flex items-center gap-3 mb-2">
           <div className={`p-2 rounded-xl ${isCp ? 'bg-pink-500' : 'bg-blue-500'} text-white shadow-lg`}>
             {isCp ? <Heart size={20} fill="currentColor" /> : <Users size={20} />}
           </div>
           <div>
             <h4 className="text-sm font-black text-white">{isCp ? 'هدية الارتباط (CP)' : 'هدية الصداقة المقربة'}</h4>
             <p className="text-[10px] text-slate-500">ارفع الصورة وحدد سعر الشراء</p>
           </div>
        </div>

        <div className="flex flex-col items-center gap-4">
           <div className="relative w-24 h-24 bg-black/40 rounded-3xl border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden group">
              {currentUrl ? (
                <img src={currentUrl} className="w-full h-full object-contain" alt="" />
              ) : (
                <ImageIcon className="text-slate-600" size={32} />
              )}
              <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                <Upload size={20} className="text-white" />
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => handleFileUpload(e, (url) => onUpdateGameSettings({ [isCp ? 'cpGiftUrl' : 'friendGiftUrl']: url }), 300, 300)} 
                />
              </label>
           </div>

           <div className="w-full space-y-2">
              <label className="text-[10px] font-black text-slate-500 pr-2 uppercase">سعر الهدية (كوينز)</label>
              <div className="relative">
                 <input 
                   type="number" 
                   value={currentPrice || 0}
                   onChange={(e) => handleUpdatePrice(type, e.target.value)}
                   className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-yellow-400 font-black text-center outline-none focus:border-blue-500/50"
                 />
                 <Coins size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
              </div>
           </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 text-right font-cairo" dir="rtl">
      <div className="bg-slate-950/40 p-8 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="text-2xl font-black text-white flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-pink-600 to-rose-600 rounded-xl shadow-lg"><Heart className="text-white" /></div>
            تخصيص هدايا العلاقات
          </h3>
          <p className="text-slate-500 text-xs font-bold mt-2 pr-1">قم برفع صور هدايا الـ CP والصداقة وتحديد أسعارها ليتمكن المستخدمون من شرائها.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderGiftConfig('cp')}
        {renderGiftConfig('friend')}
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-[2rem] flex items-center gap-3">
         <Sparkles className="text-amber-500" size={20} />
         <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
           سيتمكن المستخدمون من طلب الارتباط عبر زر الـ CP في ملفهم الشخصي، وسيحتاجون لدفع السعر المحدد أعلاه لإتمام الارتباط.
         </p>
      </div>
    </div>
  );
};

export default AdminRelationships;
