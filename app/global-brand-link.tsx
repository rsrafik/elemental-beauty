'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const HIDDEN_ROUTES = new Set(['/', '/about', '/sponsors', '/dashboard', '/join', '/login']);

export default function GlobalBrandLink() {
  const pathname = usePathname();

  if (!pathname || HIDDEN_ROUTES.has(pathname)) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-6 pt-6">
      <Link
        href="/"
        className="pointer-events-auto font-abril text-2xl uppercase tracking-tight text-rich-black transition-colors hover:text-guardsman-red md:text-3xl"
      >
        Elemental <span className="text-guardsman-red">Beauty</span>
      </Link>
    </div>
  );
}
