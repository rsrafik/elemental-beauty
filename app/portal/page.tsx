'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Award,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileCheck,
  FlaskConical,
  LogOut,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatPurdueEmail, normalizePurdueUsername, useAccounts } from '@/lib/accounts';
import { useAdminDashboardData } from '@/lib/admin-dashboard';

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

function readImageFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Unable to read image file.'));
    reader.readAsDataURL(file);
  });
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
                  htmlFor="portal-account-photo"
                  className="inline-flex cursor-pointer items-center gap-3 border border-rich-black/10 px-4 py-3 font-header text-[10px] uppercase tracking-[0.3em] transition-colors hover:border-guardsman-red hover:bg-guardsman-red hover:text-white"
                >
                  Change Photo
                </label>
                <input
                  id="portal-account-photo"
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
      <Link href="/" className="mb-16 flex items-center gap-3 group">
        <div className="flex h-8 w-8 items-center justify-center bg-rich-black transition-transform group-hover:rotate-12">
          <FlaskConical className="h-5 w-5 text-white" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-abril text-[1.55rem] uppercase tracking-tight text-rich-black">Elemental</span>
          <span className="font-abril text-[1.55rem] uppercase tracking-tight text-guardsman-red">Portal</span>
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
}: {
  title: string;
  accountName: string;
  accountRole: string;
  profilePhotoDataUrl: string;
}) => {
  return (
    <header className="sticky top-0 z-10 flex h-20 items-center justify-between border-b border-rich-black/5 bg-white px-10">
      <h1 className="font-header text-xl uppercase tracking-widest text-rich-black">{title}</h1>

      <div className="flex items-center gap-8">
        <button className="relative flex h-10 w-10 items-center justify-center bg-pale-powder/30 transition-colors hover:bg-guardsman-red hover:text-white">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 border-2 border-white bg-guardsman-red" />
        </button>

        <div className="flex items-center gap-4 border-l border-rich-black/10 pl-8">
          <div className="hidden text-right sm:block">
            <p className="text-[10px] font-header uppercase tracking-widest text-rich-black">{accountName}</p>
            <p className="text-[8px] font-header uppercase tracking-widest text-rich-black/40">{accountRole}</p>
          </div>
          <div className="h-10 w-10 overflow-hidden rounded-full border border-rich-black/10 shadow-xl">
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

function DashboardTab({ name }: { name: string }) {
  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <div className="relative overflow-hidden bg-rich-black p-10 text-white shadow-2xl md:col-span-2">
          <div className="absolute right-[-8rem] top-[-8rem] h-64 w-64 bg-guardsman-red/10 blur-[80px]" />
          <div className="relative z-10">
            <h2 className="mb-4 font-header text-4xl uppercase tracking-tight">Welcome Back, {name}</h2>
            <p className="mb-8 max-w-md font-sans leading-relaxed text-white/60">
              Your member portal keeps the current labs, events, and chapter progress in one place.
            </p>
            <Link
              href="/labs"
              className="inline-flex items-center gap-3 bg-guardsman-red px-8 py-3 font-header text-[10px] uppercase tracking-widest text-white transition-all hover:bg-madder"
            >
              Explore Labs
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="flex flex-col justify-between border border-rich-black/5 bg-white p-10 shadow-xl">
          <div>
            <h3 className="mb-6 text-xs font-header uppercase tracking-widest text-rich-black/40">Member Status</h3>
            <div className="mb-4 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center bg-green-50">
                <FileCheck className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="font-header text-sm uppercase tracking-widest">Active Access</p>
                <p className="text-[10px] text-rich-black/40">Current member features unlocked</p>
              </div>
            </div>
          </div>
          <Link
            href="/about"
            className="w-full border border-rich-black/10 py-3 text-center font-header text-[10px] uppercase tracking-widest transition-all hover:bg-rich-black hover:text-white"
          >
            Meet The Board
          </Link>
        </div>
      </div>
    </div>
  );
}

function LabsTab({
  labs,
  role,
}: {
  labs: ReturnType<typeof useAdminDashboardData>['data']['labs'];
  role: 'user' | 'member' | 'officer' | 'admin';
}) {
  const visibleLabs = role === 'officer' || role === 'admin' ? labs : labs.filter((lab) => lab.status === 'Published');

  return (
    <div className="border border-rich-black/5 bg-white p-10 shadow-2xl">
      <h3 className="mb-8 font-header text-lg uppercase tracking-widest">My Labs</h3>
      <div className="space-y-6">
        {visibleLabs.map((lab) => (
          <div key={lab.id} className="flex items-center justify-between border border-transparent bg-pale-powder/20 p-6 transition-all hover:border-rich-black/10">
            <div className="flex items-center gap-6">
              <div className="flex h-12 w-12 items-center justify-center bg-guardsman-red/10">
                <FlaskConical className="h-6 w-6 text-guardsman-red" />
              </div>
              <div>
                <p className="text-xs font-header uppercase tracking-widest text-rich-black">{lab.title}</p>
                <p className="text-[10px] font-header uppercase tracking-widest text-rich-black/40">
                  {lab.status} • {lab.visibility}
                </p>
              </div>
            </div>
            <Link href={lab.visibility === 'Public' ? `/labs/${lab.id}` : '/join'} className="text-guardsman-red transition-colors hover:text-rich-black">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

function EventsTab({
  events,
  role,
}: {
  events: ReturnType<typeof useAdminDashboardData>['data']['events'];
  role: 'user' | 'member' | 'officer' | 'admin';
}) {
  const visibleEvents =
    role === 'officer' || role === 'admin' ? events : events.filter((event) => event.status !== 'Draft');

  return (
    <div className="border border-rich-black/5 bg-white p-10 shadow-2xl">
      <h3 className="mb-8 font-header text-lg uppercase tracking-widest">Upcoming Events</h3>
      <div className="space-y-6">
        {visibleEvents.map((event) => (
          <div key={event.id} className="flex items-center justify-between border border-transparent bg-pale-powder/20 p-6 transition-all hover:border-rich-black/10">
            <div className="flex items-center gap-6">
              <div className="flex h-14 w-14 flex-col items-center justify-center bg-rich-black text-white">
                <span className="text-[8px] font-header uppercase tracking-widest opacity-60">
                  {new Date(event.date).toLocaleString('en-US', { month: 'short' })}
                </span>
                <span className="text-lg font-header">{new Date(event.date).getDate()}</span>
              </div>
              <div>
                <p className="text-xs font-header uppercase tracking-widest text-rich-black">{event.title}</p>
                <p className="text-[10px] text-rich-black/40">{event.location}</p>
              </div>
            </div>
            <span className="text-[10px] font-header uppercase tracking-widest text-guardsman-red">{event.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResourcesTab() {
  const links = [
    { label: 'Public Lab Archive', href: '/labs' },
    { label: 'About The Board', href: '/about' },
    { label: 'Sponsorship Page', href: '/sponsors' },
  ];

  return (
    <div className="grid gap-8 md:grid-cols-3">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="border border-rich-black/8 bg-white p-8 shadow-xl transition-transform hover:-translate-y-1"
        >
          <p className="text-[10px] font-header uppercase tracking-[0.35em] text-rich-black/35">Resource</p>
          <h3 className="mt-4 font-header text-2xl uppercase tracking-wide text-rich-black">{link.label}</h3>
        </Link>
      ))}
    </div>
  );
}

function MembershipTab({
  role,
  waiverSigned,
  duesPaid,
  onToggleWaiver,
  onToggleDues,
}: {
  role: string;
  waiverSigned: boolean;
  duesPaid: boolean;
  onToggleWaiver: () => void;
  onToggleDues: () => void;
}) {
  const isProspective = role === 'user';
  const duesRequired = role === 'user' || role === 'admin';

  return (
    <div className="grid gap-10 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="border border-rich-black/5 bg-white p-10 shadow-2xl">
        <p className="text-[10px] font-header uppercase tracking-[0.35em] text-rich-black/35">Membership</p>
        <h2 className="mt-3 font-header text-3xl uppercase tracking-wide text-rich-black">
          {isProspective ? 'Complete access requirements' : 'Membership complete'}
        </h2>
        <p className="mt-6 max-w-2xl text-base leading-8 text-rich-black/60">
          {isProspective
            ? 'Prospective users must sign the waiver and pay dues before full member access is unlocked.'
            : duesRequired
              ? 'Your account has completed membership requirements and has full member access.'
              : 'Your current role does not require dues. Only the waiver needs to stay on file for active chapter access.'}
        </p>

        <div className={`mt-10 grid gap-6 ${duesRequired ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
          <div className="border border-rich-black/10 bg-pale-powder/20 p-8">
            <ShieldCheck className="h-8 w-8 text-guardsman-red" />
            <h3 className="mt-6 font-header text-xl uppercase tracking-wide">Waiver</h3>
            <p className="mt-3 text-sm leading-7 text-rich-black/60">
              Safety acknowledgement and lab participation waiver.
            </p>
            <button
              type="button"
              onClick={onToggleWaiver}
              className={`mt-8 inline-flex items-center gap-3 px-5 py-3 font-header text-[10px] uppercase tracking-[0.3em] transition-colors ${
                waiverSigned
                  ? 'bg-green-50 text-green-700'
                  : 'bg-rich-black text-white hover:bg-guardsman-red'
              }`}
            >
              {waiverSigned ? 'Waiver Signed' : 'Sign Waiver'}
            </button>
          </div>
          {duesRequired ? (
            <div className="border border-rich-black/10 bg-pale-powder/20 p-8">
              <CreditCard className="h-8 w-8 text-guardsman-red" />
              <h3 className="mt-6 font-header text-xl uppercase tracking-wide">Dues</h3>
              <p className="mt-3 text-sm leading-7 text-rich-black/60">
                Semester dues payment required for active membership status.
              </p>
              <button
                type="button"
                onClick={onToggleDues}
                className={`mt-8 inline-flex items-center gap-3 px-5 py-3 font-header text-[10px] uppercase tracking-[0.3em] transition-colors ${
                  duesPaid
                    ? 'bg-green-50 text-green-700'
                    : 'bg-rich-black text-white hover:bg-guardsman-red'
                }`}
              >
                {duesPaid ? 'Dues Paid' : 'Pay Dues'}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="border border-rich-black/5 bg-white p-10 shadow-2xl">
        <h3 className="font-header text-xl uppercase tracking-wide text-rich-black">Completion</h3>
        <div className="mt-8 space-y-5">
          <div className="flex items-center justify-between border border-rich-black/10 p-5">
            <span className="text-[11px] font-header uppercase tracking-[0.3em] text-rich-black/45">Waiver Signed</span>
            {waiverSigned ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Sparkles className="h-5 w-5 text-rich-black/25" />}
          </div>
          <div className="flex items-center justify-between border border-rich-black/10 p-5">
            <span className="text-[11px] font-header uppercase tracking-[0.3em] text-rich-black/45">
              {duesRequired ? 'Dues Paid' : 'Dues Requirement'}
            </span>
            {duesRequired ? (
              duesPaid ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Sparkles className="h-5 w-5 text-rich-black/25" />
            ) : (
              <span className="font-header text-[10px] uppercase tracking-[0.3em] text-green-700">Not Required</span>
            )}
          </div>
          <div className="flex items-center justify-between border border-rich-black/10 p-5">
            <span className="text-[11px] font-header uppercase tracking-[0.3em] text-rich-black/45">Account Role</span>
            <span className="font-header text-sm uppercase tracking-[0.3em] text-guardsman-red">{role}</span>
          </div>
        </div>

        {isProspective && waiverSigned && duesPaid ? (
          <p className="mt-8 font-header text-[10px] uppercase tracking-[0.35em] text-green-700">
            Requirements complete. Your account is now upgraded to member access.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function PortalPage() {
  const { currentAccount, isReady, updateAccount, signOut } = useAccounts();
  const { data: adminData } = useAdminDashboardData();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoaded, setIsLoaded] = useState(false);
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

    setTimeout(() => setIsLoaded(true), 0);
  }, [currentAccount, isReady, router]);

  const availableTabs = useMemo(() => {
    if (!currentAccount) {
      return [];
    }

    if (currentAccount.role === 'user') {
      return [{ id: 'membership', label: 'Membership', icon: Award }];
    }

    return [
      { id: 'dashboard', label: 'Dashboard', icon: User },
      { id: 'labs', label: 'My Labs', icon: FlaskConical },
      { id: 'events', label: 'Events', icon: Calendar },
      { id: 'resources', label: 'Resources', icon: BookOpen },
      { id: 'membership', label: 'Membership', icon: Award },
    ];
  }, [currentAccount]);

  const resolvedTab =
    currentAccount?.role === 'user'
      ? 'membership'
      : availableTabs.some((tab) => tab.id === activeTab)
        ? activeTab
        : 'dashboard';

  if (!isLoaded || !currentAccount) {
    return null;
  }

  const handleLogout = () => {
    signOut();
    router.push('/login');
  };

  const handleMembershipUpdate = (updates: { waiverSigned?: boolean; duesPaid?: boolean }) => {
    updateAccount(currentAccount.id, updates);
  };

  const titleMap: Record<string, string> = {
    dashboard: 'Dashboard',
    labs: 'My Labs',
    events: 'Events',
    resources: 'Resources',
    membership: 'Membership',
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
          title={titleMap[resolvedTab] ?? 'Portal'}
          accountName={currentAccount.name}
          accountRole={currentAccount.role}
          profilePhotoDataUrl={currentAccount.profilePhotoDataUrl}
        />
        <div className="mx-auto max-w-7xl p-12">
          <motion.div
            key={resolvedTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {resolvedTab === 'dashboard' ? <DashboardTab name={currentAccount.name} /> : null}
            {resolvedTab === 'labs' ? <LabsTab labs={adminData.labs} role={currentAccount.role} /> : null}
            {resolvedTab === 'events' ? <EventsTab events={adminData.events} role={currentAccount.role} /> : null}
            {resolvedTab === 'resources' ? <ResourcesTab /> : null}
            {resolvedTab === 'membership' ? (
              <MembershipTab
                role={currentAccount.role}
                waiverSigned={currentAccount.waiverSigned}
                duesPaid={currentAccount.duesPaid}
                onToggleWaiver={() => handleMembershipUpdate({ waiverSigned: !currentAccount.waiverSigned })}
                onToggleDues={() => handleMembershipUpdate({ duesPaid: !currentAccount.duesPaid })}
              />
            ) : null}
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
