'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { FlaskConical, ArrowRight, Lock, Mail, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate login
    setTimeout(() => {
      // If it's an admin email, maybe go to dashboard, but user said portal is for regular users
      // Let's just go to /portal for now
      router.push('/portal');
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
            <Link href="/" className="inline-flex items-center justify-center w-16 h-16 bg-rich-black mb-8 group hover:rotate-12 transition-transform">
              <FlaskConical className="w-8 h-8 text-white" />
            </Link>
            <h1 className="font-header text-3xl text-rich-black uppercase tracking-widest mb-2">Welcome Back</h1>
            <p className="font-sans text-xs text-rich-black/40 uppercase tracking-[0.2em]">Enter your credentials to access the portal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-8">
            <div className="space-y-6">
              <div className="relative group">
                <label className="absolute -top-2.5 left-4 bg-white px-2 text-[10px] font-header text-rich-black/40 uppercase tracking-widest transition-colors group-focus-within:text-guardsman-red">
                  Email Address
                </label>
                <div className="flex items-center border border-rich-black/10 px-4 py-4 focus-within:border-guardsman-red transition-colors">
                  <Mail className="w-4 h-4 text-rich-black/20 mr-4" />
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-transparent border-none w-full outline-none font-header text-xs uppercase tracking-widest text-rich-black"
                    placeholder="ELEMENTIST@EB.COM"
                  />
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
