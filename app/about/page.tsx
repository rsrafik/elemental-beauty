'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Menu, X, Instagram, Twitter, Mail, Search } from 'lucide-react';

const members = [
  {
    name: "Catherine Chang",
    role: "President",
    image: "https://picsum.photos/seed/catherine/800/1000",
    quote: "If you want to be original, be ready to be copied.",
    bio: "Catherine revolutionized the way the club approaches cosmetic formulation. With a vision for sustainable beauty and high-performance ingredients, she leads the Elementists into a new era of scientific excellence.",
    tagline: "THE VISIONARY LEADER",
    metadata: {
      left: "ELEMENTAL BEAUTY",
      right: "EST. 2024"
    }
  },
  {
    name: "Azu Nakao",
    role: "Vice-President",
    image: "https://picsum.photos/seed/azu/800/1000",
    quote: "Science is not just a study, it's a lifestyle.",
    bio: "Azu brings a meticulous eye for detail to every lab session. Her dedication to safety and innovation ensures that every product created under the Elemental banner meets the highest standards of quality.",
    tagline: "THE TECHNICAL ARCHITECT",
    metadata: {
      left: "LABORATORY NOTES",
      right: "VOL. 02"
    }
  },
  {
    name: "Rachel Rafik",
    role: "Software Developer/ Designer",
    image: "https://picsum.photos/seed/rachel/800/1000",
    quote: "Design is where science meets the soul.",
    bio: "Rachel bridges the gap between digital aesthetics and chemical reality. Her work on the portal and brand identity has transformed how the world sees cosmetic chemistry at our university.",
    tagline: "THE CREATIVE ENGINEER",
    metadata: {
      left: "DIGITAL FRONTIER",
      right: "PIXEL PERFECT"
    }
  },
  {
    name: "Anjali Muthyala",
    role: "Treasurer",
    image: "https://picsum.photos/seed/anjali/800/1000",
    quote: "Precision in numbers, precision in formulas.",
    bio: "Anjali ensures the club's resources are optimized for maximum impact. Her strategic planning allows us to source the finest raw materials and host world-class workshops for our members.",
    tagline: "THE STRATEGIC MIND",
    metadata: {
      left: "FISCAL EXCELLENCE",
      right: "RESOURCEFUL"
    }
  }
];

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const menuItems = [
    { id: '01', label: 'HOME', href: '/' },
    { id: '02', label: 'LABS', href: '/labs' },
    { id: '03', label: 'ABOUT', href: '/about' },
    { id: '04', label: 'SPONSORS', href: '#' },
    { id: '05', label: 'JOIN', href: '/join' },
    { id: '06', label: 'PORTAL', href: '/portal' },
  ];

  return (
    <>
      <nav className="fixed top-0 left-0 w-full z-[100] bg-aesthetic-white/80 backdrop-blur-md border-b border-rich-black/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <button 
              onClick={() => setIsMenuOpen(true)}
              className="p-2 hover:text-guardsman-red transition-colors"
            >
              <Menu className="w-6 h-6 cursor-pointer" />
            </button>
            <Search className="w-5 h-5 cursor-pointer hidden md:block" />
          </div>
          
          <div className="absolute left-1/2 -translate-x-1/2">
            <Link href="/" className="font-title text-2xl md:text-3xl tracking-tighter uppercase text-rich-black">
              ELEMENTAL <span className="text-guardsman-red">BEAUTY</span>
            </Link>
          </div>

          <div className="flex items-center gap-8">
            <Link href="/portal" className="hidden md:block font-header text-sm tracking-widest uppercase cursor-pointer hover:text-guardsman-red transition-colors">Portal</Link>
            <Link href="/join" className="bg-rich-black text-aesthetic-white px-6 py-2 font-header text-xs tracking-widest uppercase hover:bg-guardsman-red transition-colors">
              Join Us
            </Link>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ y: '-100%' }}
            animate={{ y: 0 }}
            exit={{ y: '-100%' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[110] bg-rich-black text-aesthetic-white flex flex-col"
          >
            <div className="flex justify-between items-center p-8">
              <div className="font-title text-2xl tracking-tighter">E—B</div>
              <button 
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-2 font-header text-xs tracking-widest uppercase hover:text-guardsman-red transition-colors"
              >
                CLOSE <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 flex flex-col justify-center px-8 md:px-24">
              <div className="space-y-4 md:space-y-0">
                {menuItems.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + idx * 0.1 }}
                    className="group border-b border-white/10 py-6 md:py-10 flex items-baseline gap-8 cursor-pointer"
                  >
                    <span className="font-sans text-xs text-white/40">{item.id}</span>
                    <Link 
                      href={item.href}
                      onClick={() => setIsMenuOpen(false)}
                      className="font-header text-5xl md:text-8xl tracking-tight hover:text-guardsman-red transition-colors"
                    >
                      {item.label}
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="p-8 flex justify-between items-center border-t border-white/10">
              <div className="font-sans text-[10px] text-white/40 uppercase tracking-widest">
                © 2024 ELEMENTAL BEAUTY
              </div>
              <div className="flex gap-8 font-header text-[10px] uppercase tracking-widest">
                <span className="hover:text-guardsman-red cursor-pointer">INSTAGRAM</span>
                <span className="hover:text-guardsman-red cursor-pointer">TWITTER</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const ShatterText = ({ text, colorClass = "text-guardsman-red" }: { text: string, colorClass?: string }) => {
  // Simple deterministic pseudo-random function
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  return (
    <h1 className={`font-bowlby text-4xl md:text-7xl uppercase tracking-tight ${colorClass} leading-none flex flex-wrap justify-center`}>
      {text.split('').map((char, idx) => {
        const seed = idx + text.length;
        const randomZ = seededRandom(seed) * 600 + 200;
        const randomRotX = seededRandom(seed + 1) * 360;
        const randomRotY = seededRandom(seed + 2) * 360;
        const randomX = (seededRandom(seed + 3) - 0.5) * 100;
        const randomY = (seededRandom(seed + 4) - 0.5) * 100;

        return (
          <motion.span
            key={idx}
            initial={{ 
              opacity: 0, 
              z: randomZ, 
              rotateX: randomRotX,
              rotateY: randomRotY,
              x: randomX,
              y: randomY
            }}
            whileInView={{ 
              opacity: 1, 
              z: 0, 
              rotateX: 0,
              rotateY: 0,
              x: 0,
              y: 0
            }}
            transition={{ 
              duration: 1.5, 
              delay: idx * 0.02,
              ease: [0.6, 0.01, -0.05, 0.95]
            }}
            className="inline-block"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {char === ' ' ? '\u00A0' : char}
          </motion.span>
        );
      })}
    </h1>
  );
};

export default function AboutPage() {
  const [flippedPages, setFlippedPages] = useState<number[]>([]);
  const totalPages = members.length;

  const togglePage = (index: number) => {
    if (flippedPages.includes(index)) {
      setFlippedPages(flippedPages.filter(p => p < index));
    } else {
      setFlippedPages([...flippedPages, index]);
    }
  };

  const Page = ({ index, front, back, isFlipped }: { index: number, front: React.ReactNode, back: React.ReactNode, isFlipped: boolean }) => {
    return (
      <motion.div
        className="absolute top-0 right-0 w-1/2 h-full origin-left cursor-pointer"
        initial={false}
        animate={{ 
          rotateY: isFlipped ? -180 : 0,
          zIndex: isFlipped ? index + 10 : totalPages - index
        }}
        transition={{ 
          duration: 1.2, 
          ease: [0.645, 0.045, 0.355, 1]
        }}
        style={{ transformStyle: 'preserve-3d' }}
        onClick={() => togglePage(index)}
      >
        {/* Front Side */}
        <div 
          className="absolute inset-0 bg-white border border-black/10 backface-hidden flex flex-col p-6 md:p-10 shadow-[-10px_0_30px_rgba(0,0,0,0.05)]"
          style={{ backfaceVisibility: 'hidden' }}
        >
          {front}
          <div className="absolute bottom-4 left-6 font-mono text-[10px] text-black/40">
            PAGE {index * 2 + 1}
          </div>
        </div>

        {/* Back Side */}
        <div 
          className="absolute inset-0 bg-white border border-black/10 flex flex-col p-6 md:p-10 shadow-[10px_0_30px_rgba(0,0,0,0.05)]"
          style={{ 
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)'
          }}
        >
          {back}
          <div className="absolute bottom-4 right-6 font-mono text-[10px] text-black/40">
            PAGE {index * 2 + 2}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <main className="h-screen bg-pale-powder overflow-hidden flex flex-col selection:bg-guardsman-red selection:text-white">
      <Navbar />
      
      <div className="flex-1 flex items-center justify-center p-4 md:p-12 relative overflow-hidden z-10">
        <div className="max-w-6xl w-full h-full max-h-[80vh] relative perspective-3000 bg-white shadow-2xl">
          
          {/* Static Left Base (Intro) */}
          <div className="absolute top-0 left-0 w-1/2 h-full bg-white border border-black/10 p-10 flex flex-col justify-between">
            <div className="border-b-4 border-black pb-4">
              <div className="flex justify-between items-center text-xs font-mono uppercase tracking-widest mb-4">
                <div className="border border-black px-2 py-1">ELEMENTAL BEAUTY</div>
                <div className="font-bowlby text-3xl uppercase">Elementist</div>
                <div className="border border-black px-2 py-1">EST. 2024</div>
              </div>
              <div className="h-1 bg-black w-full mb-1" />
              <div className="h-[1px] bg-black w-full" />
            </div>

            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="font-title text-8xl md:text-[12rem] leading-none tracking-tighter text-rich-black/5"
              >
                EB
              </motion.div>
              <div className="space-y-2 relative z-10">
                <h2 className="font-header text-2xl italic">The Modern</h2>
                <h1 className="font-bowlby text-5xl md:text-7xl uppercase tracking-tight text-guardsman-red">Elementist</h1>
              </div>
              <p className="font-mono text-xs tracking-[0.4em] opacity-40">UNIVERSITY COSMETIC CHEMISTRY COLLECTIVE</p>
            </div>

            <div className="border-t-4 border-black pt-4 flex justify-between items-center font-mono text-[10px] uppercase tracking-widest">
              <span>Volume 01</span>
              <span>Issue 04</span>
              <span>Page 00</span>
            </div>
          </div>

          {/* Flipped Pages Stack */}
          {members.map((member, idx) => (
            <Page 
              key={idx}
              index={idx}
              isFlipped={flippedPages.includes(idx)}
              front={
                <div className="flex-1 flex flex-col">
                  <div className="flex justify-between items-center mb-8">
                    <div className="font-title text-xl">EB</div>
                    <div className="font-mono text-[10px] uppercase tracking-widest">{member.metadata.left}</div>
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-center">
                    <h2 className="font-header text-sm uppercase tracking-widest mb-2 text-guardsman-red">{member.role}</h2>
                    <ShatterText text={member.name} colorClass="text-rich-black" />
                    <div className="h-[1px] bg-black w-full my-6" />
                    <p className="font-sans text-sm leading-relaxed text-justify first-letter:text-5xl first-letter:font-header first-letter:float-left first-letter:mr-3 first-letter:mt-1">
                      {member.bio}
                    </p>
                  </div>

                  <div className="mt-8 flex justify-between items-center border-t border-black/10 pt-4">
                    <div className="flex gap-4">
                      <Instagram className="w-4 h-4" />
                      <Twitter className="w-4 h-4" />
                    </div>
                    <div className="font-header italic text-xs">The Elementist Journal</div>
                  </div>
                </div>
              }
              back={
                <div className="flex-1 flex flex-col">
                  <div className="relative flex-1 bg-pale-powder overflow-hidden grayscale group hover:grayscale-0 transition-all duration-1000">
                    <motion.div
                      initial={{ clipPath: 'inset(0 100% 0 0)' }}
                      whileInView={{ clipPath: 'inset(0 0% 0 0)' }}
                      transition={{ duration: 1.5, ease: [0.6, 0.01, -0.05, 0.95] }}
                      className="absolute inset-0"
                    >
                      <Image 
                        src={member.image} 
                        alt={member.name} 
                        fill 
                        className="object-cover scale-110 group-hover:scale-100 transition-transform duration-1000"
                        referrerPolicy="no-referrer"
                      />
                    </motion.div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-8">
                      <div className="mb-4">
                        <h4 className="font-header italic text-xl md:text-2xl text-black mb-1">Presenting...</h4>
                        <ShatterText text={member.name} />
                      </div>
                      <motion.p 
                        initial={{ y: 20, opacity: 0 }}
                        whileInView={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.8 }}
                        className="text-white font-header italic text-xl leading-tight mb-2"
                      >
                        &quot;{member.quote}&quot;
                      </motion.p>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="h-[1px] bg-black flex-1" />
                      <span className="font-mono text-[10px] uppercase tracking-widest">Featured Profile</span>
                      <div className="h-[1px] bg-black flex-1" />
                    </div>
                    <motion.h3 
                      initial={{ letterSpacing: '0px', opacity: 0 }}
                      whileInView={{ letterSpacing: '2px', opacity: 1 }}
                      transition={{ duration: 1, delay: 0.5 }}
                      className="font-bowlby text-2xl md:text-4xl uppercase text-center leading-tight"
                    >
                      {member.role}
                    </motion.h3>
                  </div>
                </div>
              }
            />
          ))}

          {/* Back Cover (Static Right Base) */}
          <div className="absolute top-0 right-0 w-1/2 h-full bg-aesthetic-white border border-black/10 p-10 flex flex-col items-center justify-center text-center z-[-1]">
             <div className="font-title text-4xl mb-8 opacity-20">ELEMENTAL BEAUTY</div>
             <div className="space-y-4 max-w-xs">
                <p className="font-header text-lg italic">&quot;Beauty is the harmony of purpose and form.&quot;</p>
                <div className="h-[1px] bg-black/10 w-full" />
                <p className="font-mono text-[10px] uppercase tracking-widest opacity-40">
                  Thank you for exploring our collective. Join us in the lab to discover your own elemental beauty.
                </p>
             </div>
             <Link href="/join" className="mt-12 bg-rich-black text-white px-8 py-3 font-header text-xs tracking-widest uppercase hover:bg-guardsman-red transition-colors">
                Join the Collective
             </Link>
          </div>

        </div>
      </div>

      {/* Navigation Hint */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 font-mono text-[10px] uppercase tracking-widest opacity-40 pointer-events-none"
      >
        <ChevronLeft className="w-3 h-3" />
        Click pages to flip
        <ChevronRight className="w-3 h-3" />
      </motion.div>

      <style jsx global>{`
        .perspective-3000 {
          perspective: 3000px;
        }
        .backface-hidden {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.1);
        }
      `}</style>
    </main>
  );
}
