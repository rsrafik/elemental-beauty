'use client';

import { useSyncExternalStore } from 'react';

export const ADMIN_DASHBOARD_STORAGE_KEY = 'elemental-beauty-admin-dashboard';
const ADMIN_DASHBOARD_SYNC_EVENT = 'elemental-beauty-admin-dashboard-sync';

let cachedAdminDashboardRaw: string | null | undefined;
let cachedAdminDashboardSnapshot: AdminDashboardData;

export type AdminMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  dues: 'Paid' | 'Unpaid';
  waiver: 'Signed' | 'Pending';
  joinDate: string;
};

export type AdminLab = {
  id: string;
  title: string;
  date: string;
  status: 'Published' | 'Draft';
  visibility: 'Public' | 'Members Only';
  markdown: string;
};

export type AdminEvent = {
  id: string;
  title: string;
  date: string;
  location: string;
  status: 'Scheduled' | 'Draft' | 'Completed';
};

export type AdminSettings = {
  chapterName: string;
  adminName: string;
  adminRole: string;
  memberDuesLabel: string;
  recruitmentOpen: boolean;
  allowPublicLabs: boolean;
};

export type AdminNotification = {
  id: string;
  message: string;
  timeLabel: string;
};

export type AdminDashboardData = {
  members: AdminMember[];
  labs: AdminLab[];
  events: AdminEvent[];
  settings: AdminSettings;
  notifications: AdminNotification[];
};

export const defaultAdminDashboardData: AdminDashboardData = {
  members: [
    { id: '1', name: 'Alice Johnson', email: 'alice@example.com', role: 'Member', dues: 'Paid', waiver: 'Signed', joinDate: '2024-01-15' },
    { id: '2', name: 'Bob Smith', email: 'bob@example.com', role: 'Officer', dues: 'Paid', waiver: 'Signed', joinDate: '2023-09-10' },
    { id: '3', name: 'Charlie Brown', email: 'charlie@example.com', role: 'Member', dues: 'Unpaid', waiver: 'Pending', joinDate: '2024-02-01' },
    { id: '4', name: 'Diana Prince', email: 'diana@example.com', role: 'Member', dues: 'Paid', waiver: 'Signed', joinDate: '2024-01-20' },
    { id: '5', name: 'Ethan Hunt', email: 'ethan@example.com', role: 'Member', dues: 'Unpaid', waiver: 'Signed', joinDate: '2024-02-10' },
  ],
  labs: [
    {
      id: '1',
      title: 'Vitamin C Serum',
      date: '2024-02-15',
      status: 'Published',
      visibility: 'Public',
      markdown: '# Vitamin C Serum\n\nA stable, high-potency serum study focused on oxidation control and texture.\n\n## Focus Areas\n- Stability testing\n- Texture refinement\n- Antioxidant support',
    },
    {
      id: '2',
      title: 'Hydrating Mist',
      date: '2024-01-28',
      status: 'Published',
      visibility: 'Members Only',
      markdown: '# Hydrating Mist\n\nA lightweight mist lab centered on hydration delivery and clean finish.\n\n## Focus Areas\n- Humectant balance\n- Botanical ratios\n- Packaging behavior',
    },
    {
      id: '3',
      title: 'Mineral Sunscreen',
      date: '2023-12-12',
      status: 'Draft',
      visibility: 'Public',
      markdown: '# Mineral Sunscreen\n\nAdvanced mineral sunscreen draft centered on dispersion and finish behavior.\n\n## Focus Areas\n- Dispersion\n- Cast reduction\n- Finish optimization',
    },
  ],
  events: [
    { id: '1', title: 'Formulation Lab Night', date: '2026-03-08', location: 'Chemistry Building 210', status: 'Scheduled' },
    { id: '2', title: 'Ingredient Spotlight Workshop', date: '2026-03-15', location: 'Student Union Studio', status: 'Draft' },
    { id: '3', title: 'Spring Recruitment Table', date: '2026-02-20', location: 'Campus Green', status: 'Completed' },
  ],
  settings: {
    chapterName: 'Elemental Beauty',
    adminName: 'Officer Jane',
    adminRole: 'Administrator',
    memberDuesLabel: '$25 / semester',
    recruitmentOpen: true,
    allowPublicLabs: true,
  },
  notifications: [
    { id: 'n1', message: 'Board book controls are ready for updates.', timeLabel: 'Just now' },
    { id: 'n2', message: 'Two members still have unpaid dues.', timeLabel: 'Today' },
    { id: 'n3', message: 'Next lab publish review is due this week.', timeLabel: 'This week' },
  ],
};

