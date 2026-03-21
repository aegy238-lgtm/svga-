
import React, { useMemo, useEffect, useState } from 'react';
import { User, Room } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageCircle, Gift, Trophy, Star, Heart, Coins, Copy, ShieldCheck, MoreVertical, MicOff, UserX, RotateCcw, Users, Edit3 } from 'lucide-react';
import { db } from '../services/firebase';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';

// دالة حساب المستوى الموحدة للبروفايل
const calculateProfileLvl = (pts: number) => {
  if (!pts || pts <= 0) return 1;
  const l = Math.floor(Math.sqrt(pts / 50000)); 
  return Math.max(1, Math.min(200, l));
};

const ProfileLevelBadge: React.FC<{ level: number; type: 'wealth' | 'recharge' }> = ({ level, type }) => {
  const isWealth = type === 'wealth';
  return (
    <div className="relative h-[20px] min-w-[65px] flex items-center pr-3 group cursor-default shrink-0">
      <div className={`absolute inset-0 right-3 rounded-l-md border border-amber-500/60 shadow-lg ${
        isWealth 
          ? 'bg-gradient-to-r from-[#6a29e3] to-[#8b5cf6]' 
          : 'bg-[#121212]'
      }`}>
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]"></div>
      </div>
      <div className="relative z-10 flex-1 text-center pl-1 pr-1">
        <span className="text-[11px] font-black italic tracking-tighter text-white drop-shadow-md leading-none block transform translate-y-[0.5px]">
          {level}
        </span>
      </div>
      <div className="relative z-20 w-[22px] h-[22px] flex items-center justify-center -mr-2">
        <div className={`absolute inset-0 rounded-sm transform rotate-45 border border-amber-500 shadow-md ${
          isWealth ? 'bg-[#7c3aed]' : 'bg-[#000]'
        }`}></div>
        <span className="relative z-30 text-[10px] mb-0.5 drop-shadow-md select-none">👑</span>
      </div>
    </div>
  );
};

// Define UserProfileSheetProps interface
interface UserProfileSheetProps {
  user: User;
  onClose: () => void;
  isCurrentUser: boolean;
  onAction: (action: string) => void;
  currentUser: User;
  allUsers?: User[];
  currentRoom: Room;
}

