'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Instagram,
  Menu,
  Search,
  Sparkles,
  X,
} from 'lucide-react';

const members = [
  {
    name: 'Catherine Chang',
    role: 'President',
    kicker: 'Chemistry Major',
    quote: 'Sets the pace for the chapter and keeps the vision sharp.',
    bio: 'Catherine leads Elemental Beauty with a focus on clear direction, polished programming, and a chapter identity that feels authored instead of improvised.',
    caption: 'Leadership, programming, and chapter direction.',
    stamp: 'Issue 01',
    accent: 'from-[#250000] via-[#8f0e18] to-[#d34040]',
    instagram: 'https://www.instagram.com/ting._0425/',
  },
  {
    name: 'Azu Nakao',
    role: 'Vice-President',
    kicker: 'Marketing Major',
    quote: 'Turns ideas into calendars, meetings, and work that actually lands.',
    bio: 'Azu keeps operations moving across the board, handling coordination and follow-through so the chapter can execute consistently instead of relying on last-minute momentum.',
    caption: 'Operations, continuity, and execution.',
    stamp: 'Issue 02',
    accent: 'from-[#120d16] via-[#5f1d32] to-[#c47157]',
    instagram: 'https://www.instagram.com/azuazu301/',
  },
  {
    name: 'Rachel Rafik',
    role: 'Software Developer',
    kicker: 'Computer Science Major',
    quote: 'Builds the chapter online with the same care as the work happening in person.',
    bio: 'Rachel develops the site and digital identity for Elemental Beauty, shaping the public-facing experience so the chapter reads as deliberate, modern, and distinct.',
    caption: 'Web, design system, and digital presence.',
    stamp: 'Issue 03',
    accent: 'from-[#09131b] via-[#103447] to-[#c50000]',
    instagram: 'https://www.instagram.com/shaymarafi/',
  },
  {
    name: 'Anjali Muthyala',
    role: 'Treasurer',
    kicker: 'Business Major',
    quote: 'Keeps the chapter stable by treating the numbers like infrastructure.',
    bio: 'Anjali manages dues, budgets, and purchasing with discipline, making sure the chapter can support labs, materials, and growth without losing control of the details.',
    caption: 'Budgeting, dues, and sustainable growth.',
    stamp: 'Issue 04',
    accent: 'from-[#16110f] via-[#5a2d17] to-[#b6551f]',
    instagram: 'https://www.instagram.com/anjali_571/',
  },
] as const;

const menuItems = [
  { id: '01', label: 'HOME', href: '/' },
  { id: '02', label: 'LABS', href: '/labs' },
  { id: '03', label: 'ABOUT', href: '/about' },
  { id: '04', label: 'JOIN', href: '/join' },
  { id: '05', label: 'PORTAL', href: '/portal' },
];

function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = isMenuOpen ? 'hidden' : originalOverflow;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isMenuOpen]);

  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-[320] border-b border-rich-black/5 bg-aesthetic-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <button
              type="button"
              onClick={() => setIsMenuOpen(true)}
              className="p-2 transition-colors hover:text-guardsman-red"
              aria-label="Open site menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <Search className="hidden h-5 w-5 md:block" />
          </div>

          <div className="absolute left-1/2 -translate-x-1/2">
            <Link href="/" className="font-abril text-2xl uppercase tracking-tight text-rich-black md:text-3xl">
              Elemental <span className="text-guardsman-red">Beauty</span>
            </Link>
          </div>

          <div className="flex items-center gap-8">
            <Link
              href="/portal"
              className="hidden font-header text-sm uppercase tracking-widest transition-colors hover:text-guardsman-red md:block"
            >
              Portal
            </Link>
            <Link
              href="/join"
              className="bg-rich-black px-6 py-2 font-header text-xs uppercase tracking-widest text-aesthetic-white transition-colors hover:bg-guardsman-red"
            >
              Join Us
            </Link>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {isMenuOpen ? (
          <motion.div
            initial={{ y: '-100%' }}
            animate={{ y: 0 }}
            exit={{ y: '-100%' }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[340] flex flex-col bg-rich-black text-aesthetic-white"
          >
            <div className="flex items-center justify-between p-8">
              <div className="font-abril text-2xl tracking-tight">E—B</div>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-2 font-header text-xs uppercase tracking-widest transition-colors hover:text-guardsman-red"
              >
                Close <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-1 flex-col justify-center px-8 md:px-24">
              <div className="space-y-4 md:space-y-0">
                {menuItems.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.24 + idx * 0.08 }}
                    className="group flex items-baseline gap-8 border-b border-white/10 py-6 md:py-10"
                  >
                    <span className="font-mono text-xs text-white/40">{item.id}</span>
                    <Link
                      href={item.href}
                      onClick={() => setIsMenuOpen(false)}
                      className="font-header text-5xl tracking-tight transition-colors hover:text-guardsman-red md:text-8xl"
                    >
                      {item.label}
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function SplitHeadline({ text, className }: { text: string; className?: string }) {
  return (
    <h2 className={className}>
      {text.split(' ').map((word, index) => (
        <span key={`${word}-${index}`} className="block">
          {word}
        </span>
      ))}
    </h2>
  );
}

type TurningSheet = {
  direction: 'forward' | 'backward';
  index: number;
};

type BookPosition = 'front' | 'open' | 'back';

type FrontCoverProps = {
  onSelectMember: (index: number) => void;
};

function FrontCoverPage({ onSelectMember }: FrontCoverProps) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-aesthetic-white p-6 md:p-10">
      <div className="absolute inset-0 overflow-hidden">
        <Image
          src="/images/magazine-background.avif"
          alt=""
          fill
          priority
          className="object-cover grayscale contrast-125 brightness-75"
        />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18),rgba(0,0,0,0.28))]" />

      <div className="relative flex flex-1 items-center">
        <div className="max-w-[62%]">
          <p className="font-imperial text-4xl text-rich-black md:text-6xl">
            2026 edition
          </p>
          <h1 className="mt-5 max-w-[6.5ch] font-abril text-6xl uppercase leading-[0.82] tracking-tight text-[#e01212] drop-shadow-[0_3px_18px_rgba(0,0,0,0.45)] md:text-[7.4rem]">
            The Board Book
          </h1>
        </div>
      </div>

      <div className="relative flex items-center justify-between border-t border-white/30 pt-4 font-mono text-[10px] uppercase tracking-[0.35em] text-white/90">
        <span>Volume 01</span>
        <span>Issue 01</span>
      </div>
    </div>
  );
}