function sanitizeString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function sanitizeBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function sanitizeMember(value: unknown, fallback: AdminMember, index: number): AdminMember {
  if (!value || typeof value !== 'object') {
    return { ...fallback, id: `${fallback.id}-${index}` };
  }

  const record = value as Partial<AdminMember>;

  return {
    id: sanitizeString(record.id, `${fallback.id}-${index}`),
    name: sanitizeString(record.name, fallback.name),
    email: sanitizeString(record.email, fallback.email),
    role: sanitizeString(record.role, fallback.role),
    dues: record.dues === 'Unpaid' ? 'Unpaid' : 'Paid',
    waiver: record.waiver === 'Pending' ? 'Pending' : 'Signed',
    joinDate: sanitizeString(record.joinDate, fallback.joinDate),
  };
}

function sanitizeLab(value: unknown, fallback: AdminLab, index: number): AdminLab {
  if (!value || typeof value !== 'object') {
    return { ...fallback, id: `${fallback.id}-${index}` };
  }

  const record = value as Partial<AdminLab>;

  return {
    id: sanitizeString(record.id, `${fallback.id}-${index}`),
    title: sanitizeString(record.title, fallback.title),
    date: sanitizeString(record.date, fallback.date),
    status: record.status === 'Draft' ? 'Draft' : 'Published',
    visibility: record.visibility === 'Members Only' ? 'Members Only' : 'Public',
    markdown: sanitizeString(record.markdown, fallback.markdown),
  };
}

function sanitizeEvent(value: unknown, fallback: AdminEvent, index: number): AdminEvent {
  if (!value || typeof value !== 'object') {
    return { ...fallback, id: `${fallback.id}-${index}` };
  }

  const record = value as Partial<AdminEvent>;

  return {
    id: sanitizeString(record.id, `${fallback.id}-${index}`),
    title: sanitizeString(record.title, fallback.title),
    date: sanitizeString(record.date, fallback.date),
    location: sanitizeString(record.location, fallback.location),
    status:
      record.status === 'Draft' || record.status === 'Completed' ? record.status : 'Scheduled',
  };
}

function sanitizeNotification(value: unknown, fallback: AdminNotification, index: number): AdminNotification {
  if (!value || typeof value !== 'object') {
    return { ...fallback, id: `${fallback.id}-${index}` };
  }

  const record = value as Partial<AdminNotification>;

  return {
    id: sanitizeString(record.id, `${fallback.id}-${index}`),
    message: sanitizeString(record.message, fallback.message),
    timeLabel: sanitizeString(record.timeLabel, fallback.timeLabel),
  };
}

