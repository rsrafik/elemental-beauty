'use client';

import { useSyncExternalStore } from 'react';

export const BOARD_BOOK_STORAGE_KEY = 'elemental-beauty-board-book';
const BOARD_BOOK_SYNC_EVENT = 'elemental-beauty-board-book-sync';
let cachedBoardBookRaw: string | null | undefined;
let cachedBoardBookSnapshot: BoardBookData;

export type BoardBookMember = {
  id: string;
  name: string;
  role: string;
  kicker: string;
  quote: string;
  bio: string;
  caption: string;
  accent: string;
  instagram: string;
  imageDataUrl: string;
};

export type BoardBookCover = {
  editionLabel: string;
  volumeNumber: string;
  issueNumber: string;
};

export type BoardBookData = {
  cover: BoardBookCover;
  members: BoardBookMember[];
};

export const defaultBoardBookData: BoardBookData = {
  cover: {
    editionLabel: '2026 edition',
    volumeNumber: '01',
    issueNumber: '01',
  },
  members: [
    {
      id: 'catherine-chang',
      name: 'Catherine Chang',
      role: 'President',
      kicker: 'Chemistry Major',
      quote: 'Sets the pace for the chapter and keeps the vision sharp.',
      bio: 'Catherine leads Elemental Beauty with a focus on clear direction, polished programming, and a chapter identity that feels authored instead of improvised.',
      caption: 'Leadership, programming, and chapter direction.',
      accent: 'from-[#250000] via-[#8f0e18] to-[#d34040]',
      instagram: 'https://www.instagram.com/ting._0425/',
      imageDataUrl: '',
    },
    {
      id: 'azu-nakao',
      name: 'Azu Nakao',
      role: 'Vice-President',
      kicker: 'Marketing Major',
      quote: 'Turns ideas into calendars, meetings, and work that actually lands.',
      bio: 'Azu keeps operations moving across the board, handling coordination and follow-through so the chapter can execute consistently instead of relying on last-minute momentum.',
      caption: 'Operations, continuity, and execution.',
      accent: 'from-[#120d16] via-[#5f1d32] to-[#c47157]',
      instagram: 'https://www.instagram.com/azuazu301/',
      imageDataUrl: '',
    },
    {
      id: 'rachel-rafik',
      name: 'Rachel Rafik',
      role: 'Software Developer',
      kicker: 'Computer Science Major',
      quote: 'Builds the chapter online with the same care as the work happening in person.',
      bio: 'Rachel develops the site and digital identity for Elemental Beauty, shaping the public-facing experience so the chapter reads as deliberate, modern, and distinct.',
      caption: 'Web, design system, and digital presence.',
      accent: 'from-[#09131b] via-[#103447] to-[#c50000]',
      instagram: 'https://www.instagram.com/shaymarafi/',
      imageDataUrl: '',
    },
    {
      id: 'anjali-muthyala',
      name: 'Anjali Muthyala',
      role: 'Treasurer',
      kicker: 'Business Major',
      quote: 'Keeps the chapter stable by treating the numbers like infrastructure.',
      bio: 'Anjali manages dues, budgets, and purchasing with discipline, making sure the chapter can support labs, materials, and growth without losing control of the details.',
      caption: 'Budgeting, dues, and sustainable growth.',
      accent: 'from-[#16110f] via-[#5a2d17] to-[#b6551f]',
      instagram: 'https://www.instagram.com/anjali_571/',
      imageDataUrl: '',
    },
  ],
};

function sanitizeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function sanitizeMember(member: unknown, fallback: BoardBookMember, index: number): BoardBookMember {
  if (!member || typeof member !== 'object') {
    return { ...fallback, id: `${fallback.id}-${index}` };
  }

  const record = member as Partial<BoardBookMember>;

  return {
    id: sanitizeString(record.id, `${fallback.id}-${index}`),
    name: sanitizeString(record.name, fallback.name),
    role: sanitizeString(record.role, fallback.role),
    kicker: sanitizeString(record.kicker, fallback.kicker),
    quote: sanitizeString(record.quote, fallback.quote),
    bio: sanitizeString(record.bio, fallback.bio),
    caption: sanitizeString(record.caption, fallback.caption),
    accent: sanitizeString(record.accent, fallback.accent),
    instagram: sanitizeString(record.instagram, fallback.instagram),
    imageDataUrl: sanitizeString(record.imageDataUrl, ''),
  };
}

export function sanitizeBoardBookData(value: unknown): BoardBookData {
  if (!value || typeof value !== 'object') {
    return defaultBoardBookData;
  }

  const record = value as Partial<BoardBookData>;
  const cover = record.cover && typeof record.cover === 'object' ? record.cover : {};
  const membersInput =
    Array.isArray(record.members) && record.members.length > 0
      ? record.members
      : defaultBoardBookData.members;

  return {
    cover: {
      editionLabel: sanitizeString(
        (cover as Partial<BoardBookCover>).editionLabel,
        defaultBoardBookData.cover.editionLabel,
      ),
      volumeNumber: sanitizeString(
        (cover as Partial<BoardBookCover>).volumeNumber,
        defaultBoardBookData.cover.volumeNumber,
      ),
      issueNumber: sanitizeString(
        (cover as Partial<BoardBookCover>).issueNumber,
        defaultBoardBookData.cover.issueNumber,
      ),
    },
    members: membersInput.map((member, index) =>
      sanitizeMember(
        member,
        defaultBoardBookData.members[index] ?? {
          id: `member-${index + 1}`,
          name: '',
          role: '',
          kicker: '',
          quote: '',
          bio: '',
          caption: '',
          accent: 'from-[#140b0d] via-[#7a1523] to-[#d34040]',
          instagram: '',
          imageDataUrl: '',
        },
        index,
      ),
    ),
  };
}

export function readBoardBookData(): BoardBookData {
  if (typeof window === 'undefined') {
    return defaultBoardBookData;
  }

  const stored = window.localStorage.getItem(BOARD_BOOK_STORAGE_KEY);
  if (stored === cachedBoardBookRaw && cachedBoardBookSnapshot) {
    return cachedBoardBookSnapshot;
  }

  if (!stored) {
    cachedBoardBookRaw = stored;
    cachedBoardBookSnapshot = defaultBoardBookData;
    return cachedBoardBookSnapshot;
  }

  try {
    cachedBoardBookRaw = stored;
    cachedBoardBookSnapshot = sanitizeBoardBookData(JSON.parse(stored));
    return cachedBoardBookSnapshot;
  } catch {
    cachedBoardBookRaw = stored;
    cachedBoardBookSnapshot = defaultBoardBookData;
    return cachedBoardBookSnapshot;
  }
}

export function writeBoardBookData(data: BoardBookData) {
  if (typeof window === 'undefined') {
    return;
  }

  const sanitized = sanitizeBoardBookData(data);
  const serialized = JSON.stringify(sanitized);
  cachedBoardBookRaw = serialized;
  cachedBoardBookSnapshot = sanitized;
  window.localStorage.setItem(BOARD_BOOK_STORAGE_KEY, serialized);
  window.dispatchEvent(new Event(BOARD_BOOK_SYNC_EVENT));
}

function subscribeToBoardBookData(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === BOARD_BOOK_STORAGE_KEY) {
      callback();
    }
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(BOARD_BOOK_SYNC_EVENT, callback);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(BOARD_BOOK_SYNC_EVENT, callback);
  };
}

export function useBoardBookData() {
  const data = useSyncExternalStore(
    subscribeToBoardBookData,
    readBoardBookData,
    () => defaultBoardBookData,
  );

  const updateData = (nextData: BoardBookData) => {
    const sanitized = sanitizeBoardBookData(nextData);
    writeBoardBookData(sanitized);
  };

  return { data, isReady: true, setData: updateData };
}