type BackCoverProps = {
};

function BackCoverPage({}: BackCoverProps) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-aesthetic-white p-8 text-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(197,0,0,0.12),transparent_42%)]" />
      <div className="relative mx-auto flex w-full max-w-[36rem] flex-col items-center text-center">
        <p className="font-imperial text-4xl text-guardsman-red md:text-5xl">Back cover</p>
        <h2 className="mt-4 max-w-[10ch] text-center font-abril text-4xl uppercase leading-none text-rich-black md:text-5xl">
          The chapter continues.
        </h2>
        <Link
          href="/join"
          className="mt-10 inline-flex items-center justify-center gap-3 border border-rich-black/20 bg-aesthetic-white/92 px-8 py-3 text-center font-header text-xs uppercase tracking-[0.3em] text-rich-black transition-colors hover:border-guardsman-red hover:bg-guardsman-red hover:text-aesthetic-white"
        >
          Join The Collective
        </Link>
      </div>
    </div>
  );
}

type SpreadPageProps = {
  member: (typeof members)[number];
  index: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  previousLabel: string;
  nextLabel: string;
};

function ImageProfilePage({
  member,
  index,
  total,
  onPrevious,
  previousLabel,
}: Omit<SpreadPageProps, 'onNext' | 'nextLabel'>) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden border border-r-0 border-rich-black/10 bg-aesthetic-white">
      <div className={`absolute inset-0 bg-gradient-to-br ${member.accent}`} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_30%)]" />
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="absolute inset-x-[10%] top-[10%] h-[78%] border border-white/14" />
      <div className="absolute left-[16%] top-[18%] h-[22%] w-[18%] border border-white/16 bg-white/6" />
      <div className="absolute left-[40%] top-[18%] h-[22%] w-[22%] border border-white/12 bg-black/10" />
      <div className="absolute left-[16%] top-[46%] h-[28%] w-[46%] border border-white/16 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.02))]" />
      <div className="absolute right-[14%] top-[18%] h-[56%] w-[18%] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.22),rgba(0,0,0,0.08))]" />
      <div className="absolute right-[18%] top-[24%] h-[12%] w-[10%] rounded-full border border-white/16" />
      <div className="absolute left-[18%] top-[50%] h-[20%] w-[42%] bg-[linear-gradient(135deg,transparent_0%,transparent_46%,rgba(255,255,255,0.2)_46%,rgba(255,255,255,0.2)_50%,transparent_50%)] opacity-75" />

      <div className="relative flex h-full flex-col p-6 md:p-8">
        <div className="mt-auto flex items-end justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-white/60">
            Page {String(index * 2 + 3).padStart(2, '0')} / {String(total * 2 + 1).padStart(2, '0')}
          </div>
        </div>
      </div>
    </div>
  );
}