const UserProfileSheet: React.FC<UserProfileSheetProps> = ({ user: initialUser, onClose, isCurrentUser, onAction, currentUser, allUsers = [], currentRoom }) => {
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  
  const user = useMemo(() => {
    if (initialUser.id === currentUser.id) return currentUser;
    const latest = allUsers.find(u => u.id === initialUser.id);
    return latest || initialUser;
  }, [initialUser, allUsers, currentUser]);

  const isHost = currentRoom.hostId === currentUser.id;
  const isModerator = currentRoom.moderators?.includes(currentUser.id);
  const canManage = (isHost || isModerator) && !isCurrentUser;

  // حساب المستويات حياً من البيانات الخام
  const wealthLvl = calculateProfileLvl(Number(user.wealth || 0));
  const rechargeLvl = calculateProfileLvl(Number(user.rechargePoints || 0));

  return (
    <div className="fixed inset-0 z-[160] flex items-end justify-center p-0 font-cairo">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose} 
        className="absolute inset-0 bg-black/70 backdrop-blur-[4px]" 
      />

      <motion.div 
        initial={{ y: "100%" }} 
        animate={{ y: 0 }} 
        exit={{ y: "100%" }} 
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative w-full max-w-md bg-[#030816] rounded-t-[3rem] border-t border-white/10 shadow-[0_-20px_60px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden h-[85vh]"
        dir="rtl"
      >
        {/* Background Cover */}
        <div className="absolute inset-0 z-0">
          {user.cover ? (
            <img src={user.cover} className="w-full h-full object-cover opacity-40" alt="background" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-indigo-950 via-slate-900 to-[#030816]"></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#030816] via-[#030816]/70 to-black/20"></div>
        </div>

        {/* Top Header Buttons */}
        <div className="relative z-20 h-44 w-full shrink-0">
          <div className="absolute top-6 right-6 flex items-center gap-2">
             <button onClick={onClose} className="p-2.5 bg-black/40 backdrop-blur-md rounded-full text-white/70 hover:text-white border border-white/10 transition-all">
               <X size={20} />
             </button>
          </div>

          <div className="absolute top-6 left-6 flex items-center gap-2">
             {isCurrentUser && (
                <button 
                  onClick={() => onAction('edit')}
                  className="p-2 bg-blue-600/60 backdrop-blur-md rounded-full text-white border border-blue-400/30 transition-all shadow-lg active:scale-90"
                  title="تعديل الحساب"
                >
                  <Edit3 size={16} />
                </button>
             )}
             {canManage && (
                <button 
                  onClick={() => setShowAdminMenu(!showAdminMenu)}
                  className="p-2.5 bg-black/40 backdrop-blur-md rounded-full text-white/70 border border-white/10"
                >
                  <MoreVertical size={20} />
                </button>
             )}
          </div>

          {/* User Avatar with Prominent Frame */}
          <div className="absolute bottom-2 left-8">
            <div className="relative w-28 h-28 flex items-center justify-center">
              <div className="w-[82%] h-[82%] rounded-full border-4 border-[#030816] overflow-hidden bg-slate-800 shadow-2xl relative z-10">
                <img src={user.avatar} className="w-full h-full object-cover" alt="avatar" />
              </div>
              {user.frame && (
                <img 
                  src={user.frame} 
                  className="absolute inset-0 w-full h-full object-contain z-20 pointer-events-none drop-shadow-[0_0_15px_rgba(0,0,0,0.8)]" 
                  alt="frame" 
                />
              )}
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="relative z-20 flex-1 px-8 pt-6 pb-10 space-y-6 overflow-y-auto scrollbar-hide">
          {/* Relationship Status */}
          {user.cpPartner && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-r from-purple-900/40 via-pink-600/30 to-purple-900/40 border border-pink-500/20 rounded-2xl p-3 flex items-center justify-center gap-4 shadow-xl backdrop-blur-sm"
            >
              <div className="flex items-center gap-3">
                <img src={user.avatar} className="w-10 h-10 rounded-full border-2 border-pink-500/40 object-cover" alt="" />
                <div className="flex flex-col items-center gap-0.5">
                   <Heart size={18} fill="#ec4899" className="text-pink-500 animate-pulse" />
                   <span className="text-[7px] font-black text-pink-300 uppercase tracking-widest">Sweet Couple</span>
                </div>
                <img src={user.cpPartner.avatar} className="w-10 h-10 rounded-full border-2 border-pink-500/40 object-cover shadow-lg" alt="" />
              </div>
            </motion.div>
          )}

          {/* Name and Levels */}
          <div className="text-right space-y-4">
            <div className="flex items-center justify-start gap-3 flex-wrap flex-row-reverse">
                <h2 className="text-3xl font-black text-white tracking-tight drop-shadow-lg">{user.name}</h2>
                <div className="flex items-center gap-1">
                   <ProfileLevelBadge level={wealthLvl} type="wealth" />
                   <ProfileLevelBadge level={rechargeLvl} type="recharge" />
                </div>
            </div>
            
            <button 
              onClick={() => { navigator.clipboard.writeText(user.customId || user.id); alert('تم نسخ الـ ID'); }}
              className="relative inline-flex items-center justify-center min-h-[40px] group"
            >
              {user.badge ? (
                <div className="relative flex items-center justify-center h-12 min-w-[120px] px-6">
                   <img src={user.badge} className="absolute inset-0 w-full h-full object-contain z-0 drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-transform group-active:scale-95" alt="ID Badge" />
                   <span className="relative z-10 text-white font-black text-[13px] drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] ml-6 uppercase">ID: {user.customId || user.id}</span>
                </div>
              ) : (
                <div className="bg-[#3b82f6] text-white px-5 py-2 rounded-full text-xs font-black flex items-center gap-2 w-fit shadow-lg shadow-blue-900/20 active:scale-95 transition-all">
                   ID: {user.customId || user.id}
                   <Copy size={12} className="opacity-60" />
                </div>
              )}
            </button>
          </div>

          {/* Medals / Achievements */}
          <div className="pt-2">
             <div className="flex flex-wrap gap-4 items-center">
                {user.achievements && user.achievements.length > 0 ? (
                   user.achievements.map((medal, idx) => (
                      <motion.div 
                        initial={{ scale: 0, opacity: 0 }} 
                        animate={{ scale: 1, opacity: 1 }} 
                        transition={{ delay: idx * 0.05 }}
                        key={idx} 
                        className="w-20 h-20 flex items-center justify-center p-0 transition-transform hover:scale-110"
                      >
                         <img src={medal} className="w-full h-full object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)]" alt="" />
                      </motion.div>
                   ))
                ) : (
                   <div className="w-full text-center py-6 bg-black/40 backdrop-blur-md rounded-3xl border border-white/5">
                      <p className="text-xs text-slate-500 font-bold">لا توجد أوسمة معروضة حالياً</p>
                   </div>
                )}
             </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-6">
             <button 
               onClick={() => onAction('gift')}
               className="flex-1 bg-gradient-to-r from-[#d946ef] via-[#ec4899] to-[#8b5cf6] text-white font-black py-4 rounded-[2rem] flex items-center justify-center gap-3 shadow-2xl shadow-pink-900/40 active:scale-95 transition-all text-sm uppercase tracking-wider"
             >
               إرسال هدية <Gift size={20} fill="currentColor" />
             </button>
             
             {!isCurrentUser && (
               <>
                 <button 
                   onClick={() => { onAction('cp'); onClose(); }}
                   className="w-16 h-16 bg-pink-600/20 backdrop-blur-md border border-pink-500/30 rounded-full flex items-center justify-center text-pink-500 active:scale-90 transition-all shadow-xl"
                   title="طلب ارتباط"
                 >
                   <Heart size={26} fill="currentColor" />
                 </button>
                 <button 
                   onClick={() => { onAction('message'); onClose(); }}
                   className="w-16 h-16 bg-white/10 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center text-white active:scale-90 transition-all shadow-xl"
                 >
                   <MessageCircle size={26} />
                 </button>
               </>
             )}
          </div>
        </div>
      </motion.div>

      {/* Admin Quick Menu */}
      <AnimatePresence>
        {showAdminMenu && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
             <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-xs p-6 shadow-2xl space-y-4">
                <div className="flex justify-between items-center mb-2">
                   <h4 className="text-white font-black">إدارة العضو</h4>
                   <button onClick={() => setShowAdminMenu(false)}><X size={20} className="text-slate-500" /></button>
                </div>
                <button onClick={() => { onAction('resetUserCharm'); setShowAdminMenu(false); }} className="w-full p-4 bg-white/5 rounded-2xl flex items-center gap-3 text-white text-xs font-bold hover:bg-white/10"><RotateCcw size={16} className="text-blue-400" /> تصفير الكاريزما</button>
                <button className="w-full p-4 bg-white/5 rounded-2xl flex items-center gap-3 text-red-500 text-xs font-bold hover:bg-red-500/10"><UserX size={16} /> طرد من الغرفة</button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserProfileSheet;
