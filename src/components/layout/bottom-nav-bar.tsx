'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, User, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirebase } from '@/firebase';
import { t } from '@/lib/locales';

const navItems = [
  { href: '/', label: 'home' },
  { href: '/dashboard/customer/my-orders', label: 'my-orders' },
  { href: '/dashboard/customer/my-profile', label: 'my-profile' },
];

const navIcons = {
    'home': Home,
    'my-orders': Package,
    'my-profile': User,
};

export function BottomNavBar() {
  const pathname = usePathname();
  const { user, isUserLoading } = useFirebase();

  // Don't show if loading or on login page
  if (isUserLoading || pathname === '/login') {
    return null;
  }
  
  // Don't show on protected routes if not logged in
  if (!user && (pathname.startsWith('/dashboard') || pathname === '/checkout')) {
      return null;
  }

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-background border-t z-50">
      <nav className="grid h-full grid-cols-3">
        {navItems.map((item) => {
          const Icon = navIcons[item.label];
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-primary'
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{t(item.label)}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