export function sanitizeAdminDashboardData(value: unknown): AdminDashboardData {
  if (!value || typeof value !== 'object') {
    return defaultAdminDashboardData;
  }

  const record = value as Partial<AdminDashboardData>;
  const settings = record.settings && typeof record.settings === 'object' ? record.settings : {};

  return {
    members: (Array.isArray(record.members) ? record.members : defaultAdminDashboardData.members).map((member, index) =>
      sanitizeMember(member, defaultAdminDashboardData.members[index] ?? defaultAdminDashboardData.members[0], index),
    ),
    labs: (Array.isArray(record.labs) ? record.labs : defaultAdminDashboardData.labs).map((lab, index) =>
      sanitizeLab(lab, defaultAdminDashboardData.labs[index] ?? defaultAdminDashboardData.labs[0], index),
    ),
    events: (Array.isArray(record.events) ? record.events : defaultAdminDashboardData.events).map((event, index) =>
      sanitizeEvent(event, defaultAdminDashboardData.events[index] ?? defaultAdminDashboardData.events[0], index),
    ),
    settings: {
      chapterName: sanitizeString(
        (settings as Partial<AdminSettings>).chapterName,
        defaultAdminDashboardData.settings.chapterName,
      ),
      adminName: sanitizeString(
        (settings as Partial<AdminSettings>).adminName,
        defaultAdminDashboardData.settings.adminName,
      ),
      adminRole: sanitizeString(
        (settings as Partial<AdminSettings>).adminRole,
        defaultAdminDashboardData.settings.adminRole,
      ),
      memberDuesLabel: sanitizeString(
        (settings as Partial<AdminSettings>).memberDuesLabel,
        defaultAdminDashboardData.settings.memberDuesLabel,
      ),
      recruitmentOpen: sanitizeBoolean(
        (settings as Partial<AdminSettings>).recruitmentOpen,
        defaultAdminDashboardData.settings.recruitmentOpen,
      ),
      allowPublicLabs: sanitizeBoolean(
        (settings as Partial<AdminSettings>).allowPublicLabs,
        defaultAdminDashboardData.settings.allowPublicLabs,
      ),
    },
    notifications: (
      Array.isArray(record.notifications) ? record.notifications : defaultAdminDashboardData.notifications
    ).map((notification, index) =>
      sanitizeNotification(
        notification,
        defaultAdminDashboardData.notifications[index] ?? defaultAdminDashboardData.notifications[0],
        index,
      ),
    ),
  };
}

export function readAdminDashboardData(): AdminDashboardData {
  if (typeof window === 'undefined') {
    return defaultAdminDashboardData;
  }

  const stored = window.localStorage.getItem(ADMIN_DASHBOARD_STORAGE_KEY);
  if (stored === cachedAdminDashboardRaw && cachedAdminDashboardSnapshot) {
    return cachedAdminDashboardSnapshot;
  }

  if (!stored) {
    cachedAdminDashboardRaw = stored;
    cachedAdminDashboardSnapshot = defaultAdminDashboardData;
    return cachedAdminDashboardSnapshot;
  }

  try {
    cachedAdminDashboardRaw = stored;
    cachedAdminDashboardSnapshot = sanitizeAdminDashboardData(JSON.parse(stored));
    return cachedAdminDashboardSnapshot;
  } catch {
    cachedAdminDashboardRaw = stored;
    cachedAdminDashboardSnapshot = defaultAdminDashboardData;
    return cachedAdminDashboardSnapshot;
  }
}

export function writeAdminDashboardData(data: AdminDashboardData) {
  if (typeof window === 'undefined') {
    return;
  }

  const sanitized = sanitizeAdminDashboardData(data);
  const serialized = JSON.stringify(sanitized);
  cachedAdminDashboardRaw = serialized;
  cachedAdminDashboardSnapshot = sanitized;
  window.localStorage.setItem(ADMIN_DASHBOARD_STORAGE_KEY, serialized);
  window.dispatchEvent(new Event(ADMIN_DASHBOARD_SYNC_EVENT));
}

function subscribeToAdminDashboardData(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === ADMIN_DASHBOARD_STORAGE_KEY) {
      callback();
    }
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(ADMIN_DASHBOARD_SYNC_EVENT, callback);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(ADMIN_DASHBOARD_SYNC_EVENT, callback);
  };
}

export function useAdminDashboardData() {
  const data = useSyncExternalStore(
    subscribeToAdminDashboardData,
    readAdminDashboardData,
    () => defaultAdminDashboardData,
  );

  const setData = (nextData: AdminDashboardData) => {
    writeAdminDashboardData(nextData);
  };

  return { data, isReady: true, setData };
}
