'use client';

import Link from 'next/link';
import { Menu, Sparkles } from 'lucide-react';

export default function SponsorsPage() {
  return (
    <main className="min-h-screen bg-aesthetic-white text-rich-black selection:bg-guardsman-red selection:text-white">
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-rich-black/5 bg-aesthetic-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <Menu className="h-6 w-6" />
          </div>

          <div className="absolute left-1/2 -translate-x-1/2">
            <Link href="/" className="font-abril text-2xl uppercase tracking-tight text-rich-black md:text-3xl">
              Elemental <span className="text-guardsman-red">Beauty</span>
            </Link>
          </div>

          <div className="flex items-center gap-8">
            <Link
              href="/join"
              className="bg-rich-black px-6 py-2 font-header text-xs uppercase tracking-widest text-aesthetic-white transition-colors hover:bg-guardsman-red"
            >
              Join Us
            </Link>
          </div>
        </div>
      </nav>

      <section className="mx-auto flex min-h-screen max-w-7xl items-center px-6 pt-24">
        <div className="grid w-full gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.4em] text-rich-black/35">Sponsors</p>
            <h1 className="mt-6 font-abril text-6xl uppercase leading-[0.9] tracking-tight md:text-8xl">
              Partnership space reserved.
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-8 text-rich-black/60">
              We do not have sponsors published yet. This page is ready for future brand partners,
              studio collaborators, and chapter supporters once those relationships are confirmed.
            </p>
            <div className="mt-10">
              <div className="inline-flex flex-col items-start">
                <div className="flex flex-wrap gap-4">
                  <Link
                    href="/join"
                    className="inline-flex items-center gap-3 bg-rich-black px-8 py-3 font-header text-xs uppercase tracking-[0.3em] text-aesthetic-white transition-colors hover:bg-guardsman-red"
                  >
                    Join The Chapter
                  </Link>
                  <Link
                    href="/about"
                    className="inline-flex items-center gap-3 border border-rich-black/15 px-8 py-3 font-header text-xs uppercase tracking-[0.3em] text-rich-black transition-colors hover:border-guardsman-red hover:bg-guardsman-red hover:text-aesthetic-white"
                  >
                    Meet The Board
                  </Link>
                </div>
                <div className="mt-4 w-full">
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center bg-guardsman-red px-8 py-3 font-header text-xs uppercase tracking-[0.3em] text-aesthetic-white transition-colors hover:bg-rich-black"
                  >
                    Become A Sponsor
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {[1, 2, 3, 4].map((card) => (
              <div
                key={card}
                className="flex min-h-52 flex-col justify-between border border-rich-black/8 bg-[#f7f3f0] p-6"
              >
                <Sparkles className="h-5 w-5 text-guardsman-red" />
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-rich-black/35">
                    Placeholder 0{card}
                  </p>
                  <p className="mt-3 font-header text-2xl uppercase leading-tight">
                    Reserved for a future sponsor feature.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
