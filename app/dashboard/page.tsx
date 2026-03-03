'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  LayoutDashboard, 
  Users, 
  FlaskConical, 
  Calendar, 
  Settings, 
  LogOut, 
  Search, 
  Plus, 
  Filter,
  CheckCircle2,
  XCircle,
  FileText,
  DollarSign,
  ChevronRight,
  MoreVertical,
  Bell,
  User,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// --- Mock Data ---

const MOCK_MEMBERS = [
  { id: '1', name: 'Alice Johnson', email: 'alice@example.com', role: 'Member', dues: 'Paid', waiver: 'Signed', joinDate: '2024-01-15' },
  { id: '2', name: 'Bob Smith', email: 'bob@example.com', role: 'Officer', dues: 'Paid', waiver: 'Signed', joinDate: '2023-09-10' },
  { id: '3', name: 'Charlie Brown', email: 'charlie@example.com', role: 'Member', dues: 'Unpaid', waiver: 'Pending', joinDate: '2024-02-01' },
  { id: '4', name: 'Diana Prince', email: 'diana@example.com', role: 'Member', dues: 'Paid', waiver: 'Signed', joinDate: '2024-01-20' },
  { id: '5', name: 'Ethan Hunt', email: 'ethan@example.com', role: 'Member', dues: 'Unpaid', waiver: 'Signed', joinDate: '2024-02-10' },
];

const MOCK_LABS = [
  { id: '1', title: 'Vitamin C Serum', date: '2024-02-15', status: 'Published', visibility: 'Public' },
  { id: '2', title: 'Hydrating Mist', date: '2024-01-28', status: 'Published', visibility: 'Members Only' },
  { id: '3', title: 'Mineral Sunscreen', date: '2023-12-12', status: 'Draft', visibility: 'Public' },
];

// --- Dashboard Components ---

const Sidebar = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) => {
  const menuItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'labs', label: 'Labs & Projects', icon: FlaskConical },
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white border-r border-rich-black/5 h-screen sticky top-0 flex flex-col p-8">
      <Link href="/" prefetch={false} className="flex items-center gap-2 mb-16 group">
        <div className="w-8 h-8 bg-guardsman-red flex items-center justify-center group-hover:rotate-12 transition-transform">
          <FlaskConical className="w-5 h-5 text-white" />
        </div>
        <span className="font-title text-xl tracking-tighter uppercase text-rich-black">
          ELEMENTAL <span className="text-guardsman-red">PORTAL</span>
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
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rich-black/20" />
          <input 
            type="text" 
            placeholder="SEARCH..." 
            className="bg-pale-powder/30 border-none pl-10 pr-6 py-2 text-[10px] font-header uppercase tracking-widest focus:ring-1 focus:ring-guardsman-red outline-none w-64 transition-all"
          />
        </div>
        
        <button className="relative w-10 h-10 bg-pale-powder/30 flex items-center justify-center hover:bg-guardsman-red hover:text-white transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-guardsman-red border-2 border-white" />
        </button>

        <div className="flex items-center gap-4 pl-8 border-l border-rich-black/10">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-header text-rich-black uppercase tracking-widest">OFFICER JANE</p>
            <p className="text-[8px] font-header text-guardsman-red uppercase tracking-widest">ADMINISTRATOR</p>
          </div>
          <div className="w-10 h-10 bg-rich-black flex items-center justify-center shadow-xl">
            <User className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>
    </header>
  );
};

