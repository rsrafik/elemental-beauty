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
  useAdminDashboardData,
} from '@/lib/admin-dashboard';
import { Account, AccountRole, formatPurdueEmail, normalizePurdueUsername, useAccounts } from '@/lib/accounts';
import { BoardBookData, BoardBookMember, defaultBoardBookData, useBoardBookData } from '@/lib/board-book';
import { renderMarkdownToHtml } from '@/lib/markdown';

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

function readTextFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Unable to read markdown file.'));
    reader.readAsText(file);
  });
}

function createAccount(): Account {
  const token = Date.now().toString().slice(-5);
  return {
    id: `acct-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: 'New Member',
    username: `member${token}`,
    role: 'member',
    password: 'boilerup',
    profilePhotoDataUrl: '',
    waiverSigned: false,
    duesPaid: false,
    joinedAt: new Date().toISOString().slice(0, 10),
  };
}

function createAdminLab(): AdminLab {
  return {
    id: `lab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: 'New Lab Draft',
    date: new Date().toISOString().slice(0, 10),
    status: 'Draft',
    visibility: 'Public',
    markdown: '# New Lab Draft\n\nAdd your markdown here.\n',
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

function AccountAvatar({
  name,
  photo,
  sizeClass,
  textClass,
}: {
  name: string;
  photo: string;
  sizeClass: string;
  textClass: string;
}) {
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt={name} className={`${sizeClass} object-cover`} />;
  }

  return (
    <div className={`flex items-center justify-center bg-rich-black text-white ${sizeClass}`}>
      <span className={textClass}>{name[0] ?? '?'}</span>
    </div>
  );
}

function AccountEditor({
  isOpen,
  name,
  username,
  password,
  profilePhotoDataUrl,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  name: string;
  username: string;
  password: string;
  profilePhotoDataUrl: string;
  onClose: () => void;
  onSave: (updates: { name: string; username: string; password: string; profilePhotoDataUrl: string }) => void;
}) {
  const [draftName, setDraftName] = useState(name);
  const [draftUsername, setDraftUsername] = useState(username);
  const [draftPassword, setDraftPassword] = useState(password);
  const [draftPhoto, setDraftPhoto] = useState(profilePhotoDataUrl);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setDraftName(name);
    setDraftUsername(username);
    setDraftPassword(password);
    setDraftPhoto(profilePhotoDataUrl);
  }, [isOpen, name, password, profilePhotoDataUrl, username]);

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setDraftPhoto(await readImageFile(file));
    } finally {
      event.target.value = '';
    }
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-rich-black/45 p-6"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="w-full max-w-xl border border-rich-black/10 bg-white p-8 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-[10px] font-header uppercase tracking-[0.35em] text-rich-black/35">Account</p>
                <h3 className="mt-3 font-header text-2xl uppercase tracking-wide">Edit Profile</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="font-header text-[10px] uppercase tracking-[0.3em] text-rich-black/45 transition-colors hover:text-guardsman-red"
              >
                Close
              </button>
            </div>

            <div className="mt-8 space-y-5">
              <div className="flex items-center gap-5">
                <div className="h-20 w-20 overflow-hidden rounded-full border border-rich-black/10">
                  <AccountAvatar
                    name={draftName}
                    photo={draftPhoto}
                    sizeClass="h-full w-full"
                    textClass="font-header text-2xl uppercase"
                  />
                </div>
                <label
                  htmlFor="dashboard-account-photo"
                  className="inline-flex cursor-pointer items-center gap-3 border border-rich-black/10 px-4 py-3 font-header text-[10px] uppercase tracking-[0.3em] transition-colors hover:border-guardsman-red hover:bg-guardsman-red hover:text-white"
                >
                  Change Photo
                </label>
                <input
                  id="dashboard-account-photo"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>

              <label className="block space-y-2">
                <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Display Name</span>
                <input
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  className="w-full border border-rich-black/10 bg-pale-powder/20 px-4 py-3 text-sm outline-none focus:border-guardsman-red"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Purdue Username</span>
                <div className="flex items-center border border-rich-black/10 bg-pale-powder/20 px-4 py-3">
                  <input
                    value={draftUsername}
                    onChange={(event) => setDraftUsername(normalizePurdueUsername(event.target.value))}
                    className="w-full bg-transparent text-sm outline-none"
                  />
                  <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/30">@purdue.edu</span>
                </div>
              </label>
              <label className="block space-y-2">
                <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Password</span>
                <input
                  value={draftPassword}
                  onChange={(event) => setDraftPassword(event.target.value)}
                  className="w-full border border-rich-black/10 bg-pale-powder/20 px-4 py-3 text-sm outline-none focus:border-guardsman-red"
                />
              </label>
            </div>

            <div className="mt-8 flex gap-4">
              <button
                type="button"
                onClick={() => {
                  onSave({
                    name: draftName.trim() || name,
                    username: draftUsername,
                    password: draftPassword,
                    profilePhotoDataUrl: draftPhoto,
                  });
                  onClose();
                }}
                className="bg-rich-black px-6 py-3 font-header text-[10px] uppercase tracking-[0.35em] text-white transition-colors hover:bg-guardsman-red"
              >
                Save Account
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

