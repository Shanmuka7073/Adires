
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, User, Package, Store, Truck, UserCheck, FileText, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirebase } from '@/firebase';
import { t } from '@/lib/locales';
import { useAdminAuth } from '@/hooks/use-admin-auth';

const navItems = [
  { href: '/', label: 'home', icon: Home, color: 'text-primary' },
  { href: '/stores', label: 'Market', icon: LayoutGrid, color: 'text-blue-600' },
  { href: '/dashboard/owner/my-store', label: 'my-store', icon: Store, color: 'text-orange-500' },
  { href: '/dashboard/customer/my-orders', label: 'my-orders', icon: Package, color: 'text-purple-500' },
  { href: '/dashboard/customer/my-profile', label: 'my-profile', icon: User, color: 'text-gray-500' },
];

const employeeNavItems = [
    { href: '/dashboard/employee/attendance', label: 'Attendance', icon: UserCheck, color: 'text-green-600' },
    { href: '/dashboard/employee/salary-slips', label: 'Salaries', icon: FileText, color: 'text-blue-600' },
    { href: '/dashboard/customer/my-profile', label: 'Profile', icon: User, color: 'text-gray-500' },
];

export function BottomNavBar() {
  const pathname = usePathname();
  const { user, isUserLoading } = useFirebase();
  const { isEmployee } = useAdminAuth();

  // Don't show if loading, on login page, or on public menu pages
  if (isUserLoading || pathname === '/login' || pathname.startsWith('/menu/')) {
    return null;
  }
  
  // Don't show on protected routes if not logged in
  if (!user && (pathname.startsWith('/dashboard') || pathname === '/checkout')) {
      return null;
  }

  const items = isEmployee ? employeeNavItems : navItems;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-background border-t z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <nav className={cn("grid h-full", isEmployee ? "grid-cols-3" : "grid-cols-5")}>
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          const label = isEmployee ? item.label : (item.label === 'Market' ? 'Market' : t(item.label));
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 text-[10px] font-black uppercase tracking-tight transition-all',
                isActive ? item.color : 'text-muted-foreground opacity-60 hover:opacity-100'
              )}
            >
              <Icon className={cn("h-5 w-5 mb-0.5", isActive && "scale-110")} />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
