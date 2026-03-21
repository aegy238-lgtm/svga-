
import React from 'react';
import { motion } from 'framer-motion';
import { X, Gamepad2, Play, Sparkles } from 'lucide-react';
import { GameType } from '../types';

interface GameCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGame: (game: GameType) => void;
}

const GameCenterModal: React.FC<GameCenterModalProps> = ({ isOpen, onClose, onSelectGame }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-md bg-slate-900 rounded-3xl border border-white/10 shadow-2xl overflow-hidden p-6"
      >
         <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
               <Gamepad2 className="text-green-500" /> مركز الألعاب
            </h2>
            <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition">
               <X size={20} className="text-slate-400" />
            </button>
         </div>

         <div className="grid grid-cols-1 gap-4">
            {/* Lion King Game (New) */}
            <div 
               onClick={() => onSelectGame('lion')}
               className="group cursor-pointer bg-gradient-to-r from-sky-600 to-indigo-800 rounded-2xl p-5 border border-white/10 hover:border-amber-500/50 transition-all hover:scale-[1.02] relative overflow-hidden"
            >
               <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-30 transition-opacity">
                  <div className="text-7xl">🦁</div>
               </div>
               <div className="flex items-center gap-4 relative z-10">
                  <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center text-4xl shadow-lg border-b-4 border-amber-700">
                     🦁
                  </div>
                  <div>
                     <h3 className="font-black text-white text-xl flex items-center gap-2">عجلة الأسد الملك <Sparkles size={14} className="text-yellow-400" /></h3>
                     <p className="text-xs text-sky-100 mt-1">اربح مضاعفات كبرى حتى x45 بنظام الـ 10 ثوانٍ!</p>
                  </div>
               </div>
               <div className="mt-4 flex items-center justify-end gap-2 text-xs font-black text-yellow-400 bg-black/20 p-2 rounded-xl">
                  <Play size={12} fill="currentColor" /> العب الآن
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               {/* Wheel Game Card */}
               <div 
                  onClick={() => onSelectGame('wheel')}
                  className="group cursor-pointer bg-gradient-to-br from-purple-900 to-indigo-900 rounded-2xl p-4 border border-white/10 hover:border-amber-500/50 transition-all hover:scale-[1.02] relative overflow-hidden"
               >
                  <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-transform">🎡</div>
                  <h3 className="font-bold text-white text-lg">عجلة الحظ</h3>
                  <p className="text-[10px] text-slate-400 mt-1">اربح حتى x8</p>
               </div>

               {/* Slots Game Card */}
               <div 
                  onClick={() => onSelectGame('slots')}
                  className="group cursor-pointer bg-gradient-to-br from-pink-900 to-red-900 rounded-2xl p-4 border border-white/10 hover:border-pink-500/50 transition-all hover:scale-[1.02] relative overflow-hidden"
               >
                  <div className="w-12 h-12 bg-pink-500/20 rounded-full flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-transform">🎰</div>
                  <h3 className="font-bold text-white text-lg">ماكينة الخضار</h3>
                  <p className="text-[10px] text-slate-400 mt-1">اربح حتى x20</p>
               </div>
            </div>
         </div>
      </motion.div>
    </div>
  );
};

export default GameCenterModal;
