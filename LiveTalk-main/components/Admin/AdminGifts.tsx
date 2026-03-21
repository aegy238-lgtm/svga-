
import React, { useState, useEffect } from 'react';
import { Plus, Gift as GiftIcon, Edit3, Trash2, Wand2, X, Upload, RefreshCw, AlertCircle, Video, Clock, Image as ImageIcon, Maximize, PlayCircle, Settings2, Save, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, GiftAnimationType, GiftDisplaySize } from '../../types';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

interface AdminGiftsProps {
  gifts: Gift[];
  onSaveGift: (gift: Gift, isDelete?: boolean) => Promise<void>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, callback: (url: string) => void, w: number, h: number) => void;
}

const animationTypes: { id: GiftAnimationType; label: string }[] = [
  { id: 'none', label: 'بدون تأثير' },
  { id: 'pop', label: 'ظهور (Pop)' },
  { id: 'fly', label: 'طيران (Fly)' },
  { id: 'full-screen', label: 'ملء الشاشة' },
  { id: 'shake', label: 'اهتزاز' },
  { id: 'glow', label: 'توهج' },
  { id: 'bounce', label: 'قفز' },
  { id: 'rotate', label: 'دوران' },
  { id: 'slide-up', label: 'انزلاق للأعلى' },
];

const sizeOptions: { id: GiftDisplaySize; label: string }[] = [
  { id: 'small', label: 'صغير (25%)' },
  { id: 'medium', label: 'متوسط (50%)' },
  { id: 'large', label: 'كبير (75%)' },
  { id: 'full', label: 'ملء الشاشة (Contain)' },
  { id: 'max', label: 'شاشة فائقة (Cover Full)' },
];