function TextProfilePage({
  member,
  index,
  total,
  onNext,
  nextLabel,
}: Omit<SpreadPageProps, 'onPrevious' | 'previousLabel'>) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden border border-rich-black/10 bg-aesthetic-white">
      <div className="flex h-full flex-col p-6 md:p-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-rich-black/40">{member.stamp}</p>
            <p className="mt-2 font-header text-sm uppercase tracking-[0.3em] text-guardsman-red">{member.kicker}</p>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-rich-black/35">Elementist</div>
        </div>

        <div className="mt-10 flex-1">
          <SplitHeadline
            text={member.name}
            className="font-abril text-4xl uppercase leading-[0.84] tracking-tight text-rich-black md:text-6xl"
          />
          <div className="mt-6 h-px w-full bg-rich-black/15" />
          <p className="mt-6 font-header text-xl italic leading-8 text-rich-black/80 md:text-2xl">{member.quote}</p>
          <p className="mt-6 max-w-md text-sm leading-7 text-rich-black/68 md:text-base">{member.bio}</p>
        </div>

        <div className="mt-8 flex items-end justify-between border-t border-rich-black/10 pt-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-rich-black/35">Position</p>
            <p className="mt-1 font-header text-base uppercase">{member.role}</p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.35em] text-rich-black/35">
              Page {String(index * 2 + 2).padStart(2, '0')} / {String(total * 2 + 1).padStart(2, '0')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={member.instagram}
              target="_blank"
              rel="noreferrer"
              aria-label={`${member.name} Instagram`}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-rich-black/15 text-rich-black/55 transition-all hover:border-guardsman-red hover:bg-guardsman-red hover:text-aesthetic-white"
            >
              <Instagram className="h-4 w-4" />
            </a>
            <Sparkles className="h-4 w-4 text-rich-black/40" />
          </div>
        </div>
      </div>
    </div>
  );
}

type PageSheetProps = {
  index: number;
  totalSheets: number;
  isFlipped: boolean;
  isTurning: boolean;
  canFlipForward: boolean;
  canFlipBackward: boolean;
  front: React.ReactNode;
  back: React.ReactNode;
  onForward: () => void;
  onBackward: () => void;
  onTurnComplete: () => void;
};

