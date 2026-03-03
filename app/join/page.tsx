'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Sparkles, 
  CreditCard, 
  ChevronRight, 
  ShieldCheck, 
  User, 
  School,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

const JoinPage = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    major: '',
    year: '',
    interest: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  const steps = [
    { id: 1, title: 'Identity', icon: User },
    { id: 2, title: 'Academic', icon: School },
    { id: 3, title: 'Membership', icon: CreditCard },
  ];

  return (
    <main className="min-h-screen bg-aesthetic-white selection:bg-guardsman-red selection:text-white pt-24 pb-20">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-16">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-header uppercase tracking-widest text-rich-black/40 hover:text-guardsman-red transition-colors mb-8">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
          <h1 className="text-5xl md:text-7xl font-header text-rich-black mb-6 leading-tight uppercase">
            BECOME AN <span className="text-guardsman-red">ELEMENTIST</span>
          </h1>
          <p className="font-sans text-lg text-rich-black/60 max-w-xl mx-auto leading-relaxed">
            Join the elite circle of cosmetic chemistry enthusiasts. 
            Precision, passion, and science.
          </p>
        </div>

        {/* Progress Stepper */}
        <div className="flex justify-between items-center mb-12 relative">
          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-rich-black/10 -z-10" />
          {steps.map((s) => (
            <div key={s.id} className="flex flex-col items-center gap-2 bg-aesthetic-white px-4">
              <div className={`w-12 h-12 flex items-center justify-center transition-all duration-500 border ${
                step >= s.id ? 'bg-rich-black text-aesthetic-white border-rich-black' : 'bg-white text-rich-black/20 border-rich-black/10'
              }`}>
                <s.icon className="w-5 h-5" />
              </div>
              <span className={`text-[10px] font-header uppercase tracking-widest ${
                step >= s.id ? 'text-rich-black' : 'text-rich-black/30'
              }`}>
                {s.title}
              </span>
            </div>
          ))}
        </div>

        {/* Form Container */}
        <div className="bg-white p-8 md:p-16 border border-rich-black/5 shadow-2xl relative overflow-hidden">
          <form onSubmit={(e) => e.preventDefault()} className="space-y-12">
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-header uppercase tracking-widest text-rich-black/50">Full Name</label>
                    <input 
                      type="text" 
                      name="name"
                      placeholder="JANE DOE"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full bg-pale-powder/30 border-b border-rich-black/10 px-0 py-4 text-sm font-header focus:border-guardsman-red outline-none transition-all placeholder:text-rich-black/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-header uppercase tracking-widest text-rich-black/50">Email Address</label>
                    <input 
                      type="email" 
                      name="email"
                      placeholder="JANE@UNIVERSITY.EDU"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full bg-pale-powder/30 border-b border-rich-black/10 px-0 py-4 text-sm font-header focus:border-guardsman-red outline-none transition-all placeholder:text-rich-black/20"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-header uppercase tracking-widest text-rich-black/50">Statement of Interest</label>
                  <textarea 
                    name="interest"
                    rows={4}
                    placeholder="WHY DO YOU SEEK TO JOIN THE ELEMENTISTS?"
                    value={formData.interest}
                    onChange={handleInputChange}
                    className="w-full bg-pale-powder/30 border-b border-rich-black/10 px-0 py-4 text-sm font-header focus:border-guardsman-red outline-none transition-all resize-none placeholder:text-rich-black/20"
                  />
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-header uppercase tracking-widest text-rich-black/50">Major</label>
                    <input 
                      type="text" 
                      name="major"
                      placeholder="CHEMISTRY / BIOLOGY"
                      value={formData.major}
                      onChange={handleInputChange}
                      className="w-full bg-pale-powder/30 border-b border-rich-black/10 px-0 py-4 text-sm font-header focus:border-guardsman-red outline-none transition-all placeholder:text-rich-black/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-header uppercase tracking-widest text-rich-black/50">Academic Year</label>
                    <select 
                      name="year"
                      value={formData.year}
                      onChange={handleInputChange}
                      className="w-full bg-pale-powder/30 border-b border-rich-black/10 px-0 py-4 text-sm font-header focus:border-guardsman-red outline-none transition-all appearance-none"
                    >
                      <option value="">SELECT YEAR</option>
                      <option value="freshman">FRESHMAN</option>
                      <option value="sophomore">SOPHOMORE</option>
                      <option value="junior">JUNIOR</option>
                      <option value="senior">SENIOR</option>
                    </select>
                  </div>
                </div>
                
                <div className="p-8 border border-guardsman-red/20 flex gap-6 items-start bg-guardsman-red/[0.02]">
                  <ShieldCheck className="w-6 h-6 text-guardsman-red shrink-0" />
                  <div>
                    <h4 className="font-header text-sm mb-2 uppercase tracking-widest">Laboratory Protocol</h4>
                    <p className="font-sans text-xs text-rich-black/60 leading-relaxed">
                      Membership requires strict adherence to safety standards. 
                      A digital waiver will be issued upon application approval.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-12 text-center"
              >
                <div className="max-w-sm mx-auto p-12 border border-rich-black shadow-xl">
                  <CreditCard className="w-12 h-12 text-guardsman-red mx-auto mb-6" />
                  <h3 className="font-header text-2xl text-rich-black mb-2 uppercase tracking-widest">MEMBERSHIP DUES</h3>
                  <p className="font-header text-5xl text-rich-black mb-6">$25<span className="text-xs text-rich-black/40 tracking-normal"> / SEMESTER</span></p>
                  <ul className="text-left space-y-4 mb-10">
                    {['PREMIUM LAB MATERIALS', 'EXCLUSIVE ARCHIVE ACCESS', 'PRIVATE WORKSHOPS'].map(item => (
                      <li key={item} className="flex items-center gap-3 text-[10px] font-header uppercase tracking-widest">
                        <Sparkles className="w-4 h-4 text-guardsman-red" /> {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="text-[10px] font-header text-rich-black/40 uppercase tracking-[0.2em]">
                  SECURE APPLICATION PORTAL
                </p>
              </motion.div>
            )}

            <div className="flex justify-between items-center pt-12 border-t border-rich-black/10">
              {step > 1 ? (
                <button 
                  type="button"
                  onClick={prevStep}
                  className="text-[10px] font-header uppercase tracking-widest text-rich-black/40 hover:text-rich-black transition-colors"
                >
                  Previous
                </button>
              ) : <div />}

              {step < 3 ? (
                <button 
                  type="button"
                  onClick={nextStep}
                  className="bg-rich-black text-aesthetic-white px-10 py-4 font-header text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-guardsman-red transition-all"
                >
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button 
                  type="button"
                  className="bg-guardsman-red text-aesthetic-white px-12 py-5 font-header text-sm uppercase tracking-widest hover:bg-madder transition-all shadow-xl"
                >
                  Submit Application
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </main>
  );
};

export default JoinPage;
