'use client';

import { useSyncExternalStore } from 'react';

export type AccountRole = 'user' | 'member' | 'officer' | 'admin';

export type Account = {
  id: string;
  name: string;
  username: string;
  role: AccountRole;
  password: string;
  profilePhotoDataUrl: string;
  waiverSigned: boolean;
  duesPaid: boolean;
  joinedAt: string;
};

type AccountStoreData = {
  currentAccountId: string | null;
  accounts: Account[];
};

export const ACCOUNT_STORAGE_KEY = 'elemental-beauty-accounts';
const ACCOUNT_SYNC_EVENT = 'elemental-beauty-accounts-sync';

let cachedAccountsRaw: string | null | undefined;
let cachedAccountsSnapshot: AccountStoreData;

export const defaultAccountStoreData: AccountStoreData = {
  currentAccountId: null,
  accounts: [
    {
      id: 'acct-user',
      name: 'Prospective Elementist',
      username: 'newuser',
      role: 'user',
      password: 'boilerup',
      profilePhotoDataUrl: '',
      waiverSigned: false,
      duesPaid: false,
      joinedAt: '2026-03-01',
    },
    {
      id: 'acct-member',
      name: 'Alex Elementist',
      username: 'alex',
      role: 'member',
      password: 'boilerup',
      profilePhotoDataUrl: '',
      waiverSigned: true,
      duesPaid: true,
      joinedAt: '2025-09-01',
    },
    {
      id: 'acct-officer',
      name: 'Azu Nakao',
      username: 'azu',
      role: 'officer',
      password: 'boilerup',
      profilePhotoDataUrl: '',
      waiverSigned: true,
      duesPaid: true,
      joinedAt: '2025-08-15',
    },
    {
      id: 'acct-admin',
      name: 'Rachel Rafik',
      username: 'rrafik',
      role: 'admin',
      password: 'boilerup',
      profilePhotoDataUrl: '',
      waiverSigned: true,
      duesPaid: true,
      joinedAt: '2025-08-01',
    },
  ],
};

function sanitizeString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function sanitizeBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function sanitizeRole(value: unknown, fallback: AccountRole): AccountRole {
  if (value === 'user' || value === 'member' || value === 'officer' || value === 'admin') {
    return value;
  }

  return fallback;
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase().replace(/@purdue\.edu$/i, '').replace(/\s+/g, '');
}

function sanitizeAccount(value: unknown, fallback: Account, index: number): Account {
  if (!value || typeof value !== 'object') {
    return { ...fallback, id: `${fallback.id}-${index}` };
  }

  const record = value as Partial<Account>;
  const waiverSigned = sanitizeBoolean(record.waiverSigned, fallback.waiverSigned);
  const duesPaid = sanitizeBoolean(record.duesPaid, fallback.duesPaid);
  const role = sanitizeRole(record.role, fallback.role);
  const username = normalizeUsername(sanitizeString(record.username, fallback.username)) || fallback.username;

  return {
    id: sanitizeString(record.id, `${fallback.id}-${index}`),
    name: sanitizeString(record.name, fallback.name),
    username,
    role: role === 'user' && waiverSigned && duesPaid ? 'member' : role,
    password: sanitizeString(record.password, fallback.password),
    profilePhotoDataUrl: sanitizeString(record.profilePhotoDataUrl, ''),
    waiverSigned,
    duesPaid,
    joinedAt: sanitizeString(record.joinedAt, fallback.joinedAt),
  };
}

function sanitizeAccountStoreData(value: unknown): AccountStoreData {
  if (!value || typeof value !== 'object') {
    return defaultAccountStoreData;
  }

  const record = value as Partial<AccountStoreData>;
  const accountsInput =
    Array.isArray(record.accounts) && record.accounts.length > 0
      ? record.accounts
      : defaultAccountStoreData.accounts;

  const accounts = accountsInput.map((account, index) =>
    sanitizeAccount(account, defaultAccountStoreData.accounts[index] ?? defaultAccountStoreData.accounts[0], index),
  );

  const currentAccountId = sanitizeString(record.currentAccountId, '');
  const resolvedCurrentAccountId = accounts.some((account) => account.id === currentAccountId)
    ? currentAccountId
    : null;

  return {
    currentAccountId: resolvedCurrentAccountId,
    accounts,
  };
}

