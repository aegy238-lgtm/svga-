import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User as UserIcon, LogIn, UserPlus, Smartphone, Camera, Globe, ChevronDown, Hash, ShieldCheck, Ban, ArrowRight, AlertCircle } from 'lucide-react';
import { UserLevel, User as UserType } from '../types';
import { auth, db } from '../services/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, getDocs, serverTimestamp, collection, query, where, onSnapshot, limit } from 'firebase/firestore';

const ARAB_COUNTRIES = [
  "مصر", "السعودية", "الإمارات", "الكويت", "قطر", "البحرين", "عُمان", "الأردن", "فلسطين", 
  "لبنان", "سوريا", "العراق", "اليمن", "ليبيا", "السودان", "تونس", "الجزائر", "المغرب", 
  "موريتانيا", "الصومال", "جيبوتي", "جزر القمر"
];

// البريد الرسمي للمالك
const ROOT_ADMIN_EMAIL = 'admin@live-tilk.com';

interface AuthScreenProps {
  onAuth: (user: UserType) => void;
  appLogo?: string;
  authBackground?: string;
  canInstall?: boolean;
  onInstall?: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onAuth, appLogo, authBackground, canInstall, onInstall }) => {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'id_login'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userId, setUserId] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [location, setLocation] = useState('مصر');
  const [avatar, setAvatar] = useState('');
  const [defaultAvatars, setDefaultAvatars] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [deviceBanned, setDeviceBanned] = useState(false);
  const [ipBanned, setIpBanned] = useState(false);

  const LOGO = appLogo || 'https://storage.googleapis.com/static.aistudio.google.com/stables/2025/03/06/f0e64906-e7e0-4a87-af9b-029e2467d302/f0e64906-e7e0-4a87-af9b-029e2467d302.png';

  const getDeviceId = () => {
    let id = localStorage.getItem('livetalk_device_fingerprint');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
      localStorage.setItem('livetalk_device_fingerprint', id);
    }
    return id;
  };

  const getIp = async () => {
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      return data.ip;
    } catch (e) { return '0.0.0.0'; }
  };

  useEffect(() => {
    const devId = getDeviceId();
    let unsubIP: (() => void) | null = null;

    const unsubDevice = onSnapshot(doc(db, 'blacklist', 'dev_' + devId), (snap) => {
      setDeviceBanned(snap.exists());
    });

    getIp().then(ip => {
      const ipKey = 'ip_' + ip.replace(/\./g, '_');
      unsubIP = onSnapshot(doc(db, 'blacklist', ipKey), (ipSnap) => {
        setIpBanned(ipSnap.exists());
      });
    });

    const fetchDefaults = async () => {
       try {
         const snap = await getDoc(doc(db, 'appSettings', 'defaults'));
         if (snap.exists()) {
            const imgs = snap.data().profilePictures || [];
            setDefaultAvatars(imgs);
            if (imgs.length > 0 && !avatar) setAvatar(imgs[0]);
         }
       } catch (e) {}
    };
    fetchDefaults();

    return () => {
      unsubDevice();
      if (unsubIP) unsubIP();
    };
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setAvatar(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleIdLogin = async () => {
    if (!userId || !password) {
      setError('الرجاء إدخال الـ ID وكلمة المرور');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('customId', '==', userId), limit(1));
      const querySnapshot = await getDocs(q);
      
      let targetUser = null;
      if (!querySnapshot.empty) {
        targetUser = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as UserType;
      } else {
        const docSnap = await getDoc(doc(db, 'users', userId));
        if (docSnap.exists()) {
          targetUser = { id: docSnap.id, ...docSnap.data() } as UserType;
        }
      }

      if (targetUser && targetUser.loginPassword === password) {
        const isRoot = targetUser.customId?.toString() === '1' || targetUser.email?.toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase();
        
        if (targetUser.isBanned && !isRoot) {
          setError('هذا الحساب محظور حالياً');
          setLoading(false);
          return;
        }
        const devId = getDeviceId();
        const userIp = await getIp();
        await setDoc(doc(db, 'users', targetUser.id), { deviceId: devId, lastIp: userIp }, { merge: true });
        onAuth({ ...targetUser, deviceId: devId, lastIp: userIp });
      } else {
        setError('بيانات الدخول غير صحيحة');
      }
    } catch (err) {
      setError('حدث خطأ أثناء محاولة الدخول');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'id_login') {
      handleIdLogin();
      return;
    }

    if (!email || !password || (authMode === 'register' && (!name || !avatar))) {
      setError('الرجاء ملء جميع الحقول واختيار صورة');
      return;
    }
    setLoading(true);
    setError('');

    const devId = getDeviceId();
    const userIp = await getIp();

    try {
      if (authMode === 'login') {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
        if (userDoc.exists()) {
          const uData = userDoc.data() as UserType;
          const isRoot = uData.email?.toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase() || uData.customId?.toString() === '1';
          
          if (uData.isBanned && !isRoot) {
            setError('هذا الحساب محظور');
            setLoading(false);
            return;
          }
          await setDoc(doc(db, 'users', uData.id), { deviceId: devId, lastIp: userIp }, { merge: true });
          onAuth({ ...uData, deviceId: devId, lastIp: userIp });
        }
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // التحقق إذا كان المسجل هو المدير العام
        const isMasterAdmin = email.toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase();
        
        const userData: UserType = {
          id: userCredential.user.uid,
          customId: isMasterAdmin ? "1" : Math.floor(100000 + Math.random() * 899999).toString(),
          name,
          avatar,
          gender,
          location,
          level: UserLevel.NEW, 
          coins: isMasterAdmin ? 10000000 : 0, 
          diamonds: 0, 
          wealth: 0, 
          charm: 0, 
          isVip: isMasterAdmin,
          vipLevel: isMasterAdmin ? 12 : 0,
          isSystemModerator: isMasterAdmin, // منح صلاحية لوحة التحكم
          moderatorPermissions: isMasterAdmin ? ["users", "rooms_manage", "defaults", "badges", "id_badges", "host_agency", "room_bgs", "mic_skins", "emojis", "relationships", "agency", "games", "gifts", "store", "vip", "identity", "maintenance"] : [],
          stats: { likes: 0, visitors: 0, following: 0, followers: 0 }, ownedItems: [],
          deviceId: devId,
          lastIp: userIp
        };
        await setDoc(doc(db, 'users', userCredential.user.uid), { ...userData, email, createdAt: serverTimestamp() });
        onAuth(userData);
      }
    } catch (err: any) {
      setError('خطأ في البيانات أو الحساب مسجل مسبقاً');
    } finally {
      setLoading(false);
    }
  };

  const isActuallyBanned = (deviceBanned || ipBanned);

  return (
    <div className="h-[100dvh] w-full bg-[#020617] flex flex-col items-center justify-center overflow-hidden font-cairo px-4 relative">
      {authBackground && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          className="absolute inset-0 bg-cover bg-center blur-[1px]" 
          style={{ backgroundImage: `url(${authBackground})` }} 
        />
      )}
      <div className="absolute inset-0 bg-black/60 z-0"></div>

      <AnimatePresence mode="wait">
        {isActuallyBanned ? (
           <motion.div 
             key="banned-screen"
             initial={{ opacity: 0, scale: 0.9, y: 20 }}
             animate={{ opacity: 1, scale: 1, y: 0 }}
             exit={{ opacity: 0, scale: 0.9, y: -20 }}
             className="w-full max-w-[360px] bg-red-950/30 backdrop-blur-3xl border-2 border-red-500/40 rounded-[3rem] p-12 text-center relative z-10 shadow-[0_0_80px_rgba(239,68,68,0.2)]"
           >
              <div className="w-24 h-24 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-8 border-2 border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.5)] animate-pulse">
                 <Ban size={48} className="text-red-500" />
              </div>
              <h1 className="text-3xl font-black text-white mb-4">الوصول مرفوض</h1>
              <p className="text-red-100/80 text-sm leading-relaxed font-bold mb-8">
                 لقد تم حظر جهازك أو شبكتك بشكل نهائي من دخول المنصة لمخالفة قوانين السياسة والأمان. لا يمكنك الدخول من هذا الجهاز مرة أخرى.
              </p>
              
              <div className="flex items-center justify-center gap-2 text-red-500 bg-red-500/10 py-3 rounded-2xl border border-red-500/20">
                 <AlertCircle size={18} />
                 <span className="text-[10px] font-black uppercase tracking-widest">تنبيه: محاولة التخطي قد تعرضك للمساءلة</span>
              </div>
           </motion.div>
        ) : (
          <motion.div 
            key="login-screen"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-[360px] flex flex-col items-center gap-4 relative z-10"
          >
            <div className="text-center">
              <motion.div 
                className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-600 rounded-2xl mx-auto mb-1 p-0.5 shadow-xl"
              >
                <img src={LOGO} className="w-full h-full object-cover rounded-[0.9rem]" />
              </motion.div>
              <h1 className="text-lg font-black text-white">لايف تـوك</h1>
            </div>

            <div className="w-full bg-slate-900/80 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] p-6 shadow-2xl max-h-[85vh] overflow-y-auto scrollbar-hide">
              <div className="flex bg-black/40 p-1 rounded-2xl mb-6 gap-1">
                <button onClick={() => setAuthMode('login')} className={`flex-1 py-2.5 rounded-xl text-[9px] font-black transition-all ${authMode === 'login' ? 'bg-amber-500 text-black shadow-lg' : 'text-slate-500'}`}>دخول</button>
                <button onClick={() => setAuthMode('id_login')} className={`flex-1 py-2.5 rounded-xl text-[9px] font-black transition-all ${authMode === 'id_login' ? 'bg-blue-500 text-white shadow-lg' : 'text-slate-500'}`}>دخول ID</button>
                <button onClick={() => setAuthMode('register')} className={`flex-1 py-2.5 rounded-xl text-[9px] font-black transition-all ${authMode === 'register' ? 'bg-amber-500 text-black shadow-lg' : 'text-slate-500'}`}>تسجيل</button>
              </div>

              <form onSubmit={handleAuth} className="space-y-4" dir="rtl">
                {authMode === 'register' && (
                  <>
                    <div className="flex flex-col items-center gap-4">
                       <div className="relative group">
                          <div className="w-20 h-20 rounded-full border-2 border-amber-500/50 p-1 overflow-hidden shadow-xl bg-slate-800">
                             {avatar ? <img src={avatar} className="w-full h-full object-cover rounded-full" /> : <UserIcon size={32} className="text-slate-600 mx-auto mt-4" />}
                          </div>
                          <label className="absolute bottom-0 right-0 p-1.5 bg-amber-500 text-black rounded-full cursor-pointer shadow-lg active:scale-90 transition-transform">
                             <Camera size={14} />
                             <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                          </label>
                       </div>
                       
                       {defaultAvatars.length > 0 && (
                          <div className="w-full">
                             <p className="text-[8px] font-black text-slate-500 text-center mb-2 uppercase tracking-widest">أو اختر صورة جاهزة</p>
                             <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide px-1">
                                {defaultAvatars.map((img, i) => (
                                   <button key={i} type="button" onClick={() => setAvatar(img)} className={`w-10 h-10 rounded-full border-2 shrink-0 transition-all ${avatar === img ? 'border-amber-500 scale-110 shadow-lg' : 'border-white/10 opacity-50'}`}>
                                      <img src={img} className="w-full h-full object-cover rounded-full" />
                                   </button>
                                ))}
                             </div>
                          </div>
                       )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 pr-1">الاسم المستعار</label>
                      <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-xl py-3 px-4 text-white text-xs outline-none focus:border-amber-500/50" placeholder="اسمك الظاهر..." />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 pr-1">الجنس</label>
                          <select value={gender} onChange={(e) => setGender(e.target.value as any)} className="w-full bg-black/40 border border-white/5 rounded-xl py-3 px-3 text-white text-xs outline-none appearance-none cursor-pointer">
                             <option value="male">ذكر ♂</option>
                             <option value="female">أنثى ♀</option>
                          </select>
                       </div>
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 pr-1">الدولة</label>
                          <select value={location} onChange={(e) => setLocation(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-xl py-3 px-3 text-white text-xs outline-none cursor-pointer">
                             {ARAB_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                       </div>
                    </div>
                  </>
                )}

                {authMode === 'id_login' ? (
                   <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 pr-1">رقم المعرف (ID)</label>
                        <div className="relative">
                           <input type="text" value={userId} onChange={(e) => setUserId(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-xl py-3 px-4 text-white text-xs outline-none focus:border-blue-500/50" placeholder="مثال: 123456" />
                           <Hash size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 pr-1">كلمة مرور الربط</label>
                        <div className="relative">
                           <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-xl py-3 px-4 text-white text-xs outline-none focus:border-blue-500/50" placeholder="********" />
                           <ShieldCheck size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                        </div>
                      </div>
                   </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 pr-1">البريد الإلكتروني</label>
                      <div className="relative">
                         <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white text-xs outline-none focus:border-amber-500/50" placeholder="example@mail.com" />
                         <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 pr-1">كلمة السر</label>
                      <div className="relative">
                         <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white text-xs outline-none focus:border-amber-500/50" placeholder="********" />
                         <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                      </div>
                    </div>
                  </>
                )}

                {error && <p className="text-red-500 text-[10px] text-center font-black animate-pulse">{error}</p>}

                <button type="submit" disabled={loading} className={`w-full py-4 rounded-2xl text-white font-black text-sm shadow-xl active:scale-95 transition-all mt-4 flex items-center justify-center gap-2 ${authMode === 'id_login' ? 'bg-gradient-to-r from-blue-600 to-indigo-700' : 'bg-gradient-to-r from-amber-500 to-orange-600'}`}>
                  {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : (authMode === 'login' ? <><LogIn size={18}/> دخول</> : authMode === 'id_login' ? <><ShieldCheck size={18}/> دخول بالـ ID</> : <><UserPlus size={18}/> إنشاء الحساب</>)}
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AuthScreen;