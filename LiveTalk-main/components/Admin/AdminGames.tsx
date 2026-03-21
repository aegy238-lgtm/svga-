
import React, { useState } from 'react';
import { Activity, Smile, Upload, Timer, Zap, RefreshCcw, Target, LayoutGrid, X, Trophy, Coins, Settings2, Sparkles, Key } from 'lucide-react';
import { GameSettings, LuckyMultiplier } from '../../types';
import { motion } from 'framer-motion';

interface AdminGamesProps {
  gameSettings: GameSettings;
  onUpdateGameSettings: (updates: Partial<GameSettings>) => Promise<void>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, callback: (url: string) => void, w: number, h: number) => void;
}

const AdminGames: React.FC<AdminGamesProps> = ({ gameSettings, onUpdateGameSettings, handleFileUpload }) => {
  // تحديث نسبة الحظ للهدايا
  const updateLuckyWinRate = (val: number) => {
    onUpdateGameSettings({ luckyGiftWinRate: val });
  };

  // تحديث نسبة الفوز لعجلة الحظ
  const updateWheelLuck = (val: number) => {
    onUpdateGameSettings({ wheelWinRate: val });
  };

  // تحديث نسبة الفوز للسلوتس
  const updateSlotsLuck = (val: number) => {
    onUpdateGameSettings({ slotsWinRate: val });
  };

  // تحديث منفصل للعبة الأسد
  const updateLionGameLuck = (val: number) => {
    onUpdateGameSettings({ lionWinRate: val });
  };

  // تحديث مفاتيح الرهان
  const updateChips = (game: 'wheel' | 'slots' | 'lion', index: number, value: string) => {
    const num = parseInt(value) || 0;
    const key = game === 'wheel' ? 'wheelChips' : game === 'slots' ? 'slotsChips' : 'lionChips';
    const current = [...(gameSettings[key] || [0, 0, 0, 0])];
    current[index] = num;
    onUpdateGameSettings({ [key]: current });
  };

  // تفعيل الأكسات الفائقة (من 1 إلى 1000)
  const toggleSuperMultipliers = () => {
    const isCurrentlyEnabled = gameSettings.luckyXEnabled;
    const superMuls: LuckyMultiplier[] = [
      { label: 'X1', value: 1, chance: 50 },
      { label: 'X10', value: 10, chance: 30 },
      { label: 'X100', value: 100, chance: 15 },
      { label: 'X500', value: 500, chance: 4 },
      { label: 'X1000', value: 1000, chance: 1 }
    ];
    
    onUpdateGameSettings({ 
      luckyXEnabled: !isCurrentlyEnabled,
      luckyMultipliers: superMuls
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 text-right font-cairo" dir="rtl">
      {/* Header Section */}
      <div className="bg-slate-950/40 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
           <Settings2 size={120} />
        </div>
        <div className="relative z-10 text-center md:text-right">
          <h3 className="text-3xl font-black text-white flex items-center justify-center md:justify-start gap-3">
             <div className="p-2 bg-amber-500 rounded-2xl shadow-lg shadow-amber-900/40"><Activity className="text-black" /></div>
             مركز التحكم الفائق بالحظ
          </h3>
          <p className="text-slate-500 text-sm font-bold mt-2 pr-1">إدارة شاملة لنسب الأرباح ومفاتيح الرهان بضغطة واحدة.</p>
        </div>
        <div className="flex gap-2">
           <div className="px-4 py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-500 text-[10px] font-black tracking-widest uppercase">System Active</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Lucky Gifts Control Card */}
        <motion.div whileHover={{ y: -5 }} className="bg-[#0f172a] border border-amber-500/20 p-8 rounded-[3rem] shadow-2xl space-y-8 relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-30"></div>
           
           <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-black text-white flex items-center gap-2"><Zap className="text-amber-400" /> هدايا الحظ</h4>
                <p className="text-[10px] text-slate-500 font-bold mt-1">نسبة فوز الصناديق في الغرف</p>
              </div>
              <div className="bg-amber-500 text-black px-4 py-1 rounded-full font-black text-xl shadow-lg">{gameSettings.luckyGiftWinRate}%</div>
           </div>
           
           <div className="space-y-6">
              <input 
                type="range" min="0" max="100" 
                value={gameSettings.luckyGiftWinRate} 
                onChange={(e) => updateLuckyWinRate(parseInt(e.target.value))}
                className="w-full h-4 bg-slate-800 rounded-2xl appearance-none cursor-pointer accent-amber-500 border border-white/5" 
              />
              <div className="flex justify-between text-[10px] font-black text-slate-600 px-1">
                 <span className="flex items-center gap-1"><X size={10}/> خسارة (0%)</span>
                 <span className="flex items-center gap-1 text-amber-500">فوز دائم (100%) <Sparkles size={10}/></span>
              </div>
           </div>

           <div className="pt-6 border-t border-white/5">
              <button 
                onClick={toggleSuperMultipliers}
                className={`w-full py-5 rounded-[1.5rem] font-black text-xs flex items-center justify-center gap-3 transition-all shadow-xl active:scale-95 ${gameSettings.luckyXEnabled ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-black shadow-amber-500/20' : 'bg-slate-800 text-slate-500 border border-white/5'}`}
              >
                 <Target size={20} />
                 {gameSettings.luckyXEnabled ? 'تعطيل مضاعفات الحظ (X1000)' : 'تفعيل المضاعفات القصوى (X1 - X1000)'}
              </button>
           </div>
        </motion.div>

        {/* Lion King Game Control Card */}
        <motion.div whileHover={{ y: -5 }} className="bg-[#030816] border border-orange-500/30 p-8 rounded-[3rem] shadow-2xl space-y-6 relative overflow-hidden">
           <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-black text-white flex items-center gap-2">
                   <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-lg">🦁</div>
                   عجلة الأسد الملك
                </h4>
                <p className="text-[10px] text-slate-500 font-bold mt-1">التحكم في حظ ومفاتيح لعبة الأسد</p>
              </div>
              <div className="bg-orange-600 text-white px-4 py-1 rounded-full font-black text-xl shadow-lg">{(gameSettings.lionWinRate || 30)}%</div>
           </div>

           <div className="space-y-4">
              <input 
                type="range" min="0" max="100" 
                value={gameSettings.lionWinRate || 30} 
                onChange={(e) => updateLionGameLuck(parseInt(e.target.value))}
                className="w-full h-4 bg-slate-800 rounded-2xl appearance-none cursor-pointer accent-orange-500 border border-white/5" 
              />
              <div className="flex justify-between text-[8px] font-black text-slate-600">
                 <span>حظ منخفض</span>
                 <span>حظ ملكي 100%</span>
              </div>
           </div>

           <div className="space-y-3 pt-4 border-t border-white/5">
              <h5 className="text-[10px] font-black text-orange-500 uppercase flex items-center gap-2"><Key size={12}/> مفاتيح الرهان (الأسد)</h5>
              <div className="grid grid-cols-4 gap-2">
                 {(gameSettings.lionChips || [100, 1000, 10000, 100000]).map((chip, idx) => (
                    <input key={idx} type="number" value={chip} onChange={(e) => updateChips('lion', idx, e.target.value)} className="bg-black/40 border border-white/5 rounded-xl p-2 text-[10px] font-black text-white text-center outline-none focus:border-orange-500" />
                 ))}
              </div>
           </div>
        </motion.div>

        {/* Wheel Game Control Card */}
        <motion.div whileHover={{ y: -5 }} className="bg-[#0f172a] border border-purple-500/20 p-8 rounded-[3rem] shadow-2xl space-y-6 relative overflow-hidden">
           <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-black text-white flex items-center gap-2"><RefreshCcw className="text-purple-400" /> عجلة الحظ</h4>
                <p className="text-[10px] text-slate-500 font-bold mt-1">نسبة فوز اللاعبين في العجلة</p>
              </div>
              <div className="bg-purple-600 text-white px-4 py-1 rounded-full font-black text-xl shadow-lg">{gameSettings.wheelWinRate}%</div>
           </div>

           <div className="space-y-4">
              <input 
                type="range" min="0" max="100" 
                value={gameSettings.wheelWinRate} 
                onChange={(e) => updateWheelLuck(parseInt(e.target.value))}
                className="w-full h-4 bg-slate-800 rounded-2xl appearance-none cursor-pointer accent-purple-500 border border-white/5" 
              />
              <div className="flex justify-between text-[8px] font-black text-slate-600">
                 <span>خسارة (0%)</span>
                 <span>فوز كامل (100%)</span>
              </div>
           </div>

           <div className="space-y-3 pt-4 border-t border-white/5">
              <h5 className="text-[10px] font-black text-purple-400 uppercase flex items-center gap-2"><Key size={12}/> مفاتيح الرهان (العجلة)</h5>
              <div className="grid grid-cols-2 gap-2">
                 {(gameSettings.wheelChips || [10000, 1000000, 5000000, 20000000]).map((chip, idx) => (
                    <input key={idx} type="number" value={chip} onChange={(e) => updateChips('wheel', idx, e.target.value)} className="bg-black/40 border border-white/5 rounded-xl p-2 text-[10px] font-black text-white text-center outline-none focus:border-purple-500" />
                 ))}
              </div>
           </div>
        </motion.div>

        {/* Slots Game Control Card */}
        <motion.div whileHover={{ y: -5 }} className="bg-[#0f172a] border border-pink-500/20 p-8 rounded-[3rem] shadow-2xl space-y-6 relative overflow-hidden">
           <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-black text-white flex items-center gap-2"><LayoutGrid className="text-pink-400" /> ماكينة الفواكه</h4>
                <p className="text-[10px] text-slate-500 font-bold mt-1">نسبة فوز اللاعبين في السلوتس</p>
              </div>
              <div className="bg-pink-600 text-white px-4 py-1 rounded-full font-black text-xl shadow-lg">{gameSettings.slotsWinRate}%</div>
           </div>

           <div className="space-y-4">
              <input 
                type="range" min="0" max="100" 
                value={gameSettings.slotsWinRate} 
                onChange={(e) => updateSlotsLuck(parseInt(e.target.value))}
                className="w-full h-4 bg-slate-800 rounded-2xl appearance-none cursor-pointer accent-pink-500 border border-white/5" 
              />
              <div className="flex justify-between text-[8px] font-black text-slate-600">
                 <span>خسارة (0%)</span>
                 <span>فوز كامل (100%)</span>
              </div>
           </div>

           <div className="space-y-3 pt-4 border-t border-white/5">
              <h5 className="text-[10px] font-black text-pink-400 uppercase flex items-center gap-2"><Key size={12}/> مفاتيح الرهان (السلوتس)</h5>
              <div className="grid grid-cols-2 gap-2">
                 {(gameSettings.slotsChips || [10000, 1000000, 5000000, 20000000]).map((chip, idx) => (
                    <input key={idx} type="number" value={chip} onChange={(e) => updateChips('slots', idx, e.target.value)} className="bg-black/40 border border-white/5 rounded-xl p-2 text-[10px] font-black text-white text-center outline-none focus:border-pink-500" />
                 ))}
              </div>
           </div>
        </motion.div>

      </div>
    </div>
  );
};

export default AdminGames;
