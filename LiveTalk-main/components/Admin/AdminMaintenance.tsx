import React, { useState } from 'react';
import { Eraser, AlertTriangle, Layout, Users, ShieldAlert, RotateCcw, ShieldX, UserMinus, Zap, RefreshCw, Trash2, ShieldOff, DatabaseBackup, History, CheckCircle2, Crown, Gift, ShoppingBag, Trophy, Globe, Smartphone, UserCog, Sparkles } from 'lucide-react';
import { db } from '../../services/firebase';
import { collection, getDocs, writeBatch, doc, deleteDoc, query, where, updateDoc } from 'firebase/firestore';
import { DEFAULT_GIFTS, DEFAULT_STORE_ITEMS, DEFAULT_VIP_LEVELS } from '../../constants';

interface AdminMaintenanceProps {
  currentUser: any;
}

const ROOT_ADMIN_EMAIL = 'admin@live-tilk.com';

const AdminMaintenance: React.FC<AdminMaintenanceProps> = ({ currentUser }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState('');

  const isActuallyRoot = currentUser.customId?.toString() === '1' || currentUser.email?.toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase();

  const handleResetAllCharms = async () => {
    if (!confirm('⚠️ تحذير: هل تريد تصفير كاريزما جميع المستخدمين في التطبيق؟')) return;
    if (!confirm('☢️ هذا الإجراء سيقوم بتصفير قائمة المتصدرين (الكاس الخارجي) نهائياً.')) return;

    setIsProcessing(true);
    setProcessStatus('جاري تصفير كاريزما الجميع...');
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const batch = writeBatch(db);
      let count = 0;
      usersSnap.forEach((userDoc) => {
        batch.update(userDoc.ref, { charm: 0 });
        count++;
      });
      await batch.commit();
      alert(`✅ تم تصفير كاريزما ${count} مستخدم بنجاح!`);
    } catch (e) {
      alert('❌ فشلت عملية تصفير الكاريزما.');
    } finally {
      setIsProcessing(false);
      setProcessStatus('');
    }
  };

  const handleResetMasterAccount = async () => {
    if (!isActuallyRoot) return;
    const confirm1 = confirm('⚠️ تحذير الإدارة العليا: هل تريد تصفير حسابك بالكامل؟');
    const confirm2 = confirm('☢️ سيتم تصفير الكوينز، المستويات، الأوسمة، وكافة المقتنيات ليعود الحساب كأنه مسجل الآن. هل أنت متأكد؟');
    
    if (!confirm1 || !confirm2) return;

    setIsProcessing(true);
    setProcessStatus('جاري إعادة ضبط حساب المدير...');
    try {
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, {
        coins: 10000000,
        diamonds: 0,
        wealth: 0,
        charm: 0,
        rechargePoints: 0,
        wealthLevel: 1,
        rechargeLevel: 1,
        isVip: true,
        vipLevel: 12,
        frame: null,
        activeBubble: null,
        activeEntry: null,
        badge: null,
        achievements: [],
        ownedItems: [],
        isHostAgent: false,
        isAgency: false,
        isSystemModerator: true,
        hostAgencyId: null,
        hostProduction: 0
      });
      alert('✅ تم إعادة ضبط حسابك كمدير رسمي بنجاح!');
      window.location.reload();
    } catch (e) {
      alert('❌ فشلت عملية تصفير الحساب.');
    } finally {
      setIsProcessing(false);
      setProcessStatus('');
    }
  };

  const handleRestoreSystemData = async () => {
    const confirmMsg = 'هل أنت متأكد من رغبتك في استعادة كافة البيانات الافتراضية (VIP، إطارات المتجر، الهدايا)؟';
    if (!confirm(confirmMsg)) return;

    setIsProcessing(true);
    setProcessStatus('جاري استعادة البيانات...');
    try {
      const batch = writeBatch(db);
      DEFAULT_VIP_LEVELS.forEach(vip => {
        const id = `vip_lvl_${vip.level}`;
        batch.set(doc(db, 'vip', id), { ...vip, id });
      });
      DEFAULT_STORE_ITEMS.forEach(item => {
        batch.set(doc(db, 'store', item.id), item);
      });
      DEFAULT_GIFTS.forEach(gift => {
        batch.set(doc(db, 'gifts', gift.id), gift);
      });
      await batch.commit();
      alert('✅ تمت استعادة كافة البيانات بنجاح!');
    } catch (e) {
      alert('❌ فشلت عملية الاستعادة.');
    } finally {
      setIsProcessing(false);
      setProcessStatus('');
    }
  };

  const handleDeleteAllUsers = async () => {
    if (!confirm('⚠️ تحذير: حذف جميع حسابات المستخدمين؟') || !confirm('☢️ تأكيد أخير: لا يمكن التراجع!')) return;
    setIsProcessing(true);
    setProcessStatus('جاري تطهير الحسابات...');
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const batch = writeBatch(db);
      let count = 0;
      usersSnap.forEach((userDoc) => {
        const userData = userDoc.data();
        if (userDoc.id !== currentUser.id && userData.email !== ROOT_ADMIN_EMAIL) {
          batch.delete(userDoc.ref);
          count++;
        }
      });
      if (count > 0) await batch.commit();
      alert(`✅ تم حذف ${count} مستخدم بنجاح.`);
    } catch (e) { alert('❌ فشل الحذف الشامل.'); } finally { setIsProcessing(false); setProcessStatus(''); }
  };

  const handleClearBlacklist = async () => {
    if (!confirm('🔥 هل تريد حذف جميع بنود حظر الأجهزة والشبكات؟')) return;
    
    setIsProcessing(true);
    setProcessStatus('جاري فك حظر الجميع...');
    try {
      const blacklistSnap = await getDocs(collection(db, 'blacklist'));
      const batch = writeBatch(db);
      let count = 0;
      blacklistSnap.forEach((d) => {
        batch.delete(d.ref);
        count++;
      });
      if (count > 0) await batch.commit();
      alert(`✅ تم فك الحظر عن ${count} جهاز/شبكة بنجاح!`);
    } catch (e) { alert('❌ فشلت العملية.'); } finally { setIsProcessing(false); setProcessStatus(''); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 text-right font-cairo" dir="rtl">
      
      {isActuallyRoot && (
        <div className="bg-amber-500/10 border-2 border-amber-500/30 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-right">
              <h3 className="text-2xl font-black text-white flex items-center justify-center md:justify-start gap-3">
                <UserCog className="text-amber-500" size={32} /> تصفير حساب المدير النهائي
              </h3>
              <p className="text-slate-400 text-sm font-bold mt-2">إعادة حسابك الحالي للصفر مع الاحتفاظ بصلاحيات الإدارة والكوينز.</p>
            </div>
            <button onClick={handleResetMasterAccount} disabled={isProcessing} className="px-10 py-5 bg-amber-600 hover:bg-amber-500 text-black font-black rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3">
              {isProcessing ? <RefreshCw className="animate-spin" /> : <Zap fill="currentColor" />} ابدأ التصفير النهائي
            </button>
          </div>
        </div>
      )}

      <div className="bg-indigo-600/10 border-2 border-indigo-500/30 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-right">
            <h3 className="text-2xl font-black text-white flex items-center justify-center md:justify-start gap-3">
              <Trophy className="text-yellow-500" size={32} /> تصفير الكاس الخارجي
            </h3>
            <p className="text-slate-400 text-sm font-bold mt-2">تصفير كاريزما جميع مستخدمي التطبيق وإعادة ترتيب المتصدرين للصفر (الترتيب العالمي).</p>
          </div>
          <button onClick={handleResetAllCharms} disabled={isProcessing} className="px-10 py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3">
            {isProcessing ? <RefreshCw className="animate-spin" /> : <RotateCcw />} تصفير الكاريزما للكل
          </button>
        </div>
      </div>

      <div className="bg-slate-800/20 border-2 border-slate-700/30 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-right">
            <h3 className="text-2xl font-black text-white flex items-center justify-center md:justify-start gap-3">
              <DatabaseBackup className="text-blue-400" size={32} /> إدارة بيانات النظام
            </h3>
            <p className="text-slate-400 text-sm font-bold mt-2">استرجع رتب الـ VIP، الهدايا الأساسية، وإطارات المتجر.</p>
          </div>
          <button onClick={handleRestoreSystemData} disabled={isProcessing} className="px-10 py-5 bg-slate-700 hover:bg-slate-600 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3">
            {isProcessing ? <RefreshCw className="animate-spin" /> : <RefreshCw />} استعادة VIP والإطارات
          </button>
        </div>
      </div>

      <div className="bg-red-600/10 border-2 border-red-600/30 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="text-2xl font-black text-white flex items-center gap-3 mb-6">
            <ShieldAlert className="text-red-500" /> منطقة العمليات الخطرة
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button onClick={handleClearBlacklist} disabled={isProcessing} className="px-8 py-5 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
              <Globe size={20} /> فك حظر (الشبكة والأجهزة) عن الجميع
            </button>

            <button onClick={handleDeleteAllUsers} disabled={isProcessing} className="px-8 py-5 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
              <UserMinus size={20} /> حذف جميع المستخدمين
            </button>
          </div>
        </div>
        
        {isProcessing && (
          <div className="mt-6 flex items-center justify-center gap-3 text-amber-500 font-black animate-pulse bg-black/40 py-2 rounded-xl">
             <RefreshCw className="animate-spin" size={16} />
             <span className="text-xs">{processStatus || 'جاري المعالجة...'}</span>
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-white/5 p-6 rounded-3xl opacity-50 flex items-center gap-3">
         <ShieldOff className="text-slate-500" />
         <p className="text-[10px] text-slate-500 font-bold">ملاحظة: حساب الأدمن الرئيسي محمي من الحذف الشامل.</p>
      </div>
    </div>
  );
};

export default AdminMaintenance;