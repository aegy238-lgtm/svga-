import React, { useState } from 'react';
import { Search, Settings2, X, Save, ShieldAlert, Upload, Trash2, ImageIcon, Award, Sparkles, UserMinus, Medal, Lock, Unlock, Clock, Ban, Eraser, Key, ShieldCheck, Check, Shield, UserCog, Hash, Smartphone, Globe, Coins, Crown, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, VIPPackage } from '../../types';
import { db } from '../../services/firebase';
import { doc, updateDoc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';

interface AdminUsersProps {
  users: User[];
  vipLevels: VIPPackage[];
  onUpdateUser: (userId: string, data: Partial<User>) => Promise<void>;
  currentUser: User;
}

const ROOT_ADMIN_EMAIL = 'admin@live-tilk.com';

const ADMIN_TABS = [
  { id: 'users', label: 'الأعضاء' },
  { id: 'rooms_manage', label: 'الغرف' },
  { id: 'defaults', label: 'صور البداية' },
  { id: 'badges', label: 'أوسمة' },
  { id: 'id_badges', label: 'قوالب ID' },
  { id: 'host_agency', label: 'وكالات' },
  { id: 'room_bgs', label: 'خلفيات' },
  { id: 'mic_skins', label: 'مايكات' },
  { id: 'emojis', label: 'إيموشنات' },
  { id: 'relationships', label: 'ارتباط' },
  { id: 'agency', label: 'شحن' },
  { id: 'games', label: 'ألعاب' },
  { id: 'gifts', label: 'هدايا' },
  { id: 'store', label: 'متجر' },
  { id: 'vip', label: 'VIP' },
  { id: 'identity', label: 'هوية' },
  { id: 'maintenance', label: 'صيانة' },
];

const AdminUsers: React.FC<AdminUsersProps> = ({ users, vipLevels, onUpdateUser, currentUser }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editingFields, setEditingFields] = useState({ 
    coins: 0, 
    customId: '', 
    vipLevel: 0, 
    isBanned: false, 
    banUntil: '',
    banDevice: true, 
    banNetwork: true, 
    badge: '',
    cover: '',
    loginPassword: '',
    isSystemModerator: false,
    moderatorPermissions: [] as string[],
    achievements: [] as string[]
  });

  const isRootAdmin = (currentUser as any).email?.toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase() || currentUser.customId?.toString() === '1';

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.customId?.toString().includes(searchQuery) ||
    u.id.includes(searchQuery)
  );

  const isTargetRoot = (user: User) => {
    return (user as any).email?.toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase() || user.customId?.toString() === '1';
  };

  const handleDeleteUser = async (user: User) => {
    if (isTargetRoot(user)) return alert('خطأ أمني: لا يمكن حذف حساب المدير العام!');
    if (user.id === currentUser.id) return alert('لا يمكنك حذف حسابك الخاص');
    if (!confirm(`تحذير نهائي: هل أنت متأكد من حذف حساب "${user.name}" نهائياً؟`)) return;
    try { 
      await deleteDoc(doc(db, 'users', user.id)); 
      alert('تم مسح الحساب ✅'); 
      setSelectedUser(null);
    } catch (e) { alert('فشل الحذف'); }
  };

  const handleBan = (durationDays: number | 'permanent') => {
    if (durationDays === 'permanent') {
      setEditingFields({ ...editingFields, isBanned: true, banUntil: 'permanent' });
    } else {
      const date = new Date();
      date.setDate(date.getDate() + durationDays);
      setEditingFields({ ...editingFields, isBanned: true, banUntil: date.toISOString() });
    }
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    
    if (!isRootAdmin && isTargetRoot(selectedUser)) {
      alert('غير مسموح للمشرفين بتعديل بيانات الإدارة العليا');
      return;
    }

    try { 
      const selectedVipPackage = vipLevels.find(v => v.level === editingFields.vipLevel);
      const updates: any = { 
        coins: Number(editingFields.coins), 
        customId: editingFields.customId,
        isBanned: editingFields.isBanned, 
        banUntil: editingFields.banUntil,
        vipLevel: editingFields.vipLevel,
        isVip: editingFields.vipLevel > 0,
        loginPassword: editingFields.loginPassword || null,
      }; 

      if (editingFields.isBanned) {
        if (editingFields.banDevice && selectedUser.deviceId) {
          await setDoc(doc(db, 'blacklist', 'dev_' + selectedUser.deviceId), {
            type: 'device', value: selectedUser.deviceId, bannedUserId: selectedUser.id, timestamp: serverTimestamp()
          });
        }
        if (editingFields.banNetwork && selectedUser.lastIp) {
          await setDoc(doc(db, 'blacklist', 'ip_' + selectedUser.lastIp.replace(/\./g, '_')), {
            type: 'ip', value: selectedUser.lastIp, bannedUserId: selectedUser.id, timestamp: serverTimestamp()
          });
        }
      } else {
        if (selectedUser.deviceId) await deleteDoc(doc(db, 'blacklist', 'dev_' + selectedUser.deviceId));
        if (selectedUser.lastIp) await deleteDoc(doc(db, 'blacklist', 'ip_' + selectedUser.lastIp.replace(/\./g, '_')));
        const q = query(collection(db, 'blacklist'), where('bannedUserId', '==', selectedUser.id));
        const qSnap = await getDocs(q);
        qSnap.forEach(async (d) => { await deleteDoc(d.ref); });
      }

      if (isRootAdmin) {
        updates.isSystemModerator = editingFields.isSystemModerator;
        updates.moderatorPermissions = editingFields.moderatorPermissions;
      }
      
      if (selectedVipPackage) updates.frame = selectedVipPackage.frameUrl;

      await onUpdateUser(selectedUser.id, updates); 
      alert('تم التحديث ✅'); 
      setSelectedUser(null); 
    } catch (e) { alert('فشل الحفظ'); }
  };

  return (
    <div className="space-y-4 text-right font-cairo" dir="rtl">
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
        <input type="text" placeholder="بحث بالاسم أو الـ ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-900/50 border border-white/5 rounded-xl py-3 pr-10 text-white text-xs outline-none focus:border-blue-500/50 transition-all" />
      </div>

      <div className="bg-slate-950/40 rounded-2xl border border-white/5 overflow-hidden shadow-xl overflow-x-auto">
        <table className="w-full text-right text-[10px] md:text-xs">
          <thead className="bg-black/40 text-slate-500 border-b border-white/5 font-black uppercase tracking-widest">
            <tr>
              <th className="p-3">المستخدم</th>
              <th className="p-3 text-center">الإجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredUsers.map(u => (
              <tr key={u.id} className={`${u.isBanned ? 'bg-red-950/10' : 'hover:bg-white/5'} transition-colors`}>
                <td className="p-3 flex items-center gap-2">
                  <img src={u.avatar} className="w-8 h-8 rounded-lg object-cover border border-white/5" />
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1">
                       <span className="font-bold text-white truncate max-w-[80px]">{u.name}</span>
                       {isTargetRoot(u) && <ShieldCheck size={10} className="text-amber-500" />}
                    </div>
                    <span className="text-[8px] text-slate-500">ID: {u.customId || u.id}</span>
                  </div>
                </td>
                <td className="p-3 text-center">
                  <button onClick={() => { setSelectedUser(u); setEditingFields({ ...editingFields, coins: u.coins || 0, customId: u.customId?.toString() || '', vipLevel: u.vipLevel || 0, isBanned: u.isBanned || false, banUntil: u.banUntil || '', loginPassword: u.loginPassword || '', isSystemModerator: u.isSystemModerator || false, moderatorPermissions: u.moderatorPermissions || [], banDevice: true, banNetwork: true }); }} className="p-2 bg-blue-600 text-white rounded-lg active:scale-90"><UserCog size={14}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-[1500] flex items-center justify-center p-3 bg-black/90 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#0f172a] border border-white/10 rounded-[2rem] w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[92vh] relative">
               
               <div className="absolute top-3 right-3 z-20">
                 <button onClick={() => setSelectedUser(null)} className="p-2 bg-black/40 backdrop-blur-md text-white rounded-full hover:bg-black/60 transition-all active:scale-90 border border-white/10 shadow-lg">
                    <X size={20} />
                 </button>
               </div>
               
               <div className="absolute top-3 left-3 z-20">
                 {isRootAdmin && !isTargetRoot(selectedUser) && (
                   <button onClick={() => handleDeleteUser(selectedUser)} className="p-2 bg-red-600/40 backdrop-blur-md text-red-500 rounded-full hover:bg-red-600 hover:text-white transition-all border border-red-500/20 shadow-lg">
                      <Trash2 size={20} />
                   </button>
                 )}
               </div>

               <div className="relative h-24 w-full bg-slate-800 shrink-0">
                  {selectedUser.cover && <img src={selectedUser.cover} className="w-full h-full object-cover opacity-40" />}
                  <div className="absolute -bottom-6 right-5 flex items-end gap-3">
                     <div className="relative shrink-0">
                        <img src={selectedUser.avatar} className="w-16 h-16 rounded-2xl border-2 border-[#0f172a] shadow-xl object-cover" />
                        {selectedUser.isVip && <Crown size={12} className="absolute -top-1 -right-1 text-amber-500" fill="currentColor" />}
                     </div>
                     <div className="pb-1 text-right">
                       <h3 className="font-black text-sm text-white">{selectedUser.name}</h3>
                       <p className="text-[7px] text-slate-500 font-bold uppercase tracking-widest">ID: {selectedUser.customId || selectedUser.id}</p>
                     </div>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto p-4 pt-8 space-y-4 scrollbar-hide">
                  
                  {!isRootAdmin && isTargetRoot(selectedUser) ? (
                    <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-3xl flex flex-col items-center text-center gap-3">
                       <Lock size={40} className="text-amber-500" />
                       <h4 className="text-white font-black text-sm">حساب محمي</h4>
                       <p className="text-[10px] text-slate-400 font-bold">لا يمكن للمشرفين الوصول أو تعديل بيانات المدير العام. كافة الصلاحيات مغلقة.</p>
                    </div>
                  ) : (
                    <>
                      <div className="p-3 bg-red-600/5 rounded-2xl border border-red-600/20 space-y-3">
                        <h4 className="text-[9px] font-black text-red-500 flex items-center gap-1 uppercase tracking-widest">
                           <ShieldAlert size={12} /> الحظر المتقدم
                        </h4>
                        
                        <div className="flex gap-2">
                           <button onClick={() => setEditingFields({...editingFields, banDevice: !editingFields.banDevice})} className={`flex-1 py-2 rounded-lg border flex items-center justify-center gap-1 text-[8px] font-black transition-all ${editingFields.banDevice ? 'bg-red-600/20 border-red-600 text-white' : 'bg-black/40 border-white/5 text-slate-500'}`}>
                              <Smartphone size={12} /> بند فون {editingFields.banDevice && <Check size={8} />}
                           </button>
                           <button onClick={() => setEditingFields({...editingFields, banNetwork: !editingFields.banNetwork})} className={`flex-1 py-2 rounded-lg border flex items-center justify-center gap-1 text-[8px] font-black transition-all ${editingFields.banNetwork ? 'bg-red-600/20 border-red-500 text-white' : 'bg-black/40 border-white/5 text-slate-500'}`}>
                              <Globe size={12} /> بند شبكة {editingFields.banNetwork && <Check size={8} />}
                           </button>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5">
                           <button onClick={() => setEditingFields({...editingFields, isBanned: false, banUntil: ''})} className={`py-2 rounded-lg text-[8px] font-black border ${!editingFields.isBanned ? 'bg-emerald-600 text-white' : 'bg-black/20 text-slate-500 border-white/5'}`}>فك</button>
                           <button onClick={() => handleBan(30)} className={`py-2 rounded-lg text-[8px] font-black border ${editingFields.isBanned && editingFields.banUntil !== 'permanent' ? 'bg-red-600 text-white' : 'bg-black/20 text-slate-500 border-white/5'}`}>شهر</button>
                           <button onClick={() => handleBan('permanent')} className={`py-2 rounded-lg text-[8px] font-black border ${editingFields.banUntil === 'permanent' ? 'bg-red-900 text-white' : 'bg-black/20 text-slate-500 border-white/5'}`}>أبدي</button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                         <div className="space-y-1">
                            <label className="text-[8px] font-black text-slate-500 pr-1 uppercase"><Coins size={8} className="inline ml-1" /> الكوينز</label>
                            <input type="number" value={editingFields.coins} onChange={e => setEditingFields({...editingFields, coins: parseInt(e.target.value) || 0})} className="w-full bg-black/40 border border-white/10 rounded-xl p-2 text-yellow-500 font-black text-xs text-center outline-none" />
                         </div>
                         <div className="space-y-1">
                            <label className="text-[8px] font-black text-slate-500 pr-1 uppercase"><Crown size={8} className="inline ml-1" /> VIP</label>
                            <select value={editingFields.vipLevel} onChange={e => setEditingFields({...editingFields, vipLevel: parseInt(e.target.value)})} className="w-full bg-black/40 border border-white/10 rounded-xl p-2 text-white text-[10px] font-black outline-none appearance-none text-center">
                               <option value={0}>تصفير</option>
                               {vipLevels.sort((a,b)=>a.level-b.level).map(v => <option key={v.level} value={v.level}>{v.name}</option>)}
                            </select>
                         </div>
                      </div>

                      <div className="p-3 bg-white/5 rounded-2xl border border-white/5 space-y-3">
                        <div className="space-y-1">
                           <label className="text-[8px] font-black text-slate-500 pr-1">تغيير الـ ID</label>
                           <div className="relative">
                              <input type="text" value={editingFields.customId} onChange={e => setEditingFields({...editingFields, customId: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-2 text-amber-500 font-black text-[10px] pr-8" />
                              <Hash size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-700" />
                           </div>
                        </div>
                        <div className="space-y-1">
                           <label className="text-[8px] font-black text-slate-500 pr-1">كلمة المرور</label>
                           <div className="relative">
                              <input type="text" value={editingFields.loginPassword} onChange={e => setEditingFields({...editingFields, loginPassword: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-2 text-blue-400 font-black text-[10px] pr-8" />
                              <Key size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-700" />
                           </div>
                        </div>
                      </div>

                      {isRootAdmin && (
                        <div className="p-3 bg-blue-600/5 rounded-2xl border border-blue-500/20 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-[9px] font-black text-white flex items-center gap-1 uppercase"><ShieldCheck size={14} className="text-blue-400" /> مشرف نظام</h4>
                            <button onClick={() => setEditingFields({ ...editingFields, isSystemModerator: !editingFields.isSystemModerator })} className={`w-8 h-4 rounded-full relative transition-all ${editingFields.isSystemModerator ? 'bg-blue-500' : 'bg-slate-700'}`}><motion.div animate={{ x: editingFields.isSystemModerator ? 18 : 2 }} className="absolute top-0.5 w-3 h-3 bg-white rounded-full" /></button>
                          </div>
                          {editingFields.isSystemModerator && (
                            <div className="grid grid-cols-3 gap-1 pt-2 border-t border-blue-500/10">
                              {ADMIN_TABS.map(tab => (
                                <button key={tab.id} onClick={() => {
                                   const current = [...editingFields.moderatorPermissions];
                                   const updated = current.includes(tab.id) ? current.filter(id => id !== tab.id) : [...current, tab.id];
                                   setEditingFields({...editingFields, moderatorPermissions: updated});
                                }} className={`p-1.5 rounded-md text-[7px] font-black border transition-all truncate ${editingFields.moderatorPermissions.includes(tab.id) ? 'bg-blue-600 border-blue-400 text-white' : 'bg-black/40 border-white/5 text-slate-500'}`}>{tab.label}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="pb-2">
                        <button onClick={handleSave} className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-black rounded-xl shadow-lg text-xs active:scale-95 transition-all flex items-center justify-center gap-2">
                           <Save size={16} /> حفظ التعديلات
                        </button>
                      </div>
                    </>
                  )}
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminUsers;