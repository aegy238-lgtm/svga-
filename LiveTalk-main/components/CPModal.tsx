import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, Users, Search, Sparkles, Coins, Zap, UserPlus, Trash2 } from 'lucide-react';
import { User, GameSettings, CPPartner } from '../types';
import { db } from '../services/firebase';
import { doc, updateDoc, increment, writeBatch } from 'firebase/firestore';

interface CPModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  users: User[];
  gameSettings: GameSettings;
  onUpdateUser: (data: Partial<User>) => void;
}

const CPModal: React.FC<CPModalProps> = ({ isOpen, onClose, currentUser, users, gameSettings, onUpdateUser }) => {
  const [searchId, setSearchId] = useState('');
  const [selectedType, setSelectedType] = useState<'cp' | 'friend'>('cp');
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleSearch = () => {
    const found = users.find(u => u.customId?.toString() === searchId || u.id === searchId);
    if (found) {
       if (found.id === currentUser.id) return alert('لا يمكنك الارتباط بنفسك!');
       setTargetUser(found);
    } else {
       alert('المستخدم غير موجود');
    }
  };

  const handleEstablish = async () => {
    if (!targetUser || isProcessing) return;
    const isCp = selectedType === 'cp';
    const price = isCp ? (gameSettings.cpGiftPrice || 0) : (gameSettings.friendGiftPrice || 0);
    const partnerField = isCp ? 'cpPartner' : 'friendPartner';

    if (currentUser.coins < price) return alert('رصيدك لا يكفي لإتمام هذا الارتباط');
    
    // التحقق إذا كان مرتبطاً بالفعل بنفس النوع
    if (isCp && currentUser.cpPartner) return alert('لديك ارتباط CP بالفعل، قم بإنهائه أولاً');
    if (!isCp && currentUser.friendPartner) return alert('لديك علاقة صداقة بالفعل، قم بإنهائها أولاً');

    setIsProcessing(true);
    try {
       const batch = writeBatch(db);
       const partnerData: CPPartner = { id: targetUser.id, name: targetUser.name, avatar: targetUser.avatar, type: selectedType };
       const selfData: CPPartner = { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar, type: selectedType };

       // تحديث حساب المرسل (خصم كوينز وإضافة شريك)
       batch.update(doc(db, 'users', currentUser.id), { 
         [partnerField]: partnerData, 
         coins: increment(-price) 
       });
       
       // تحديث حساب الشريك (إضافة شريك فقط)
       batch.update(doc(db, 'users', targetUser.id), { 
         [partnerField]: selfData 
       });

       await batch.commit();

       onUpdateUser({ [partnerField]: partnerData, coins: currentUser.coins - price });
       alert(`مبروك! تم تفعيل ${isCp ? 'الارتباط الملكي' : 'الصداقة المقربة'} بنجاح! ✨`);
       setTargetUser(null);
       setSearchId('');
    } catch (e) {
       alert('حدث خطأ أثناء تفعيل الارتباط');
    } finally {
       setIsProcessing(false);
    }
  };

  const handleBreakRelation = async (type: 'cp' | 'friend') => {
    if (isProcessing) return;
    const relationName = type === 'cp' ? 'ارتباط CP' : 'علاقة الصداقة';
    const partnerField = type === 'cp' ? 'cpPartner' : 'friendPartner';
    const partner = type === 'cp' ? currentUser.cpPartner : currentUser.friendPartner;
    
    if (!partner) return;
    if (!confirm(`هل أنت متأكد من رغبتك في إنهاء ${relationName}؟ سيتم حذفه لدى الطرفين نهائياً من البروفايل.`)) return;

    setIsProcessing(true);
    try {
       const batch = writeBatch(db);
       const partnerId = partner.id;

       // حذف العلاقة من حساب المستخدم الحالي
       batch.update(doc(db, 'users', currentUser.id), { [partnerField]: null });
       
       // حذف العلاقة من حساب الطرف الآخر فوراً لضمان الاختفاء من بروفايله أيضاً
       batch.update(doc(db, 'users', partnerId), { [partnerField]: null });

       await batch.commit();
       
       onUpdateUser({ [partnerField]: null });
       alert(`تم إنهاء ${relationName} وحذفه من البروفايلات بنجاح.`);
    } catch (e) {
       alert('حدث خطأ أثناء محاولة إنهاء العلاقة');
    } finally {
       setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md font-cairo">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-sm bg-slate-900 border border-pink-500/30 rounded-[2.5rem] overflow-hidden shadow-2xl"
        dir="rtl"
      >
        <div className="p-6 bg-gradient-to-br from-pink-600/20 to-purple-600/20 border-b border-white/5 relative text-center">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 text-white/50 hover:text-white transition"><X size={20} /></button>
          <div className="w-16 h-16 bg-pink-500/20 rounded-full flex items-center justify-center mb-3 border border-pink-500/30 mx-auto shadow-lg">
            <Heart size={32} fill={(currentUser.cpPartner || currentUser.friendPartner) ? "#ec4899" : "none"} className="text-pink-500" />
          </div>
          <h2 className="text-xl font-black text-white">نظام العلاقات المزدوج</h2>
          <p className="text-[10px] text-pink-300 font-bold uppercase tracking-widest">ارتبط وكون صداقات في آن واحد</p>
        </div>

        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto scrollbar-hide">
           {/* قسم العلاقات الحالية */}
           {(currentUser.cpPartner || currentUser.friendPartner) && (
              <div className="space-y-3">
                 <h3 className="text-[10px] font-black text-slate-500 uppercase pr-2">علاقاتك النشطة:</h3>
                 
                 {currentUser.cpPartner && (
                    <div className="bg-gradient-to-r from-pink-600/10 to-purple-600/10 rounded-2xl border border-pink-500/20 p-3 flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <img src={currentUser.cpPartner.avatar} className="w-10 h-10 rounded-full border border-pink-500/30 object-cover" />
                          <div>
                             <p className="text-white font-black text-xs">{currentUser.cpPartner.name}</p>
                             <p className="text-[8px] text-pink-400 font-bold">ارتباط CP الملكي ❤️</p>
                          </div>
                       </div>
                       <button onClick={() => handleBreakRelation('cp')} className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"><Trash2 size={16} /></button>
                    </div>
                 )}

                 {currentUser.friendPartner && (
                    <div className="bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-2xl border border-blue-500/20 p-3 flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <img src={currentUser.friendPartner.avatar} className="w-10 h-10 rounded-full border border-blue-500/30 object-cover" />
                          <div>
                             <p className="text-white font-black text-xs">{currentUser.friendPartner.name}</p>
                             <p className="text-[8px] text-blue-400 font-bold">صديق مقرب 🌟</p>
                          </div>
                       </div>
                       <button onClick={() => handleBreakRelation('friend')} className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"><Trash2 size={16} /></button>
                    </div>
                 )}
              </div>
           )}

           {/* قسم إنشاء علاقة جديدة */}
           <div className="space-y-4 pt-4 border-t border-white/5">
              <h3 className="text-[10px] font-black text-slate-500 uppercase pr-2">إنشاء علاقة جديدة:</h3>
              <div className="flex gap-2 p-1 bg-black/40 rounded-xl">
                 <button onClick={() => setSelectedType('cp')} className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${selectedType === 'cp' ? 'bg-pink-600 text-white shadow-lg' : 'text-slate-500'}`}>ارتباط CP</button>
                 <button onClick={() => setSelectedType('friend')} className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${selectedType === 'friend' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}>صداقة</button>
              </div>

              <div className="space-y-2">
                 <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={searchId}
                      onChange={(e) => setSearchId(e.target.value)}
                      className="flex-1 bg-black/40 border border-white/10 rounded-xl p-3 text-white text-xs font-black outline-none focus:border-pink-500/50"
                      placeholder="ID الشريك..."
                    />
                    <button onClick={handleSearch} className="px-4 bg-slate-800 text-white rounded-xl active:scale-95 transition-all"><Search size={18}/></button>
                 </div>
              </div>

              {targetUser && (
                 <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, scale: 1 }} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4">
                    <div className="flex items-center gap-3">
                       <img src={targetUser.avatar} className="w-12 h-12 rounded-xl object-cover" />
                       <div className="flex-1 text-right">
                          <div className="text-xs font-black text-white">{targetUser.name}</div>
                          <div className="text-[9px] text-slate-500">ID: {targetUser.customId || targetUser.id}</div>
                       </div>
                    </div>
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                       <div className="flex flex-col">
                          <span className="text-[8px] text-slate-500 font-bold uppercase">سعر التفعيل</span>
                          <div className="flex items-center gap-1 text-yellow-500 font-black text-sm">
                             {selectedType === 'cp' ? (gameSettings.cpGiftPrice || 0) : (gameSettings.friendGiftPrice || 0)} <Coins size={12} />
                          </div>
                       </div>
                       <button 
                         onClick={handleEstablish} 
                         disabled={isProcessing}
                         className={`px-6 py-2 ${selectedType === 'cp' ? 'bg-pink-600' : 'bg-blue-600'} text-white font-black text-[10px] rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50`}
                       >
                          {isProcessing ? 'جاري...' : 'تفعيل الآن'}
                       </button>
                    </div>
                 </motion.div>
              )}
           </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CPModal;