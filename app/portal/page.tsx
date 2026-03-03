'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FlaskConical, 
  LogOut, 
  User, 
  Bell, 
  Calendar, 
  BookOpen, 
  Award, 
  CreditCard, 
  FileCheck,
  ChevronRight,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const Sidebar = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: User },
    { id: 'labs', label: 'My Labs', icon: FlaskConical },
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'resources', label: 'Resources', icon: BookOpen },
    { id: 'membership', label: 'Membership', icon: Award },
  ];

  return (
    <aside className="w-64 bg-white border-r border-rich-black/5 h-screen sticky top-0 flex flex-col p-8">
      <Link href="/" className="flex items-center gap-2 mb-16 group">
        <div className="w-8 h-8 bg-rich-black flex items-center justify-center group-hover:rotate-12 transition-transform">
          <FlaskConical className="w-5 h-5 text-white" />
        </div>
        <span className="font-title text-xl tracking-tighter uppercase text-rich-black">
          E—B <span className="text-guardsman-red">PORTAL</span>
        </span>
      </Link>

      <nav className="flex-1 space-y-4">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-4 px-4 py-3 font-header text-[10px] uppercase tracking-widest transition-all border ${
              activeTab === item.id 
                ? 'bg-rich-black text-white border-rich-black shadow-xl' 
                : 'text-rich-black/40 border-transparent hover:border-rich-black/10 hover:text-rich-black'
            }`}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </button>
        ))}
      </nav>

      <Link href="/login" className="flex items-center gap-4 px-4 py-3 font-header text-[10px] uppercase tracking-widest text-guardsman-red hover:bg-guardsman-red/5 transition-all mt-auto border border-transparent hover:border-guardsman-red/10">
        <LogOut className="w-4 h-4" />
        Logout
      </Link>
    </aside>
  );
};

const Header = ({ title }: { title: string }) => {
  return (
    <header className="h-20 bg-white border-b border-rich-black/5 px-10 flex items-center justify-between sticky top-0 z-10">
      <h1 className="font-header text-xl text-rich-black uppercase tracking-widest">{title}</h1>
      
      <div className="flex items-center gap-8">
        <button className="relative w-10 h-10 bg-pale-powder/30 flex items-center justify-center hover:bg-guardsman-red hover:text-white transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-guardsman-red border-2 border-white" />
        </button>

        <div className="flex items-center gap-4 pl-8 border-l border-rich-black/10">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-header text-rich-black uppercase tracking-widest">ALEX ELEMENTIST</p>
            <p className="text-[8px] font-header text-rich-black/40 uppercase tracking-widest">MEMBER #124</p>
          </div>
          <div className="w-10 h-10 bg-rich-black flex items-center justify-center shadow-xl">
            <User className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>
    </header>
  );
};

const DashboardTab = () => {
  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 bg-rich-black text-white p-10 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-guardsman-red/10 blur-[80px] -mr-32 -mt-32 group-hover:bg-guardsman-red/20 transition-colors" />
          <div className="relative z-10">
            <h2 className="font-header text-4xl mb-4 uppercase tracking-tight">Welcome Back, Alex</h2>
            <p className="font-sans text-white/60 mb-8 max-w-md leading-relaxed">You have 2 upcoming labs this week. Don&apos;t forget to review the safety protocols before arriving at the laboratory.</p>
            <button className="bg-guardsman-red text-white px-8 py-3 font-header text-[10px] uppercase tracking-widest hover:bg-madder transition-all shadow-xl">
              Resume Lab #24
            </button>
          </div>
        </div>
        
        <div className="bg-white p-10 border border-rich-black/5 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="font-header text-xs uppercase tracking-widest text-rich-black/40 mb-6">Membership Status</h3>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-green-50 flex items-center justify-center">
                <FileCheck className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="font-header text-sm uppercase tracking-widest">ACTIVE MEMBER</p>
                <p className="text-[10px] font-sans text-rich-black/40">Expires Dec 2024</p>
              </div>
            </div>
          </div>
          <button className="w-full border border-rich-black/10 py-3 font-header text-[10px] uppercase tracking-widest hover:bg-rich-black hover:text-white transition-all">
            View ID Card
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="bg-white p-10 border border-rich-black/5 shadow-2xl">
          <h3 className="font-header text-lg uppercase tracking-widest mb-8">Upcoming Events</h3>
          <div className="space-y-6">
            {[
              { date: 'MAR 05', title: 'Vitamin C Formulation Workshop', time: '5:00 PM' },
              { date: 'MAR 12', title: 'Guest Speaker: Dr. Aris', time: '6:30 PM' },
              { date: 'MAR 20', title: 'Spring Networking Mixer', time: '7:00 PM' },
            ].map((event, idx) => (
              <div key={idx} className="flex items-center justify-between p-6 bg-pale-powder/20 border border-transparent hover:border-rich-black/10 transition-all cursor-pointer">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 bg-rich-black flex flex-col items-center justify-center text-white">
                    <span className="text-[8px] font-header uppercase tracking-widest opacity-60">{event.date.split(' ')[0]}</span>
                    <span className="text-lg font-header">{event.date.split(' ')[1]}</span>
                  </div>
                  <div>
                    <p className="text-xs font-header text-rich-black uppercase tracking-widest">{event.title}</p>
                    <p className="text-[10px] font-sans text-rich-black/40">{event.time} • Lab 402</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-rich-black/20" />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-10 border border-rich-black/5 shadow-2xl">
          <h3 className="font-header text-lg uppercase tracking-widest mb-8">Recent Lab Activity</h3>
          <div className="space-y-6">
            {[
              { title: 'Hydrating Mist Stability Test', status: 'Completed', score: '98/100' },
              { title: 'Emulsion Basics Quiz', status: 'In Progress', score: '--' },
              { title: 'Safety Certification', status: 'Verified', score: 'PASSED' },
            ].map((lab, idx) => (
              <div key={idx} className="flex items-center justify-between p-6 bg-pale-powder/20 border border-transparent hover:border-rich-black/10 transition-all cursor-pointer">
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 bg-guardsman-red/10 flex items-center justify-center">
                    <FlaskConical className="w-6 h-6 text-guardsman-red" />
                  </div>
                  <div>
                    <p className="text-xs font-header text-rich-black uppercase tracking-widest">{lab.title}</p>
                    <p className="text-[10px] font-header text-rich-black/40 uppercase tracking-widest">{lab.status}</p>
                  </div>
                </div>
                <span className="text-[10px] font-header text-guardsman-red uppercase tracking-widest">{lab.score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function PortalPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoaded, setIsLoaded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Simulate auth check
    const isLoggedIn = true; // In a real app, this would check a cookie or token
    if (!isLoggedIn) {
      router.push('/login');
    } else {
      setTimeout(() => setIsLoaded(true), 0);
    }
  }, [router]);

  if (!isLoaded) return null;

  return (
    <div className="min-h-screen bg-aesthetic-white flex selection:bg-guardsman-red selection:text-white">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 overflow-y-auto">
        <Header title={activeTab} />
        <div className="p-12 max-w-7xl mx-auto">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'dashboard' ? <DashboardTab /> : (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <Sparkles className="w-12 h-12 text-guardsman-red mb-8 animate-pulse" />
                <h3 className="font-header text-3xl text-rich-black mb-4 uppercase tracking-widest">Coming Soon</h3>
                <p className="font-sans text-rich-black/40 max-w-sm leading-relaxed">We are currently formulating this section. Stay tuned for the next lab update.</p>
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
