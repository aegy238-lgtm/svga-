import React from 'react';
import { motion } from 'framer-motion';
// Added Coins to the imports to fix the "Cannot find name 'Coins'" error
import { Trophy, Star, Sparkles, Crown, Zap, Flame, Clover, Coins } from 'lucide-react';
import { GlobalAnnouncement } from '../types';

interface GlobalBannerProps {
  announcement: GlobalAnnouncement;
}

const GlobalBanner: React.FC<GlobalBannerProps> = ({ announcement }) => {
  const isLuckyWin = announcement.type === 'lucky_win';
  const isBigWin = announcement.amount >= 100000;

  const renderIcon = (icon: string) => {
    if (!icon) return null;
    const isImage = icon.startsWith('http') || icon.startsWith('data:');
    return isImage ? (
      <img src={icon} className="w-7 h-7 object-contain" alt="" />
    ) : (
      <span className="text-xl">{icon}</span>
    );
  };

  // تحديد نظام الألوان بناءً على نوع الإعلان
  let bannerStyle = "bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-700 border-indigo-400/30";
  let glowColor = "bg-purple-600";
  
  if (isLuckyWin) {
    // لون أخضر زمردي مميز لمكسب الحظ
    bannerStyle = "bg-gradient-to-r from-emerald-600 via-teal-400 to-cyan-600 border-emerald-200/50 shadow-[0_0_25px_rgba(16,185,129,0.4)]";
    glowColor = "bg-emerald-500";
  } else if (isBigWin) {
    // لون ذهبي ملكي للهدايا الكبرى
    bannerStyle = "bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600 border-yellow-200/50 shadow-[0_0_25px_rgba(245,158,11,0.4)]";
    glowColor = "bg-amber-500";
  }

  return (
    <div className="fixed top-14 left-0 right-0 z-[10000] pointer-events-none flex justify-center px-4">
      {/* تأثير الهالة الضوئية خلف الشريط */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: [0, 0.4, 0], scale: [1, 1.8, 1.2] }}
        transition={{ duration: 3, repeat: Infinity }}
        className={`absolute inset-0 blur-[60px] opacity-20 rounded-full ${glowColor}`}
      />

      <motion.div
        // حركة احترافية: دخول -> وقوف في المنتصف لمدة ثانيتين -> خروج
        initial={{ x: "120%", opacity: 0, scale: 0.8 }}
        animate={{ 
          x: ["120%", "0%", "0%", "-120%"],
          opacity: [0, 1, 1, 0],
          scale: [0.8, 1.05, 1.05, 0.8]
        }}
        transition={{
          times: [0, 0.15, 0.85, 1], // يقضي 70% من الوقت متوقفاً في المنتصف
          duration: 6,
          ease: "easeInOut"
        }}
        className={`relative w-full max-w-[360px] flex items-center gap-3 px-4 py-2.5 rounded-full border-2 shadow-[0_15px_45px_rgba(0,0,0,0.6)] overflow-hidden ${bannerStyle}`}
      >
        {/* تأثير المسح الضوئي (Shimmer) */}
        <motion.div 
          animate={{ x: ['-100%', '300%'] }} 
          transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-25 w-1/3 pointer-events-none"
        />

        {/* الأيقونة الجانبية */}
        <div className="flex-shrink-0 relative">
          <div className="w-10 h-10 bg-black/40 rounded-full flex items-center justify-center border border-white/25 shadow-inner overflow-hidden">
            {isLuckyWin ? (
               <Clover size={22} className="text-emerald-300 animate-pulse" fill="currentColor" />
            ) : renderIcon(announcement.giftIcon)}
          </div>
          <div className="absolute -top-1 -right-1">
            {isLuckyWin ? (
              <Zap size={14} className="text-yellow-300 fill-yellow-300 animate-bounce" />
            ) : isBigWin ? (
              <Crown size={14} className="text-white drop-shadow-md animate-bounce" fill="currentColor" />
            ) : (
              <Star size={14} className="text-yellow-300 fill-yellow-300" />
            )}
          </div>
        </div>

        {/* نصوص الإعلان */}
        <div className="flex-1 text-right overflow-hidden">
          <div className="flex items-center justify-end gap-1.5 font-black text-[11px] md:text-xs text-white leading-none">
            <span className="truncate drop-shadow-md">{announcement.senderName}</span>
            <span className="opacity-80 font-bold drop-shadow-sm">
               {isLuckyWin ? 'اكتسح الحظ!' : 'أرسل هدية'}
            </span>
          </div>
          
          <div className="flex items-center justify-end gap-2 mt-1">
            {isLuckyWin ? (
              <div className="flex items-center gap-1.5 bg-black/20 px-2 py-0.5 rounded-lg border border-white/10">
                <span className="text-emerald-50 font-black text-sm md:text-base tracking-tighter drop-shadow-md">
                  {(announcement.amount).toLocaleString()}
                </span>
                <Coins size={12} className="text-yellow-400 fill-yellow-400" />
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                 <span className="text-white/90 truncate max-w-[90px] font-bold text-[11px]">{announcement.recipientName}</span>
                 <div className="bg-black/30 px-2 py-0.5 rounded-lg text-yellow-400 font-mono text-[10px] border border-white/15 shadow-sm font-black">
                   {announcement.amount.toLocaleString()}
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* معلومات الغرفة */}
        <div className="flex flex-col items-center border-r border-white/30 pr-3 mr-1">
           <Flame size={14} className={`${isLuckyWin ? 'text-cyan-300' : 'text-orange-500'} animate-pulse`} />
           <span className="text-[7px] font-black text-white/80 uppercase tracking-tighter truncate max-w-[50px]">
             {announcement.roomTitle}
           </span>
        </div>

        {/* تأثير الجزيئات المتطايرة */}
        <Sparkles size={12} className="absolute top-1 left-4 text-white/40 animate-ping" />
        <Sparkles size={8} className="absolute bottom-1 right-12 text-white/30 animate-pulse" />
      </motion.div>
    </div>
  );
};

export default GlobalBanner;