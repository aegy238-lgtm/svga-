import React, { useState } from 'react';
import { UserRecord, LicenseKey } from '../types';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { User, CreditCard, Key, X, CheckCircle, AlertCircle, BadgeCheck } from 'lucide-react';

interface UserProfileModalProps {
  currentUser: UserRecord;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ currentUser, onClose }) => {
  const [keyInput, setKeyInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleRedeemKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) return;
    
    setLoading(true);
    setMessage(null);

    try {
      // 1. Find the key
      const q = query(collection(db, 'licenseKeys'), where('key', '==', keyInput.trim()));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setMessage({ type: 'error', text: 'مفتاح غير صحيح' });
        setLoading(false);
        return;
      }

      const keyDoc = snapshot.docs[0];
      const keyData = keyDoc.data() as LicenseKey;

      if (keyData.isUsed) {
        setMessage({ type: 'error', text: 'هذا المفتاح مستخدم من قبل' });
        setLoading(false);
        return;
      }

      // 2. Calculate new expiry
      let expiry = new Date();
      // If user already has a valid subscription, extend it? 
      // For simplicity, we'll just set it from now or extend if current expiry is in future.
      const currentExpiry = currentUser.subscriptionExpiry?.toDate 
        ? currentUser.subscriptionExpiry.toDate() 
        : (currentUser.subscriptionExpiry ? new Date(currentUser.subscriptionExpiry) : new Date());
      
      if (currentExpiry > new Date()) {
        expiry = currentExpiry;
      }

      if (keyData.duration === 'day') expiry.setDate(expiry.getDate() + 1);
      if (keyData.duration === 'week') expiry.setDate(expiry.getDate() + 7);
      if (keyData.duration === 'month') expiry.setMonth(expiry.getMonth() + 1);
      if (keyData.duration === 'year') expiry.setFullYear(expiry.getFullYear() + 1);

      // 3. Update Key status
      await updateDoc(doc(db, 'licenseKeys', keyDoc.id), {
        isUsed: true,
        usedBy: currentUser.id,
        usedAt: Timestamp.now()
      });

      // 4. Update User subscription
      await updateDoc(doc(db, 'users', currentUser.id), {
        subscriptionType: keyData.duration,
        subscriptionExpiry: Timestamp.fromDate(expiry),
        isVIP: true,
        activatedKey: keyData.key
      });

      setMessage({ type: 'success', text: `تم تفعيل اشتراك ${keyData.duration} بنجاح!` });
      setKeyInput('');
      
      // Reload page or wait for auth state listener to update (it might take a moment)
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error("Redemption error:", error);
      setMessage({ type: 'error', text: 'حدث خطأ أثناء التفعيل' });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: any) => {
    if (!date) return 'غير مفعل';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('ar-EG');
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in duration-300">
        <div className="flex justify-between items-center p-6 border-b border-white/10 bg-slate-950/50">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-400" />
            الملف الشخصي
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* User Info */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-2xl font-bold text-white relative">
              {currentUser.name.charAt(0).toUpperCase()}
              {currentUser.isVIP && (
                <div className="absolute -bottom-1 -right-1 bg-slate-900 rounded-full p-0.5">
                  <BadgeCheck className="w-5 h-5 text-blue-500 fill-blue-500/20" />
                </div>
              )}
            </div>
            <div>
              <h4 className="text-lg font-bold text-white flex items-center gap-2">
                {currentUser.name}
                {currentUser.isVIP && <BadgeCheck className="w-4 h-4 text-blue-500" />}
              </h4>
              <p className="text-slate-400 text-sm">{currentUser.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded ${currentUser.isVIP ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-300'}`}>
                  {currentUser.isVIP ? 'VIP عضوية' : 'عضوية مجانية'}
                </span>
                {currentUser.role === 'admin' && (
                  <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400">مسؤول</span>
                )}
              </div>
            </div>
          </div>

          {/* Subscription Status */}
          <div className="bg-slate-950/50 rounded-xl p-4 border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">حالة الاشتراك</span>
              <span className={currentUser.isVIP ? 'text-green-400 font-bold' : 'text-slate-400'}>
                {currentUser.isVIP ? 'نشط' : 'غير نشط'}
              </span>
            </div>
            {currentUser.isVIP && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">ينتهي في</span>
                <span className="text-white font-mono text-sm">
                  {formatDate(currentUser.subscriptionExpiry)}
                </span>
              </div>
            )}
          </div>

          {/* Redeem Key */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
              <Key className="w-4 h-4" />
              تفعيل كود اشتراك
            </label>
            <form onSubmit={handleRedeemKey} className="relative">
              <input 
                type="text" 
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="أدخل كود التفعيل هنا..."
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:border-indigo-500/50 transition-colors text-center font-mono uppercase"
              />
              <button 
                type="submit"
                disabled={loading || !keyInput}
                className="absolute left-2 top-2 bottom-2 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {loading ? '...' : 'تفعيل'}
              </button>
            </form>
            {message && (
              <div className={`mt-3 p-3 rounded-lg text-sm flex items-center gap-2 ${
                message.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
              }`}>
                {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {message.text}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
