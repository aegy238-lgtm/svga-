
import React, { useState } from 'react';
import { Plus, Crown, Edit3, Trash2, X, Upload, Image as ImageIcon, Star, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { VIPPackage } from '../../types';

interface AdminVIPProps {
  vipLevels: VIPPackage[];
  onSaveVip: (vip: VIPPackage, isDelete?: boolean) => Promise<void>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, callback: (url: string) => void, w: number, h: number) => void;
}

const AdminVIP: React.FC<AdminVIPProps> = ({ vipLevels, onSaveVip, handleFileUpload }) => {
  const [editingVip, setEditingVip] = useState<Partial<VIPPackage> | null>(null);

  const handleFinalSave = async () => {
    if (!editingVip || !editingVip.name || !editingVip.frameUrl) {
      alert('يرجى إكمال البيانات ورفع الصورة أولاً');
      return;
    }
    await onSaveVip(editingVip as VIPPackage);
    setEditingVip(null);
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      <div className="flex items-center justify-between bg-slate-950/40 p-6 rounded-[2rem] border border-white/5 shadow-xl">
        <div>
          <h3 className="text-2xl font-black text-white flex items-center gap-2">
            <Crown className="text-amber-500" /> إدارة عضويات الـ VIP
          </h3>
          <p className="text-slate-500 text-xs font-bold mt-1">خصص الرتب الملكية كما تشاء (مثل الإطارات)</p>
        </div>
        <button 
          onClick={() => setEditingVip({ 
            level: (vipLevels.length + 1), 
            name: '', 
            cost: 1000, 
            frameUrl: '', 
            color: 'text-amber-400', 
            nameStyle: 'font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-600' 
          })} 
          className="px-6 py-3 bg-gradient-to-r from-amber-600 to-yellow-600 text-black rounded-2xl font-black text-xs flex items-center gap-2 shadow-xl active:scale-95 transition-all"
        >
          <Plus size={18}/> إضافة رتبة جديدة
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {vipLevels.sort((a,b)=>a.level-b.level).map(vip => (
          <div key={vip.level} className="bg-slate-950/60 p-6 rounded-[2.5rem] border border-white/10 flex items-center gap-4 group relative overflow-hidden">
            <div className="absolute top-3 left-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <button onClick={() => setEditingVip(vip)} className="p-2 bg-blue-600 rounded-xl text-white shadow-lg"><Edit3 size={16}/></button>
              <button onClick={() => { if(confirm('حذف هذه الرتبة؟')) onSaveVip(vip, true) }} className="p-2 bg-red-600 rounded-xl text-white shadow-lg"><Trash2 size={16}/></button>
            </div>
            
            <div className="relative w-20 h-20 flex-shrink-0">
               <div className="absolute inset-2 rounded-full bg-black/40 border border-white/5"></div>
               <img src={vip.frameUrl} className="w-full h-full object-contain relative z-10 scale-125" alt="" />
            </div>

            <div className="text-right flex-1">
              <h4 className={`font-black text-lg ${vip.color}`}>{vip.name}</h4>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-sm font-black text-yellow-500">{(vip.cost || 0).toLocaleString()}</span>
                <span className="text-[10px] text-yellow-600">🪙 كوينز</span>
              </div>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1 block">LV. {vip.level}</span>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {editingVip && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-black text-white flex items-center gap-2 text-right">
                   <div className="p-2 bg-amber-500/20 rounded-xl"><Crown className="text-amber-500" size={20}/></div>
                   إعدادات رتبة الـ VIP
                </h3>
                <button onClick={() => setEditingVip(null)} className="p-2 hover:bg-white/5 rounded-full"><X size={24} className="text-slate-500" /></button>
              </div>

              <div className="space-y-6 text-right">
                {/* رفع صورة الإطار الملكي */}
                <div className="flex flex-col items-center gap-4 p-8 bg-black/30 rounded-[2.5rem] border border-white/5 relative group">
                  <div className="w-32 h-32 flex items-center justify-center bg-slate-800 rounded-full border border-white/10 shadow-inner overflow-hidden relative">
                    {editingVip.frameUrl ? (
                      <img src={editingVip.frameUrl} className="w-full h-full object-contain scale-125" alt="" />
                    ) : (
                      <ImageIcon className="text-slate-600" size={48} />
                    )}
                  </div>
                  <label className="bg-amber-600 hover:bg-amber-500 text-black px-8 py-3 rounded-2xl text-xs font-black cursor-pointer flex items-center gap-2 transition-all shadow-lg active:scale-95">
                    <Upload size={16} /> رفع إطار الرتبة
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => handleFileUpload(e, (url) => setEditingVip({...editingVip, frameUrl: url}), 400, 400)} 
                    />
                  </label>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">PNG Transparent Recommended</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase pr-2">اسم الرتبة</label>
                    <input 
                      type="text" 
                      value={editingVip.name} 
                      placeholder="مثال: السلطان"
                      onChange={e => setEditingVip({...editingVip, name: e.target.value})} 
                      className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-sm font-black outline-none focus:border-amber-500/50 transition-all text-right" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase pr-2">المستوى</label>
                    <input 
                      type="number" 
                      value={editingVip.level} 
                      onChange={e => setEditingVip({...editingVip, level: parseInt(e.target.value) || 1})} 
                      className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white font-black text-sm outline-none text-center focus:border-amber-500/50 transition-all" 
                    />
                  </div>
                </div>

                <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-500 uppercase pr-2">سعر التفعيل (بالكوينز)</label>
                   <div className="relative">
                      <input 
                        type="number" 
                        value={editingVip.cost} 
                        onChange={e => setEditingVip({...editingVip, cost: parseInt(e.target.value) || 0})} 
                        className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-yellow-500 font-black text-lg outline-none text-center focus:border-amber-500/50 transition-all" 
                      />
                      <Star className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-600/30" size={24} />
                   </div>
                </div>

                <button 
                  onClick={handleFinalSave} 
                  className="w-full py-5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 text-black font-black rounded-[1.5rem] shadow-xl shadow-amber-900/40 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Save size={20} /> حفظ وتفعيل الرتبة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminVIP;
