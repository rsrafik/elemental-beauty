'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  Calendar,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  Eye,
  FileText,
  Filter,
  FlaskConical,
  GripVertical,
  ImagePlus,
  LogOut,
  MoreVertical,
  Plus,
  Save,
  Search,
  Settings,
  Trash2,
  User,
  Users,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AdminDashboardData,
  AdminEvent,
  AdminLab,
  AdminMember,
  useAdminDashboardData,
} from '@/lib/admin-dashboard';
import { BoardBookData, BoardBookMember, defaultBoardBookData, useBoardBookData } from '@/lib/board-book';

const DEFAULT_BOARD_PLACEHOLDER = 'from-[#efebe8] via-[#f8f4f1] to-[#e4dcda]';

function createBoardMember(): BoardBookMember {
  return {
    id: `board-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    role: '',
    kicker: '',
    quote: '',
    bio: '',
    caption: '',
    accent: DEFAULT_BOARD_PLACEHOLDER,
    instagram: '',
    imageDataUrl: '',
  };
}

function reorderBoardMembers(members: BoardBookMember[], draggedId: string, targetId: string) {
  const nextMembers = [...members];
  const draggedIndex = nextMembers.findIndex((member) => member.id === draggedId);
  const targetIndex = nextMembers.findIndex((member) => member.id === targetId);

  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
    return members;
  }

  const [draggedMember] = nextMembers.splice(draggedIndex, 1);
  nextMembers.splice(targetIndex, 0, draggedMember);
  return nextMembers;
}

function readImageFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Unable to read image file.'));
    reader.readAsDataURL(file);
  });
}

function createAdminMember(): AdminMember {
  const token = Date.now().toString().slice(-5);
  return {
    id: `member-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: 'New Member',
    email: `member${token}@example.com`,
    role: 'Member',
    dues: 'Unpaid',
    waiver: 'Pending',
    joinDate: new Date().toISOString().slice(0, 10),
  };
}

function createAdminLab(): AdminLab {
  return {
    id: `lab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: 'New Lab Draft',
    date: new Date().toISOString().slice(0, 10),
    status: 'Draft',
    visibility: 'Public',
  };
}

function createAdminEvent(): AdminEvent {
  return {
    id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: 'New Event',
    date: new Date().toISOString().slice(0, 10),
    location: 'TBD',
    status: 'Draft',
  };
}

function BoardBookPlaceholder({ className = '' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${DEFAULT_BOARD_PLACEHOLDER} ${className}`}>
      <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.05)_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="absolute inset-[14%] border border-rich-black/10" />
      <div className="absolute left-[18%] top-[18%] h-[22%] w-[28%] border border-rich-black/10 bg-white/40" />
      <div className="absolute right-[16%] top-[24%] h-[44%] w-[24%] border border-rich-black/10 bg-rich-black/5" />
      <div className="absolute left-[18%] bottom-[16%] h-[18%] w-[48%] border border-rich-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.45),rgba(0,0,0,0.04))]" />
    </div>
  );
}

