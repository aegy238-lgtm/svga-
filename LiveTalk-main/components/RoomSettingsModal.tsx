import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Image as ImageIcon, Upload, Layout, Save, Edit3, Lock, Unlock } from 'lucide-react';
import { Room } from '../types';

const compressImage = (base64: string, maxWidth: number, maxHeight: number, quality: number = 0.85): Promise<string> => {
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

interface RoomSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  onUpdate: (roomId: string, data: Partial<Room>) => void;
}

const RoomSettingsModal: React.FC<RoomSettingsModalProps> = ({ isOpen, onClose, room, onUpdate }) => {
  const [title, setTitle] = useState(room.title);
  const [thumbnail, setThumbnail] = useState(room.thumbnail);
  const [background, setBackground] = useState(room.background);
  const [isLocked, setIsLocked] = useState(room.isLocked || false);
  const [password, setPassword] = useState(room.password || '');
  const [isProcessing, setIsProcessing] = useState(false);

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

  const handleSave = () => {
     if (isProcessing) return;
     if (isLocked && password.length < 4) return alert('يرجى إدخال رمز من 4 أرقام');

     onUpdate(room.id, {
        title,
        thumbnail,
        background,
        isLocked,
        password: isLocked ? password : ''
     });
     onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center pointer-events-none">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto" />
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="relative w-full max-w-md bg-[#10141f] rounded-t-[30px] p-6 pb-8 border-t border-white/10 pointer-events-auto shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
           <h2 className="text-xl font-bold text-white flex items-center gap-2"><Edit3 className="text-blue-500" /> إعدادات الغرفة</h2>
           <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition"><X size={20} className="text-slate-400" /></button>
        </div>
        <div className="space-y-5">
           <div><label className="text-xs text-slate-400 mb-2 block font-bold">اسم الغرفة</label><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white focus:border-blue-500 outline-none" /></div>

           <div className="bg-black/30 p-4 rounded-2xl border border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isLocked ? 'bg-amber-500 text-black' : 'bg-white/5 text-slate-500'}`}>
                       {isLocked ? <Lock size={18} /> : <Unlock size={18} />}
                    </div>
                    <div>
                       <h4 className="text-xs font-bold text-white">قفل الغرفة</h4>
                       <p className="text-[10px] text-slate-500">حماية الغرفة بكلمة مرور</p>
                    </div>
                 </div>
                 <button 
                   onClick={() => setIsLocked(!isLocked)}
                   className={`w-12 h-6 rounded-full transition-all relative ${isLocked ? 'bg-amber-500' : 'bg-slate-700'}`}
                 >
                    <motion.div 
                      animate={{ x: isLocked ? 24 : 4 }}
                      className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-lg"
                    />
                 </button>
              </div>

              {isLocked && (
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <input 
                      type="password" 
                      maxLength={4}
                      value={password}
                      onChange={(e) => setPassword(e.target.value.replace(/\D/g, ''))}
                      placeholder="رمز سري جديد..."
                      className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-center text-lg font-black text-amber-500 tracking-widest outline-none"
                    />
                 </motion.div>
              )}
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div><label className="text-xs text-slate-400 mb-2 block font-bold">صورة الغرفة (خارجي)</label><label className="block w-full aspect-square rounded-2xl border-2 border-dashed border-white/10 hover:border-blue-500/50 transition-colors cursor-pointer relative overflow-hidden bg-slate-900 group">{isProcessing ? (<div className="w-full h-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>) : (<><img src={thumbnail} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" alt="Thumbnail" /><div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Upload size={20} className="text-white" /></div></>)}<input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'thumbnail')} className="hidden" /></label></div>
              <div><label className="text-xs text-slate-400 mb-2 block font-bold">خلفية الغرفة (داخلي)</label><label className="block w-full aspect-square rounded-2xl border-2 border-dashed border-white/10 hover:border-blue-500/50 transition-colors cursor-pointer relative overflow-hidden bg-slate-900 group">{isProcessing ? (<div className="w-full h-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>) : (<>{background.includes('data:') || background.includes('http') ? <img src={background} className="w-full h-full object-cover" /> : <div className="w-full h-full" style={{ background: background }}></div>}<div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Layout size={20} className="text-white" /></div></>)}<input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'background')} className="hidden" /></label></div>
           </div>
           <button onClick={handleSave} disabled={isProcessing} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2 mt-4 active:scale-95 transition-transform disabled:opacity-50">{isProcessing ? 'جاري معالجة الصور...' : <><Save size={20} /> حفظ التغييرات</>}</button>
        </div>
      </motion.div>
    </div>
  );
};

export default RoomSettingsModal;