const AdminGifts: React.FC<AdminGiftsProps> = ({ gifts, onSaveGift, handleFileUpload }) => {
  const [editingGift, setEditingGift] = useState<Partial<Gift> | null>(null);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [isUploadingContent, setIsUploadingContent] = useState(false);
  
  const [categoryLabels, setCategoryLabels] = useState({
    popular: 'شائع',
    exclusive: 'حصري',
    lucky: 'الحظ',
    trend: 'ترند'
  });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'appSettings', 'gift_settings'), (snap) => {
      if (snap.exists() && snap.data().categoryLabels) {
        setCategoryLabels(snap.data().categoryLabels);
      }
    });
    return () => unsub();
  }, []);

  const handleSaveCategories = async () => {
    try {
      await setDoc(doc(db, 'appSettings', 'gift_settings'), { categoryLabels }, { merge: true });
      alert('تم تحديث مسميات الأقسام بنجاح ✅');
    } catch (e) {
      alert('فشل حفظ المسميات');
    }
  };

  const isVideoUrl = (url: string) => {
    if (!url) return false;
    return url.match(/\.(mp4|webm|ogg|mov|m4v)$/i) || url.includes('video');
  };

  const handleFinalSave = async () => {
    if (!editingGift || !editingGift.icon) {
      alert('يرجى وضع رابط المحتوى أو رفعه أولاً');
      return;
    }
    
    if (editingGift.icon.length > 850000) {
        alert('حجم محتوى الهدية كبير جداً (يتجاوز 850 كيلوبايت بعد الترميز). يرجى تقليل مدة الفيديو أو جودة الصورة/GIF قبل الرفع لضمان حفظها في قاعدة البيانات.');
        return;
    }

    if (editingGift.catalogIcon && editingGift.catalogIcon.length > 300000) {
        alert('حجم أيقونة المتجر كبير جداً. يرجى اختيار صورة أصغر.');
        return;
    }
    
    // تأكيد تعيين isLucky بناءً على الفئة المختارة
    const isLuckyCategory = editingGift.category === 'lucky';
    
    await onSaveGift({ 
      ...editingGift, 
      isLucky: isLuckyCategory,
      duration: Number(editingGift.duration) || 5,
      displaySize: editingGift.displaySize || 'medium'
    } as Gift);
    setEditingGift(null);
  };

  const renderPreview = (url: string) => {
    if (!url) return <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 bg-slate-800/50 rounded-2xl border-2 border-dashed border-white/5"><ImageIcon size={32} /><span className="text-[10px] mt-2 font-bold uppercase">لا يوجد معاينة</span></div>;
    if (isVideoUrl(url)) {
      return <video src={url} autoPlay muted loop className="w-full h-full object-contain rounded-2xl" />;
    }
    return <img src={url} className="w-full h-full object-contain rounded-2xl" alt="Preview" />;
  };

  return (
    <div className="space-y-10 text-right font-cairo" dir="rtl">
      <div className="bg-slate-950/40 p-8 rounded-[2.5rem] border border-white/10 shadow-2xl space-y-6">
        <div className="flex items-center gap-3 border-b border-white/5 pb-4">
          <div className="p-2 bg-amber-500 rounded-xl shadow-lg shadow-amber-900/40">
            <Settings2 className="text-black" size={20} />
          </div>
          <h3 className="text-xl font-black text-white">إدارة مسميات أقسام الهدايا</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 pr-2">قسم الشائع</label>
            <input 
              type="text" 
              value={categoryLabels.popular} 
              onChange={e => setCategoryLabels({...categoryLabels, popular: e.target.value})}
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-xs font-bold outline-none focus:border-amber-500" 
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 pr-2">قسم الحصري</label>
            <input 
              type="text" 
              value={categoryLabels.exclusive} 
              onChange={e => setCategoryLabels({...categoryLabels, exclusive: e.target.value})}
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-xs font-bold outline-none focus:border-amber-500" 
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 pr-2">قسم الحظ</label>
            <input 
              type="text" 
              value={categoryLabels.lucky} 
              onChange={e => setCategoryLabels({...categoryLabels, lucky: e.target.value})}
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-xs font-bold outline-none focus:border-amber-500" 
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 pr-2">قسم ترند</label>
            <input 
              type="text" 
              value={categoryLabels.trend} 
              onChange={e => setCategoryLabels({...categoryLabels, trend: e.target.value})}
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-xs font-bold outline-none focus:border-amber-500" 
            />
          </div>
        </div>
        
        <div className="flex justify-end">
          <button 
            onClick={handleSaveCategories}
            className="flex items-center gap-2 px-8 py-3 bg-amber-500 text-black rounded-xl font-black text-xs shadow-xl active:scale-95 transition-all"
          >
            <Save size={16} /> حفظ المسميات الجديدة
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-black text-white">إدارة الهدايا المتطورة ({gifts.length})</h3>
        <button onClick={() => setEditingGift({ id: 'gift_' + Date.now(), name: '', icon: '', catalogIcon: '', cost: 10, animationType: 'none', category: 'popular', duration: 5, displaySize: 'medium' })} className="px-6 py-3 bg-pink-600 text-white rounded-2xl font-black text-xs flex items-center gap-2 shadow-xl active:scale-95 transition-all">
          <Plus size={18}/> إضافة هدية جديدة
        </button>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {gifts.map(gift => (
          <div key={gift.id} className="bg-slate-950/60 p-4 rounded-[2rem] border border-white/10 flex flex-col items-center gap-2 group relative">
            <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <button onClick={() => setEditingGift(gift)} className="p-1.5 bg-blue-600 rounded-lg text-white shadow-lg"><Edit3 size={12}/></button>
              <button onClick={() => { if(confirm('حذف الهدية؟')) onSaveGift(gift, true) }} className="p-1.5 bg-red-600 rounded-lg text-white shadow-lg"><Trash2 size={12}/></button>
            </div>
            <div className="w-16 h-16 flex items-center justify-center mb-1">
               {gift.catalogIcon ? (
                 <img src={gift.catalogIcon} className="w-full h-full object-contain" alt="" />
               ) : isVideoUrl(gift.icon) ? (
                 <div className="w-full h-full bg-indigo-600 rounded-xl flex items-center justify-center text-white"><Video size={24} /></div>
               ) : (
                 <img src={gift.icon} className="w-full h-full object-contain" alt="" />
               )}
            </div>
            <span className="text-xs font-black text-white truncate w-full text-center">{gift.name}</span>
            <span className="text-[10px] text-yellow-500 font-bold">🪙 {gift.cost}</span>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {editingGift && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-xl p-8 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-black text-white flex items-center gap-2 text-right"><Wand2 className="text-pink-500 ml-2"/> إعدادات الهدية</h3>
                <button onClick={() => setEditingGift(null)} className="p-2 hover:bg-white/5 rounded-full"><X size={24} className="text-slate-500" /></button>
              </div>

              <div className="space-y-8">
                {/* قسم اختيار الفئة المخصص بناءً على طلب المستخدم */}
                <div className="bg-indigo-600/10 p-6 rounded-3xl border border-indigo-500/20 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Layers size={18} className="text-indigo-400" />
                    <h4 className="text-xs font-black text-white">تخصيص تصنيف الهدية</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'popular', label: categoryLabels.popular },
                      { id: 'exclusive', label: categoryLabels.exclusive },
                      { id: 'lucky', label: categoryLabels.lucky },
                      { id: 'trend', label: categoryLabels.trend },
                    ].map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setEditingGift({...editingGift, category: cat.id as any})}
                        className={`p-3 rounded-xl text-[10px] font-black border transition-all ${editingGift.category === cat.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-black/20 border-white/5 text-slate-500 hover:bg-black/40'}`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                  {editingGift.category === 'lucky' && (
                    <p className="text-[9px] text-amber-500 font-bold flex items-center gap-1">
                      <AlertCircle size={10} /> سيتم تفعيل ميزة "الحظ" لهذا الهدية تلقائياً في الغرف.
                    </p>
                  )}
                </div>

                <div className="bg-black/40 p-6 rounded-3xl border border-white/5 space-y-4">
                   <div className="flex items-center gap-2 mb-2">
                      <ImageIcon size={18} className="text-amber-500" />
                      <h4 className="text-xs font-black text-white">أيقونة المتجر (Catalog Icon)</h4>
                   </div>
                   <div className="flex flex-col md:flex-row items-center gap-6">
                      <div className="w-24 h-24 bg-slate-800 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                         {editingGift.catalogIcon ? <img src={editingGift.catalogIcon} className="w-full h-full object-contain" /> : <ImageIcon className="text-slate-700" size={32} />}
                      </div>
                      <div className="flex-1 w-full space-y-3">
                         <input type="text" value={editingGift.catalogIcon || ''} onChange={e => setEditingGift({...editingGift, catalogIcon: e.target.value})} placeholder="رابط صورة الأيقونة..." className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-[10px] text-white outline-none" />
                         <label className={`w-full py-2.5 bg-amber-600/20 text-amber-500 rounded-xl text-[10px] font-black flex items-center justify-center gap-2 cursor-pointer border border-amber-500/20 active:scale-95 transition-all ${isUploadingIcon ? 'opacity-50' : ''}`}>
                            <Upload size={14} /> {isUploadingIcon ? 'جاري الرفع...' : 'رفع صورة المصغرة'}
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => { setIsUploadingIcon(true); handleFileUpload(e, (url) => { setEditingGift({...editingGift, catalogIcon: url}); setIsUploadingIcon(false); }, 150, 150); }} />
                         </label>
                      </div>
                   </div>
                </div>

                <div className="bg-black/40 p-6 rounded-3xl border border-white/5 space-y-4">
                   <div className="flex items-center gap-2 mb-2">
                      <PlayCircle size={18} className="text-blue-500" />
                      <h4 className="text-xs font-black text-white">محتوى الأنميشن (MP4 / GIF / PNG)</h4>
                   </div>
                   <div className="space-y-4">
                      <div className="w-full h-40 bg-slate-800 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden">
                         {renderPreview(editingGift.icon || '')}
                      </div>
                      <div className="flex flex-col gap-3">
                         <input type="text" value={editingGift.icon || ''} onChange={e => setEditingGift({...editingGift, icon: e.target.value})} placeholder="رابط الفيديو (MP4) أو الأنميشن (GIF)..." className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-[10px] text-blue-400 font-bold outline-none ltr" />
                         <label className={`w-full py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 transition-all ${isUploadingContent ? 'opacity-50' : ''}`}>
                            <Video size={16} /> {isUploadingContent ? 'جاري الرفع...' : 'رفع محتوى الهدية (فيديو أو GIF)'}
                            <input type="file" accept="video/mp4,image/gif,image/png,image/jpeg" className="hidden" onChange={(e) => { setIsUploadingContent(true); handleFileUpload(e, (url) => { setEditingGift({...editingGift, icon: url}); setIsUploadingContent(false); }, 512, 512); }} />
                         </label>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase pr-2">اسم الهدية</label>
                    <input type="text" value={editingGift.name} onChange={e => setEditingGift({...editingGift, name: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-xs font-bold outline-none text-right" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase pr-2">سعر الهدية</label>
                    <input type="number" value={editingGift.cost} onChange={e => setEditingGift({...editingGift, cost: parseInt(e.target.value) || 0})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-yellow-500 font-black text-xs outline-none text-center" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase pr-2 flex items-center gap-1"><Maximize size={12}/> الحجم</label>
                    <select value={editingGift.displaySize || 'medium'} onChange={e => setEditingGift({...editingGift, displaySize: e.target.value as any})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-xs font-bold text-center appearance-none">
                      {sizeOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase pr-2 flex items-center gap-1"><Clock size={12}/> المدة (ثواني)</label>
                    <input type="number" value={editingGift.duration} onChange={e => setEditingGift({...editingGift, duration: parseInt(e.target.value) || 5})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-emerald-400 font-black text-xs outline-none text-center" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1"><PlayCircle size={14}/> حركة الظهور (Animation Style)</label>
                  <div className="grid grid-cols-3 gap-2">
                    {animationTypes.map(type => (
                      <button key={type.id} onClick={() => setEditingGift({...editingGift, animationType: type.id})} className={`p-3 rounded-xl text-[9px] font-black text-center border transition-all ${editingGift.animationType === type.id ? 'bg-pink-600 border-pink-500 text-white shadow-lg' : 'bg-black/20 border-white/5 text-slate-500 hover:bg-black/40'}`}>
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={handleFinalSave} className="w-full py-5 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-700 text-white font-black rounded-3xl shadow-xl active:scale-95 transition-all text-sm">حفظ ونشر الهدية الجديدة</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminGifts;
