
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Medal, Sparkles, Coins } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

interface Contributor {
  userId: string;
  name: string;
  avatar: string;
  amount: number;
}

interface RoomRankModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomTitle: string;
}

const RoomRankModal: React.FC<RoomRankModalProps> = ({ isOpen, onClose, roomId, roomTitle }) => {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !roomId) return;

    const q = query(
      collection(db, 'rooms', roomId, 'contributors'),
      orderBy('amount', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Contributor);
      setContributors(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, roomId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-sm bg-[#0c101b] border border-pink-500/30 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
      >
        {/* Header */}
        <div className="p-6 bg-gradient-to-br from-pink-600/20 to-indigo-900/20 border-b border-white/5 relative text-center">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 text-white/50 hover:text-white transition">
            <X size={20} />
          </button>
          <div className="w-16 h-16 bg-yellow-400/20 rounded-2xl flex items-center justify-center mb-3 border border-yellow-500/30 mx-auto shadow-lg shadow-yellow-900/20">
            <Trophy size={32} className="text-yellow-500" fill="currentColor" />
          </div>
          <h2 className="text-xl font-black text-white">ترتيب داعمي الغرفة</h2>
          <p className="text-[10px] text-pink-500 font-black uppercase tracking-widest mt-1 truncate px-4">{roomTitle}</p>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs text-slate-500 font-bold">جاري تحميل القائمة...</span>
            </div>
          ) : contributors.length === 0 ? (
            <div className="text-center py-20 opacity-30">
               <Sparkles size={40} className="mx-auto mb-2 text-slate-500" />
               <p className="text-xs font-bold text-slate-500">لا يوجد داعمون لهذه الغرفة بعد</p>
            </div>
          ) : (
            contributors.map((contrib, index) => (
              <motion.div 
                key={contrib.userId}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white/5 rounded-2xl p-3 flex items-center gap-4 border border-white/5 hover:bg-white/10 transition-colors"
                dir="rtl"
              >
                {/* Rank Badge */}
                <div className="w-8 flex justify-center shrink-0">
                  {index === 0 ? <Medal size={24} className="text-yellow-400" /> :
                   index === 1 ? <Medal size={24} className="text-slate-300" /> :
                   index === 2 ? <Medal size={24} className="text-amber-600" /> :
                   <span className="text-sm font-black text-slate-600">#{index + 1}</span>}
                </div>

                {/* Avatar */}
                <div className="relative shrink-0">
                   <img src={contrib.avatar} className="w-10 h-10 rounded-xl object-cover border border-white/10" alt="" />
                   {index === 0 && <div className="absolute -top-1 -right-1 text-xs">👑</div>}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                   <h4 className="text-xs font-black text-white truncate">{contrib.name}</h4>
                   <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[10px] font-black text-yellow-500">{contrib.amount.toLocaleString()}</span>
                      <Coins size={10} className="text-yellow-500" />
                   </div>
                </div>

                {/* Progress Visual */}
                <div className="shrink-0 flex items-center gap-1 bg-pink-600/10 px-2 py-1 rounded-lg border border-pink-500/20">
                   <Sparkles size={10} className="text-pink-500" />
                   <span className="text-[8px] font-black text-pink-500">TOP {index + 1}</span>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-black/40 text-center border-t border-white/5">
           <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">
              القائمة تشمل الداعمين النشطين في هذه الجلسة فقط
           </p>
        </div>
      </motion.div>
    </div>
  );
};

export default RoomRankModal;
