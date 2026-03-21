
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Shield, User as UserIcon } from 'lucide-react';
import { User, Room } from '../../types';

interface RoomMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  speakers: User[];
  listeners?: User[]; // مضاف لاستقبال الحضور الفعلي
  onSelectUser: (user: User) => void;
}

const RoomMembersModal: React.FC<RoomMembersModalProps> = ({ isOpen, onClose, room, speakers, listeners = [], onSelectUser }) => {
  if (!isOpen) return null;

  // استخدام قائمة المستمعين الفعليين لأنها تشمل الجميع (المتحدثين والمستمعين)
  // إذا كانت القائمة فارغة نعود للمتحدثين كخيار احتياطي
  const members = listeners.length > 0 ? listeners : speakers;

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose} 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ y: "100%" }} 
        animate={{ y: 0 }} 
        exit={{ y: "100%" }}
        className="relative w-full max-w-md h-[60vh] bg-[#0f172a]/95 backdrop-blur-xl border-t border-white/10 rounded-t-[2.5rem] flex flex-col overflow-hidden shadow-2xl"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500/20 rounded-lg">
               <Users size={18} className="text-emerald-400" />
            </div>
            <span className="text-sm font-black text-white">الأشخاص في الغرفة ({members.length})</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-slate-400 active:scale-90">
            <X size={20} />
          </button>
        </div>

        {/* Members List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full opacity-30 gap-3">
               <UserIcon size={40} />
               <p className="text-xs font-bold">لا يوجد أحد حالياً</p>
            </div>
          ) : (
            members.map((member) => (
              <button 
                key={member.id}
                onClick={() => { onSelectUser(member); onClose(); }}
                className="w-full flex items-center gap-4 p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all group text-right"
              >
                <div className="relative shrink-0">
                  <img src={member.avatar} className="w-12 h-12 rounded-xl object-cover border border-white/10 shadow-lg" alt="" />
                  {member.id === room.hostId && (
                    <div className="absolute -top-1 -right-1 bg-amber-500 text-black p-0.5 rounded-md shadow-lg border border-amber-600">
                       <Shield size={10} fill="currentColor" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-black text-white text-sm truncate">{member.name}</h4>
                    {member.id === room.hostId && (
                      <span className="text-[8px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20 font-black uppercase">Host</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold">ID: {member.customId || member.id}</p>
                </div>

                <div className="opacity-0 group-hover:opacity-100 transition-opacity pl-2">
                   <div className="px-3 py-1 bg-blue-600 text-white text-[9px] font-black rounded-lg shadow-lg shadow-blue-900/40">بروفايل</div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-black/40 text-center border-t border-white/5">
           <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest opacity-50">
              LiveTalk Real-time Member Discovery
           </p>
        </div>
      </motion.div>
    </div>
  );
};

export default RoomMembersModal;
