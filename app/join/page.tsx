'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ChevronRight, KeyRound, Sparkles, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { normalizePurdueUsername, useAccounts } from '@/lib/accounts';

type JoinFormState = {
  name: string;
  username: string;
  password: string;
  confirmPassword: string;
};

export default function JoinPage() {
  const router = useRouter();
  const { data, addAccount, signIn } = useAccounts();
  const [formData, setFormData] = useState<JoinFormState>({
    name: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [showPasswordRequirement, setShowPasswordRequirement] = useState(false);

  const normalizedUsername = useMemo(
    () => normalizePurdueUsername(formData.username),
    [formData.username],
  );

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: name === 'username' ? normalizePurdueUsername(value) : value,
    }));
    setError('');
  };

  const handleCreateAccount = () => {
    if (!formData.name.trim() || !normalizedUsername || !formData.password || !formData.confirmPassword) {
      setError('Full name, Purdue username, password, and verify password are required.');
      return;
    }

    if (formData.password.length < 8) {
      setShowPasswordRequirement(true);
      setError('Password must be at least 8 characters.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const usernameTaken = data.accounts.some((account) => account.username === normalizedUsername);
    if (usernameTaken) {
      setError('That Purdue username already exists.');
      return;
    }

    const account = {
      id: `acct-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: formData.name.trim(),
      username: normalizedUsername,
      role: 'user' as const,
      password: formData.password,
      profilePhotoDataUrl: '',
      waiverSigned: false,
      duesPaid: false,
      joinedAt: new Date().toISOString().slice(0, 10),
    };

    addAccount(account);
    signIn(normalizedUsername, formData.password);
    router.push('/portal');
  };

  return (
    <main className="min-h-screen bg-aesthetic-white px-6 pb-20 pt-24 selection:bg-guardsman-red selection:text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-xs font-header uppercase tracking-widest text-rich-black/40 transition-colors hover:text-guardsman-red"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          <h1 className="font-header text-5xl uppercase leading-tight text-rich-black md:text-7xl">
            Join The <span className="text-guardsman-red">Chapter</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-rich-black/60">
            Create your Elemental Beauty account with your Purdue username. New signups begin as
            users and complete waiver and dues later from the membership page.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]"
        >
          <section className="border border-rich-black/5 bg-white p-8 shadow-2xl md:p-14">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-[10px] font-header uppercase tracking-[0.35em] text-rich-black/35">
                  Account Signup
                </p>
                <h2 className="mt-3 font-header text-3xl uppercase tracking-wide text-rich-black">
                  Create Account
                </h2>
              </div>
              <div className="flex h-14 w-14 items-center justify-center bg-rich-black text-white shadow-xl">
                <User className="h-6 w-6" />
              </div>
            </div>

            {error ? (
              <div className="mt-8 border border-guardsman-red/20 bg-guardsman-red/[0.06] px-5 py-4">
                <p className="text-[10px] font-header font-bold uppercase tracking-[0.28em] text-guardsman-red">
                  {error}
                </p>
              </div>
            ) : null}

            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleCreateAccount();
              }}
              className="mt-8 space-y-8"
            >
              <label className="block space-y-2">
                <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">
                  Full Name
                </span>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full border border-rich-black/10 bg-pale-powder/20 px-5 py-4 text-sm font-header uppercase tracking-[0.08em] outline-none transition-colors placeholder:text-rich-black/20 focus:border-guardsman-red"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">
                  Purdue Username
                </span>
                <div className="flex items-center gap-3 border border-rich-black/10 bg-pale-powder/20 px-5 py-4">
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    className="w-full bg-transparent text-sm font-header uppercase tracking-[0.08em] outline-none placeholder:text-rich-black/20"
                  />
                  <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/30">
                    @purdue.edu
                  </span>
                </div>
              </label>

              <div className="grid gap-8 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">
                    Password
                  </span>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full border border-rich-black/10 bg-pale-powder/20 px-5 py-4 text-sm font-header uppercase tracking-[0.08em] outline-none transition-colors placeholder:text-rich-black/20 focus:border-guardsman-red"
                  />
                  <p
                    className={`text-[10px] font-header uppercase tracking-[0.25em] transition-colors ${
                      showPasswordRequirement && formData.password.length < 8
                        ? 'font-bold text-guardsman-red'
                        : 'text-rich-black/35'
                    }`}
                  >
                    At least 8 characters
                  </p>
                </label>

                <label className="block space-y-2">
                  <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">
                    Verify Password
                  </span>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="w-full border border-rich-black/10 bg-pale-powder/20 px-5 py-4 text-sm font-header uppercase tracking-[0.08em] outline-none transition-colors placeholder:text-rich-black/20 focus:border-guardsman-red"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between border-t border-rich-black/10 pt-8">
                <div />
                <button
                  type="submit"
                  className="inline-flex items-center gap-3 bg-guardsman-red px-8 py-4 font-header text-[10px] uppercase tracking-[0.35em] text-white transition-colors hover:bg-madder"
                >
                  Create Account
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </section>

          <aside className="space-y-8">
            <div className="border border-rich-black/5 bg-white p-8 shadow-2xl md:p-12">
              <div className="flex h-14 w-14 items-center justify-center bg-guardsman-red/10 text-guardsman-red">
                <KeyRound className="h-6 w-6" />
              </div>
              <h3 className="mt-8 font-header text-3xl uppercase tracking-wide text-rich-black">
                Account Preview
              </h3>
              <div className="mt-8 space-y-4 border border-guardsman-red/20 bg-guardsman-red/[0.02] p-8">
                <p className="font-header text-2xl uppercase tracking-wide text-rich-black">
                  {formData.name.trim() || 'Your Name'}
                </p>
                <p className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/45">
                  {(normalizedUsername || 'username') + '@purdue.edu'}
                </p>
                <p className="text-[10px] font-header uppercase tracking-[0.3em] text-guardsman-red">
                  Role: User
                </p>
              </div>
            </div>

            <div className="border border-rich-black/5 bg-white p-8 shadow-2xl md:p-12">
              <p className="text-[10px] font-header uppercase tracking-[0.35em] text-rich-black/35">
                Account Rules
              </p>
              <div className="mt-8 space-y-4">
                {[
                  'Full name is required.',
                  'Use your Purdue username only.',
                  'Password must be at least 8 characters.',
                  'Waiver and dues happen after signup in the portal.',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-guardsman-red" />
                    <p className="text-sm leading-7 text-rich-black/60">{item}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 border-t border-rich-black/10 pt-8">
                <p className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">
                  Secure local signup
                </p>
              </div>
            </div>
          </aside>
        </motion.div>
      </div>
    </main>
  );
}
