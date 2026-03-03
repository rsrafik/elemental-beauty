'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Lock, UserRound, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { normalizePurdueUsername, useAccounts } from '@/lib/accounts';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAccounts();
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    setTimeout(() => {
      const account = signIn(username, password);
      if (!account) {
        setIsLoading(false);
        setError('Username or password did not match a local account.');
        return;
      }

      router.push(account.role === 'officer' || account.role === 'admin' ? '/dashboard' : '/portal');
    }, 1500);
  };

  return (
    <main className="min-h-screen bg-rich-black flex items-center justify-center p-6 selection:bg-guardsman-red selection:text-white">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-guardsman-red/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-guardsman-red/5 blur-[120px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-white p-10 md:p-16 shadow-2xl border border-white/10 relative overflow-hidden">
          {/* Decorative element */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-guardsman-red/5 -mr-12 -mt-12 rotate-45" />
          
          <div className="text-center mb-12">
            <Link href="/" className="inline-flex flex-col items-center justify-center mb-8 leading-none transition-opacity hover:opacity-75">
              <span className="font-abril text-4xl uppercase tracking-tight text-rich-black md:text-5xl">
                Elemental
              </span>
              <span className="font-abril text-4xl uppercase tracking-tight text-guardsman-red md:text-5xl">
                Beauty
              </span>
            </Link>
            <h1 className="font-header text-3xl text-rich-black uppercase tracking-widest mb-2">Welcome Back</h1>
            <p className="font-sans text-xs text-rich-black/40 uppercase tracking-[0.2em]">Enter your credentials to access the portal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-8">
            <div className="space-y-6">
              <div className="relative group">
                <label className="absolute -top-2.5 left-4 bg-white px-2 text-[10px] font-header text-rich-black/40 uppercase tracking-widest transition-colors group-focus-within:text-guardsman-red">
                  Purdue Username
                </label>
                <div className="flex items-center border border-rich-black/10 px-4 py-4 focus-within:border-guardsman-red transition-colors">
                  <UserRound className="w-4 h-4 text-rich-black/20 mr-4" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(normalizePurdueUsername(e.target.value))}
                    className="bg-transparent border-none w-full outline-none font-header text-xs uppercase tracking-widest text-rich-black"
                    placeholder="CAREY123"
                  />
                  <span className="text-[10px] font-header uppercase tracking-widest text-rich-black/25">
                    @purdue.edu
                  </span>
                </div>
              </div>

              <div className="relative group">
                <label className="absolute -top-2.5 left-4 bg-white px-2 text-[10px] font-header text-rich-black/40 uppercase tracking-widest transition-colors group-focus-within:text-guardsman-red">
                  Password
                </label>
                <div className="flex items-center border border-rich-black/10 px-4 py-4 focus-within:border-guardsman-red transition-colors">
                  <Lock className="w-4 h-4 text-rich-black/20 mr-4" />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-transparent border-none w-full outline-none font-header text-xs uppercase tracking-widest text-rich-black"
                    placeholder="••••••••"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-rich-black/20 hover:text-guardsman-red transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {error ? (
              <p className="text-center font-header text-[10px] uppercase tracking-[0.25em] text-guardsman-red">
                {error}
              </p>
            ) : null}

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" className="w-4 h-4 border-rich-black/10 rounded-none checked:bg-guardsman-red focus:ring-0 transition-colors" />
                <span className="font-header text-[10px] text-rich-black/40 uppercase tracking-widest group-hover:text-rich-black transition-colors">Remember Me</span>
              </label>
              <button type="button" className="font-header text-[10px] text-guardsman-red uppercase tracking-widest hover:underline">Forgot Password?</button>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-rich-black text-white py-5 font-header text-xs tracking-[0.3em] uppercase hover:bg-guardsman-red transition-all flex items-center justify-center gap-4 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign In <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-12 text-center pt-8 border-t border-rich-black/5">
            <p className="font-header text-[10px] text-rich-black/40 uppercase tracking-widest">
              Don&apos;t have an account? <Link href="/join" className="text-guardsman-red hover:underline">Join the Chapter</Link>
            </p>
            <p className="mt-4 text-[10px] font-header uppercase tracking-[0.25em] text-rich-black/25">
              Local accounts: `newuser`, `alex`, `azu`, `rrafik`
            </p>
          </div>
        </div>
        
        <div className="mt-8 text-center">
          <Link href="/" className="font-header text-[10px] text-white/40 uppercase tracking-widest hover:text-white transition-colors">
            ← Back to Home
          </Link>
        </div>
      </motion.div>
    </main>
  );
}
