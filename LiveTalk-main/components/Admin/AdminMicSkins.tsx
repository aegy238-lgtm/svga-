
import React, { useState, useEffect } from 'react';
import { Layout, Upload, Image as ImageIcon, Trash2, Save, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AdminMicSkinsProps {
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, callback: (url: string) => void, w: number, h: number) => void;
}

const LAYOUT_TYPES = [8, 10, 15, 20];

const AdminMicSkins: React.FC<AdminMicSkinsProps> = ({ handleFileUpload }) => {
  const [skins, setSkins] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSkins = async () => {
      const docRef = doc(db, 'appSettings', 'micSkins');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setSkins(snap.data() as Record<number, string>);
      }
      setLoading(false);
    };
    fetchSkins();
  }, []);

  const handleSaveSkin = async (count: number, url: string) => {
    const newSkins = { ...skins, [count]: url };
    setSkins(newSkins);
    await setDoc(doc(db, 'appSettings', 'micSkins'), newSkins);
    alert(`تم تحديث شكل مايكات الـ ${count} بنجاح! ✨`);
  };

  const removeSkin = async (count: number) => {
    if (!confirm('هل تريد العودة للشكل الافتراضي؟')) return;
    const newSkins = { ...skins };
    delete newSkins[count];
    setSkins(newSkins);
    await setDoc(doc(db, 'appSettings', 'micSkins'), newSkins);
  };

  if (loading) return <div className="text-center py-20 text-slate-500">جاري تحميل الإعدادات...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 text-right font-cairo" dir="rtl">
      <div className="bg-slate-950/40 p-8 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="text-2xl font-black text-white flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-900/40"><Layout className="text-white" /></div>
            تخصيص أشكال المايكات
          </h3>
          <p className="text-slate-500 text-xs font-bold mt-2 pr-1">ارفع صوراً مخصصة تظهر كخلفية للمقاعد الفارغة في الغرفة لكل مستوى.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {LAYOUT_TYPES.map((count) => (
          <motion.div 
            key={count}
            whileHover={{ y: -5 }}
            className="bg-[#0f172a] border border-white/5 p-6 rounded-[2.5rem] shadow-xl space-y-6"
          >
            <div className="flex items-center justify-between">
               <span className="px-4 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full font-black text-xs uppercase tracking-widest">
                  نمط {count} مقعد
               </span>
               {skins[count] && (
                 <button onClick={() => removeSkin(count)} className="text-red-500 hover:bg-red-500/10 p-2 rounded-xl transition-colors">
                    <Trash2 size={18} />
                 </button>
               )}
            </div>

            <div className="relative aspect-square w-32 mx-auto rounded-[2rem] overflow-hidden border-2 border-dashed border-white/10 bg-black/40 flex items-center justify-center group">
               {skins[count] ? (
                 <img src={skins[count]} className="w-full h-full object-contain" />
               ) : (
                 <div className="flex flex-col items-center gap-2 text-slate-600">
                    <ImageIcon size={32} />
                    <span className="text-[10px] font-bold">افتراضي 🛋️</span>
                 </div>
               )}
               
               <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                  <div className="flex flex-col items-center gap-1">
                    <Upload size={20} className="text-white" />
                    <span className="text-[10px] text-white font-black">تغيير الصورة</span>
                  </div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={(e) => handleFileUpload(e, (url) => handleSaveSkin(count, url), 300, 300)} 
                  />
               </label>
            </div>

            <div className="pt-4 border-t border-white/5 flex items-center gap-2">
               <Sparkles size={14} className="text-amber-500" />
               <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                  يفضل استخدام صور بصيغة PNG شفافة أو GIF بحجم 200x200 بكسل.
               </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default AdminMicSkins;
