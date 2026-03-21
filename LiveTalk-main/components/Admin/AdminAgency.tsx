
import React, { useState } from 'react';
import { Search, Zap, UserCheck, ShieldOff, Coins, PlusCircle, CheckCircle2 } from 'lucide-react';
import { User } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';

interface AdminAgencyProps {
  users: User[];
  onUpdateUser: (userId: string, data: Partial<User>) => Promise<void>;
}

const AdminAgency: React.FC<AdminAgencyProps> = ({ users, onUpdateUser }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [coinsToAdd, setCoinsToAdd] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const filteredUsers = searchQuery.trim() === '' ? [] : users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.customId?.toString() === searchQuery ||
    u.id === searchQuery
  ).slice(0, 5);

  const handleToggleAgency = async (u: User) => {
    const isAgency = !u.isAgency;
    await onUpdateUser(u.id, { isAgency, agencyBalance: isAgency ? (u.agencyBalance || 0) : 0 });
    alert(isAgency ? 'تم تفعيل الوكالة بنجاح ✅' : 'تم سحب صلاحية الوكالة ❌');
    setSelectedUser(null);
  };

  const handleAddAgencyBalance = async () => {
    if (!selectedUser || !coinsToAdd) return;
    const amount = parseInt(coinsToAdd);
    if (isNaN(amount) || amount <= 0) return;

    setLoading(true);
    try {
      await onUpdateUser(selectedUser.id, { agencyBalance: (selectedUser.agencyBalance || 0) + amount });
      alert(`تم إضافة ${amount.toLocaleString()} كوينز لرصيد الوكالة ✅`);
      setCoinsToAdd('');
      setSelectedUser(null);
    } catch (e) {
      alert('فشلت العملية');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 text-right font-cairo" dir="rtl">
      <div className="bg-slate-950/40 p-8 rounded-[2.5rem] border border-white/10 shadow-2xl">
         <h3 className="text-2xl font-black text-white flex items-center gap-3">
            <Zap className="text-orange-500" /> إدارة وكالات الشحن
         </h3>
         <p className="text-slate-500 text-xs font-bold mt-2">يمكنك منح صلاحية الشحن للمستخدمين وتزويد أرصدة وكالاتهم من هنا.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
         {/* البحث */}
         <div className="space-y-4">
            <label className="text-xs font-black text-slate-400 pr-2">البحث عن المستخدم (بالاسم أو الآيدي):</label>
            <div className="relative">
               <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
               <input 
                 type="text" 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 pr-14 text-white outline-none focus:border-orange-500/50" 
                 placeholder="ادخل الآيدي أو الاسم..."
               />
            </div>

            <AnimatePresence>
               {filteredUsers.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-950 border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                     {filteredUsers.map(u => (
                        <button key={u.id} onClick={() => { setSelectedUser(u); setSearchQuery(''); }} className="w-full p-4 flex items-center gap-4 hover:bg-white/5 border-b border-white/5 last:border-0 text-right">
                           <img src={u.avatar} className="w-10 h-10 rounded-xl object-cover" />
                           <div className="flex-1">
                              <div className="flex items-center gap-2">
                                 <span className="font-bold text-white text-sm">{u.name}</span>
                                 {u.isAgency && <Zap size={12} className="text-orange-500" />}
                              </div>
                              <span className="text-[10px] text-slate-500">ID: {u.customId || u.id}</span>
                           </div>
                           {u.isAgency && <span className="text-[10px] font-black text-orange-500 bg-orange-500/10 px-2 py-1 rounded-lg">وكيل</span>}
                        </button>
                     ))}
                  </motion.div>
               )}
            </AnimatePresence>
         </div>

         {/* التحكم بالمستخدم المختار */}
         <div className="bg-black/20 p-8 rounded-[3rem] border border-white/5 min-h-[300px] flex flex-col items-center justify-center">
            {selectedUser ? (
               <div className="w-full space-y-6">
                  <div className="flex flex-col items-center text-center gap-3 pb-6 border-b border-white/5">
                     <div className="relative">
                        <img src={selectedUser.avatar} className="w-20 h-20 rounded-3xl border-2 border-white/10 shadow-xl" />
                        {selectedUser.isAgency && <div className="absolute -bottom-2 -right-2 bg-orange-500 p-1.5 rounded-xl shadow-lg"><Zap size={16} className="text-black" /></div>}
                     </div>
                     <div>
                        <h4 className="font-black text-white text-lg">{selectedUser.name}</h4>
                        <p className="text-xs text-slate-500">الآيدي: {selectedUser.customId || selectedUser.id}</p>
                     </div>
                  </div>

                  {!selectedUser.isAgency ? (
                     <button onClick={() => handleToggleAgency(selectedUser)} className="w-full py-4 bg-orange-600 text-white font-black rounded-2xl shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
                        <UserCheck size={18} /> تفعيل كوكيل شحن
                     </button>
                  ) : (
                     <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-3">
                           <div className="bg-orange-500/10 p-4 rounded-2xl border border-orange-500/20 text-center">
                              <span className="text-[10px] font-black text-slate-400 block mb-1">رصيد الوكالة</span>
                              <span className="text-lg font-black text-orange-500">{(selectedUser.agencyBalance || 0).toLocaleString()}</span>
                           </div>
                           <button onClick={() => handleToggleAgency(selectedUser)} className="bg-red-600/10 p-4 rounded-2xl border border-red-600/20 text-red-500 text-[10px] font-black hover:bg-red-600 hover:text-white transition-all">سحب الصلاحية</button>
                        </div>

                        <div className="space-y-3">
                           <label className="text-[10px] font-black text-slate-400 pr-2">تزويد رصيد الوكالة:</label>
                           <div className="flex gap-2">
                              <div className="relative flex-1">
                                 <input 
                                   type="number" 
                                   value={coinsToAdd}
                                   onChange={(e) => setCoinsToAdd(e.target.value)}
                                   className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-yellow-500 font-black text-sm outline-none"
                                   placeholder="أدخل عدد الكوينز..."
                                 />
                                 <Coins size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                              </div>
                              <button 
                                onClick={handleAddAgencyBalance}
                                disabled={loading}
                                className="px-6 bg-emerald-600 text-white rounded-xl font-black text-xs active:scale-95 disabled:opacity-50"
                              >
                                {loading ? '...' : <PlusCircle size={20} />}
                              </button>
                           </div>
                        </div>
                     </div>
                  )}
               </div>
            ) : (
               <div className="text-center opacity-30">
                  <Zap size={60} className="mx-auto mb-4 text-slate-500" />
                  <p className="text-sm font-bold text-slate-500">اختر مستخدماً للتحكم بوكالته</p>
               </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default AdminAgency;