const OverviewTab = () => {
  const stats = [
    { label: 'Total Members', value: '156', change: '+12%', icon: Users, color: 'bg-guardsman-red' },
    { label: 'Active Labs', value: '24', change: '+2', icon: FlaskConical, color: 'bg-rich-black' },
    { label: 'Upcoming Events', value: '3', change: 'NEXT: MAR 5', icon: Calendar, color: 'bg-aurora-black' },
    { label: 'Revenue', value: '$1,240', change: '+15%', icon: DollarSign, color: 'bg-madder' },
  ];

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-8 border border-rich-black/5 shadow-xl">
            <div className="flex justify-between items-start mb-6">
              <div className={`${stat.color} w-12 h-12 flex items-center justify-center shadow-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-[10px] font-header text-green-600 bg-green-50 px-2 py-1 uppercase tracking-widest">{stat.change}</span>
            </div>
            <h3 className="text-4xl font-header text-rich-black mb-1">{stat.value}</h3>
            <p className="text-[10px] font-header uppercase tracking-widest text-rich-black/30">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="bg-white p-10 border border-rich-black/5 shadow-2xl">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-header text-lg uppercase tracking-widest">Recent Signups</h3>
            <button className="text-[10px] font-header text-guardsman-red uppercase tracking-widest hover:underline">View All</button>
          </div>
          <div className="space-y-6">
            {MOCK_MEMBERS.slice(0, 3).map((member) => (
              <div key={member.id} className="flex items-center justify-between p-6 bg-pale-powder/20 border border-transparent hover:border-rich-black/10 transition-all">
                <div className="flex items-center gap-6">
                  <div className="w-10 h-10 bg-rich-black flex items-center justify-center font-header text-white text-xs">
                    {member.name[0]}
                  </div>
                  <div>
                    <p className="text-xs font-header text-rich-black uppercase tracking-widest">{member.name}</p>
                    <p className="text-[10px] font-sans text-rich-black/40">{member.email}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-rich-black/20" />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-10 border border-rich-black/5 shadow-2xl">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-header text-lg uppercase tracking-widest">Lab Status</h3>
            <button className="text-[10px] font-header text-guardsman-red uppercase tracking-widest hover:underline">New Lab</button>
          </div>
          <div className="space-y-6">
            {MOCK_LABS.map((lab) => (
              <div key={lab.id} className="flex items-center justify-between p-6 bg-pale-powder/20 border border-transparent hover:border-rich-black/10 transition-all">
                <div className="flex items-center gap-6">
                  <div className="w-10 h-10 bg-guardsman-red flex items-center justify-center">
                    <FlaskConical className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-header text-rich-black uppercase tracking-widest">{lab.title}</p>
                    <p className="text-[10px] font-header text-rich-black/40 uppercase tracking-widest">{lab.visibility}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-header uppercase tracking-widest px-4 py-1 border ${
                  lab.status === 'Published' ? 'border-green-500 text-green-600' : 'border-yellow-500 text-yellow-600'
                }`}>
                  {lab.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const MembersTab = () => {
  return (
    <div className="bg-white border border-rich-black/5 shadow-2xl overflow-hidden">
      <div className="p-10 border-b border-rich-black/5 flex flex-col sm:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-6 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rich-black/20" />
            <input 
              type="text" 
              placeholder="FILTER MEMBERS..." 
              className="w-full bg-pale-powder/30 border-none px-10 py-3 text-[10px] font-header uppercase tracking-widest focus:ring-1 focus:ring-guardsman-red outline-none"
            />
          </div>
          <button className="p-3 bg-pale-powder/30 hover:bg-rich-black hover:text-white transition-all">
            <Filter className="w-5 h-5" />
          </button>
        </div>
        <button className="w-full sm:w-auto bg-guardsman-red text-white px-10 py-3 font-header text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl hover:bg-madder transition-all">
          <Plus className="w-4 h-4" /> Add Member
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-pale-powder/10 text-[10px] font-header uppercase tracking-[0.2em] text-rich-black/40 border-b border-rich-black/5">
              <th className="px-10 py-6">Member</th>
              <th className="px-10 py-6">Role</th>
              <th className="px-10 py-6">Dues</th>
              <th className="px-10 py-6">Waiver</th>
              <th className="px-10 py-6">Joined</th>
              <th className="px-10 py-6"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rich-black/5">
            {MOCK_MEMBERS.map((member) => (
              <tr key={member.id} className="hover:bg-pale-powder/10 transition-colors">
                <td className="px-10 py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-rich-black flex items-center justify-center text-xs font-header text-white">
                      {member.name[0]}
                    </div>
                    <div>
                      <p className="text-xs font-header text-rich-black uppercase tracking-widest">{member.name}</p>
                      <p className="text-[10px] font-sans text-rich-black/40">{member.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-10 py-6">
                  <span className="text-[10px] font-header uppercase tracking-widest bg-pale-powder/30 px-3 py-1">
                    {member.role}
                  </span>
                </td>
                <td className="px-10 py-6">
                  <div className="flex items-center gap-3">
                    {member.dues === 'Paid' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-guardsman-red" />
                    )}
                    <span className="text-[10px] font-header uppercase tracking-widest">{member.dues}</span>
                  </div>
                </td>
                <td className="px-10 py-6">
                  <div className="flex items-center gap-3">
                    <FileText className={`w-4 h-4 ${member.waiver === 'Signed' ? 'text-guardsman-red' : 'text-rich-black/20'}`} />
                    <span className="text-[10px] font-header uppercase tracking-widest">{member.waiver}</span>
                  </div>
                </td>
                <td className="px-10 py-6 text-[10px] font-header uppercase tracking-widest text-rich-black/40">
                  {member.joinDate}
                </td>
                <td className="px-10 py-6 text-right">
                  <button className="p-2 hover:bg-pale-powder/30 transition-colors">
                    <MoreVertical className="w-4 h-4 text-rich-black/20" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoaded, setIsLoaded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Simulate admin auth check
    const isAdmin = true; 
    if (!isAdmin) {
      router.push('/login');
    } else {
      setTimeout(() => setIsLoaded(true), 0);
    }
  }, [router]);

  if (!isLoaded) return null;

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return <OverviewTab />;
      case 'members': return <MembersTab />;
      default: return (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-24 h-24 border border-rich-black/10 flex items-center justify-center mb-10">
            <Settings className="w-12 h-12 text-rich-black/10 animate-spin-slow" />
          </div>
          <h3 className="font-header text-3xl text-rich-black mb-4 uppercase tracking-widest">Under Formulation</h3>
          <p className="font-sans text-rich-black/40 max-w-sm leading-relaxed">This module is currently being refined in the laboratory. Check back for the next update.</p>
        </div>
      );
    }
  };

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
            {renderContent()}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
