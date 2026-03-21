import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Image as ImageIcon, Upload, Mic, Layout, Lock, Unlock, Sparkles, Check } from 'lucide-react';
import { Room } from '../types';
import { db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';

const compressImage = (base64: string, maxWidth: number, maxHeight: number, quality: number = 0.8): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
      } else {
        if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
      }
      resolve(canvas.toDataURL('image/webp', quality));
    };
  });
};

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (roomData: Pick<Room, 'title' | 'category' | 'thumbnail' | 'background' | 'isLocked' | 'password'>) => void;
}

const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Room['category']>('ترفيه');
  const [thumbnail, setThumbnail] = useState('');
  const [background, setBackground] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [officialBackgrounds, setOfficialBackgrounds] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      const fetchOfficialBgs = async () => {
        const snap = await getDoc(doc(db, 'appSettings', 'official_backgrounds'));
        if (snap.exists()) setOfficialBackgrounds(snap.data().list || []);
      };
      fetchOfficialBgs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'thumbnail' | 'background') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('حجم الملف كبير جداً');
        return;
      }
      setIsProcessing(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (event.target?.result) {
          const raw = event.target.result as string;
          // رفع الجودة إلى 0.85 للخلفيات لضمان نقاء الصورة
          const compressed = type === 'thumbnail' 
            ? await compressImage(raw, 400, 400, 0.7)
            : await compressImage(raw, 1080, 1920, 0.85);
          
          if (type === 'thumbnail') setThumbnail(compressed);
          else setBackground(compressed);
        }
        setIsProcessing(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    if (!title.trim()) return alert('الرجاء كتابة اسم الغرفة');
    if (isLocked && password.length < 4) return alert('يرجى إدخال كلمة مرور من 4 أرقام');
    if (isProcessing) return;
    
    onCreate({
      title,
      category,
      thumbnail: thumbnail || 'https://picsum.photos/200/150?random=' + Date.now(),
      background: background || '#0f172a',
      isLocked,
      password: isLocked ? password : ''
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center pointer-events-none p-0">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto" />
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="relative w-full max-w-md bg-[#0a0f1d] rounded-t-[35px] border-t border-white/10 pointer-events-auto shadow-[0_-10px_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 flex justify-between items-center shrink-0 border-b border-white/5">
           <h2 className="text-lg font-black text-white flex items-center gap-2.5"><div className="p-2 bg-amber-500/20 rounded-xl"><Mic className="text-amber-500" size={18} /></div> إنشاء غرفتك</h2>
           <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition active:scale-90"><X size={20} className="text-slate-400" /></button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide pb-20">
           <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 pr-2 uppercase tracking-widest">عنوان الغرفة</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً: سهرة فيفو المميزة..." className="w-full bg-slate-900/50 border border-white/5 rounded-2xl p-4 text-white font-bold focus:border-amber-500/50 outline-none shadow-inner" />
           </div>
           
           <div className="bg-black/30 p-4 rounded-2xl border border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isLocked ? 'bg-amber-500 text-black' : 'bg-white/5 text-slate-500'}`}>
                       {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
                    </div>
                    <div>
                       <h4 className="text-xs font-black text-white">الغرفة خاصة</h4>
                       <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">الحماية بكلمة مرور</p>
                    </div>
                 </div>
                 <button 
                   onClick={() => setIsLocked(!isLocked)}
                   className={`w-11 h-6 rounded-full transition-all relative ${isLocked ? 'bg-amber-500' : 'bg-slate-700'}`}
                 >
                    <motion.div 
                      animate={{ x: isLocked ? 22 : 4 }}
                      className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-lg"
                    />
                 </button>
              </div>

              {isLocked && (
                 <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}>
                    <input 
                      type="password" 
                      maxLength={4}
                      value={password}
                      onChange={(e) => setPassword(e.target.value.replace(/\D/g, ''))}
                      placeholder="أدخل 4 أرقام للرمز..."
                      className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-center text-xl font-black text-amber-500 tracking-[10px] outline-none"
                    />
                 </motion.div>
              )}
           </div>

           <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 pr-2 uppercase tracking-widest">نوع البث</label>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                 {['ترفيه', 'ألعاب', 'شعر', 'تعارف'].map((cat) => (
                    <button key={cat} onClick={() => setCategory(cat as any)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black transition-all border shrink-0 ${category === cat ? 'bg-amber-500 text-black border-amber-500 shadow-lg' : 'bg-slate-900 text-slate-400 border-white/10'}`}>{cat}</button>
                 ))}
              </div>
           </div>

           {/* قسم الخلفيات الرسمية */}
           {officialBackgrounds.length > 0 && (
             <div className="space-y-3">
               <div className="flex items-center justify-between pr-2">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Sparkles size={12} className="text-amber-500" /> خلفيات رسمية</label>
                 <span className="text-[8px] text-slate-600 font-bold">اختيار سريع</span>
               </div>
               <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {officialBackgrounds.map((bgUrl, i) => (
                    <button 
                      key={i} 
                      onClick={() => setBackground(bgUrl)}
                      className={`relative w-16 h-24 rounded-xl border-2 shrink-0 overflow-hidden transition-all ${background === bgUrl ? 'border-amber-500 scale-105 shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'border-white/5 opacity-70 hover:opacity-100'}`}
                    >
                      <img src={bgUrl} className="w-full h-full object-cover" alt="" />
                      {background === bgUrl && (
                        <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                          <div className="bg-amber-500 rounded-full p-0.5 shadow-lg"><Check size={12} className="text-black" /></div>
                        </div>
                      )}
                    </button>
                  ))}
               </div>
             </div>
           )}
           
           <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-500 pr-2 uppercase tracking-widest">الغلاف (خارجي)</label>
                 <label className="block aspect-[4/3] rounded-2xl border-2 border-dashed border-white/5 hover:border-amber-500/50 transition-colors cursor-pointer relative overflow-hidden bg-slate-900 group">
                    {isProcessing ? (<div className="w-full h-full flex items-center justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-500"></div></div>) : thumbnail ? (<><img src={thumbnail} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Upload size={18} className="text-white" /></div></>) : (<div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-700"><ImageIcon size={20} /><span className="text-[9px] font-black uppercase">اختيار صورة</span></div>)}
                    <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'thumbnail')} className="hidden" />
                 </label>
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-500 pr-2 uppercase tracking-widest">خلفية مخصصة</label>
                 <label className="block aspect-[4/3] rounded-2xl border-2 border-dashed border-white/5 hover:border-blue-500/50 transition-colors cursor-pointer relative overflow-hidden bg-slate-900 group">
                    {isProcessing ? (<div className="w-full h-full flex items-center justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div></div>) : (background && !officialBackgrounds.includes(background)) ? (<><img src={background} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Upload size={18} className="text-white" /></div></>) : (<div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-700"><Layout size={20} /><span className="text-[9px] font-black uppercase">رفع خلفية</span></div>)}
                    <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'background')} className="hidden" />
                 </label>
              </div>
           </div>
        </div>

        {/* Action Button - Sticky at bottom */}
        <div className="p-5 bg-gradient-to-t from-[#0a0f1d] to-transparent shrink-0">
           <button 
             onClick={handleSubmit} 
             disabled={isProcessing} 
             className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-black font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
           >
             <Mic size={18} fill="currentColor" /> ابدأ البث الآن
           </button>
        </div>

      </motion.div>
    </div>
  );
};

export default CreateRoomModal;