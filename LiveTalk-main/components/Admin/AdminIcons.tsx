
import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Upload, Trash2, Save, Gift, Gamepad2, Smile, Wallet, Shield, LogOut, Edit3, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AdminIconsProps {
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, callback: (url: string) => void, w: number, h: number) => void;
}

export type IconKeys = 'gift' | 'game' | 'emoji' | 'wallet' | 'admin' | 'logout' | 'edit_profile';

const AdminIcons: React.FC<AdminIconsProps> = ({ handleFileUpload }) => {
  const [icons, setIcons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIcons = async () => {
      const docRef = doc(db, 'appSettings', 'icons');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setIcons(snap.data());
      }
      setLoading(false);
    };
    fetchIcons();
  }, []);

  const handleSaveIcon = async (key: string, url: string) => {
    const newIcons = { ...icons, [key]: url };
    setIcons(newIcons);
    await setDoc(doc(db, 'appSettings', 'icons'), newIcons);
  };

  const removeIcon = async (key: string) => {
    if (!confirm('العودة للأيقونة الافتراضية؟')) return;
    const newIcons = { ...icons };
    delete newIcons[key];
    setIcons(newIcons);
    await setDoc(doc(db, 'appSettings', 'icons'), newIcons);
  };

  const iconSlots: { key: IconKeys; label: string; icon: any; color: string }[] = [
    { key: 'gift', label: 'أيقونة الهدايا', icon: Gift, color: 'bg-pink-500' },
    { key: 'game', label: 'أيقونة الألعاب (ذراع)', icon: Gamepad2, color: 'bg-emerald-500' },
    { key: 'emoji', label: 'أيقونة الإيموشنات', icon: Smile, color: 'bg-yellow-500' },
    { key: 'wallet', label: 'أيقونة المحفظة', icon: Wallet, color: 'bg-indigo-500' },
    { key: 'admin', label: 'أيقونة لوحة السيستم', icon: Shield, color: 'bg-red-500' },
    { key: 'edit_profile', label: 'أيقونة تعديل الحساب', icon: Edit3, color: 'bg-blue-500' },
    { key: 'logout', label: 'أيقونة الخروج', icon: LogOut, color: 'bg-slate-700' },
  ];

  if (loading) return <div className="text-center py-20 text-slate-500">جاري تحميل أيقونات النظام...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 text-right font-cairo" dir="rtl">
      <div className="bg-slate-950/40 p-8 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="text-2xl font-black text-white flex items-center gap-3">
            <div className="p-2 bg-amber-500 rounded-xl shadow-lg shadow-amber-900/40"><ImageIcon className="text-black" /></div>
            تخصيص أيقونات النظام (Graphics)
          </h3>
          <p className="text-slate-500 text-xs font-bold mt-2 pr-1">قم برفع أيقونات مخصصة لجميع أزرار التطبيق الرئيسية لجعل التصميم فريداً.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {iconSlots.map((slot) => (
          <motion.div 
            key={slot.key}
            whileHover={{ y: -5 }}
            className="bg-[#0f172a] border border-white/5 p-6 rounded-[2.5rem] shadow-xl space-y-5"
          >
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${slot.color} text-white shadow-lg`}><slot.icon size={18} /></div>
                  <span className="font-black text-xs text-white uppercase tracking-widest">{slot.label}</span>
               </div>
               {icons[slot.key] && (
                 <button onClick={() => removeIcon(slot.key)} className="text-red-500 hover:bg-red-500/10 p-2 rounded-xl transition-colors">
                    <Trash2 size={16} />
                 </button>
               )}
            </div>

            <div className="relative aspect-square w-24 mx-auto rounded-[1.8rem] overflow-hidden border-2 border-dashed border-white/10 bg-black/40 flex items-center justify-center group">
               {icons[slot.key] ? (
                 <img src={icons[slot.key]} className="w-full h-full object-contain p-2" />
               ) : (
                 <div className="flex flex-col items-center gap-2 text-slate-600">
                    <slot.icon size={24} className="opacity-30" />
                    <span className="text-[9px] font-bold">افتراضي ⚙️</span>
                 </div>
               )}
               
               <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                  <div className="flex flex-col items-center gap-1">
                    <Upload size={18} className="text-white" />
                    <span className="text-[9px] text-white font-black">رفع جديد</span>
                  </div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={(e) => handleFileUpload(e, (url) => handleSaveIcon(slot.key, url), 200, 200)} 
                  />
               </label>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-[2rem] flex items-center gap-3">
         <Sparkles className="text-amber-500" size={20} />
         <p className="text-[10px] text-slate-400 font-bold">يفضل استخدام صور بصيغة PNG شفافة أو صور ثلاثية الأبعاد (3D) بحجم 200x200 لضمان أفضل مظهر.</p>
      </div>
    </div>
  );
};

export default AdminIcons;
