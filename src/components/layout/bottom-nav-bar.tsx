
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, User, Package, Store, Truck, UserCheck, FileText, LayoutGrid, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirebase } from '@/firebase';
import { t } from '@/lib/locales';
import { useAdminAuth } from '@/hooks/use-admin-auth';

const customerNavItems = [
  { href: '/', label: 'home', icon: Home, color: 'text-primary' },
  { href: '/dashboard/owner/my-store', label: 'my-store', icon: Store, color: 'text-orange-500' },
  { href: '/dashboard/customer/my-orders', label: 'my-orders', icon: Package, color: 'text-purple-500' },
  { href: '/dashboard/customer/my-profile', label: 'my-profile', icon: User, color: 'text-gray-500' },
];

const merchantNavItems = [
  { href: '/dashboard/restaurant', label: 'Dashboard', icon: LayoutGrid, color: 'text-primary' },
  { href: '/dashboard/owner/orders', label: 'Live Orders', icon: ShoppingBag, color: 'text-blue-600' },
  { href: '/dashboard/owner/my-store', label: 'Business', icon: Store, color: 'text-orange-500' },
  { href: '/dashboard/customer/my-profile', label: 'Profile', icon: User, color: 'text-gray-500' },
];

const employeeNavItems = [
    { href: '/dashboard/employee/attendance', label: 'Attendance', icon: UserCheck, color: 'text-green-600' },
    { href: '/dashboard/employee/salary-slips', label: 'Salaries', icon: FileText, color: 'text-blue-600' },
    { href: '/dashboard/customer/my-profile', label: 'Profile', icon: User, color: 'text-gray-500' },
];

export function BottomNavBar() {
  const pathname = usePathname();
  const { user, isUserLoading } = useFirebase();
  const { isRestaurantOwner, isEmployee, isAdmin } = useAdminAuth();

  if (isUserLoading || pathname === '/login' || pathname.startsWith('/menu/')) {
    return null;
  }
  
  if (!user && (pathname.startsWith('/dashboard') || pathname === '/checkout')) {
      return null;
  }

  let items = customerNavItems;
  if (isAdmin) {
      return null; 
  } else if (isRestaurantOwner) {
      items = merchantNavItems;
  } else if (isEmployee) {
      items = employeeNavItems;
  }

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-background border-t z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <nav className={cn(
          "grid h-full", 
          items.length === 3 ? "grid-cols-3" : 
          items.length === 4 ? "grid-cols-4" : 
          items.length === 5 ? "grid-cols-5" : "grid-cols-4"
      )}>
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          const label = item.label.includes('-') ? t(item.label) : item.label;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 text-[9px] font-black uppercase tracking-tight transition-all',
                isActive ? item.color : 'text-muted-foreground opacity-60'
              )}
            >
              <Icon className={cn("h-5 w-5 mb-0.5", isActive && "scale-110")} />
              <span className="truncate max-w-full px-1">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
