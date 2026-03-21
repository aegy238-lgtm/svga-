
import React, { useState } from 'react';
import { Search, Trash2, Users, Mic, Home, AlertCircle, ExternalLink } from 'lucide-react';
import { Room } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../services/firebase';
import { doc, deleteDoc } from 'firebase/firestore';

interface AdminRoomsProps {
  rooms: Room[];
}

const AdminRooms: React.FC<AdminRoomsProps> = ({ rooms }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRooms = rooms.filter(room => 
    room.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    room.hostCustomId?.toString().includes(searchQuery) ||
    room.id.includes(searchQuery)
  );

  const handleDeleteRoom = async (room: Room) => {
    if (!confirm(`هل أنت متأكد من حذف غرفة "${room.title}"؟ سيتم طرد جميع المستخدمين وإغلاق الغرفة فوراً.`)) return;

    try {
      await deleteDoc(doc(db, 'rooms', room.id));
      alert('تم حذف الغرفة وإغلاقها بنجاح ✅');
    } catch (e) {
      alert('حدث خطأ أثناء محاولة حذف الغرفة');
    }
  };

  return (
    <div className="space-y-8 text-right font-cairo" dir="rtl">
      <div className="bg-slate-950/40 p-8 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="text-2xl font-black text-white flex items-center gap-3">
            <div className="p-2 bg-red-600 rounded-xl shadow-lg shadow-red-900/40"><Home className="text-white" /></div>
            إدارة وحذف الغرف الخارجية
          </h3>
          <p className="text-slate-500 text-xs font-bold mt-2 pr-1">يمكنك مراقبة جميع الغرف النشطة في التطبيق وحذف أي غرفة مخالفة بضغطة زر.</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
        <input 
          type="text" 
          placeholder="بحث عن غرفة (عنوان أو ID)..." 
          value={searchQuery} 
          onChange={(e) => setSearchQuery(e.target.value)} 
          className="w-full bg-slate-950/50 border border-white/10 rounded-2xl py-4 pr-12 text-white text-sm outline-none shadow-lg focus:border-red-500/50 transition-all" 
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {filteredRooms.map(room => (
            <motion.div 
              key={room.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-slate-900/60 border border-white/5 rounded-[2rem] overflow-hidden group hover:border-red-500/30 transition-all shadow-xl"
            >
              <div className="relative h-32 overflow-hidden">
                <img src={room.thumbnail} className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-700" alt="" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>
                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5">
                   <Users size={12} className="text-emerald-400" />
                   <span className="text-[10px] font-black text-white">{room.listeners || 0}</span>
                </div>
                {room.isLocked && (
                  <div className="absolute top-3 left-3 bg-amber-500 text-black p-1.5 rounded-lg shadow-lg">
                    <AlertCircle size={14} />
                  </div>
                )}
              </div>

              <div className="p-5 space-y-4">
                <div className="text-right">
                  <h4 className="font-black text-white text-sm truncate">{room.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-md">{room.category}</span>
                  </div>
                </div>

                <div className="bg-black/30 p-3 rounded-xl border border-white/5 flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10">
                        <img src={room.speakers?.[0]?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=room'} className="w-full h-full object-cover" />
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black text-amber-500 leading-none">{room.speakers?.[0]?.name || 'مضيف'}</p>
                        <p className="text-[8px] text-slate-500 mt-1">ID: {room.hostCustomId || room.hostId}</p>
                      </div>
                   </div>
                   <Mic size={14} className="text-slate-700" />
                </div>

                <button 
                  onClick={() => handleDeleteRoom(room)}
                  className="w-full py-3 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-red-900/10"
                >
                  <Trash2 size={16} /> حذف وإغلاق الغرفة
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredRooms.length === 0 && (
        <div className="py-20 text-center opacity-30">
          <Home size={60} className="mx-auto mb-4 text-slate-600" />
          <p className="font-black text-slate-500">لا توجد غرف نشطة مطابقة للبحث</p>
        </div>
      )}
    </div>
  );
};

export default AdminRooms;