const Sidebar = ({ activeTab, setActiveTab }: { activeTab: string; setActiveTab: (tab: string) => void }) => {
  const menuItems = [
    { id: 'overview', label: 'Overview', icon: Users },
    { id: 'members', label: 'Members', icon: User },
    { id: 'board', label: 'Board Book', icon: FileText },
    { id: 'labs', label: 'Labs & Projects', icon: FlaskConical },
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="sticky top-0 flex h-screen w-64 flex-col border-r border-rich-black/5 bg-white p-8">
      <Link href="/" prefetch={false} className="group mb-16 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center bg-guardsman-red transition-transform group-hover:rotate-12">
          <FlaskConical className="h-5 w-5 text-white" />
        </div>
        <span className="font-title text-xl uppercase tracking-tighter text-rich-black">
          ELEMENTAL <span className="text-guardsman-red">PORTAL</span>
        </span>
      </Link>

      <nav className="flex-1 space-y-4">
        {menuItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`flex w-full items-center gap-4 border px-4 py-3 font-header text-[10px] uppercase tracking-widest transition-all ${
              activeTab === item.id
                ? 'border-rich-black bg-rich-black text-white shadow-xl'
                : 'border-transparent text-rich-black/40 hover:border-rich-black/10 hover:text-rich-black'
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </nav>

      <Link
        href="/login"
        className="mt-auto flex items-center gap-4 border border-transparent px-4 py-3 font-header text-[10px] uppercase tracking-widest text-guardsman-red transition-all hover:border-guardsman-red/10 hover:bg-guardsman-red/5"
      >
        <LogOut className="h-4 w-4" />
        Logout
      </Link>
    </aside>
  );
};

const Header = ({
  title,
  adminName,
  adminRole,
  notifications,
  notificationsOpen,
  onToggleNotifications,
}: {
  title: string;
  adminName: string;
  adminRole: string;
  notifications: AdminDashboardData['notifications'];
  notificationsOpen: boolean;
  onToggleNotifications: () => void;
}) => {
  return (
    <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-rich-black/5 bg-white px-10">
      <h1 className="font-header text-xl uppercase tracking-widest text-rich-black">{title}</h1>

      <div className="relative flex items-center gap-8">
        <button
          type="button"
          onClick={onToggleNotifications}
          className="relative flex h-10 w-10 items-center justify-center bg-pale-powder/30 transition-colors hover:bg-guardsman-red hover:text-white"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 border-2 border-white bg-guardsman-red" />
        </button>

        <AnimatePresence>
          {notificationsOpen ? (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute right-20 top-14 w-80 border border-rich-black/10 bg-white p-5 shadow-2xl"
            >
              <p className="font-header text-xs uppercase tracking-[0.3em] text-rich-black/35">Notifications</p>
              <div className="mt-4 space-y-3">
                {notifications.map((notification) => (
                  <div key={notification.id} className="border border-rich-black/8 bg-pale-powder/18 p-4">
                    <p className="text-sm leading-6 text-rich-black/75">{notification.message}</p>
                    <p className="mt-2 text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">
                      {notification.timeLabel}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="flex items-center gap-4 border-l border-rich-black/10 pl-8">
          <div className="hidden text-right sm:block">
            <p className="text-[10px] font-header uppercase tracking-widest text-rich-black">{adminName}</p>
            <p className="text-[8px] font-header uppercase tracking-widest text-guardsman-red">{adminRole}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center bg-rich-black shadow-xl">
            <User className="h-6 w-6 text-white" />
          </div>
        </div>
      </div>
    </header>
  );
};

const OverviewTab = ({
  data,
  onSelectTab,
}: {
  data: AdminDashboardData;
  onSelectTab: (tab: string) => void;
}) => {
  const stats = [
    { label: 'Total Members', value: String(data.members.length), change: `${data.members.filter((member) => member.dues === 'Paid').length} paid`, icon: Users, color: 'bg-guardsman-red' },
    { label: 'Active Labs', value: String(data.labs.length), change: `${data.labs.filter((lab) => lab.status === 'Published').length} published`, icon: FlaskConical, color: 'bg-rich-black' },
    { label: 'Upcoming Events', value: String(data.events.filter((event) => event.status === 'Scheduled').length), change: 'schedule live', icon: Calendar, color: 'bg-aurora-black' },
    { label: 'Revenue', value: `${data.members.filter((member) => member.dues === 'Paid').length * 25}`, change: data.settings.memberDuesLabel, icon: DollarSign, color: 'bg-madder' },
  ];

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <button
            key={stat.label}
            type="button"
            onClick={() => onSelectTab(stat.label === 'Total Members' ? 'members' : stat.label === 'Active Labs' ? 'labs' : stat.label === 'Upcoming Events' ? 'events' : 'settings')}
            className="border border-rich-black/5 bg-white p-8 text-left shadow-xl transition-transform hover:-translate-y-1"
          >
            <div className="mb-6 flex items-start justify-between">
              <div className={`flex h-12 w-12 items-center justify-center shadow-lg ${stat.color}`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
              <span className="bg-green-50 px-2 py-1 text-[10px] font-header uppercase tracking-widest text-green-600">
                {stat.change}
              </span>
            </div>
            <h3 className="mb-1 font-header text-4xl text-rich-black">{stat.value}</h3>
            <p className="text-[10px] font-header uppercase tracking-widest text-rich-black/30">{stat.label}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        <div className="border border-rich-black/5 bg-white p-10 shadow-2xl">
          <div className="mb-8 flex items-center justify-between">
            <h3 className="font-header text-lg uppercase tracking-widest">Recent Signups</h3>
            <button
              type="button"
              onClick={() => onSelectTab('members')}
              className="text-[10px] font-header uppercase tracking-widest text-guardsman-red hover:underline"
            >
              View All
            </button>
          </div>
          <div className="space-y-6">
            {data.members.slice(0, 3).map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => onSelectTab('members')}
                className="flex w-full items-center justify-between border border-transparent bg-pale-powder/20 p-6 text-left transition-all hover:border-rich-black/10"
              >
                <div className="flex items-center gap-6">
                  <div className="flex h-10 w-10 items-center justify-center bg-rich-black font-header text-xs text-white">
                    {member.name[0]}
                  </div>
                  <div>
                    <p className="text-xs font-header uppercase tracking-widest text-rich-black">{member.name}</p>
                    <p className="text-[10px] font-sans text-rich-black/40">{member.email}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-rich-black/20" />
              </button>
            ))}
          </div>
        </div>

        <div className="border border-rich-black/5 bg-white p-10 shadow-2xl">
          <div className="mb-8 flex items-center justify-between">
            <h3 className="font-header text-lg uppercase tracking-widest">Lab Status</h3>
            <button
              type="button"
              onClick={() => onSelectTab('labs')}
              className="text-[10px] font-header uppercase tracking-widest text-guardsman-red hover:underline"
            >
              New Lab
            </button>
          </div>
          <div className="space-y-6">
            {data.labs.map((lab) => (
              <button
                key={lab.id}
                type="button"
                onClick={() => onSelectTab('labs')}
                className="flex w-full items-center justify-between border border-transparent bg-pale-powder/20 p-6 text-left transition-all hover:border-rich-black/10"
              >
                <div className="flex items-center gap-6">
                  <div className="flex h-10 w-10 items-center justify-center bg-guardsman-red">
                    <FlaskConical className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-header uppercase tracking-widest text-rich-black">{lab.title}</p>
                    <p className="text-[10px] font-header uppercase tracking-widest text-rich-black/40">{lab.visibility}</p>
                  </div>
                </div>
                <span
                  className={`border px-4 py-1 text-[10px] font-header uppercase tracking-widest ${
                    lab.status === 'Published' ? 'border-green-500 text-green-600' : 'border-yellow-500 text-yellow-600'
                  }`}
                >
                  {lab.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const MembersTab = ({
  members,
  onSaveMembers,
}: {
  members: AdminMember[];
  onSaveMembers: (members: AdminMember[]) => void;
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | 'Paid' | 'Unpaid'>('All');
  const [selectedMemberId, setSelectedMemberId] = useState(members[0]?.id ?? '');
  const [memberDraft, setMemberDraft] = useState<AdminMember>(members[0] ?? createAdminMember());

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const matchesSearch =
        member.name.toLowerCase().includes(search.toLowerCase()) ||
        member.email.toLowerCase().includes(search.toLowerCase()) ||
        member.role.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === 'All' || member.dues === filter;
      return matchesSearch && matchesFilter;
    });
  }, [filter, members, search]);

  const saveMember = () => {
    onSaveMembers(members.map((member) => (member.id === memberDraft.id ? memberDraft : member)));
  };

  const addMember = () => {
    const nextMember = createAdminMember();
    onSaveMembers([nextMember, ...members]);
    setSelectedMemberId(nextMember.id);
    setMemberDraft(nextMember);
  };

  const removeMember = (memberId: string) => {
    const nextMembers = members.filter((member) => member.id !== memberId);
    onSaveMembers(nextMembers);
    const fallback = nextMembers[0];
    if (fallback) {
      setSelectedMemberId(fallback.id);
      setMemberDraft(fallback);
    }
  };

  return (
    <div className="grid gap-10 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="overflow-hidden border border-rich-black/5 bg-white shadow-2xl">
        <div className="flex flex-col items-center justify-between gap-6 border-b border-rich-black/5 p-10 sm:flex-row">
          <div className="flex w-full items-center gap-6 sm:w-auto">
            <div className="relative flex-1 sm:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rich-black/20" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="FILTER MEMBERS..."
                className="w-full bg-pale-powder/30 px-10 py-3 text-[10px] font-header uppercase tracking-widest outline-none ring-0 focus:ring-1 focus:ring-guardsman-red"
              />
            </div>
            <button
              type="button"
              onClick={() => setFilter((current) => (current === 'All' ? 'Paid' : current === 'Paid' ? 'Unpaid' : 'All'))}
              className="bg-pale-powder/30 p-3 transition-all hover:bg-rich-black hover:text-white"
            >
              <Filter className="h-5 w-5" />
            </button>
          </div>
          <button
            type="button"
            onClick={addMember}
            className="flex w-full items-center justify-center gap-3 bg-guardsman-red px-10 py-3 font-header text-[10px] uppercase tracking-widest text-white shadow-xl transition-all hover:bg-madder sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Add Member
          </button>
        </div>

        <div className="border-b border-rich-black/5 px-10 py-4 text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">
          Current filter: {filter}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-rich-black/5 bg-pale-powder/10 text-[10px] font-header uppercase tracking-[0.2em] text-rich-black/40">
                <th className="px-10 py-6">Member</th>
                <th className="px-10 py-6">Role</th>
                <th className="px-10 py-6">Dues</th>
                <th className="px-10 py-6">Waiver</th>
                <th className="px-10 py-6">Joined</th>
                <th className="px-10 py-6" />
              </tr>
            </thead>
            <tbody className="divide-y divide-rich-black/5">
              {filteredMembers.map((member) => (
                <tr
                  key={member.id}
                  onClick={() => {
                    setSelectedMemberId(member.id);
                    setMemberDraft(member);
                  }}
                  className={`cursor-pointer transition-colors hover:bg-pale-powder/10 ${
                    member.id === selectedMemberId ? 'bg-guardsman-red/5' : ''
                  }`}
                >
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center bg-rich-black text-xs font-header text-white">
                        {member.name[0] ?? '?'}
                      </div>
                      <div>
                        <p className="text-xs font-header uppercase tracking-widest text-rich-black">{member.name}</p>
                        <p className="text-[10px] font-sans text-rich-black/40">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-6">
                    <span className="bg-pale-powder/30 px-3 py-1 text-[10px] font-header uppercase tracking-widest">
                      {member.role}
                    </span>
                  </td>
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-3">
                      {member.dues === 'Paid' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-guardsman-red" />
                      )}
                      <span className="text-[10px] font-header uppercase tracking-widest">{member.dues}</span>
                    </div>
                  </td>
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-3">
                      <FileText className={`h-4 w-4 ${member.waiver === 'Signed' ? 'text-guardsman-red' : 'text-rich-black/20'}`} />
                      <span className="text-[10px] font-header uppercase tracking-widest">{member.waiver}</span>
                    </div>
                  </td>
                  <td className="px-10 py-6 text-[10px] font-header uppercase tracking-widest text-rich-black/40">
                    {member.joinDate}
                  </td>
                  <td className="px-10 py-6 text-right">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedMemberId(member.id);
                        setMemberDraft(member);
                      }}
                      className="p-2 transition-colors hover:bg-pale-powder/30"
                    >
                      <MoreVertical className="h-4 w-4 text-rich-black/20" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border border-rich-black/5 bg-white p-8 shadow-2xl">
        <p className="text-[10px] font-header uppercase tracking-[0.35em] text-rich-black/35">Member Actions</p>
        <h3 className="mt-3 font-header text-2xl uppercase tracking-wide">Edit Member</h3>

        <div className="mt-8 space-y-4">
          <label className="block space-y-2">
            <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Name</span>
            <input
              value={memberDraft.name}
              onChange={(event) => setMemberDraft((current) => ({ ...current, name: event.target.value }))}
              className="w-full border border-rich-black/10 bg-pale-powder/20 px-4 py-3 text-sm outline-none focus:border-guardsman-red"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Email</span>
            <input
              value={memberDraft.email}
              onChange={(event) => setMemberDraft((current) => ({ ...current, email: event.target.value }))}
              className="w-full border border-rich-black/10 bg-pale-powder/20 px-4 py-3 text-sm outline-none focus:border-guardsman-red"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Role</span>
            <input
              value={memberDraft.role}
              onChange={(event) => setMemberDraft((current) => ({ ...current, role: event.target.value }))}
              className="w-full border border-rich-black/10 bg-pale-powder/20 px-4 py-3 text-sm outline-none focus:border-guardsman-red"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setMemberDraft((current) => ({ ...current, dues: current.dues === 'Paid' ? 'Unpaid' : 'Paid' }))}
              className="border border-rich-black/10 px-4 py-3 text-[10px] font-header uppercase tracking-[0.3em] transition-colors hover:border-guardsman-red hover:bg-guardsman-red hover:text-white"
            >
              Dues: {memberDraft.dues}
            </button>
            <button
              type="button"
              onClick={() => setMemberDraft((current) => ({ ...current, waiver: current.waiver === 'Signed' ? 'Pending' : 'Signed' }))}
              className="border border-rich-black/10 px-4 py-3 text-[10px] font-header uppercase tracking-[0.3em] transition-colors hover:border-guardsman-red hover:bg-guardsman-red hover:text-white"
            >
              Waiver: {memberDraft.waiver}
            </button>
          </div>
          <label className="block space-y-2">
            <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Join Date</span>
            <input
              type="date"
              value={memberDraft.joinDate}
              onChange={(event) => setMemberDraft((current) => ({ ...current, joinDate: event.target.value }))}
              className="w-full border border-rich-black/10 bg-pale-powder/20 px-4 py-3 text-sm outline-none focus:border-guardsman-red"
            />
          </label>
        </div>

        <div className="mt-8 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={saveMember}
            className="inline-flex items-center gap-3 bg-rich-black px-6 py-3 font-header text-[10px] uppercase tracking-[0.35em] text-white transition-colors hover:bg-guardsman-red"
          >
            <Save className="h-4 w-4" />
            Save Member
          </button>
          <button
            type="button"
            onClick={() => removeMember(memberDraft.id)}
            className="inline-flex items-center gap-3 border border-rich-black/10 px-6 py-3 font-header text-[10px] uppercase tracking-[0.35em] transition-colors hover:border-guardsman-red hover:bg-guardsman-red hover:text-white"
          >
            <Trash2 className="h-4 w-4" />
            Remove Member
          </button>
        </div>
      </div>
    </div>
  );
};

const BoardBookTab = () => {
  const { data, isReady, setData } = useBoardBookData();
  const [draftData, setDraftData] = useState<BoardBookData>(defaultBoardBookData);
  const [selectedMemberId, setSelectedMemberId] = useState(defaultBoardBookData.members[0]?.id ?? '');
  const [memberDraft, setMemberDraft] = useState<BoardBookMember>(defaultBoardBookData.members[0] ?? createBoardMember());
  const [draggedMemberId, setDraggedMemberId] = useState('');
  const [saveState, setSaveState] = useState('');
  const selectedMemberIdRef = useRef(selectedMemberId);

  useEffect(() => {
    selectedMemberIdRef.current = selectedMemberId;
  }, [selectedMemberId]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    setDraftData(data);
    const activeMember =
      data.members.find((member) => member.id === selectedMemberIdRef.current) ?? data.members[0];
    if (activeMember) {
      setSelectedMemberId(activeMember.id);
      setMemberDraft({ ...activeMember });
    }
  }, [data, isReady]);

  const syncSelectedMember = (members: BoardBookMember[], fallbackId?: string) => {
    const nextSelectedId = fallbackId ?? selectedMemberId;
    const activeMember = members.find((member) => member.id === nextSelectedId) ?? members[0];

    if (!activeMember) {
      return;
    }

    setSelectedMemberId(activeMember.id);
    setMemberDraft({ ...activeMember });
  };

  const persistMembers = (nextMembers: BoardBookMember[], message: string, nextSelectedId?: string) => {
    const nextData = {
      ...draftData,
      members: nextMembers,
    };

    setDraftData(nextData);
    setData(nextData);
    syncSelectedMember(nextMembers, nextSelectedId);
    setSaveState(message);
  };

  const updateCoverField = (field: keyof BoardBookData['cover'], value: string) => {
    setDraftData((current) => ({
      ...current,
      cover: {
        ...current.cover,
        [field]: value,
      },
    }));
    setSaveState('');
  };

  const selectMember = (memberId: string) => {
    const member = draftData.members.find((entry) => entry.id === memberId);
    if (!member) {
      return;
    }

    setSelectedMemberId(memberId);
    setMemberDraft({ ...member });
    setSaveState('');
  };

  const saveMemberDraft = () => {
    persistMembers(
      draftData.members.map((member) => (member.id === selectedMemberId ? { ...memberDraft } : member)),
      'Card saved',
      selectedMemberId,
    );
  };

  const addMember = () => {
    const nextMember = createBoardMember();
    persistMembers([...draftData.members, nextMember], 'New member added', nextMember.id);
  };

  const removeMember = (memberId: string) => {
    if (draftData.members.length <= 1) {
      return;
    }

    const nextMembers = draftData.members.filter((member) => member.id !== memberId);
    persistMembers(nextMembers, 'Member removed', nextMembers[0]?.id);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const imageDataUrl = await readImageFile(file);
      setMemberDraft((current) => ({
        ...current,
        imageDataUrl,
      }));
      setSaveState('Image added to draft');
    } finally {
      event.target.value = '';
    }
  };

  const persistBoardBook = () => {
    const nextData: BoardBookData = {
      ...draftData,
      members: draftData.members.map((member) =>
        member.id === selectedMemberId ? { ...memberDraft } : member,
      ),
    };

    setDraftData(nextData);
    setData(nextData);
    syncSelectedMember(nextData.members, selectedMemberId);
    setSaveState('Board book saved');
  };

  if (!isReady) {
    return null;
  }

  return (
    <div className="space-y-10">
      <div className="grid gap-10 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-8">
          <div className="border border-rich-black/5 bg-white p-8 shadow-2xl">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-[10px] font-header uppercase tracking-[0.35em] text-rich-black/35">Cover Settings</p>
                <h2 className="mt-3 font-header text-2xl uppercase tracking-wide">Board Book Controls</h2>
              </div>
              <button
                type="button"
                onClick={persistBoardBook}
                className="inline-flex items-center gap-3 bg-rich-black px-6 py-3 font-header text-[10px] uppercase tracking-[0.35em] text-white transition-colors hover:bg-guardsman-red"
              >
                <Save className="h-4 w-4" />
                Save Board Book
              </button>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-3">
              <label className="space-y-2">
                <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Edition Label</span>
                <input
                  value={draftData.cover.editionLabel}
                  onChange={(event) => updateCoverField('editionLabel', event.target.value)}
                  className="w-full border border-rich-black/10 bg-pale-powder/20 px-4 py-3 text-sm outline-none transition-colors focus:border-guardsman-red"
                />
              </label>
              <label className="space-y-2">
                <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Volume Number</span>
                <input
                  value={draftData.cover.volumeNumber}
                  onChange={(event) => updateCoverField('volumeNumber', event.target.value)}
                  className="w-full border border-rich-black/10 bg-pale-powder/20 px-4 py-3 text-sm outline-none transition-colors focus:border-guardsman-red"
                />
              </label>
              <label className="space-y-2">
                <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Issue Number</span>
                <input
                  value={draftData.cover.issueNumber}
                  onChange={(event) => updateCoverField('issueNumber', event.target.value)}
                  className="w-full border border-rich-black/10 bg-pale-powder/20 px-4 py-3 text-sm outline-none transition-colors focus:border-guardsman-red"
                />
              </label>
            </div>

            <p className="mt-4 text-xs text-rich-black/45">
              Member issue numbers inside the book are automatic and come from drag order. These cover values control the front-cover line only.
            </p>
            {saveState ? (
              <p className="mt-4 text-[10px] font-header uppercase tracking-[0.35em] text-guardsman-red">{saveState}</p>
            ) : null}
          </div>

          <div className="border border-rich-black/5 bg-white p-8 shadow-2xl">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-[10px] font-header uppercase tracking-[0.35em] text-rich-black/35">Member Editor</p>
                <h3 className="mt-3 font-header text-2xl uppercase tracking-wide">Edit Board Member</h3>
              </div>
              <button
                type="button"
                onClick={addMember}
                className="inline-flex items-center gap-3 border border-rich-black/10 px-5 py-3 font-header text-[10px] uppercase tracking-[0.35em] transition-colors hover:border-guardsman-red hover:bg-guardsman-red hover:text-white"
              >
                <Plus className="h-4 w-4" />
                Add Member
              </button>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Name</span>
                <input
                  value={memberDraft.name}
                  onChange={(event) => setMemberDraft((current) => ({ ...current, name: event.target.value }))}
                  className="w-full border border-rich-black/10 bg-pale-powder/20 px-4 py-3 text-sm outline-none transition-colors focus:border-guardsman-red"
                />
              </label>
              <label className="space-y-2">
                <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Role</span>
                <input
                  value={memberDraft.role}
                  onChange={(event) => setMemberDraft((current) => ({ ...current, role: event.target.value }))}
                  className="w-full border border-rich-black/10 bg-pale-powder/20 px-4 py-3 text-sm outline-none transition-colors focus:border-guardsman-red"
                />
              </label>
              <label className="space-y-2">
                <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Kicker</span>
                <input
                  value={memberDraft.kicker}
                  onChange={(event) => setMemberDraft((current) => ({ ...current, kicker: event.target.value }))}
                  className="w-full border border-rich-black/10 bg-pale-powder/20 px-4 py-3 text-sm outline-none transition-colors focus:border-guardsman-red"
                />
              </label>
              <label className="space-y-2">
                <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Instagram</span>
                <input
                  value={memberDraft.instagram}
                  onChange={(event) => setMemberDraft((current) => ({ ...current, instagram: event.target.value }))}
                  className="w-full border border-rich-black/10 bg-pale-powder/20 px-4 py-3 text-sm outline-none transition-colors focus:border-guardsman-red"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Quote</span>
                <textarea
                  value={memberDraft.quote}
                  onChange={(event) => setMemberDraft((current) => ({ ...current, quote: event.target.value }))}
                  rows={2}
                  className="w-full resize-none border border-rich-black/10 bg-pale-powder/20 px-4 py-3 text-sm outline-none transition-colors focus:border-guardsman-red"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Bio</span>
                <textarea
                  value={memberDraft.bio}
                  onChange={(event) => setMemberDraft((current) => ({ ...current, bio: event.target.value }))}
                  rows={4}
                  className="w-full resize-none border border-rich-black/10 bg-pale-powder/20 px-4 py-3 text-sm outline-none transition-colors focus:border-guardsman-red"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Caption</span>
                <input
                  value={memberDraft.caption}
                  onChange={(event) => setMemberDraft((current) => ({ ...current, caption: event.target.value }))}
                  className="w-full border border-rich-black/10 bg-pale-powder/20 px-4 py-3 text-sm outline-none transition-colors focus:border-guardsman-red"
                />
              </label>
              <div className="space-y-2 md:col-span-2">
                <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Visual Preview</span>
                <div className="h-44 overflow-hidden border border-rich-black/10 bg-pale-powder/20">
                  {memberDraft.imageDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={memberDraft.imageDataUrl} alt={memberDraft.name || 'Board member preview'} className="h-full w-full object-cover" />
                  ) : (
                    <BoardBookPlaceholder className="h-full w-full" />
                  )}
                </div>
              </div>
              <label className="space-y-2 md:col-span-2">
                <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Image Upload</span>
                <label
                  htmlFor="board-book-image-upload"
                  className="flex h-[50px] cursor-pointer items-center justify-center gap-3 border border-dashed border-rich-black/15 bg-pale-powder/20 px-4 text-[10px] font-header uppercase tracking-[0.3em] transition-colors hover:border-guardsman-red hover:text-guardsman-red"
                >
                  <ImagePlus className="h-4 w-4" />
                  Upload Face Image
                </label>
                <input
                  id="board-book-image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <p className="text-xs text-rich-black/45">
                  If no image is uploaded, the book uses one shared placeholder visual automatically.
                </p>
              </label>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={saveMemberDraft}
                className="inline-flex items-center gap-3 bg-rich-black px-6 py-3 font-header text-[10px] uppercase tracking-[0.35em] text-white transition-colors hover:bg-guardsman-red"
              >
                <Save className="h-4 w-4" />
                Save Card
              </button>
              <button
                type="button"
                onClick={() => removeMember(selectedMemberId)}
                className="inline-flex items-center gap-3 border border-rich-black/10 px-6 py-3 font-header text-[10px] uppercase tracking-[0.35em] transition-colors hover:border-guardsman-red hover:bg-guardsman-red hover:text-white"
              >
                <Trash2 className="h-4 w-4" />
                Remove Card
              </button>
            </div>
          </div>
        </div>

        <div className="border border-rich-black/5 bg-white p-8 shadow-2xl">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-[10px] font-header uppercase tracking-[0.35em] text-rich-black/35">Saved Order</p>
              <h3 className="mt-3 font-header text-2xl uppercase tracking-wide">Book Sequence</h3>
              <p className="mt-3 text-xs text-rich-black/45">
                {draftData.members.length} board {draftData.members.length === 1 ? 'member' : 'members'} currently in the book.
              </p>
            </div>
            <p className="max-w-xs text-right text-xs text-rich-black/45">
              Drag cards to reorder the board. Their issue number updates from position automatically.
            </p>
          </div>

          <div className="mt-8 space-y-4">
            {draftData.members.map((member, index) => {
              const isSelected = member.id === selectedMemberId;
              return (
                <button
                  key={member.id}
                  type="button"
                  draggable
                  onClick={() => selectMember(member.id)}
                  onDragStart={() => setDraggedMemberId(member.id)}
                  onDragEnd={() => setDraggedMemberId('')}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    const nextMembers = reorderBoardMembers(draftData.members, draggedMemberId, member.id);
                    persistMembers(nextMembers, 'Board order updated', member.id);
                    setDraggedMemberId('');
                  }}
                  className={`flex w-full items-center gap-5 border p-4 text-left transition-all ${
                    isSelected
                      ? 'border-guardsman-red bg-guardsman-red/5'
                      : 'border-rich-black/8 bg-white hover:border-rich-black/20'
                  }`}
                >
                  <div className="text-rich-black/25">
                    <GripVertical className="h-5 w-5" />
                  </div>

                  <div className="h-16 w-16 shrink-0 overflow-hidden border border-rich-black/10">
                    {member.imageDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={member.imageDataUrl} alt={member.name} className="h-full w-full object-cover" />
                    ) : (
                      <BoardBookPlaceholder className="h-full w-full" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-header uppercase tracking-[0.35em] text-rich-black/35">
                      Issue {String(index + 1).padStart(2, '0')}
                    </p>
                    <p className="mt-2 truncate font-header text-xl uppercase tracking-wide text-rich-black">
                      {member.name || 'Untitled Member'}
                    </p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.25em] text-rich-black/45">
                      {member.role || 'Role pending'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const LabsTab = ({
  labs,
  onSaveLabs,
}: {
  labs: AdminLab[];
  onSaveLabs: (labs: AdminLab[]) => void;
}) => {
  const [filter, setFilter] = useState<'All' | 'Published' | 'Draft'>('All');
  const [selectedLabId, setSelectedLabId] = useState(labs[0]?.id ?? '');
  const [labDraft, setLabDraft] = useState<AdminLab>(labs[0] ?? createAdminLab());

  const filteredLabs = labs.filter((lab) => filter === 'All' || lab.status === filter);

  const saveLab = () => {
    onSaveLabs(labs.map((lab) => (lab.id === labDraft.id ? labDraft : lab)));
  };

  const addLab = () => {
    const nextLab = createAdminLab();
    onSaveLabs([nextLab, ...labs]);
    setSelectedLabId(nextLab.id);
    setLabDraft(nextLab);
  };

  const removeLab = (labId: string) => {
    const nextLabs = labs.filter((lab) => lab.id !== labId);
    onSaveLabs(nextLabs);
    const fallback = nextLabs[0];
    if (fallback) {
      setSelectedLabId(fallback.id);
      setLabDraft(fallback);
    }
  };

  return (
    <div className="grid gap-10 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="border border-rich-black/5 bg-white p-8 shadow-2xl">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-[10px] font-header uppercase tracking-[0.35em] text-rich-black/35">Lab Controls</p>
            <h2 className="mt-3 font-header text-2xl uppercase tracking-wide">Labs & Projects</h2>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setFilter((current) => current === 'All' ? 'Published' : current === 'Published' ? 'Draft' : 'All')}
              className="border border-rich-black/10 px-4 py-3 font-header text-[10px] uppercase tracking-[0.3em] transition-colors hover:border-guardsman-red hover:bg-guardsman-red hover:text-white"
            >
              {filter}
            </button>
            <button
              type="button"
              onClick={addLab}
              className="inline-flex items-center gap-3 bg-guardsman-red px-6 py-3 font-header text-[10px] uppercase tracking-[0.35em] text-white transition-colors hover:bg-madder"
            >
              <Plus className="h-4 w-4" />
              New Lab
            </button>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          {filteredLabs.map((lab) => (
            <div
              key={lab.id}
              className={`flex items-center justify-between border p-5 transition-all ${
                lab.id === selectedLabId ? 'border-guardsman-red bg-guardsman-red/5' : 'border-rich-black/8'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedLabId(lab.id);
                  setLabDraft(lab);
                }}
                className="flex flex-1 items-center justify-between text-left"
              >
                <div>
                  <p className="text-[10px] font-header uppercase tracking-[0.35em] text-rich-black/35">{lab.date}</p>
                  <p className="mt-2 font-header text-xl uppercase tracking-wide text-rich-black">{lab.title}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.25em] text-rich-black/45">{lab.visibility}</p>
                </div>
                <span className={`border px-3 py-1 text-[10px] font-header uppercase tracking-widest ${
                  lab.status === 'Published' ? 'border-green-500 text-green-600' : 'border-yellow-500 text-yellow-600'
                }`}>
                  {lab.status}
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onSaveLabs(
                    labs.map((entry) =>
                      entry.id === lab.id
                        ? { ...entry, status: entry.status === 'Published' ? 'Draft' : 'Published' }
                        : entry,
                    ),
                  )
                }
                className="ml-5 flex h-10 w-10 items-center justify-center border border-rich-black/10 transition-colors hover:border-guardsman-red hover:bg-guardsman-red hover:text-white"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-rich-black/5 bg-white p-8 shadow-2xl">
        <p className="text-[10px] font-header uppercase tracking-[0.35em] text-rich-black/35">Lab Editor</p>
        <h3 className="mt-3 font-header text-2xl uppercase tracking-wide">Edit Lab</h3>

        <div className="mt-8 space-y-4">
          <label className="block space-y-2">
            <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Title</span>
            <input
              value={labDraft.title}
              onChange={(event) => setLabDraft((current) => ({ ...current, title: event.target.value }))}
              className="w-full border border-rich-black/10 bg-pale-powder/20 px-4 py-3 text-sm outline-none focus:border-guardsman-red"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Date</span>
            <input
              type="date"
              value={labDraft.date}
              onChange={(event) => setLabDraft((current) => ({ ...current, date: event.target.value }))}
              className="w-full border border-rich-black/10 bg-pale-powder/20 px-4 py-3 text-sm outline-none focus:border-guardsman-red"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setLabDraft((current) => ({ ...current, status: current.status === 'Published' ? 'Draft' : 'Published' }))}
              className="border border-rich-black/10 px-4 py-3 text-[10px] font-header uppercase tracking-[0.3em] transition-colors hover:border-guardsman-red hover:bg-guardsman-red hover:text-white"
            >
              Status: {labDraft.status}
            </button>
            <button
              type="button"
              onClick={() => setLabDraft((current) => ({ ...current, visibility: current.visibility === 'Public' ? 'Members Only' : 'Public' }))}
              className="border border-rich-black/10 px-4 py-3 text-[10px] font-header uppercase tracking-[0.3em] transition-colors hover:border-guardsman-red hover:bg-guardsman-red hover:text-white"
            >
              Visibility: {labDraft.visibility}
            </button>
          </div>
          <Link
            href={labDraft.visibility === 'Public' ? `/labs/${labDraft.id}` : '/join'}
            className="inline-flex items-center gap-3 border border-rich-black/10 px-4 py-3 font-header text-[10px] uppercase tracking-[0.3em] transition-colors hover:border-guardsman-red hover:bg-guardsman-red hover:text-white"
          >
            <Eye className="h-4 w-4" />
            Open Public Destination
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={saveLab}
            className="inline-flex items-center gap-3 bg-rich-black px-6 py-3 font-header text-[10px] uppercase tracking-[0.35em] text-white transition-colors hover:bg-guardsman-red"
          >
            <Save className="h-4 w-4" />
            Save Lab
          </button>
          <button
            type="button"
            onClick={() => removeLab(labDraft.id)}
            className="inline-flex items-center gap-3 border border-rich-black/10 px-6 py-3 font-header text-[10px] uppercase tracking-[0.35em] transition-colors hover:border-guardsman-red hover:bg-guardsman-red hover:text-white"
          >
            <Trash2 className="h-4 w-4" />
            Remove Lab
          </button>
        </div>
      </div>
    </div>
  );
};

