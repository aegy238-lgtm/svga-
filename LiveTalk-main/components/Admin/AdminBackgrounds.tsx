import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Upload, Trash2, Plus, Layout, Sparkles, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc, arrayUnion, arrayRemove, updateDoc } from 'firebase/firestore';

interface AdminBackgroundsProps {
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, callback: (url: string) => void, w: number, h: number) => void;
}

const AdminBackgrounds: React.FC<AdminBackgroundsProps> = ({ handleFileUpload }) => {
  const [backgrounds, setBackgrounds] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const fetchBackgrounds = async () => {
      const docRef = doc(db, 'appSettings', 'official_backgrounds');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setBackgrounds(snap.data().list || []);
      }
    };
    fetchBackgrounds();
  }, []);

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsUploading(true);
    handleFileUpload(e, async (url) => {
      try {
        const docRef = doc(db, 'appSettings', 'official_backgrounds');
        await setDoc(docRef, { list: arrayUnion(url) }, { merge: true });
        setBackgrounds(prev => [...prev, url]);
        alert('تمت إضافة الخلفية للمكتبة الرسمية ✅');
      } catch (err) {
        alert('فشل حفظ الخلفية');
      } finally {
        setIsUploading(false);
      }
    }, 800, 1200); // أبعاد مناسبة لخلفيات الجوال
  };

  const removeBg = async (url: string) => {
    if (!confirm('هل تريد حذف هذه الخلفية من المكتبة الرسمية؟')) return;
    try {
      const docRef = doc(db, 'appSettings', 'official_backgrounds');
      await updateDoc(docRef, { list: arrayRemove(url) });
      setBackgrounds(prev => prev.filter(b => b !== url));
    } catch (err) {
      alert('فشل الحذف');
    }
  };

  return (
    <div className="space-y-8 text-right font-cairo" dir="rtl">
      <div className="bg-slate-950/40 p-8 rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h3 className="text-2xl font-black text-white flex items-center gap-3">
            <Layout className="text-indigo-500" /> مكتبة خلفيات الغرف
          </h3>
          <p className="text-slate-500 text-xs font-bold mt-2">ارفع خلفيات مميزة ليستخدمها أعضاء التطبيق عند إنشاء غرفهم.</p>
        </div>
        <label className={`flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black cursor-pointer shadow-xl active:scale-95 transition-all ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
          {isUploading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Plus size={18} />}
          رفع خلفية جديدة
          <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
        </label>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {backgrounds.map((bg, idx) => (
          <motion.div 
            key={idx}
            whileHover={{ scale: 1.02 }}
            className="relative aspect-[9/16] rounded-2xl overflow-hidden border border-white/10 group bg-slate-900"
          >
            <img src={bg} className="w-full h-full object-cover" alt="" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button onClick={() => removeBg(bg)} className="p-3 bg-red-600 text-white rounded-xl shadow-lg active:scale-90 transition-transform">
                <Trash2 size={20} />
              </button>
            </div>
          </motion.div>
        ))}
        {backgrounds.length === 0 && !isUploading && (
          <div className="col-span-full py-20 text-center opacity-30">
            <ImageIcon size={60} className="mx-auto mb-4 text-slate-600" />
            <p className="font-black text-slate-500">لا توجد خلفيات رسمية حالياً</p>
          </div>
        )}
      </div>
      
      <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-[2rem] flex items-center gap-3">
         <Sparkles className="text-amber-500" size={20} />
         <p className="text-[10px] text-slate-400 font-bold">هذه الخلفيات ستظهر كقائمة اختيار سريعة للمستخدمين أثناء إنشاء الغرفة.</p>
      </div>
    </div>
  );
};

export default AdminBackgrounds;