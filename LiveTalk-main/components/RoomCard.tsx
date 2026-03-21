import React, { useMemo } from 'react';
import { Room } from '../types';
import { Users, BarChart2, Sparkles, Lock } from 'lucide-react';

interface RoomCardProps {
  room: Room;
  onClick: (room: Room) => void;
}

const RoomCard: React.FC<RoomCardProps> = ({ room, onClick }) => {
  const host = room.speakers?.[0];
  
  const idDisplay = useMemo(() => {
     const displayId = room.hostCustomId || host?.customId || '---';
     const badge = (host as any)?.badge;
     const isSpecial = (host as any)?.isSpecialId;

     return (
        <div className="relative inline-flex items-center justify-center">
           {badge ? (
             <div className="relative flex items-center justify-center h-7 min-w-[85px] px-4 group">
               <img 
                 src={badge} 
                 className="absolute inset-0 w-full h-full object-contain pointer-events-none z-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" 
                 alt="ID Badge"
               />
               <span className="relative z-10 text-white font-black text-[9px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] whitespace-nowrap tracking-tight pl-3">
                  ID: {displayId}
               </span>
             </div>
           ) : (
             <div 
                className={`relative z-10 flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black shadow-lg ${!isSpecial ? 'bg-white/5 border border-white/10 text-slate-300' : ''}`}
                style={isSpecial ? { backgroundColor: (host as any).idColor || '#fbbf24', color: '#000' } : {}}
              >
                 ID: {displayId}
             </div>
           )}
        </div>
     );
  }, [host, room.hostCustomId]);

  return (
    <div 
      onClick={() => onClick(room)}
      className="relative w-full h-24 bg-slate-800/50 rounded-2xl overflow-hidden border border-white/5 active:scale-95 transition-all duration-200 cursor-pointer group shadow-lg"
    >
      <div className="absolute inset-0">
        <img src={room.thumbnail} alt={room.title} className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/80 to-transparent"></div>
      </div>

      {room.isLocked && (
        <div className="absolute top-2 left-2 z-20">
           <div className="w-7 h-7 bg-amber-500/20 backdrop-blur-md rounded-lg flex items-center justify-center border border-amber-500/30 text-amber-500 shadow-lg shadow-amber-900/20">
              <Lock size={14} fill="currentColor" />
           </div>
        </div>
      )}

      <div className="absolute inset-0 p-2 flex justify-between items-center">
        <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-xl p-[2px] bg-gradient-to-br from-amber-400 to-orange-600 shadow-lg shadow-orange-900/30">
                    <img src={host?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=host'} className="w-full h-full rounded-[10px] object-cover" alt="Host" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-black/60 backdrop-blur rounded-md p-0.5 border border-white/10 flex items-center gap-0.5">
                    <div className="w-0.5 h-1.5 bg-green-500 animate-[bounce_1s_infinite]"></div>
                    <div className="w-0.5 h-2.5 bg-green-500 animate-[bounce_1.2s_infinite]"></div>
                    <div className="w-0.5 h-1.5 bg-green-500 animate-[bounce_0.8s_infinite]"></div>
                </div>
            </div>

            <div className="flex flex-col gap-0.5 min-w-0 text-right" dir="rtl">
                <div className="flex items-center gap-2">
                    <h3 className="font-black text-white text-sm truncate leading-tight tracking-tight">{room.title}</h3>
                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/10 text-white/80 border border-white/5 whitespace-nowrap">
                        {room.category}
                    </span>
                </div>
                
                <div className="flex items-center gap-2">
                    <span className="text-amber-400 font-bold text-[10px]">{host?.name || 'مستخدم جديد'}</span>
                    {idDisplay}
                </div>

                <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1 bg-black/30 px-2 py-0.5 rounded-full border border-white/5 text-[9px] text-slate-300">
                        <Users size={9} className="text-blue-400" />
                        <span>{room.listeners || 0}</span>
                    </div>
                </div>
            </div>
        </div>

        <div className="flex-shrink-0 ml-2">
             <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/10 group-hover:bg-amber-500 group-hover:text-black transition-colors">
                <BarChart2 size={14} className="-rotate-90" />
             </div>
        </div>
      </div>
    </div>
  );
};

export default RoomCard;