
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, Users, Trophy, Coins, Search, Building, Zap, ChevronRight, CheckCircle2, TrendingUp } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc, increment, getDocs } from 'firebase/firestore';
import { User, HostAgency } from '../types';

interface HostAgentDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  agentUser: User;
  allUsers: User[];
}

const HostAgentDashboard: React.FC<HostAgentDashboardProps> = ({ isOpen, onClose, agentUser, allUsers }) => {
  const [agencyInfo, setAgencyInfo] = useState<HostAgency | null>(null);
  const [myHosts, setMyHosts] = useState<User[]>([]);
  const [searchId, setSearchId] = useState('');
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!isOpen || !agentUser.hostAgencyId) return;

    const unsubAgency = onSnapshot(doc(db, 'host_agencies', agentUser.hostAgencyId), (snap) => {
      if (snap.exists()) setAgencyInfo({ id: snap.id, ...snap.data() } as HostAgency);
    });

    const q = query(collection(db, 'users'), where('hostAgencyId', '==', agentUser.hostAgencyId));
    const unsubHosts = onSnapshot(q, (snap) => {
      setMyHosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
    });

    return () => { unsubAgency(); unsubHosts(); };
  }, [isOpen, agentUser.hostAgencyId]);

  const handleSearch = () => {
    const user = allUsers.find(u => u.customId?.toString() === searchId || u.id === searchId);
    if (user) {
      if (user.hostAgencyId) return alert('هذا المستخدم مضاف بالفعل لوكالة أخرى');
      setFoundUser(user);
    } else {
      alert('المستخدم غير موجود');
    }
  };

  const handleAddHost = async () => {
    if (!foundUser || !agentUser.hostAgencyId) return;
    setIsProcessing(true);
    try {
      const medalsSnap = await getDoc(doc(db, 'appSettings', 'medals_library'));
      const autoHostMedal = medalsSnap.exists() ? medalsSnap.data().autoHostMedal : null;

      // منطق إضافة الوسام في بداية القائمة (unshift)
      let currentAchievements = [...(foundUser.achievements || [])];
      if (autoHostMedal && !currentAchievements.includes(autoHostMedal)) {
        currentAchievements.unshift(autoHostMedal);
      }

      await updateDoc(doc(db, 'users', foundUser.id), {
        isHost: true,
        hostAgencyId: agentUser.hostAgencyId,
        hostProduction: 0,
        achievements: currentAchievements.slice(0, 30)
      });
      
      alert(`مبروك! تمت إضافة ${foundUser.name} لوكالتك ومنحه وسام المضيف الرسمي ✅`);
      setFoundUser(null);
      setSearchId('');
    } catch (e) {
      alert('فشل إضافة المضيف');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md font-cairo">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-lg bg-[#0c101b] border border-blue-500/30 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
        dir="rtl"
      >
        <div className="p-6 bg-gradient-to-br from-blue-600/20 to-indigo-900/20 border-b border-white/5 relative text-center">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 text-white/50 hover:text-white transition"><X size={20} /></button>
          <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-3 border border-blue-500/30 mx-auto shadow-lg">
             <Building size={32} className="text-blue-400" />
          </div>
          <h2 className="text-xl font-black text-white">{agencyInfo?.name || 'وكالتي الرسمية'}</h2>
          <div className="flex items-center justify-center gap-2 mt-1">
             <span className="text-[10px] font-black text-blue-400 uppercase bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">Official Agent</span>
             <span className="text-[10px] text-slate-500">ID: {agentUser.customId || agentUser.id}</span>
          </div>
        </div>

        <div className="p-6 grid grid-cols-2 gap-4">
           <div className="bg-white/5 border border-white/5 p-4 rounded-3xl text-center">
              <div className="flex items-center justify-center gap-2 text-blue-400 mb-1">
                 <Users size={16} />
                 <span className="text-[10px] font-black uppercase">المضيفين</span>
              </div>
              <div className="text-2xl font-black text-white">{myHosts.length}</div>
           </div>
           <div className="bg-white/5 border border-white/5 p-4 rounded-3xl text-center">
              <div className="flex items-center justify-center gap-2 text-amber-500 mb-1">
                 <TrendingUp size={16} />
                 <span className="text-[10px] font-black uppercase">إجمالي الإنتاج</span>
              </div>
              <div className="text-2xl font-black text-yellow-500">{(agencyInfo?.totalProduction || 0).toLocaleString()}</div>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6 scrollbar-hide">
           <div className="bg-black/40 rounded-[2rem] p-6 border border-white/5 space-y-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2"><UserPlus size={18} className="text-emerald-500" /> دعوة مضيف جديد</h3>
              <div className="flex gap-2">
                 <div className="relative flex-1">
                    <input 
                      type="text" 
                      value={searchId}
                      onChange={(e) => setSearchId(e.target.value)}
                      placeholder="ادخل آيدي المستخدم..."
                      className="w-full bg-slate-900 border border-white/10 rounded-xl py-3 px-4 text-sm text-white outline-none focus:border-blue-500/50"
                    />
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                 </div>
                 <button onClick={handleSearch} className="px-5 bg-blue-600 text-white rounded-xl font-black text-xs active:scale-95 transition-all">بحث</button>
              </div>

              <AnimatePresence>
                 {foundUser && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, scale: 1 }} className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex items-center justify-between mt-2">
                       <div className="flex items-center gap-3">
                          <img src={foundUser.avatar} className="w-10 h-10 rounded-lg object-cover" />
                          <div className="text-right">
                             <p className="text-xs font-black text-white">{foundUser.name}</p>
                             <p className="text-[9px] text-slate-500">ID: {foundUser.customId || foundUser.id}</p>
                          </div>
                       </div>
                       <button 
                         onClick={handleAddHost}
                         disabled={isProcessing}
                         className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-black shadow-lg active:scale-95 disabled:opacity-50"
                       >
                          {isProcessing ? '...' : 'إضافة للوكالة'}
                       </button>
                    </motion.div>
                 )}
              </AnimatePresence>
           </div>

           <div className="space-y-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2"><Trophy size={18} className="text-amber-500" /> إنتاج المضيفين</h3>
              <div className="grid gap-3">
                 {myHosts.length === 0 ? (
                    <div className="text-center py-10 opacity-30">
                       <Users size={40} className="mx-auto mb-2 text-slate-500" />
                       <p className="text-xs font-bold">لا يوجد مضيفين بعد</p>
                    </div>
                 ) : (
                    myHosts.map(host => (
                       <div key={host.id} className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between hover:bg-white/10 transition-all">
                          <div className="flex items-center gap-3">
                             <img src={host.avatar} className="w-12 h-12 rounded-xl object-cover border border-white/10 shadow-md" />
                             <div className="text-right">
                                <p className="text-sm font-black text-white leading-none mb-1">{host.name}</p>
                                <div className="flex items-center gap-1">
                                   <Zap size={10} className="text-yellow-500" />
                                   <span className="text-[10px] font-black text-yellow-500">{(host.hostProduction || 0).toLocaleString()}</span>
                                </div>
                             </div>
                          </div>
                          <div className="bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                             <span className="text-[10px] font-black text-emerald-500">مضيف رسمي</span>
                          </div>
                       </div>
                    ))
                 )}
              </div>
           </div>
        </div>
      </motion.div>
    </div>
  );
};

export default HostAgentDashboard;