const EventsTab = ({
  events,
  onSaveEvents,
}: {
  events: AdminEvent[];
  onSaveEvents: (events: AdminEvent[]) => void;
}) => {
  const [filter, setFilter] = useState<'All' | 'Scheduled' | 'Draft' | 'Completed'>('All');
  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id ?? '');
  const [eventDraft, setEventDraft] = useState<AdminEvent>(events[0] ?? createAdminEvent());

  const filteredEvents = events.filter((event) => filter === 'All' || event.status === filter);

  const saveEvent = () => {
    onSaveEvents(events.map((event) => (event.id === eventDraft.id ? eventDraft : event)));
  };

  const addEvent = () => {
    const nextEvent = createAdminEvent();
    onSaveEvents([nextEvent, ...events]);
    setSelectedEventId(nextEvent.id);
    setEventDraft(nextEvent);
  };

  const removeEvent = (eventId: string) => {
    const nextEvents = events.filter((event) => event.id !== eventId);
    onSaveEvents(nextEvents);
    const fallback = nextEvents[0];
    if (fallback) {
      setSelectedEventId(fallback.id);
      setEventDraft(fallback);
    }
  };

  return (
    <div className="grid gap-10 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="border border-rich-black/5 bg-white p-8 shadow-2xl">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-[10px] font-header uppercase tracking-[0.35em] text-rich-black/35">Event Controls</p>
            <h2 className="mt-3 font-header text-2xl uppercase tracking-wide">Events</h2>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setFilter((current) => current === 'All' ? 'Scheduled' : current === 'Scheduled' ? 'Draft' : current === 'Draft' ? 'Completed' : 'All')}
              className="border border-rich-black/10 px-4 py-3 font-header text-[10px] uppercase tracking-[0.3em] transition-colors hover:border-guardsman-red hover:bg-guardsman-red hover:text-white"
            >
              {filter}
            </button>
            <button
              type="button"
              onClick={addEvent}
              className="inline-flex items-center gap-3 bg-guardsman-red px-6 py-3 font-header text-[10px] uppercase tracking-[0.35em] text-white transition-colors hover:bg-madder"
            >
              <Plus className="h-4 w-4" />
              New Event
            </button>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          {filteredEvents.map((event) => (
            <div
              key={event.id}
              className={`flex items-center justify-between border p-5 transition-all ${
                event.id === selectedEventId ? 'border-guardsman-red bg-guardsman-red/5' : 'border-rich-black/8'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedEventId(event.id);
                  setEventDraft(event);
                }}
                className="flex flex-1 items-center justify-between text-left"
              >
                <div>
                  <p className="text-[10px] font-header uppercase tracking-[0.35em] text-rich-black/35">{event.date}</p>
                  <p className="mt-2 font-header text-xl uppercase tracking-wide text-rich-black">{event.title}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.25em] text-rich-black/45">{event.location}</p>
                </div>
                <span className="border px-3 py-1 text-[10px] font-header uppercase tracking-widest text-rich-black/60">
                  {event.status}
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onSaveEvents(
                    events.map((entry) =>
                      entry.id === event.id
                        ? {
                            ...entry,
                            status:
                              entry.status === 'Draft'
                                ? 'Scheduled'
                                : entry.status === 'Scheduled'
                                  ? 'Completed'
                                  : 'Draft',
                          }
                        : entry,
                    ),
                  )
                }
                className="ml-5 flex h-10 w-10 items-center justify-center border border-rich-black/10 transition-colors hover:border-guardsman-red hover:bg-guardsman-red hover:text-white"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-rich-black/5 bg-white p-8 shadow-2xl">
        <p className="text-[10px] font-header uppercase tracking-[0.35em] text-rich-black/35">Event Editor</p>
        <h3 className="mt-3 font-header text-2xl uppercase tracking-wide">Edit Event</h3>

        <div className="mt-8 space-y-4">
          <label className="block space-y-2">
            <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Title</span>
            <input
              value={eventDraft.title}
              onChange={(event) => setEventDraft((current) => ({ ...current, title: event.target.value }))}
              className="w-full border border-rich-black/10 bg-pale-powder/20 px-4 py-3 text-sm outline-none focus:border-guardsman-red"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Date</span>
            <input
              type="date"
              value={eventDraft.date}
              onChange={(event) => setEventDraft((current) => ({ ...current, date: event.target.value }))}
              className="w-full border border-rich-black/10 bg-pale-powder/20 px-4 py-3 text-sm outline-none focus:border-guardsman-red"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Location</span>
            <input
              value={eventDraft.location}
              onChange={(event) => setEventDraft((current) => ({ ...current, location: event.target.value }))}
              className="w-full border border-rich-black/10 bg-pale-powder/20 px-4 py-3 text-sm outline-none focus:border-guardsman-red"
            />
          </label>
          <button
            type="button"
            onClick={() =>
              setEventDraft((current) => ({
                ...current,
                status:
                  current.status === 'Draft' ? 'Scheduled' : current.status === 'Scheduled' ? 'Completed' : 'Draft',
              }))
            }
            className="w-full border border-rich-black/10 px-4 py-3 text-[10px] font-header uppercase tracking-[0.3em] transition-colors hover:border-guardsman-red hover:bg-guardsman-red hover:text-white"
          >
            Status: {eventDraft.status}
          </button>
        </div>

        <div className="mt-8 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={saveEvent}
            className="inline-flex items-center gap-3 bg-rich-black px-6 py-3 font-header text-[10px] uppercase tracking-[0.35em] text-white transition-colors hover:bg-guardsman-red"
          >
            <Save className="h-4 w-4" />
            Save Event
          </button>
          <button
            type="button"
            onClick={() => removeEvent(eventDraft.id)}
            className="inline-flex items-center gap-3 border border-rich-black/10 px-6 py-3 font-header text-[10px] uppercase tracking-[0.35em] transition-colors hover:border-guardsman-red hover:bg-guardsman-red hover:text-white"
          >
            <Trash2 className="h-4 w-4" />
            Remove Event
          </button>
        </div>
      </div>
    </div>
  );
};

const SettingsTab = ({
  data,
  onSaveSettings,
  onSelectTab,
}: {
  data: AdminDashboardData;
  onSaveSettings: (settings: AdminDashboardData['settings']) => void;
  onSelectTab: (tab: string) => void;
}) => {
  const [draft, setDraft] = useState(data.settings);

  return (
    <div className="grid gap-10 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="border border-rich-black/5 bg-white p-8 shadow-2xl">
        <p className="text-[10px] font-header uppercase tracking-[0.35em] text-rich-black/35">Portal Settings</p>
        <h2 className="mt-3 font-header text-2xl uppercase tracking-wide">Chapter Settings</h2>

        <div className="mt-8 space-y-4">
          <label className="block space-y-2">
            <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Chapter Name</span>
            <input
              value={draft.chapterName}
              onChange={(event) => setDraft((current) => ({ ...current, chapterName: event.target.value }))}
              className="w-full border border-rich-black/10 bg-pale-powder/20 px-4 py-3 text-sm outline-none focus:border-guardsman-red"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Admin Name</span>
            <input
              value={draft.adminName}
              onChange={(event) => setDraft((current) => ({ ...current, adminName: event.target.value }))}
              className="w-full border border-rich-black/10 bg-pale-powder/20 px-4 py-3 text-sm outline-none focus:border-guardsman-red"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Admin Role</span>
            <input
              value={draft.adminRole}
              onChange={(event) => setDraft((current) => ({ ...current, adminRole: event.target.value }))}
              className="w-full border border-rich-black/10 bg-pale-powder/20 px-4 py-3 text-sm outline-none focus:border-guardsman-red"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Member Dues Label</span>
            <input
              value={draft.memberDuesLabel}
              onChange={(event) => setDraft((current) => ({ ...current, memberDuesLabel: event.target.value }))}
              className="w-full border border-rich-black/10 bg-pale-powder/20 px-4 py-3 text-sm outline-none focus:border-guardsman-red"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setDraft((current) => ({ ...current, recruitmentOpen: !current.recruitmentOpen }))}
              className="border border-rich-black/10 px-4 py-3 text-[10px] font-header uppercase tracking-[0.3em] transition-colors hover:border-guardsman-red hover:bg-guardsman-red hover:text-white"
            >
              Recruitment: {draft.recruitmentOpen ? 'Open' : 'Closed'}
            </button>
            <button
              type="button"
              onClick={() => setDraft((current) => ({ ...current, allowPublicLabs: !current.allowPublicLabs }))}
              className="border border-rich-black/10 px-4 py-3 text-[10px] font-header uppercase tracking-[0.3em] transition-colors hover:border-guardsman-red hover:bg-guardsman-red hover:text-white"
            >
              Public Labs: {draft.allowPublicLabs ? 'Enabled' : 'Restricted'}
            </button>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={() => onSaveSettings(draft)}
            className="inline-flex items-center gap-3 bg-rich-black px-6 py-3 font-header text-[10px] uppercase tracking-[0.35em] text-white transition-colors hover:bg-guardsman-red"
          >
            <Save className="h-4 w-4" />
            Save Settings
          </button>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <button
          type="button"
          onClick={() => onSelectTab('board')}
          className="border border-rich-black/8 bg-white p-8 text-left shadow-2xl transition-transform hover:-translate-y-1"
        >
          <p className="text-[10px] font-header uppercase tracking-[0.35em] text-rich-black/35">Board Book</p>
          <h3 className="mt-3 font-header text-3xl uppercase tracking-wide text-rich-black">Edit About Book</h3>
          <p className="mt-4 text-sm leading-7 text-rich-black/60">
            Jump straight into cover settings, saved member order, and image uploads for the About book.
          </p>
        </button>
        <Link
          href="/about"
          className="border border-rich-black/8 bg-white p-8 text-left shadow-2xl transition-transform hover:-translate-y-1"
        >
          <p className="text-[10px] font-header uppercase tracking-[0.35em] text-rich-black/35">Preview</p>
          <h3 className="mt-3 font-header text-3xl uppercase tracking-wide text-rich-black">Open About Page</h3>
          <p className="mt-4 text-sm leading-7 text-rich-black/60">
            Check the live book presentation in its public route without leaving the admin context completely.
          </p>
        </Link>
        <Link
          href="/sponsors"
          className="border border-rich-black/8 bg-white p-8 text-left shadow-2xl transition-transform hover:-translate-y-1"
        >
          <p className="text-[10px] font-header uppercase tracking-[0.35em] text-rich-black/35">Sponsors</p>
          <h3 className="mt-3 font-header text-3xl uppercase tracking-wide text-rich-black">Open Sponsors Page</h3>
          <p className="mt-4 text-sm leading-7 text-rich-black/60">
            Review the placeholder sponsor page and keep the partnership side of the site reachable from admin.
          </p>
        </Link>
        <Link
          href="/portal"
          className="border border-rich-black/8 bg-white p-8 text-left shadow-2xl transition-transform hover:-translate-y-1"
        >
          <p className="text-[10px] font-header uppercase tracking-[0.35em] text-rich-black/35">Member Portal</p>
          <h3 className="mt-3 font-header text-3xl uppercase tracking-wide text-rich-black">Open Portal</h3>
          <p className="mt-4 text-sm leading-7 text-rich-black/60">
            Jump to the member-facing portal route from the admin side when you need to compare the experience.
          </p>
        </Link>
      </div>
    </div>
  );
};

export default function DashboardPage() {
  const { data, isReady, setData } = useAdminDashboardData();
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoaded, setIsLoaded] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const isAdmin = true;
    if (!isAdmin) {
      router.push('/login');
    } else {
      setTimeout(() => setIsLoaded(true), 0);
    }
  }, [router]);

  if (!isLoaded || !isReady) {
    return null;
  }

  const titleMap: Record<string, string> = {
    overview: 'Overview',
    members: 'Members',
    board: 'Board Book',
    labs: 'Labs & Projects',
    events: 'Events',
    settings: 'Settings',
  };

  const updateMembers = (members: AdminMember[]) => {
    setData({
      ...data,
      members,
    });
  };

  const updateLabs = (labs: AdminLab[]) => {
    setData({
      ...data,
      labs,
    });
  };

  const updateEvents = (events: AdminEvent[]) => {
    setData({
      ...data,
      events,
    });
  };

  const updateSettings = (settings: AdminDashboardData['settings']) => {
    setData({
      ...data,
      settings,
    });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab data={data} onSelectTab={setActiveTab} />;
      case 'members':
        return <MembersTab members={data.members} onSaveMembers={updateMembers} />;
      case 'board':
        return <BoardBookTab />;
      case 'labs':
        return <LabsTab labs={data.labs} onSaveLabs={updateLabs} />;
      case 'events':
        return <EventsTab events={data.events} onSaveEvents={updateEvents} />;
      case 'settings':
        return <SettingsTab data={data} onSaveSettings={updateSettings} onSelectTab={setActiveTab} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-aesthetic-white selection:bg-guardsman-red selection:text-white">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 overflow-y-auto">
        <Header
          title={titleMap[activeTab] ?? 'Dashboard'}
          adminName={data.settings.adminName}
          adminRole={data.settings.adminRole}
          notifications={data.notifications}
          notificationsOpen={notificationsOpen}
          onToggleNotifications={() => setNotificationsOpen((current) => !current)}
        />
        <div className="mx-auto max-w-7xl p-12">
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
