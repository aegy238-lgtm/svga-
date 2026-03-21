
import React, { useState, useEffect } from 'react';
import { Search, Medal, Upload, Trash2, User as UserIcon, Plus, Sparkles, X, Send, CheckCircle2, UserMinus, Star, ShieldCheck, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from '../../types';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc, arrayUnion, arrayRemove, updateDoc } from 'firebase/firestore';

interface AdminBadgesProps {
  users: User[];
  onUpdateUser: (userId: string, data: Partial<User>) => Promise<void>;
}

const compressImage = (base64: string, maxWidth: number, maxHeight: number, quality: number = 0.2): Promise<string> => {
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
        ctx.imageSmoothingQuality = 'low';
        ctx.drawImage(img, 0, 0, width, height);
      }
      resolve(canvas.toDataURL('image/webp', quality));
    };
  });
};

const AdminBadges: React.FC<AdminBadgesProps> = ({ users, onUpdateUser }) => {
  const [globalMedals, setGlobalMedals] = useState<string[]>([]);
  const [autoAgentMedal, setAutoAgentMedal] = useState<string | null>(null);
  const [autoHostMedal, setAutoHostMedal] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedMedal, setSelectedMedal] = useState<string | null>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [isAwarding, setIsAwarding] = useState(false);

  useEffect(() => {
    const fetchMedals = async () => {
      const docRef = doc(db, 'appSettings', 'medals_library');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        setGlobalMedals(data.medals || []);
        setAutoAgentMedal(data.autoAgentMedal || null);
        setAutoHostMedal(data.autoHostMedal || null);
      }
    };
    fetchMedals();
  }, []);

  const filteredAwardUsers = searchQuery.trim() === '' ? [] : users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.customId?.toString() === searchQuery ||
    u.id === searchQuery
  ).slice(0, 5);

  const handleUploadToLibrary = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 200 * 1024) {
        alert('حجم الوسام كبير! يفضل أن يكون أقل من 200 كيلوبايت.');
        return;
      }
      setIsUploading(true);
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const result = ev.target?.result as string;
        
        if (file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')) {
          try {
            const docRef = doc(db, 'appSettings', 'medals_library');
            await setDoc(docRef, { medals: arrayUnion(result) }, { merge: true });
            setGlobalMedals(prev => [...prev, result]);
          } catch (err) { alert('فشل رفع الوسام'); } finally { setIsUploading(false); }
        } else {
          const compressed = await compressImage(result, 64, 64, 0.3);
          try {
            const docRef = doc(db, 'appSettings', 'medals_library');
            await setDoc(docRef, { medals: arrayUnion(compressed) }, { merge: true });
            setGlobalMedals(prev => [...prev, compressed]);
          } catch (err) { alert('فشل رفع الوسام'); } finally { setIsUploading(false); }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const setAutoMedal = async (url: string, type: 'agent' | 'host') => {
    try {
      const docRef = doc(db, 'appSettings', 'medals_library');
      if (type === 'agent') {
        await updateDoc(docRef, { autoAgentMedal: url });
        setAutoAgentMedal(url);
        alert('تم تعيين الوسام التلقائي للوكلاء الجدد ✅');
      } else {
        await updateDoc(docRef, { autoHostMedal: url });
        setAutoHostMedal(url);
        alert('تم تعيين الوسام التلقائي للمضيفين الجدد ✅');
      }
    } catch (e) { alert('فشل التعيين'); }
  };

  const removeFromLibrary = async (url: string) => {
    if (!confirm('هل تريد حذف هذا الوسام من المكتبة؟')) return;
    try {
      const docRef = doc(db, 'appSettings', 'medals_library');
      const updates: any = { medals: arrayRemove(url) };
      if (autoAgentMedal === url) updates.autoAgentMedal = null;
      if (autoHostMedal === url) updates.autoHostMedal = null;
      
      await updateDoc(docRef, updates);
      setGlobalMedals(prev => prev.filter(m => m !== url));
      if (autoAgentMedal === url) setAutoAgentMedal(null);
      if (autoHostMedal === url) setAutoHostMedal(null);
    } catch (err) { alert('فشل الحذف من المكتبة'); }
  };

  const awardMedalToUser = async () => {
    if (!selectedUser || !selectedMedal) return;
    if ((selectedUser.achievements || []).length >= 30) {
      alert('وصل هذا العضو للحد الأقصى للأوسمة (30).');
      return;
    }

    setIsAwarding(true);
    try {
      await onUpdateUser(selectedUser.id, { achievements: arrayUnion(selectedMedal) });
      alert(`تم منح الوسام لـ ${selectedUser.name} بنجاح! 🎖️`);
      setSelectedUser(null);
      setSelectedMedal(null);
      setSearchQuery('');
    } catch (err) { alert('فشل المنح'); } finally { setIsAwarding(false); }
  };

  return (
    <div className="space-y-10 text-right font-cairo" dir="rtl">
      <section>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
           <div>
              <h3 className="text-2xl font-black text-white flex items-center gap-3">
                 <Medal className="text-yellow-500" /> إدارة وتلقائية الأوسمة
              </h3>
              <p className="text-slate-500 text-xs font-bold mt-1">يمكنك تعيين أوسمة تنزل تلقائياً عند ترقية وكيل أو تسجيل مضيف.</p>
           </div>
           <label className={`flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl text-xs font-black cursor-pointer shadow-xl active:scale-95 transition-all ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
              {isUploading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Plus size={18} />}
              رفع وسام جديد
              <input type="file" accept="image/*" className="hidden" onChange={handleUploadToLibrary} />
           </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-4">
           {globalMedals.map((medal, idx) => (
              <div key={idx} className={`relative group bg-slate-950/40 border-2 rounded-2xl p-2 flex flex-col items-center justify-center min-h-[120px] transition-all ${selectedMedal === medal ? 'border-yellow-500 bg-yellow-500/5' : 'border-white/5 hover:border-white/20'}`}>
                 <div className="h-16 w-16 flex items-center justify-center mb-2">
                    <img src={medal} className="max-w-full max-h-full object-contain pointer-events-none" />
                 </div>
                 
                 {/* شارات التلقائية */}
                 <div className="flex gap-1 mb-1">
                    {autoAgentMedal === medal && <div className="bg-blue-500 text-white text-[6px] font-black px-1.5 py-0.5 rounded-full shadow-lg">AUTO AGENT</div>}
                    {autoHostMedal === medal && <div className="bg-emerald-500 text-white text-[6px] font-black px-1.5 py-0.5 rounded-full shadow-lg">AUTO HOST</div>}
                 </div>

                 <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2 rounded-2xl">
                    <button onClick={() => setSelectedMedal(medal)} className="w-full py-1.5 bg-yellow-500 text-black text-[8px] font-black rounded-lg flex items-center justify-center gap-1"><Send size={10}/> منح يدوي</button>
                    <button onClick={() => setAutoMedal(medal, 'agent')} className="w-full py-1.5 bg-blue-600 text-white text-[8px] font-black rounded-lg flex items-center justify-center gap-1"><ShieldCheck size={10}/> آلي وكيل</button>
                    <button onClick={() => setAutoMedal(medal, 'host')} className="w-full py-1.5 bg-emerald-600 text-white text-[8px] font-black rounded-lg flex items-center justify-center gap-1"><UserCheck size={10}/> آلي مضيف</button>
                    <button onClick={() => removeFromLibrary(medal)} className="w-full py-1.5 bg-red-600 text-white text-[8px] font-black rounded-lg flex items-center justify-center gap-1"><Trash2 size={10}/> حذف</button>
                 </div>
              </div>
           ))}
        </div>
      </section>

      <AnimatePresence>
        {selectedMedal && (
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="bg-slate-950/60 rounded-[3rem] border border-yellow-500/30 p-8 shadow-2xl overflow-hidden relative">
            <div className="max-w-xl relative z-10">
              <h3 className="text-xl font-black text-white mb-6 flex items-center gap-3">
                 <Sparkles className="text-yellow-500" /> منح الوسام لعضو يدوياً
              </h3>
              
              <div className="flex flex-col gap-6">
                 <div className="flex items-center gap-4 bg-black/40 p-4 rounded-3xl border border-white/5 w-fit">
                    <div className="w-16 h-16"><img src={selectedMedal} className="w-full h-full object-contain" /></div>
                    <button onClick={() => setSelectedMedal(null)} className="text-red-500 p-1 hover:bg-red-500/10 rounded-lg"><X size={16}/></button>
                 </div>

                 <div className="space-y-3">
                    <label className="text-xs font-black text-slate-400 pr-2">ابحث عن العضو:</label>
                    <div className="relative group">
                      <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                      <input type="text" placeholder="ادخل ID المستخدم..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-900/80 border border-white/10 rounded-2xl py-4 pr-14 text-white text-sm outline-none focus:border-yellow-500/50 shadow-xl" />
                    </div>

                    <AnimatePresence>
                      {filteredAwardUsers.length > 0 && (
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-2 bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl max-h-48 overflow-y-auto">
                          {filteredAwardUsers.map(u => (
                            <button key={u.id} onClick={() => { setSelectedUser(u); setSearchQuery(''); }} className="w-full p-4 flex items-center gap-4 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                              <img src={u.avatar} className="w-10 h-10 rounded-xl object-cover border border-white/10" />
                              <div className="flex flex-col text-right">
                                <span className="font-bold text-white text-sm">{u.name}</span>
                                <span className="text-[10px] text-slate-500">ID: {u.customId || u.id}</span>
                              </div>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                 </div>

                 {selectedUser && (
                    <div className="flex items-center gap-4 p-6 bg-emerald-500/10 rounded-[2rem] border border-emerald-500/20">
                       <div className="flex-1"><p className="text-white text-sm font-black">منح لـ <span className="text-emerald-400">{selectedUser.name}</span></p></div>
                       <button onClick={awardMedalToUser} disabled={isAwarding} className="px-8 py-3 bg-emerald-600 text-white rounded-2xl font-black text-xs shadow-xl active:scale-95 disabled:opacity-50">{isAwarding ? 'جاري...' : 'منح الآن'}</button>
                    </div>
                 )}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminBadges;
