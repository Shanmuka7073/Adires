
'use client';

import Link from 'next/link';
import { Package2 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { t } from '@/lib/locales';

const navLinks = [
  { href: '/', label: 'home' },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
      <nav className="flex w-full items-center gap-5 text-sm">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold md:text-base"
        >
          <Package2 className="h-6 w-6 text-primary" />
          <span className="font-headline">LocalBasket</span>
        </Link>
        {navLinks.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'transition-colors hover:text-foreground hidden md:block',
              pathname === href ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            {t(label)}
          </Link>
        ))}
      </nav>
      {/* The right side is intentionally left empty as per the user's request for a minimal design */}
    </header>
  );
}
