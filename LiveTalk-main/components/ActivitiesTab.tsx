import React from 'react';
import { motion } from 'framer-motion';
import { Gamepad2, Play, Trophy, Sparkles, Star } from 'lucide-react';
import { GameType } from '../types';

interface ActivitiesTabProps {
  onOpenGame: (game: GameType) => void;
}

const ActivitiesTab: React.FC<ActivitiesTabProps> = ({ onOpenGame }) => {
  return (
    <div className="flex flex-col h-full bg-[#030816] p-6 space-y-8 overflow-y-auto scrollbar-hide pb-24" dir="rtl">
      {/* Header Section */}
      <div className="relative">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-amber-500/20 rounded-xl border border-amber-500/30">
            <Gamepad2 className="text-amber-500" size={24} />
          </div>
          <h2 className="text-2xl font-black text-white">مركز النشاطات</h2>
        </div>
        <p className="text-slate-500 text-xs font-bold pr-1">استمتع بالألعاب الحصرية وضاعف رصيدك من الكوينز!</p>
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-blue-600/10 blur-[60px] rounded-full pointer-events-none"></div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
           <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Star size={16} className="text-yellow-400 fill-yellow-400" /> الألعاب المتاحة
           </h3>
        </div>

        <div className="grid grid-cols-1 gap-4">
          
          {/* Lion King Game Card (The Main One) */}
          <motion.button 
            whileTap={{ scale: 0.97 }}
            onClick={() => onOpenGame('lion')}
            className="group relative w-full h-52 rounded-[2.5rem] overflow-hidden border border-amber-500/20 shadow-2xl text-right"
          >
             <div className="absolute inset-0 bg-gradient-to-br from-sky-600 via-indigo-900 to-black opacity-90 group-hover:opacity-100 transition-opacity"></div>
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30"></div>
             
             <div className="relative h-full p-8 flex items-center justify-between">
                <div className="space-y-2 z-10">
                   <div className="bg-yellow-400 text-black px-3 py-1 rounded-full text-[10px] font-black w-fit shadow-lg mb-2 flex items-center gap-1"><Sparkles size={10}/> مضاعفة حتى x45</div>
                   <h4 className="text-2xl font-black text-white">عجلة الأسد الملك</h4>
                   <p className="text-xs text-sky-100 font-bold max-w-[160px]">اللعبة الملكية الأكثر شهرة، 15 ثانية تفصلك عن الربح الكبير!</p>
                   <div className="pt-4 flex items-center gap-2 text-yellow-400 font-black text-xs">
                      <div className="w-8 h-8 bg-yellow-400/20 rounded-full flex items-center justify-center border border-yellow-400/30">
                         <Play size={14} fill="currentColor" />
                      </div>
                      العب الآن
                   </div>
                </div>

                <div className="relative w-36 h-36 flex items-center justify-center">
                   <motion.div 
                     animate={{ rotate: 360 }}
                     transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                     className="text-8xl filter drop-shadow-[0_0_30px_rgba(245,158,11,0.6)]"
                   >
                     🦁
                   </motion.div>
                   <div className="absolute -bottom-2 bg-amber-700 text-white text-[10px] font-black px-2 py-0.5 rounded-lg border border-yellow-500/50">🎡 King Wheel</div>
                </div>
             </div>
          </motion.button>

          <div className="grid grid-cols-2 gap-4">
              {/* Wheel Game Card */}
              <motion.button 
                whileTap={{ scale: 0.97 }}
                onClick={() => onOpenGame('wheel')}
                className="group relative w-full h-44 rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl text-right"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-indigo-950 to-black opacity-90 group-hover:opacity-100"></div>
                <div className="relative h-full p-5 flex flex-col justify-center">
                    <span className="text-4xl mb-3">🎡</span>
                    <h4 className="text-lg font-black text-white">عجلة الحظ</h4>
                    <p className="text-[10px] text-slate-400">مضاعفة حتى x8 خلال 15 ثانية</p>
                </div>
              </motion.button>

              {/* Slots Game Card */}
              <motion.button 
                whileTap={{ scale: 0.97 }}
                onClick={() => onOpenGame('slots')}
                className="group relative w-full h-44 rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl text-right"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-pink-900 via-rose-950 to-black opacity-90 group-hover:opacity-100"></div>
                <div className="relative h-full p-5 flex flex-col justify-center">
                    <span className="text-4xl mb-3">🎰</span>
                    <h4 className="text-lg font-black text-white">ماكينة الفواكه</h4>
                    <p className="text-[10px] text-slate-400">جاكبوت حتى x20</p>
                </div>
              </motion.button>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 flex items-center justify-between group overflow-hidden relative">
         <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-transparent"></div>
         <div className="relative z-10">
            <h5 className="text-white font-black text-sm mb-1 flex items-center gap-2">
               <Trophy size={16} className="text-yellow-500" /> سجل الرابحين
            </h5>
            <p className="text-[10px] text-slate-500 font-bold">شاهد أكبر الانتصارات اليومية في فيفو لايف</p>
         </div>
         <div className="bg-white/5 px-4 py-2 rounded-xl text-[10px] font-black text-slate-400 group-hover:text-white transition-colors border border-white/5">
            قريباً
         </div>
         <Sparkles className="absolute -right-4 -bottom-4 text-white/5" size={80} />
      </div>
    </div>
  );
};

export default ActivitiesTab;