const Sidebar = ({
  activeTab,
  setActiveTab,
  availableTabs,
  onOpenAccount,
  onLogout,
}: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  availableTabs: Array<{ id: string; label: string; icon: React.ComponentType<{ className?: string }> }>;
  onOpenAccount: () => void;
  onLogout: () => void;
}) => {

  return (
    <aside className="sticky top-0 flex h-screen w-64 flex-col border-r border-rich-black/5 bg-white p-8">
      <Link href="/" prefetch={false} className="group mb-16 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center bg-guardsman-red transition-transform group-hover:rotate-12">
          <FlaskConical className="h-5 w-5 text-white" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-abril text-[1.55rem] uppercase tracking-tight text-rich-black">
            Elemental
          </span>
          <span className="font-abril text-[1.55rem] uppercase tracking-tight text-guardsman-red">
            Portal
          </span>
        </div>
      </Link>

      <nav className="flex-1 space-y-4">
        {availableTabs.map((item) => (
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

      <button
        type="button"
        onClick={onOpenAccount}
        className="mb-3 flex items-center gap-4 border border-transparent px-4 py-3 font-header text-[10px] uppercase tracking-widest text-rich-black/45 transition-all hover:border-rich-black/10 hover:bg-pale-powder/20 hover:text-rich-black"
      >
        <User className="h-4 w-4" />
        Edit Account
      </button>

      <button
        type="button"
        onClick={onLogout}
        className="mt-auto flex items-center gap-4 border border-transparent px-4 py-3 font-header text-[10px] uppercase tracking-widest text-guardsman-red transition-all hover:border-guardsman-red/10 hover:bg-guardsman-red/5"
      >
        <LogOut className="h-4 w-4" />
        Logout
      </button>
    </aside>
  );
};

const Header = ({
  title,
  accountName,
  accountRole,
  profilePhotoDataUrl,
  notifications,
  notificationsOpen,
  onToggleNotifications,
}: {
  title: string;
  accountName: string;
  accountRole: string;
  profilePhotoDataUrl: string;
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
            <p className="text-[10px] font-header uppercase tracking-widest text-rich-black">{accountName}</p>
            <p className="text-[8px] font-header uppercase tracking-widest text-guardsman-red">{accountRole}</p>
          </div>
          <div className="h-10 w-10 overflow-hidden bg-rich-black shadow-xl">
            <AccountAvatar
              name={accountName}
              photo={profilePhotoDataUrl}
              sizeClass="h-full w-full"
              textClass="font-header text-sm uppercase"
            />
          </div>
        </div>
      </div>
    </header>
  );
};

const OverviewTab = ({
  data,
  accounts,
  canAccessSettings,
  onSelectTab,
}: {
  data: AdminDashboardData;
  accounts: Account[];
  canAccessSettings: boolean;
  onSelectTab: (tab: string) => void;
}) => {
  const stats = [
    { label: 'Total Members', value: String(accounts.length), change: `${accounts.filter((member) => member.duesPaid).length} paid`, icon: Users, color: 'bg-guardsman-red' },
    { label: 'Active Labs', value: String(data.labs.length), change: `${data.labs.filter((lab) => lab.status === 'Published').length} published`, icon: FlaskConical, color: 'bg-rich-black' },
    { label: 'Upcoming Events', value: String(data.events.filter((event) => event.status === 'Scheduled').length), change: 'schedule live', icon: Calendar, color: 'bg-aurora-black' },
    { label: 'Revenue', value: `${accounts.filter((member) => member.duesPaid).length * 25}`, change: data.settings.memberDuesLabel, icon: DollarSign, color: 'bg-madder' },
  ];

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <button
            key={stat.label}
            type="button"
            onClick={() =>
              onSelectTab(
                stat.label === 'Total Members'
                  ? 'members'
                  : stat.label === 'Active Labs'
                    ? 'labs'
                    : stat.label === 'Upcoming Events'
                      ? 'events'
                      : canAccessSettings
                        ? 'settings'
                        : 'overview',
              )
            }
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
            {accounts.slice(0, 3).map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => onSelectTab('members')}
                className="flex w-full items-center justify-between border border-transparent bg-pale-powder/20 p-6 text-left transition-all hover:border-rich-black/10"
              >
                <div className="flex items-center gap-6">
                  <div className="h-10 w-10 overflow-hidden bg-rich-black">
                    <AccountAvatar
                      name={member.name}
                      photo={member.profilePhotoDataUrl}
                      sizeClass="h-full w-full"
                      textClass="font-header text-xs uppercase"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-header uppercase tracking-widest text-rich-black">{member.name}</p>
                    <p className="text-[10px] font-sans text-rich-black/40">{formatPurdueEmail(member.username)}</p>
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
  currentRole,
  onUpdateMember,
  onAddMember,
  onRemoveMember,
}: {
  members: Account[];
  currentRole: AccountRole;
  onUpdateMember: (accountId: string, updates: Partial<Account>) => void;
  onAddMember: (account: Account) => void;
  onRemoveMember: (accountId: string) => void;
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Unpaid'>('All');
  const [roleFilter, setRoleFilter] = useState<'All' | 'Officer'>('All');
  const visibleMembers = currentRole === 'admin' ? members : members.filter((member) => member.role !== 'admin');
  const [selectedMemberId, setSelectedMemberId] = useState(visibleMembers[0]?.id ?? '');
  const [memberDraft, setMemberDraft] = useState<Account>(visibleMembers[0] ?? createAccount());
  const canManageMembers = currentRole === 'admin';
  const selectedMember = visibleMembers.find((member) => member.id === selectedMemberId) ?? visibleMembers[0] ?? null;
  const isAdminAccount = selectedMember?.role === 'admin';
  const duesRequired = memberDraft.role === 'user' || memberDraft.role === 'admin';

  useEffect(() => {
    const selectedMember = visibleMembers.find((member) => member.id === selectedMemberId) ?? visibleMembers[0];
    if (!selectedMember) {
      return;
    }

    setSelectedMemberId(selectedMember.id);
    setMemberDraft(selectedMember);
  }, [selectedMemberId, visibleMembers]);

  const filteredMembers = useMemo(() => {
    return visibleMembers.filter((member) => {
      const matchesSearch =
        member.name.toLowerCase().includes(search.toLowerCase()) ||
        formatPurdueEmail(member.username).toLowerCase().includes(search.toLowerCase()) ||
        member.role.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'All' || (statusFilter === 'Paid' ? member.duesPaid : !member.duesPaid);
      const matchesRole = roleFilter === 'All' || member.role === 'officer';
      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [roleFilter, search, statusFilter, visibleMembers]);

  const saveMember = () => {
    const nextDraft: Partial<Account> = { ...memberDraft };

    if (currentRole !== 'admin') {
      if (selectedMember?.role === 'admin') {
        nextDraft.role = 'admin';
      } else if (nextDraft.role === 'admin') {
        nextDraft.role = selectedMember?.role === 'officer' ? 'officer' : 'member';
      }
    }

    onUpdateMember(memberDraft.id, nextDraft);
  };

  const addMember = () => {
    if (!canManageMembers) {
      return;
    }

    const nextMember = createAccount();
    onAddMember(nextMember);
    setSelectedMemberId(nextMember.id);
    setMemberDraft(nextMember);
  };

  const removeMember = (memberId: string) => {
    if (!canManageMembers) {
      return;
    }

    const nextMembers = visibleMembers.filter((member) => member.id !== memberId);
    onRemoveMember(memberId);
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
              onClick={() =>
                setStatusFilter((current) => (current === 'All' ? 'Paid' : current === 'Paid' ? 'Unpaid' : 'All'))
              }
              className="bg-pale-powder/30 p-3 transition-all hover:bg-rich-black hover:text-white"
            >
              <Filter className="h-5 w-5" />
            </button>
            {canManageMembers ? (
              <button
                type="button"
                onClick={() => setRoleFilter((current) => (current === 'All' ? 'Officer' : 'All'))}
                className="border border-rich-black/10 px-4 py-3 font-header text-[10px] uppercase tracking-[0.3em] transition-colors hover:border-guardsman-red hover:bg-guardsman-red hover:text-white"
              >
                {roleFilter === 'All' ? 'Officer Filter Off' : 'Officer Filter On'}
              </button>
            ) : null}
          </div>
          {canManageMembers ? (
            <button
              type="button"
              onClick={addMember}
              className="flex w-full items-center justify-center gap-3 bg-guardsman-red px-10 py-3 font-header text-[10px] uppercase tracking-widest text-white shadow-xl transition-all hover:bg-madder sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Add Member
            </button>
          ) : null}
        </div>

        <div className="border-b border-rich-black/5 px-10 py-4 text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">
          Current filter: {statusFilter}{canManageMembers ? ` / ${roleFilter}` : ''}
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
                        <AccountAvatar
                          name={member.name}
                          photo={member.profilePhotoDataUrl}
                          sizeClass="h-full w-full"
                          textClass="font-header text-xs uppercase"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-header uppercase tracking-widest text-rich-black">{member.name}</p>
                        <p className="text-[10px] font-sans text-rich-black/40">{formatPurdueEmail(member.username)}</p>
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
                      {member.duesPaid ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-guardsman-red" />
                      )}
                      <span className="text-[10px] font-header uppercase tracking-widest">
                        {member.duesPaid ? 'Paid' : 'Unpaid'}
                      </span>
                    </div>
                  </td>
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-3">
                      <FileText className={`h-4 w-4 ${member.waiverSigned ? 'text-guardsman-red' : 'text-rich-black/20'}`} />
                      <span className="text-[10px] font-header uppercase tracking-widest">
                        {member.waiverSigned ? 'Signed' : 'Pending'}
                      </span>
                    </div>
                  </td>
                  <td className="px-10 py-6 text-[10px] font-header uppercase tracking-widest text-rich-black/40">
                    {member.joinedAt}
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
            <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Purdue Username</span>
            <div className="flex items-center border border-rich-black/10 bg-pale-powder/20 px-4 py-3">
              <input
                value={memberDraft.username}
                onChange={(event) =>
                  setMemberDraft((current) => ({ ...current, username: normalizePurdueUsername(event.target.value) }))
                }
                className="w-full bg-transparent text-sm outline-none"
              />
              <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/30">@purdue.edu</span>
            </div>
          </label>
          <label className="block space-y-2">
            <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Role</span>
            <select
              value={memberDraft.role}
              onChange={(event) =>
                setMemberDraft((current) => ({ ...current, role: event.target.value as AccountRole }))
              }
              disabled={currentRole !== 'admin' && isAdminAccount}
              className="w-full border border-rich-black/10 bg-pale-powder/20 px-4 py-3 text-sm outline-none focus:border-guardsman-red disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="user">User</option>
              <option value="member">Member</option>
              <option value="officer">Officer</option>
              {currentRole === 'admin' ? <option value="admin">Admin</option> : null}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Password</span>
            <input
              value={memberDraft.password}
              onChange={(event) => setMemberDraft((current) => ({ ...current, password: event.target.value }))}
              className="w-full border border-rich-black/10 bg-pale-powder/20 px-4 py-3 text-sm outline-none focus:border-guardsman-red"
            />
          </label>
          <div className="space-y-2">
            <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Profile Photo</span>
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 overflow-hidden rounded-full border border-rich-black/10">
                <AccountAvatar
                  name={memberDraft.name}
                  photo={memberDraft.profilePhotoDataUrl}
                  sizeClass="h-full w-full"
                  textClass="font-header text-base uppercase"
                />
              </div>
              <label
                htmlFor="dashboard-member-photo"
                className="inline-flex cursor-pointer items-center gap-3 border border-rich-black/10 px-4 py-3 font-header text-[10px] uppercase tracking-[0.3em] transition-colors hover:border-guardsman-red hover:bg-guardsman-red hover:text-white"
              >
                <ImagePlus className="h-4 w-4" />
                Change Photo
              </label>
              <input
                id="dashboard-member-photo"
                type="file"
                accept="image/*"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) {
                    return;
                  }

                  try {
                    const profilePhotoDataUrl = await readImageFile(file);
                    setMemberDraft((current) => ({ ...current, profilePhotoDataUrl }));
                  } finally {
                    event.target.value = '';
                  }
                }}
                className="hidden"
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              disabled={!duesRequired}
              onClick={() => setMemberDraft((current) => ({ ...current, duesPaid: !current.duesPaid }))}
              className="border border-rich-black/10 px-4 py-3 text-[10px] font-header uppercase tracking-[0.3em] transition-colors hover:border-guardsman-red hover:bg-guardsman-red hover:text-white disabled:cursor-not-allowed disabled:border-rich-black/10 disabled:bg-pale-powder/30 disabled:text-rich-black/35"
            >
              Dues: {duesRequired ? (memberDraft.duesPaid ? 'Paid' : 'Unpaid') : 'Not Required'}
            </button>
            <button
              type="button"
              onClick={() => setMemberDraft((current) => ({ ...current, waiverSigned: !current.waiverSigned }))}
              className="border border-rich-black/10 px-4 py-3 text-[10px] font-header uppercase tracking-[0.3em] transition-colors hover:border-guardsman-red hover:bg-guardsman-red hover:text-white"
            >
              Waiver: {memberDraft.waiverSigned ? 'Signed' : 'Pending'}
            </button>
          </div>
          <label className="block space-y-2">
            <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Join Date</span>
            <input
              type="date"
              value={memberDraft.joinedAt}
              onChange={(event) => setMemberDraft((current) => ({ ...current, joinedAt: event.target.value }))}
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
          {canManageMembers ? (
            <button
              type="button"
              onClick={() => removeMember(memberDraft.id)}
              className="inline-flex items-center gap-3 border border-rich-black/10 px-6 py-3 font-header text-[10px] uppercase tracking-[0.35em] transition-colors hover:border-guardsman-red hover:bg-guardsman-red hover:text-white"
            >
              <Trash2 className="h-4 w-4" />
              Remove Member
            </button>
          ) : null}
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
  const markdownPreview = useMemo(() => renderMarkdownToHtml(labDraft.markdown), [labDraft.markdown]);

  const saveLab = () => {
    onSaveLabs(labs.map((lab) => (lab.id === labDraft.id ? labDraft : lab)));
  };

  const handleMarkdownUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const markdown = await readTextFile(file);
      setLabDraft((current) => ({
        ...current,
        markdown,
      }));
    } finally {
      event.target.value = '';
    }
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
          <div className="space-y-2">
            <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Markdown Source</span>
            <textarea
              value={labDraft.markdown}
              onChange={(event) => setLabDraft((current) => ({ ...current, markdown: event.target.value }))}
              rows={12}
              className="w-full resize-y border border-rich-black/10 bg-pale-powder/20 px-4 py-3 font-mono text-sm outline-none focus:border-guardsman-red"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <label
              htmlFor="lab-markdown-upload"
              className="inline-flex cursor-pointer items-center gap-3 border border-rich-black/10 px-4 py-3 font-header text-[10px] uppercase tracking-[0.3em] transition-colors hover:border-guardsman-red hover:bg-guardsman-red hover:text-white"
            >
              <FileText className="h-4 w-4" />
              Upload Markdown
            </label>
            <input
              id="lab-markdown-upload"
              type="file"
              accept=".md,.markdown,text/markdown,text/plain"
              onChange={handleMarkdownUpload}
              className="hidden"
            />
          </div>
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
          <div className="space-y-2">
            <span className="text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/35">Markdown Preview</span>
            <div className="prose prose-sm max-w-none border border-rich-black/10 bg-white p-5 text-rich-black/75 prose-headings:font-header prose-headings:uppercase prose-headings:tracking-wide prose-a:text-guardsman-red prose-blockquote:border-l-2 prose-blockquote:border-guardsman-red prose-blockquote:pl-4 prose-code:rounded prose-code:bg-rich-black/5 prose-code:px-1 prose-code:py-0.5 prose-li:my-1">
              <div dangerouslySetInnerHTML={{ __html: markdownPreview }} />
            </div>
          </div>
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
  const { currentAccount, data: accountData, updateAccount, addAccount, removeAccount, signOut } = useAccounts();
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoaded, setIsLoaded] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [isAccountEditorOpen, setIsAccountEditorOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (!currentAccount) {
      router.push('/login');
      return;
    }

    if (currentAccount.role !== 'officer' && currentAccount.role !== 'admin') {
      router.push('/portal');
      return;
    }

    setTimeout(() => setIsLoaded(true), 0);
  }, [currentAccount, isReady, router]);

  const availableTabs = useMemo(() => {
    if (!currentAccount) {
      return [];
    }

    const baseTabs = [
      { id: 'overview', label: 'Overview', icon: Users },
      { id: 'members', label: 'Members', icon: User },
      { id: 'labs', label: 'Labs & Projects', icon: FlaskConical },
      { id: 'events', label: 'Events', icon: Calendar },
    ];

    if (currentAccount.role === 'admin') {
      return [
        ...baseTabs.slice(0, 2),
        { id: 'board', label: 'Board Book', icon: FileText },
        ...baseTabs.slice(2),
        { id: 'settings', label: 'Settings', icon: Settings },
      ];
    }

    return baseTabs;
  }, [currentAccount]);

  const resolvedTab = availableTabs.some((tab) => tab.id === activeTab) ? activeTab : 'overview';

  if (!isLoaded || !isReady || !currentAccount) {
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
    switch (resolvedTab) {
      case 'overview':
        return (
          <OverviewTab
            data={data}
            accounts={accountData.accounts}
            canAccessSettings={currentAccount.role === 'admin'}
            onSelectTab={setActiveTab}
          />
        );
      case 'members':
        return (
          <MembersTab
            members={accountData.accounts}
            currentRole={currentAccount.role}
            onUpdateMember={updateAccount}
            onAddMember={addAccount}
            onRemoveMember={removeAccount}
          />
        );
      case 'board':
        if (currentAccount.role !== 'admin') {
          return (
            <OverviewTab
              data={data}
              accounts={accountData.accounts}
              canAccessSettings={false}
              onSelectTab={setActiveTab}
            />
          );
        }
        return <BoardBookTab />;
      case 'labs':
        return <LabsTab labs={data.labs} onSaveLabs={updateLabs} />;
      case 'events':
        return <EventsTab events={data.events} onSaveEvents={updateEvents} />;
      case 'settings':
        if (currentAccount.role !== 'admin') {
          return (
            <OverviewTab
              data={data}
              accounts={accountData.accounts}
              canAccessSettings={false}
              onSelectTab={setActiveTab}
            />
          );
        }
        return <SettingsTab data={data} onSaveSettings={updateSettings} onSelectTab={setActiveTab} />;
      default:
        return (
          <OverviewTab
            data={data}
            accounts={accountData.accounts}
            canAccessSettings={currentAccount.role === 'admin'}
            onSelectTab={setActiveTab}
          />
        );
    }
  };

  const handleLogout = () => {
    signOut();
    router.push('/login');
  };

  return (
    <div className="flex min-h-screen bg-aesthetic-white selection:bg-guardsman-red selection:text-white">
      <Sidebar
        activeTab={resolvedTab}
        setActiveTab={setActiveTab}
        availableTabs={availableTabs}
        onOpenAccount={() => setIsAccountEditorOpen(true)}
        onLogout={handleLogout}
      />

      <main className="flex-1 overflow-y-auto">
        <Header
          title={titleMap[resolvedTab] ?? 'Dashboard'}
          accountName={currentAccount.name}
          accountRole={currentAccount.role}
          profilePhotoDataUrl={currentAccount.profilePhotoDataUrl}
          notifications={data.notifications}
          notificationsOpen={notificationsOpen}
          onToggleNotifications={() => setNotificationsOpen((current) => !current)}
        />
        <div className="mx-auto max-w-7xl p-12">
          <motion.div
            key={resolvedTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {renderContent()}
          </motion.div>
        </div>
      </main>

      <AccountEditor
        isOpen={isAccountEditorOpen}
        name={currentAccount.name}
        username={currentAccount.username}
        password={currentAccount.password}
        profilePhotoDataUrl={currentAccount.profilePhotoDataUrl}
        onClose={() => setIsAccountEditorOpen(false)}
        onSave={(updates) => updateAccount(currentAccount.id, updates)}
      />
    </div>
  );
}
