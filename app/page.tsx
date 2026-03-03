'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { FlaskConical, Menu, ArrowRight, Instagram, Twitter, Facebook, Sparkles, Users, Calendar, X, ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

const DiscordIcon = ({ className = '' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
  >
    <path d="M20.317 4.369A19.79 19.79 0 0 0 15.885 3c-.191.347-.403.816-.552 1.185a18.27 18.27 0 0 0-5.104 0A12.6 12.6 0 0 0 9.676 3a19.74 19.74 0 0 0-4.433 1.369C2.44 8.612 1.68 12.75 2.06 16.83a19.92 19.92 0 0 0 5.426 2.703c.438-.594.828-1.22 1.163-1.876-.636-.241-1.242-.54-1.812-.885.15-.108.296-.222.437-.34 3.494 1.596 7.282 1.596 10.734 0 .143.118.289.232.438.34-.571.346-1.18.645-1.817.887.335.655.724 1.281 1.163 1.875a19.86 19.86 0 0 0 5.43-2.703c.444-4.73-.76-8.83-3.905-12.462ZM9.57 14.375c-1.05 0-1.914-.97-1.914-2.16 0-1.19.844-2.16 1.914-2.16 1.078 0 1.93.98 1.913 2.16 0 1.19-.844 2.16-1.913 2.16Zm4.86 0c-1.05 0-1.913-.97-1.913-2.16 0-1.19.844-2.16 1.913-2.16 1.078 0 1.93.98 1.913 2.16 0 1.19-.835 2.16-1.913 2.16Z" />
  </svg>
);

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const menuItems = [
    { id: '01', label: 'HOME', href: '/' },
    { id: '02', label: 'LABS', href: '/labs' },
    { id: '03', label: 'ABOUT', href: '/about' },
    { id: '04', label: 'SPONSORS', href: '/sponsors' },
    { id: '05', label: 'JOIN', href: '/join' },
    { id: '06', label: 'PORTAL', href: '/portal' },
  ];

  return (
    <>
      <nav className="fixed top-0 left-0 w-full z-50 bg-aesthetic-white/80 backdrop-blur-md border-b border-rich-black/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Menu 
              className="w-6 h-6 cursor-pointer hover:text-guardsman-red transition-colors" 
              onClick={() => setIsMenuOpen(true)}
            />
          </div>
          
          <div className="absolute left-1/2 -translate-x-1/2">
            <Link href="/" className="font-abril text-2xl md:text-3xl tracking-tighter uppercase text-rich-black">
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
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[60] bg-rich-black text-aesthetic-white flex flex-col"
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
                © 2026 ELEMENTAL BEAUTY
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

const Hero = () => {
  const containerRef = useRef(null);
  const heroTitle = [
    ['THE', 'MODERN'],
    ['ELEMENTIST'],
  ];
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "32%"]);
  const titleY = useTransform(scrollYProgress, [0, 1], ["0%", "10%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);

  return (
    <section ref={containerRef} className="relative h-screen flex items-center justify-center overflow-hidden pt-20">
      <motion.div style={{ y: imageY, scale }} className="absolute inset-0 z-0">
        <Image
          src="https://picsum.photos/seed/cosmetic-lab-vogue/1920/1080"
          alt="Elemental Beauty Hero"
          fill
          className="object-cover brightness-75"
          priority
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-rich-black/60 via-transparent to-transparent" />
      </motion.div>

      <motion.div style={{ y: contentY, opacity }} className="relative z-10 text-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
        >
          <motion.span
            initial={{ opacity: 0, y: 18, rotate: -2 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.18 }}
            className="font-sarina text-guardsman-red text-3xl md:text-5xl mb-4 block"
          >
            Science Meets Skincare
          </motion.span>
          <motion.h2
            style={{ y: titleY }}
            initial="hidden"
            animate="visible"
            variants={{
              visible: {
                transition: {
                  staggerChildren: 0.14,
                  delayChildren: 0.24,
                },
              },
            }}
            className="font-abril text-6xl md:text-9xl text-aesthetic-white leading-none mb-8"
          >
            {heroTitle.map((line, lineIndex) => (
              <span key={`line-${lineIndex}`} className="block overflow-hidden">
                {line.map((word, wordIndex) => (
                  <motion.span
                    key={`${word}-${wordIndex}`}
                    variants={{
                      hidden: {
                        y: '112%',
                        opacity: 0,
                        rotate: 3,
                        filter: 'blur(8px)',
                      },
                      visible: {
                        y: '0%',
                        opacity: 1,
                        rotate: 0,
                        filter: 'blur(0px)',
                        transition: {
                          duration: 0.9,
                          ease: [0.16, 1, 0.3, 1],
                        },
                      },
                    }}
                    whileHover={{
                      y: -6,
                      color: '#d81818',
                      transition: { duration: 0.22 },
                    }}
                    className="inline-block mr-[0.16em] last:mr-0 will-change-transform"
                  >
                    {word}
                  </motion.span>
                ))}
              </span>
            ))}
          </motion.h2>
          <motion.div className="flex flex-wrap justify-center gap-4">
            <Link href="/join">
              <motion.button
                whileHover={{ scale: 1.05, y: -4 }}
                whileTap={{ scale: 0.95 }}
                className="bg-guardsman-red text-aesthetic-white px-10 py-4 font-header text-lg tracking-widest uppercase hover:bg-madder transition-colors shadow-2xl"
              >
                Join the Chapter
              </motion.button>
            </Link>
            <Link href="/labs">
              <motion.button
                whileHover={{ scale: 1.05, y: -4 }}
                whileTap={{ scale: 0.95 }}
                className="bg-aesthetic-white text-rich-black px-10 py-4 font-header text-lg tracking-widest uppercase hover:bg-pale-powder transition-colors shadow-2xl"
              >
                View Labs
              </motion.button>
            </Link>
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
};

const FeaturedLabs = () => {
  const sectionRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"]
  });

  const titleY = useTransform(scrollYProgress, [0, 0.5], [50, 0]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.5], [0, 1]);
  const carouselY = useTransform(scrollYProgress, [0, 1], [80, -40]);

  const labs = [
    { id: 1, name: "Vitamin C Serum", date: "Feb 15", img: "https://picsum.photos/seed/serum-vogue/600/800", category: "Formulation" },
    { id: 2, name: "Hydrating Mist", date: "Jan 28", img: "https://picsum.photos/seed/mist-vogue/600/800", category: "Botanical" },
    { id: 3, name: "Mineral Sunscreen", date: "Dec 12", img: "https://picsum.photos/seed/sun-vogue/600/800", category: "Protection" },
    { id: 4, name: "Gentle Cleanser", date: "Nov 05", img: "https://picsum.photos/seed/clean-vogue/600/800", category: "Cleansing" },
    { id: 5, name: "Retinol Night", date: "Oct 20", img: "https://picsum.photos/seed/retinol-vogue/600/800", category: "Anti-Aging" },
  ];

  const [currentIndex, setCurrentIndex] = useState(2); // Start with the middle one

  const next = () => {
    setCurrentIndex((prev) => (prev + 1) % labs.length);
  };

  const prev = () => {
    setCurrentIndex((prev) => (prev - 1 + labs.length) % labs.length);
  };

  return (
    <section ref={sectionRef} className="py-24 bg-aesthetic-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div 
          style={{ y: titleY, opacity: titleOpacity }}
          className="flex flex-col md:flex-row justify-between items-end mb-16 gap-4"
        >
          <div>
            <h3 className="font-header text-5xl text-rich-black mb-2 uppercase">LATEST LABS</h3>
            <p className="font-sans text-rich-black/60 uppercase tracking-widest text-sm">Innovations from our Elementists</p>
          </div>
          <div className="flex items-center gap-6">
            <motion.button 
              onClick={prev}
              whileHover={{ y: -3, scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              className="w-12 h-12 border border-rich-black/10 flex items-center justify-center hover:bg-rich-black hover:text-white transition-all"
            >
              <ChevronLeft className="w-6 h-6" />
            </motion.button>
            <motion.button 
              onClick={next}
              whileHover={{ y: -3, scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              className="w-12 h-12 border border-rich-black/10 flex items-center justify-center hover:bg-rich-black hover:text-white transition-all"
            >
              <ChevronRight className="w-6 h-6" />
            </motion.button>
          </div>
        </motion.div>

        <motion.div style={{ y: carouselY }} className="relative flex justify-center items-center h-[650px]">
          <div className="relative w-full flex justify-center items-center transition-all duration-500">
            {labs.map((lab, idx) => {
              // Calculate relative position to current index
              let position = idx - currentIndex;
              
              // Handle wrapping for circular effect
              if (position < -2) position += labs.length;
              if (position > 2) position -= labs.length;

              const isActive = position === 0;
              const depth = Math.abs(position);
              const isVisible = depth <= 2;
              const xOffset = position * 320;

              if (!isVisible) return null;

              return (
                <motion.div
                  key={lab.id}
                  animate={{
                    scale: isActive ? 1.2 : depth === 1 ? 0.75 : 0.66,
                    opacity: isVisible ? (isActive ? 1 : depth === 1 ? 0.4 : 0.22) : 0,
                    x: xOffset,
                    y: isActive ? 0 : depth * 18,
                    zIndex: isActive ? 10 : 5 - depth
                  }}
                  transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                  whileHover={{ y: isActive ? -12 : depth * 18 - 8 }}
                  className="absolute w-56 md:w-80 group cursor-pointer"
                >
                  <motion.div whileHover={{ scale: 1.03 }} className="relative aspect-[3/4] overflow-hidden mb-6 bg-pale-powder shadow-2xl">
                    <Image
                      src={lab.img}
                      alt={lab.name}
                      fill
                      className={`object-cover transition-all duration-500 ${depth === 2 ? 'brightness-[0.55] saturate-[0.8]' : depth === 1 ? 'brightness-[0.82]' : ''}`}
                      referrerPolicy="no-referrer"
                    />
                  </motion.div>
                  <div className={`text-center transition-all duration-500 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    <p className="font-praise text-guardsman-red text-2xl mb-1">{lab.category}</p>
                    <h4 className="font-header text-2xl text-rich-black leading-tight">{lab.name}</h4>
                    <p className="font-sans text-rich-black/40 uppercase text-xs tracking-widest">{lab.date}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

const MissionSection = () => {
  const sectionRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"]
  });

  const imageY = useTransform(scrollYProgress, [0, 1], ["-12%", "14%"]);
  const copyY = useTransform(scrollYProgress, [0, 1], ["8%", "-8%"]);

  return (
    <section ref={sectionRef} className="bg-aurora-black py-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <motion.div
          style={{ y: imageY }}
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="relative"
        >
          <motion.div
            whileHover={{ y: -10, rotate: -1.5 }}
            className="relative aspect-square w-full max-w-md mx-auto"
          >
            <Image
              src="https://picsum.photos/seed/mission-vogue/800/800"
              alt="Mission"
              fill
              className="object-cover grayscale hover:grayscale-0 transition-all duration-1000"
              referrerPolicy="no-referrer"
            />
            <div className="absolute -top-8 -left-8 w-full h-full border-2 border-guardsman-red -z-10" />
          </motion.div>
        </motion.div>

        <motion.div
          style={{ y: copyY }}
          initial={{ opacity: 0, x: 50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="text-aesthetic-white"
        >
          <h2 className="font-title text-5xl md:text-7xl mb-6 leading-tight">
            POWER <br /> <span className="text-guardsman-red">IN PRECISION</span>
          </h2>
          <p className="font-sans text-lg text-pale-powder/80 mb-8 leading-relaxed">
            Elemental Beauty is a community of cosmetic chemistry enthusiasts. 
            We bridge the gap between textbook chemistry and real-world application. 
            As Elementists, we study the interactions of emulsifiers, the stability of 
            antioxidants, and the efficacy of active ingredients.
          </p>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-[1px] bg-guardsman-red" />
              <span className="font-accent text-2xl">The Elementist Manifesto</span>
            </div>
            <p className="font-italianno text-3xl text-guardsman-red italic">
              &quot;A scientist should be two things: curious and bold.&quot;
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

const Footer = () => {
  return (
    <footer className="bg-rich-black text-aesthetic-white py-20 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-2">
            <h2 className="font-title text-4xl mb-6">ELEMENTAL BEAUTY</h2>
            <p className="font-sans text-pale-powder/60 max-w-sm mb-8">
              Join our inner circle for exclusive access to new labs, 
              scientific stories, and private workshops.
            </p>
            <div className="flex gap-4">
              <input 
                type="email" 
                placeholder="EMAIL ADDRESS" 
                className="bg-transparent border-b border-aesthetic-white/30 py-2 w-full max-w-xs focus:border-guardsman-red outline-none transition-colors font-header text-sm"
              />
              <button className="font-header text-guardsman-red tracking-widest text-sm">JOIN</button>
            </div>
          </div>
          
          <div>
            <h5 className="font-header text-lg mb-6 uppercase tracking-widest">Explore</h5>
            <ul className="flex flex-col gap-4 font-sans text-sm text-pale-powder/60">
              <li className="hover:text-guardsman-red cursor-pointer transition-colors">Labs & Projects</li>
              <Link href="/about" className="hover:text-guardsman-red cursor-pointer transition-colors">About Us</Link>
              <Link href="/sponsors" className="hover:text-guardsman-red cursor-pointer transition-colors">Sponsors</Link>
              <li className="hover:text-guardsman-red cursor-pointer transition-colors">Join Club</li>
            </ul>
          </div>

          <div>
            <h5 className="font-header text-lg mb-6 uppercase tracking-widest">Member Area</h5>
            <ul className="flex flex-col gap-4 font-sans text-sm text-pale-powder/60">
              <Link href="/dashboard" className="hover:text-guardsman-red cursor-pointer transition-colors">Officer Portal</Link>
              <Link href="/portal" className="hover:text-guardsman-red cursor-pointer transition-colors">Member Dashboard</Link>
              <li className="hover:text-guardsman-red cursor-pointer transition-colors">Dues & Waivers</li>
              <li className="hover:text-guardsman-red cursor-pointer transition-colors">Safety Manual</li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-8">
          <p className="font-sans text-xs text-pale-powder/40">
            © 2026 ELEMENTAL BEAUTY. ALL RIGHTS RESERVED.
          </p>
          <div className="flex gap-6">
            <motion.div whileHover={{ y: -4, scale: 1.08 }} whileTap={{ scale: 0.96 }}>
              <a
                href="https://www.instagram.com/ccs.purdue/"
                target="_blank"
                rel="noreferrer"
                aria-label="CCS Purdue Instagram"
                className="block hover:text-guardsman-red transition-colors"
              >
                <Instagram className="w-5 h-5 cursor-pointer" />
              </a>
            </motion.div>
            <motion.div whileHover={{ y: -4, scale: 1.08 }} whileTap={{ scale: 0.96 }}>
              <a
                href="https://discord.gg/BDAVya9pFm"
                target="_blank"
                rel="noreferrer"
                aria-label="CCS Purdue Discord"
                className="block hover:text-guardsman-red transition-colors"
              >
                <DiscordIcon className="w-5 h-5 cursor-pointer" />
              </a>
            </motion.div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default function LandingPage() {
  const statsRef = useRef(null);
  const { scrollYProgress: statsProgress } = useScroll({
    target: statsRef,
    offset: ["start end", "end start"]
  });
  const statsYLeft = useTransform(statsProgress, [0, 1], [40, -24]);
  const statsYRight = useTransform(statsProgress, [0, 1], [-24, 32]);

  return (
    <motion.main 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
      className="min-h-screen selection:bg-guardsman-red selection:text-white"
    >
      <Navbar />
      <Hero />
      
      {/* Stats Section */}
      <section ref={statsRef} className="py-24 bg-aesthetic-white border-b border-rich-black/5 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
          {[
            { label: 'Elementists', value: '150+', icon: Users },
            { label: 'Labs Completed', value: '24', icon: FlaskConical },
            { label: 'Sponsors', value: '8', icon: Sparkles },
            { label: 'Safety First', value: '100%', icon: Calendar },
          ].map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              whileHover={{ y: -8, scale: 1.04 }}
              style={{ y: idx % 2 === 0 ? statsYLeft : statsYRight }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
              viewport={{ once: true, margin: "-100px" }}
              className="will-change-transform"
            >
              <h3 className="font-header text-4xl text-rich-black mb-2">{stat.value}</h3>
              <p className="font-sans text-xs text-rich-black/40 uppercase tracking-widest">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <FeaturedLabs />
      <MissionSection />

      <Footer />
    </motion.main>
  );
}
