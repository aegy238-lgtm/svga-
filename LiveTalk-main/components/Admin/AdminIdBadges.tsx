
import React, { useState, useEffect } from 'react';
import { Search, Image as ImageIcon, Upload, Trash2, Plus, Sparkles, X, Send, CheckCircle2, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from '../../types';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc, arrayUnion, arrayRemove, updateDoc } from 'firebase/firestore';

interface AdminIdBadgesProps {
  users: User[];
  onUpdateUser: (userId: string, data: Partial<User>) => Promise<void>;
}

const compressImage = (base64: string, maxWidth: number, maxHeight: number, quality: number = 0.4): Promise<string> => {
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
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/webp', quality));
    };
  });
};

const AdminIdBadges: React.FC<AdminIdBadgesProps> = ({ users, onUpdateUser }) => {
  const [libraryBadges, setLibraryBadges] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedBadge, setSelectedBadge] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    const fetchLibrary = async () => {
      const docRef = doc(db, 'appSettings', 'id_badges_library');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setLibraryBadges(snap.data().badges || []);
      }
    };
    fetchLibrary();
  }, []);

  // تحسين البحث ليشمل الـ customId والـ name والـ id الفعلي
  const filteredUsers = searchQuery.trim() === '' ? [] : users.filter(u => 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.customId?.toString() === searchQuery ||
    u.id === searchQuery
  ).slice(0, 5);

  const handleUploadToLibrary = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const result = ev.target?.result as string;
        const compressed = await compressImage(result, 180, 60, 0.4);
        try {
          const docRef = doc(db, 'appSettings', 'id_badges_library');
          await setDoc(docRef, { badges: arrayUnion(compressed) }, { merge: true });
          setLibraryBadges(prev => [...prev, compressed]);
        } catch (err) {
          alert('فشل الرفع للمكتبة');
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeFromLibrary = async (url: string) => {
    if (!confirm('هل تريد حذف هذا القالب من المكتبة؟')) return;
    try {
      const docRef = doc(db, 'appSettings', 'id_badges_library');
      await updateDoc(docRef, { badges: arrayRemove(url) });
      setLibraryBadges(prev => prev.filter(b => b !== url));
    } catch (err) { alert('فشل الحذف'); }
  };

  const applyBadgeToUser = async () => {
    if (!selectedUser || !selectedBadge) {
      alert('يرجى اختيار العضو والوسام أولاً');
      return;
    }
    
    setIsApplying(true);
    try {
      // التحديث في Firestore فوراً
      await onUpdateUser(selectedUser.id, {
        badge: selectedBadge,
        isSpecialId: true
      });
      
      alert(`تم بنجاح إهداء وسام الـ ID لـ ${selectedUser.name}! سيظهر لديه الآن فوراً. ✨`);
      
      // إعادة تصفير الواجهة
      setSelectedUser(null);
      setSelectedBadge(null);
      setSearchQuery('');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء المنح.. تأكد من اتصالك بالإنترنت');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="space-y-10 text-right" dir="rtl">
      <section>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
           <div>
              <h3 className="text-2xl font-black text-white flex items-center gap-3">
                 <ImageIcon className="text-blue-500" /> مكتبة قوالب الـ ID الملكية
              </h3>
              <p className="text-slate-500 text-xs font-bold mt-1">اختر وساماً ثم ابحث عن العضو لمنحه إياه فوراً.</p>
           </div>
           <label className={`flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl text-xs font-black cursor-pointer shadow-xl active:scale-95 transition-all ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
              {isUploading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Plus size={18} />}
              إضافة وسام جديد للمكتبة
              <input type="file" accept="image/*" className="hidden" onChange={handleUploadToLibrary} />
           </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
           {libraryBadges.map((badge, idx) => (
              <motion.div 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                key={idx} 
                className={`relative group bg-slate-950/40 border-2 rounded-2xl p-4 flex items-center justify-center h-20 transition-all cursor-pointer ${selectedBadge === badge ? 'border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)] bg-blue-500/5' : 'border-white/5 hover:border-white/20'}`}
                onClick={() => setSelectedBadge(badge)}
              >
                 <img src={badge} className="w-full h-full object-contain drop-shadow-md" />
                 {selectedBadge === badge && (
                   <div className="absolute -top-2 -right-2 bg-blue-500 text-white p-1 rounded-full shadow-lg">
                      <CheckCircle2 size={14} />
                   </div>
                 )}
                 <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button onClick={(e) => { e.stopPropagation(); setSelectedBadge(badge); }} className="p-2 bg-blue-500 text-white rounded-xl shadow-lg"><Send size={14}/></button>
                    <button onClick={(e) => { e.stopPropagation(); removeFromLibrary(badge); }} className="p-2 bg-red-600 text-white rounded-xl shadow-lg"><Trash2 size={14}/></button>
                 </div>
              </motion.div>
           ))}
        </div>
      </section>

      <AnimatePresence>
        {selectedBadge && (
          <motion.section 
            initial={{ opacity: 0, y: 30 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: 20 }}
            className="bg-slate-900 border border-blue-500/30 rounded-[3rem] p-8 shadow-2xl relative overflow-hidden"
          >
             <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-[60px] rounded-full pointer-events-none"></div>
             
             <div className="max-w-xl relative z-10">
                <div className="flex justify-between items-start mb-6">
                   <h3 className="text-xl font-black text-white flex items-center gap-3">
                      <Sparkles className="text-blue-400" /> إهداء الوسام لعضو
                   </h3>
                   <button onClick={() => setSelectedBadge(null)} className="p-2 bg-white/5 rounded-full text-slate-500 hover:text-white"><X size={20}/></button>
                </div>

                <div className="space-y-6">
                   <div className="space-y-3">
                      <label className="text-xs font-black text-slate-400 pr-2">ابحث عن العضو (بالاسم أو الآيدي):</label>
                      <div className="relative group">
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={20} />
                        <input 
                          type="text" 
                          placeholder="مثال: 123456" 
                          value={searchQuery} 
                          onChange={(e) => setSearchQuery(e.target.value)} 
                          className="w-full bg-slate-950 border border-white/10 rounded-2xl py-4 pr-14 text-white text-sm outline-none focus:border-blue-500/50 shadow-xl transition-all font-black" 
                        />
                      </div>
                      
                      <AnimatePresence>
                        {filteredUsers.length > 0 && (
                           <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-2 bg-slate-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl divide-y divide-white/5">
                              {filteredUsers.map(u => (
                                 <button 
                                   key={u.id} 
                                   onClick={() => { setSelectedUser(u); setSearchQuery(''); }}
                                   className={`w-full p-4 flex items-center gap-4 hover:bg-white/5 transition-all text-right ${selectedUser?.id === u.id ? 'bg-blue-600/10' : ''}`}
                                 >
                                    <img src={u.avatar} className="w-10 h-10 rounded-xl object-cover border border-white/10 shadow-md" />
                                    <div className="flex-1">
                                       <p className="font-black text-white text-sm">{u.name}</p>
                                       <p className="text-[10px] text-slate-500 font-bold">ID: {u.customId || u.id}</p>
                                    </div>
                                    {selectedUser?.id === u.id && <CheckCircle2 size={18} className="text-blue-500" />}
                                 </button>
                              ))}
                           </motion.div>
                        )}
                      </AnimatePresence>
                   </div>

                   {selectedUser && (
                      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col sm:flex-row items-center gap-6 p-6 bg-blue-600/10 rounded-[2rem] border border-blue-500/20">
                         <div className="flex-1 text-center sm:text-right">
                            <p className="text-white text-sm font-black mb-1">هل أنت متأكد من منح الوسام لـ <span className="text-blue-400">{selectedUser.name}</span>؟</p>
                            <p className="text-[10px] text-slate-500 font-bold italic">سيتم استبدال وسام الـ ID الحالي (إن وجد) بالوسام الجديد فوراً.</p>
                         </div>
                         <button 
                            onClick={applyBadgeToUser} 
                            disabled={isApplying} 
                            className="w-full sm:w-auto px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs shadow-xl shadow-blue-900/40 active:scale-95 transition-all disabled:opacity-50"
                         >
                            {isApplying ? 'جاري التنفيذ...' : 'تأكيد الإهداء الآن'}
                         </button>
                      </motion.div>
                   )}
                </div>
             </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminIdBadges;