function readAccountStoreData(): AccountStoreData {
  if (typeof window === 'undefined') {
    return defaultAccountStoreData;
  }

  const stored = window.localStorage.getItem(ACCOUNT_STORAGE_KEY);
  if (stored === cachedAccountsRaw && cachedAccountsSnapshot) {
    return cachedAccountsSnapshot;
  }

  if (!stored) {
    cachedAccountsRaw = stored;
    cachedAccountsSnapshot = defaultAccountStoreData;
    return cachedAccountsSnapshot;
  }

  try {
    cachedAccountsRaw = stored;
    cachedAccountsSnapshot = sanitizeAccountStoreData(JSON.parse(stored));
    return cachedAccountsSnapshot;
  } catch {
    cachedAccountsRaw = stored;
    cachedAccountsSnapshot = defaultAccountStoreData;
    return cachedAccountsSnapshot;
  }
}

function writeAccountStoreData(data: AccountStoreData) {
  if (typeof window === 'undefined') {
    return;
  }

  const sanitized = sanitizeAccountStoreData(data);
  const serialized = JSON.stringify(sanitized);
  cachedAccountsRaw = serialized;
  cachedAccountsSnapshot = sanitized;
  window.localStorage.setItem(ACCOUNT_STORAGE_KEY, serialized);
  window.dispatchEvent(new Event(ACCOUNT_SYNC_EVENT));
}

function subscribeToAccounts(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === ACCOUNT_STORAGE_KEY) {
      callback();
    }
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(ACCOUNT_SYNC_EVENT, callback);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(ACCOUNT_SYNC_EVENT, callback);
  };
}

export function useAccounts() {
  const data = useSyncExternalStore(subscribeToAccounts, readAccountStoreData, () => defaultAccountStoreData);

  const setData = (nextData: AccountStoreData) => {
    writeAccountStoreData(nextData);
  };

  const currentAccount = data.accounts.find((account) => account.id === data.currentAccountId) ?? null;

  const updateAccount = (accountId: string, updates: Partial<Account>) => {
    setData({
      ...data,
      accounts: data.accounts.map((account) => {
        if (account.id !== accountId) {
          return account;
        }

        const nextAccount = sanitizeAccount(
          {
            ...account,
            ...updates,
          },
          account,
          0,
        );

        return nextAccount.role === 'user' && nextAccount.waiverSigned && nextAccount.duesPaid
          ? { ...nextAccount, role: 'member' }
          : nextAccount;
      }),
    });
  };

  const addAccount = (account: Account) => {
    setData({
      ...data,
      accounts: [...data.accounts, sanitizeAccount(account, account, data.accounts.length)],
    });
  };

  const removeAccount = (accountId: string) => {
    const nextAccounts = data.accounts.filter((account) => account.id !== accountId);
    const nextCurrentId = data.currentAccountId === accountId ? null : data.currentAccountId;
    setData({
      currentAccountId: nextCurrentId,
      accounts: nextAccounts,
    });
  };

  const signIn = (username: string, password: string) => {
    const normalized = normalizeUsername(username);
    const matched = data.accounts.find(
      (account) => account.username === normalized && account.password === password,
    );

    if (!matched) {
      return null;
    }

    setData({
      ...data,
      currentAccountId: matched.id,
    });

    return matched;
  };

  const signOut = () => {
    setData({
      ...data,
      currentAccountId: null,
    });
  };

  return {
    data,
    currentAccount,
    isReady: true,
    setData,
    updateAccount,
    addAccount,
    removeAccount,
    signIn,
    signOut,
  };
}

export function formatPurdueEmail(username: string) {
  return `${normalizeUsername(username)}@purdue.edu`;
}

export function normalizePurdueUsername(username: string) {
  return normalizeUsername(username);
}
