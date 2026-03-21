
import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Upload, Trash2, Plus, UserCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc, arrayUnion, arrayRemove, updateDoc } from 'firebase/firestore';

interface AdminDefaultsProps {
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, callback: (url: string) => void, w: number, h: number) => void;
}

const AdminDefaults: React.FC<AdminDefaultsProps> = ({ handleFileUpload }) => {
  const [defaultAvatars, setDefaultAvatars] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const fetchDefaults = async () => {
      const docRef = doc(db, 'appSettings', 'defaults');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setDefaultAvatars(snap.data().profilePictures || []);
      }
    };
    fetchDefaults();
  }, []);

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsUploading(true);
    handleFileUpload(e, async (url) => {
      try {
        const docRef = doc(db, 'appSettings', 'defaults');
        await setDoc(docRef, { profilePictures: arrayUnion(url) }, { merge: true });
        setDefaultAvatars(prev => [...prev, url]);
      } catch (err) {
        alert('فشل حفظ الصورة');
      } finally {
        setIsUploading(false);
      }
    }, 300, 300);
  };

  const removeAvatar = async (url: string) => {
    if (!confirm('حذف هذه الصورة من القائمة الافتراضية؟')) return;
    try {
      const docRef = doc(db, 'appSettings', 'defaults');
      await updateDoc(docRef, { profilePictures: arrayRemove(url) });
      setDefaultAvatars(prev => prev.filter(a => a !== url));
    } catch (err) {
      alert('فشل الحذف');
    }
  };

  return (
    <div className="space-y-8 text-right font-cairo" dir="rtl">
      <div className="bg-slate-950/40 p-8 rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h3 className="text-2xl font-black text-white flex items-center gap-3">
            <UserCircle className="text-blue-500" size={32} /> صور البروفايل الافتراضية
          </h3>
          <p className="text-slate-500 text-xs font-bold mt-2">ارفع الصور التي تود أن يختار منها المستخدمون الجدد أثناء تسجيل حساباتهم.</p>
        </div>
        <label className={`flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl text-xs font-black cursor-pointer shadow-xl active:scale-95 transition-all ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
          {isUploading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Plus size={18} />}
          رفع صورة جديدة
          <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
        </label>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-4">
        {defaultAvatars.map((url, idx) => (
          <motion.div key={idx} whileHover={{ scale: 1.05 }} className="relative aspect-square rounded-2xl overflow-hidden border border-white/10 group bg-slate-900 shadow-lg">
            <img src={url} className="w-full h-full object-cover" alt="" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button onClick={() => removeAvatar(url)} className="p-2 bg-red-600 text-white rounded-xl shadow-lg active:scale-90 transition-transform">
                <Trash2 size={16} />
              </button>
            </div>
          </motion.div>
        ))}
        {defaultAvatars.length === 0 && !isUploading && (
          <div className="col-span-full py-20 text-center opacity-30">
            <ImageIcon size={60} className="mx-auto mb-4 text-slate-600" />
            <p className="font-black text-slate-500">لم تقم برفع صور افتراضية بعد</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDefaults;
