import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore, getRoleBasePath } from '../stores/authStore';
import { Scale, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    await login(email, password);
    const user = useAuthStore.getState().user;
    if (user) {
      navigate(getRoleBasePath(user.role) + '/dashboard');
    }
  };

  const quickLogin = async (email: string) => {
    clearError();
    await login(email, 'password123');
    const user = useAuthStore.getState().user;
    if (user) {
      navigate(getRoleBasePath(user.role) + '/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-gold/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-royal/20 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center">
              <Scale size={26} className="text-navy" />
            </div>
            <span className="text-2xl font-bold text-white">LegalFlow</span>
          </Link>
          <p className="text-text-secondary">Sign in to your account</p>
        </div>

        {/* Login Form */}
        <div className="glass-strong p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm animate-fade-in">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-text-secondary block mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="glass-input w-full px-4 py-3 text-sm"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-text-secondary block mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="glass-input w-full px-4 py-3 pr-10 text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={18} />
                  Sign In
                </>
              )}
            </button>
          </form>
        </div>

        {/* Quick Login */}
        <div className="mt-6 glass p-5">
          <p className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-3">Quick Login (Demo)</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Admin', email: 'admin@firm.com', color: 'from-red-500/20 to-red-500/5 border-red-500/20 hover:border-red-500/40' },
              { label: 'Attorney (John)', email: 'john@firm.com', color: 'from-blue-500/20 to-blue-500/5 border-blue-500/20 hover:border-blue-500/40' },
              { label: 'Attorney (Michael)', email: 'michael@firm.com', color: 'from-indigo-500/20 to-indigo-500/5 border-indigo-500/20 hover:border-indigo-500/40' },
              { label: 'Secretary', email: 'sarah@firm.com', color: 'from-green-500/20 to-green-500/5 border-green-500/20 hover:border-green-500/40' },
              { label: 'Client A', email: 'clientA@email.com', color: 'from-gold/20 to-gold/5 border-gold/20 hover:border-gold/40' },
              { label: 'Client B', email: 'clientB@email.com', color: 'from-amber-500/20 to-amber-500/5 border-amber-500/20 hover:border-amber-500/40' },
            ].map((acc) => (
              <button
                key={acc.email}
                onClick={() => quickLogin(acc.email)}
                className={`text-left px-3 py-2.5 rounded-lg bg-gradient-to-r border text-sm transition-all ${acc.color}`}
              >
                <p className="text-white font-medium text-xs">{acc.label}</p>
                <p className="text-text-muted text-[10px]">{acc.email}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
