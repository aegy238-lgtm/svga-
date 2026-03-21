import React, { useState } from 'react';
import { X, MessageCircle, Key, CheckCircle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDocs, query, collection, where, updateDoc, Timestamp, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AppSettings, LicenseKey } from '../types';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings | null;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ isOpen, onClose, settings }) => {
  const { currentUser } = useAuth();
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleActivateKey = async () => {
    if (!licenseKey.trim() || !currentUser) return;
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // 1. Find the key
      const q = query(collection(db, 'licenseKeys'), where('key', '==', licenseKey.trim()));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setError('مفتاح الترخيص غير صالح');
        setLoading(false);
        return;
      }

      const keyDoc = snapshot.docs[0];
      const keyData = keyDoc.data() as LicenseKey;

      if (keyData.isUsed) {
        setError('هذا المفتاح مستخدم من قبل');
        setLoading(false);
        return;
      }

      // 2. Calculate Expiry
      let expiry = new Date();
      if (keyData.duration === 'day') expiry.setDate(expiry.getDate() + 1);
      if (keyData.duration === 'week') expiry.setDate(expiry.getDate() + 7);
      if (keyData.duration === 'month') expiry.setMonth(expiry.getMonth() + 1);
      if (keyData.duration === 'year') expiry.setFullYear(expiry.getFullYear() + 1);

      // 3. Update User
      await updateDoc(doc(db, 'users', currentUser.id), {
        isVIP: true,
        subscriptionType: keyData.duration,
        subscriptionExpiry: Timestamp.fromDate(expiry),
        activatedKey: keyData.key
      });

      // 4. Mark Key as Used
      await updateDoc(doc(db, 'licenseKeys', keyDoc.id), {
        isUsed: true,
        usedBy: currentUser.id,
        usedAt: Timestamp.now()
      });

      setSuccess(`تم تفعيل اشتراك ${keyData.duration} بنجاح!`);
      setTimeout(() => {
        onClose();
        window.location.reload(); // Reload to refresh user state/context
      }, 2000);

    } catch (err) {
      console.error(err);
      setError('حدث خطأ أثناء التفعيل');
    } finally {
      setLoading(false);
    }
  };

  const whatsappLink = `https://wa.me/${settings?.whatsappNumber}?text=${encodeURIComponent('مرحباً، أرغب في شراء مفتاح تفعيل للمنصة.')}`;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
        >
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/30">
              <Key className="w-8 h-8 text-amber-400" />
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-2">انتهت المحاولات المجانية</h2>
            <p className="text-slate-400 mb-6">
              لقد استهلكت جميع المحاولات المجانية المتاحة. للاستمرار في استخدام المنصة وتصدير الملفات، يرجى تفعيل اشتراك.
            </p>

            <div className="space-y-4 mb-6">
              <div className="relative">
                <input 
                  type="text" 
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  placeholder="أدخل كود التفعيل هنا"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-center text-white focus:outline-none focus:border-amber-500 transition-colors font-mono uppercase"
                />
              </div>

              {error && (
                <div className="flex items-center justify-center gap-2 text-red-400 text-sm bg-red-500/10 p-2 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="flex items-center justify-center gap-2 text-green-400 text-sm bg-green-500/10 p-2 rounded-lg">
                  <CheckCircle className="w-4 h-4" />
                  <span>{success}</span>
                </div>
              )}

              <button 
                onClick={handleActivateKey}
                disabled={loading || !licenseKey}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold rounded-xl transition-all"
              >
                {loading ? 'جاري التفعيل...' : 'تفعيل الاشتراك'}
              </button>
            </div>

            <div className="border-t border-white/10 pt-6">
              <p className="text-slate-500 text-sm mb-4">ليس لديك كود تفعيل؟</p>
              <a 
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold transition-all"
              >
                <MessageCircle className="w-5 h-5" />
                <span>تواصل معنا عبر واتساب</span>
              </a>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
