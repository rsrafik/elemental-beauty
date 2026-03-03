import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Beaker, ChevronRight, Clock, Sparkles } from 'lucide-react';
import { getSiteLabById, siteLabs } from '@/lib/site-labs';

type LabDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function generateStaticParams() {
  return siteLabs.map((lab) => ({ id: lab.id }));
}

export default async function LabDetailPage({ params }: LabDetailPageProps) {
  const { id } = await params;
  const lab = getSiteLabById(id);

  if (!lab) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-aesthetic-white px-6 pb-20 pt-24 selection:bg-guardsman-red selection:text-white">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/labs"
          className="inline-flex items-center gap-2 text-[10px] font-header uppercase tracking-widest text-rich-black/40 transition-colors hover:text-guardsman-red"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Archive
        </Link>

        <div className="mt-10 grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <div className="flex flex-wrap gap-3">
              {lab.tags.map((tag) => (
                <span key={tag} className="text-[10px] font-header uppercase tracking-[0.3em] text-guardsman-red">
                  #{tag}
                </span>
              ))}
            </div>

            <h1 className="mt-6 font-header text-5xl uppercase leading-[0.9] tracking-tight text-rich-black md:text-7xl">
              {lab.title}
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-rich-black/65">{lab.overview}</p>

            <div className="mt-10 flex flex-wrap gap-8 border-y border-rich-black/10 py-5 text-[10px] font-header uppercase tracking-[0.3em] text-rich-black/45">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {lab.time}
              </div>
              <div className="flex items-center gap-2">
                <Beaker className="h-4 w-4" />
                {lab.difficulty}
              </div>
              <div>{lab.date}</div>
            </div>

            <div className="mt-12 grid gap-10 md:grid-cols-2">
              <section className="border border-rich-black/10 bg-white p-8 shadow-xl">
                <p className="text-[10px] font-header uppercase tracking-[0.35em] text-rich-black/35">Formulation Notes</p>
                <div className="mt-6 space-y-4">
                  {lab.formulationNotes.map((note) => (
                    <div key={note} className="flex gap-3 text-sm leading-7 text-rich-black/70">
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-guardsman-red" />
                      <span>{note}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="border border-rich-black/10 bg-rich-black p-8 text-aesthetic-white shadow-xl">
                <p className="text-[10px] font-header uppercase tracking-[0.35em] text-white/45">Key Focus</p>
                <div className="mt-6 space-y-4">
                  {lab.keyFocus.map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <Sparkles className="h-4 w-4 text-guardsman-red" />
                      <span className="text-sm uppercase tracking-[0.2em] text-white/90">{item}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>

          <div className="sticky top-28">
            <div className="relative aspect-[4/5] overflow-hidden border border-rich-black/10 bg-pale-powder shadow-2xl">
              <Image
                src={lab.img}
                alt={lab.title}
                fill
                className="object-cover grayscale"
                referrerPolicy="no-referrer"
              />
              {lab.visibility === 'Members Only' ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-rich-black/78 p-8 text-center text-white">
                  <Sparkles className="mb-4 h-8 w-8 text-guardsman-red" />
                  <p className="font-header text-[10px] uppercase tracking-[0.35em]">Members Only</p>
                  <Link
                    href="/join"
                    className="mt-6 inline-flex items-center gap-3 border border-white/20 px-6 py-3 font-header text-[10px] uppercase tracking-[0.3em] transition-colors hover:border-guardsman-red hover:bg-guardsman-red"
                  >
                    Join To Unlock
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
