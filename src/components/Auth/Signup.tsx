import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface SignupProps {
  onToggle: () => void;
}

export const Signup: React.FC<SignupProps> = ({ onToggle }) => {
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      return setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    }

    if (password !== confirmPassword) {
      return setError('كلمات المرور غير متطابقة');
    }

    try {
      setError('');
      setLoading(true);
      await signup(email, password, name);
    } catch (err: any) {
      console.error("Signup Error:", err);
      let msg = 'فشل إنشاء الحساب.';
      
      if (err.code === 'auth/email-already-in-use') {
        msg = 'البريد الإلكتروني مستخدم بالفعل.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'كلمة المرور ضعيفة جداً.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'البريد الإلكتروني غير صالح.';
      } else if (err.code === 'auth/operation-not-allowed') {
        msg = 'تسجيل الدخول عبر البريد الإلكتروني غير مفعل.';
      } else if (err.message) {
        msg = err.message;
      }
      
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-sky-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 w-full max-w-md p-8">
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-sky-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <span className="text-white font-black text-2xl">S</span>
            </div>
            <h2 className="text-3xl font-black text-white mb-2 tracking-tight">إنشاء حساب</h2>
            <p className="text-slate-400 text-sm">انضم إلينا وابدأ رحلتك الإبداعية</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6 text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">
                الاسم
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                placeholder="الاسم الكامل"
                required
              />
            </div>

            <div>
              <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                placeholder="name@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">
                كلمة المرور
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">
                تأكيد كلمة المرور
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-500 to-sky-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              {loading ? 'جاري الإنشاء...' : 'إنشاء حساب'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-slate-400 text-sm">
              لديك حساب بالفعل؟{' '}
              <button
                onClick={onToggle}
                className="text-purple-400 hover:text-purple-300 font-bold transition-colors"
              >
                تسجيل الدخول
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
