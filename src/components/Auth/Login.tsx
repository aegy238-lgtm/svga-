import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface LoginProps {
  onToggle: () => void;
}

export const Login: React.FC<LoginProps> = ({ onToggle }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      await login(email, password);
    } catch (err: any) {
      console.error("Login Error:", err);
      setError('فشل تسجيل الدخول. يرجى التحقق من البريد الإلكتروني وكلمة المرور.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl w-full">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-black text-white mb-2 tracking-tight">تسجيل الدخول</h2>
        <p className="text-slate-400 text-sm">مرحباً بعودتك</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6 text-sm text-center">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">
            البريد الإلكتروني
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
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
            className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
            placeholder="••••••••"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4"
        >
          {loading ? 'جاري التحميل...' : 'دخول'}
        </button>
      </form>

      <div className="mt-8 text-center">
        <p className="text-slate-400 text-sm">
          ليس لديك حساب؟{' '}
          <button
            onClick={onToggle}
            className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors"
          >
            إنشاء حساب جديد
          </button>
        </p>
      </div>
    </div>
  );
};
