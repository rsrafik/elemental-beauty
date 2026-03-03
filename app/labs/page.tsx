'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  FlaskConical, 
  Search, 
  Filter, 
  ChevronRight, 
  Clock, 
  Sparkles,
  ArrowLeft,
  Beaker,
  Droplets
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

const MOCK_LABS = [
  { 
    id: '1', 
    title: 'Vitamin C Serum', 
    date: 'Feb 15, 2024', 
    img: 'https://picsum.photos/seed/serum-vogue/800/600',
    tags: ['Antioxidant', 'Formulation'],
    difficulty: 'Intermediate',
    time: '2 hours',
    description: 'A stable, high-potency Vitamin C serum formulation using L-Ascorbic Acid and Ferulic Acid.',
    visibility: 'Public'
  },
  { 
    id: '2', 
    title: 'Hydrating Mist', 
    date: 'Jan 28, 2024', 
    img: 'https://picsum.photos/seed/mist-vogue/800/600',
    tags: ['Hydration', 'Botanical'],
    difficulty: 'Beginner',
    time: '1 hour',
    description: 'Refreshing facial mist with rose water, glycerin, and hyaluronic acid for instant hydration.',
    visibility: 'Public'
  },
  { 
    id: '3', 
    title: 'Mineral Sunscreen', 
    date: 'Dec 12, 2023', 
    img: 'https://picsum.photos/seed/sun-vogue/800/600',
    tags: ['SPF', 'Physical Filter'],
    difficulty: 'Advanced',
    time: '3 hours',
    description: 'Broad-spectrum SPF 30 formulation using non-nano Zinc Oxide and skin-soothing botanicals.',
    visibility: 'Members Only'
  },
  { 
    id: '4', 
    title: 'Gentle Cleanser', 
    date: 'Nov 05, 2023', 
    img: 'https://picsum.photos/seed/clean-vogue/800/600',
    tags: ['Cleansing', 'pH Balanced'],
    difficulty: 'Beginner',
    time: '1.5 hours',
    description: 'A non-foaming, pH-balanced cream cleanser designed for sensitive skin barriers.',
    visibility: 'Public'
  },
];