function PageSheet({
  index,
  totalSheets,
  isFlipped,
  isTurning,
  canFlipForward,
  canFlipBackward,
  front,
  back,
  onForward,
  onBackward,
  onTurnComplete,
}: PageSheetProps) {
  return (
    <motion.div
      initial={false}
      animate={{
        rotateY: isFlipped ? -180 : 0,
        zIndex: isTurning ? totalSheets + 20 : isFlipped ? totalSheets + index : totalSheets - index,
      }}
      transition={{ duration: 1.05, ease: [0.645, 0.045, 0.355, 1] }}
      onAnimationComplete={onTurnComplete}
      style={{ transformStyle: 'preserve-3d' }}
      className={`absolute right-0 top-0 h-full w-1/2 origin-left ${
        canFlipForward || canFlipBackward ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      <div
        className="absolute inset-0"
        style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
      >
        {front}
        {canFlipForward ? (
          <button
            type="button"
            onClick={onForward}
            className="absolute right-5 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-rich-black/20 bg-aesthetic-white/92 text-rich-black transition-all hover:border-guardsman-red hover:bg-guardsman-red hover:text-aesthetic-white"
            aria-label="Flip to next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div
        className="absolute inset-0"
        style={{
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
        }}
      >
        {back}
        {canFlipBackward ? (
          <button
            type="button"
            onClick={onBackward}
            className="absolute left-5 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-rich-black/20 bg-aesthetic-white/92 text-rich-black transition-colors hover:border-guardsman-red hover:bg-guardsman-red hover:text-aesthetic-white"
            aria-label="Flip to previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </motion.div>
  );
}

export default function AboutPage() {
  const [flippedCount, setFlippedCount] = useState(0);
  const [turningSheet, setTurningSheet] = useState<TurningSheet | null>(null);
  const [queuedTurn, setQueuedTurn] = useState<TurningSheet | null>(null);
  const [bookPosition, setBookPosition] = useState<BookPosition>('front');
  const totalSheets = members.length + 1;

  const openBookToMember = (index: number) => {
    setTurningSheet(null);
    setQueuedTurn(null);
    setBookPosition('open');
    setFlippedCount(index + 1);
  };

  const goNext = () => {
    if (turningSheet) {
      return;
    }

    if (flippedCount >= totalSheets) {
      return;
    }

    if (flippedCount === 0) {
      setQueuedTurn({ direction: 'forward', index: 0 });
      setBookPosition('open');
      return;
    }

    setTurningSheet({ direction: 'forward', index: flippedCount });
  };

  const goPrevious = () => {
    if (turningSheet) {
      return;
    }

    if (flippedCount <= 0) {
      return;
    }

    if (flippedCount === totalSheets) {
      setQueuedTurn({ direction: 'backward', index: totalSheets - 1 });
      setBookPosition('open');
      return;
    }

    setTurningSheet({ direction: 'backward', index: flippedCount - 1 });
  };

  const handleTurnComplete = (index: number) => {
    if (!turningSheet || turningSheet.index !== index) {
      return;
    }

    if (turningSheet.direction === 'forward') {
      const nextCount = index + 1;
      setFlippedCount(nextCount);
      if (nextCount === totalSheets) {
        setBookPosition('back');
      }
    } else {
      const nextCount = index;
      setFlippedCount(nextCount);
      if (nextCount === 0) {
        setBookPosition('front');
      }
    }

    setTurningSheet(null);
  };

  const handleBookPositionComplete = () => {
    if (!queuedTurn || turningSheet || bookPosition !== 'open') {
      return;
    }

    setTurningSheet(queuedTurn);
    setQueuedTurn(null);
  };

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-pale-powder selection:bg-guardsman-red selection:text-white">
      <Navbar />

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 pb-4 pt-24 md:px-8 md:pb-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(197,0,0,0.1),transparent_46%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-[linear-gradient(180deg,transparent,rgba(10,10,10,0.08))]" />

        <div className="relative h-full max-h-[720px] w-full max-w-6xl">
          <motion.div
            initial={false}
            animate={{
              x: bookPosition === 'front' ? '-25%' : bookPosition === 'back' ? '25%' : '0%',
            }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            onAnimationComplete={handleBookPositionComplete}
            className="book-perspective relative h-full w-full rounded-[10px] bg-transparent"
          >
            <div className="absolute inset-0">
              <div className="absolute inset-y-0 left-1/2 hidden w-px bg-rich-black/10 lg:block" />

              <div className="absolute left-0 top-0 h-full w-1/2 overflow-hidden border border-r-0 border-transparent bg-transparent" />
              <div className="absolute right-0 top-0 h-full w-1/2 overflow-hidden border border-l-0 border-transparent bg-transparent" />

                  {[
                {
                  front: <FrontCoverPage onSelectMember={openBookToMember} />,
                  back: (
                    <ImageProfilePage
                      member={members[0]}
                      index={0}
                      total={members.length}
                      onPrevious={goPrevious}
                      previousLabel="Previous page"
                    />
                  ),
                },
                ...members.slice(0, -1).map((member, index) => ({
                  front: (
                    <TextProfilePage
                      member={member}
                      index={index}
                      total={members.length}
                      onNext={goNext}
                      nextLabel="Next member"
                    />
                  ),
                  back: (
                    <ImageProfilePage
                      member={members[index + 1]}
                      index={index + 1}
                      total={members.length}
                      onPrevious={goPrevious}
                      previousLabel="Previous member"
                    />
                  ),
                })),
                {
                  front: (
                    <TextProfilePage
                      member={members[members.length - 1]}
                      index={members.length - 1}
                      total={members.length}
                      onNext={goNext}
                      nextLabel="Next page"
                    />
                  ),
                  back: <BackCoverPage />,
                },
                  ].map((sheet, index, sheets) => {
                    const isTurning = turningSheet?.index === index;
                    const renderedFlipped =
                      (index < flippedCount &&
                        !(turningSheet?.direction === 'backward' && index === turningSheet.index)) ||
                      (turningSheet?.direction === 'forward' && index === turningSheet.index);
                    const canFlipBackward = !turningSheet && index === flippedCount - 1;
                    const canFlipForward = !turningSheet && index === flippedCount;

                    return (
                      <PageSheet
                        key={`sheet-${index}`}
                        index={index}
                        totalSheets={sheets.length}
                        isFlipped={renderedFlipped}
                        isTurning={Boolean(isTurning)}
                        canFlipForward={canFlipForward}
                        canFlipBackward={canFlipBackward}
                        front={sheet.front}
                        back={sheet.back}
                        onForward={goNext}
                        onBackward={goPrevious}
                        onTurnComplete={() => handleTurnComplete(index)}
                      />
                    );
                  })}
            </div>
          </motion.div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="pointer-events-none fixed bottom-6 left-1/2 z-[200] flex -translate-x-1/2 items-center gap-4 font-mono text-[10px] uppercase tracking-[0.35em] text-rich-black/35"
      >
        <ChevronLeft className="h-3 w-3" />
        Flip Through Book
        <ChevronRight className="h-3 w-3" />
      </motion.div>

      <style jsx global>{`
        .book-perspective {
          perspective: 2600px;
        }
      `}</style>
    </main>
  );
}