const LabsPage = () => {
  const [filter, setFilter] = useState('All');

  const filteredLabs = filter === 'All' 
    ? MOCK_LABS 
    : MOCK_LABS.filter(lab => lab.tags.includes(filter) || lab.difficulty === filter);

  return (
    <main className="min-h-screen bg-aesthetic-white selection:bg-guardsman-red selection:text-white pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-6">
        <Link href="/" className="inline-flex items-center gap-2 text-[10px] font-header uppercase tracking-widest text-rich-black/40 hover:text-guardsman-red transition-colors mb-12">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-16 gap-12">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-guardsman-red/10 px-4 py-2 rounded-full mb-6">
              <FlaskConical className="w-4 h-4 text-guardsman-red" />
              <span className="text-[10px] font-header uppercase tracking-widest text-guardsman-red">The Archive</span>
            </div>
            <h1 className="text-5xl md:text-8xl font-header text-rich-black mb-8 leading-tight uppercase">
              LAB <span className="text-guardsman-red italic">REPORTS</span>
            </h1>
            <p className="font-sans text-lg text-rich-black/60 leading-relaxed">
              Precision formulations and scientific breakthroughs. 
              Explore the archives of Elemental Beauty.
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            {['All', 'Beginner', 'Intermediate', 'Advanced'].map(tag => (
              <button
                key={tag}
                onClick={() => setFilter(tag)}
                className={`px-8 py-2 border font-header text-[10px] uppercase tracking-widest transition-all ${
                  filter === tag ? 'bg-rich-black text-aesthetic-white border-rich-black' : 'bg-transparent text-rich-black/40 border-rich-black/10 hover:border-rich-black'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
          {filteredLabs.map((lab, idx) => (
            <motion.div
              key={lab.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="group bg-white border border-rich-black/5 shadow-2xl overflow-hidden hover:-translate-y-2 transition-all duration-700"
            >
              <div className="grid grid-cols-1 sm:grid-cols-5 h-full">
                <div className="sm:col-span-2 relative h-64 sm:h-auto overflow-hidden bg-pale-powder">
                  <Image 
                    src={lab.img} 
                    alt={lab.title} 
                    fill 
                    className="object-cover transition-transform duration-1000 group-hover:scale-110 grayscale group-hover:grayscale-0"
                    referrerPolicy="no-referrer"
                  />
                  {lab.visibility === 'Members Only' && (
                    <div className="absolute inset-0 bg-rich-black/80 backdrop-blur-[2px] flex flex-col items-center justify-center text-white p-6 text-center">
                      <Sparkles className="w-8 h-8 mb-4 text-guardsman-red" />
                      <p className="font-header text-[10px] uppercase tracking-widest">Members Only Access</p>
                    </div>
                  )}
                </div>
                
                <div className="sm:col-span-3 p-10 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex gap-3">
                        {lab.tags.map(tag => (
                          <span key={tag} className="text-[10px] font-header uppercase tracking-widest text-guardsman-red">#{tag}</span>
                        ))}
                      </div>
                      <span className="text-[10px] font-header uppercase tracking-widest text-rich-black/20">{lab.date}</span>
                    </div>
                    <h3 className="text-3xl font-header text-rich-black mb-6 uppercase group-hover:text-guardsman-red transition-colors">{lab.title}</h3>
                    <p className="font-sans text-sm text-rich-black/60 mb-8 line-clamp-3 leading-relaxed">
                      {lab.description}
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-8 text-[10px] font-header uppercase tracking-widest text-rich-black/40">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3" /> {lab.time}
                      </div>
                      <div className="flex items-center gap-2">
                        <Beaker className="w-3 h-3" /> {lab.difficulty}
                      </div>
                    </div>
                    
                    <Link 
                      href={lab.visibility === 'Members Only' ? '/join' : `/labs/${lab.id}`}
                      prefetch={false}
                      className="inline-flex items-center gap-3 font-header text-[10px] uppercase tracking-widest text-rich-black hover:text-guardsman-red transition-colors border-b border-rich-black/10 pb-1"
                    >
                      {lab.visibility === 'Members Only' ? 'Join to Unlock' : 'View Full Report'} <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Safety Section */}
        <div className="mt-32 grid grid-cols-1 lg:grid-cols-3 gap-16">
          <div className="lg:col-span-2 bg-aurora-black p-16 text-aesthetic-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-guardsman-red/10 rounded-full blur-3xl -z-10" />
            <h3 className="font-header text-4xl mb-8 uppercase tracking-widest">Safety Protocol</h3>
            <p className="font-sans text-pale-powder/60 leading-relaxed mb-12 max-w-xl">
              Precision requires discipline. All Elementists must adhere to the highest 
              standards of laboratory safety. We provide the tools; you provide the focus.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-12">
              {['PPE', 'Goggles', 'Gloves', 'MSDS'].map(item => (
                <div key={item} className="flex flex-col items-center gap-4 text-center">
                  <div className="w-12 h-12 border border-guardsman-red/30 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-guardsman-red" />
                  </div>
                  <span className="text-[10px] font-header uppercase tracking-widest text-pale-powder/40">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-guardsman-red p-16 flex flex-col justify-center text-center text-aesthetic-white shadow-2xl">
            <Droplets className="w-12 h-12 mx-auto mb-8" />
            <h3 className="font-header text-3xl mb-6 uppercase tracking-widest leading-tight">Propose a <br /> Project</h3>
            <p className="font-sans text-aesthetic-white/80 leading-relaxed mb-10 text-sm">
              Innovation is driven by curiosity. Submit your formulation proposals to the board.
            </p>
            <button className="bg-rich-black text-aesthetic-white py-5 font-header text-[10px] uppercase tracking-widest hover:bg-white hover:text-rich-black transition-all shadow-xl">
              Submit Proposal
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};

export default LabsPage;
