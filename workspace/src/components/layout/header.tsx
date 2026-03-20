
'use client';

import Link from 'next/link';
import { UserCircle, Globe, LogOut, LayoutDashboard, ShoppingBag, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CartIcon } from '@/components/cart/cart-icon';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useFirebase } from '@/firebase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { getAuth, signOut } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';
import { t } from '@/lib/locales';
import { useAppStore } from '@/lib/store';

const ADMIN_EMAIL = 'admin@gmail.com';

const dashboardLinks = [
    { href: '/dashboard/owner/orders', label: 'store-orders', icon: ShoppingBag },
    { href: '/dashboard/delivery/deliveries', label: 'deliveries', icon: Truck },
]

function LanguageSwitcher() {
    const { language, setLanguage } = useAppStore();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                    <Globe className="h-5 w-5" />
                    <span className="sr-only">Change language</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Select Language</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={language} onValueChange={setLanguage}>
                    <DropdownMenuRadioItem value="en">
                        English
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="te">
                        Telugu
                    </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

function UserMenu() {
  const { user, isUserLoading } = useFirebase();
  const isAdmin = user && user.email === ADMIN_EMAIL;
  const dashboardHref = isAdmin ? '/dashboard/admin' : '/dashboard';

  const handleLogout = async () => {
    const auth = getAuth();
    await signOut(auth);
  };

  if (isUserLoading) {
    return <Skeleton className="h-10 w-10 rounded-full" />;
  }

  if (!user) {
    return (
      <Button asChild variant="outline">
        <Link href="/login">{t('login')}</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" className="rounded-full">
          <UserCircle className="h-5 w-5" />
          <span className="sr-only">Toggle user menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('my-account')}</DropdownMenuLabel>
        <DropdownMenuItem disabled>{user.email}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <Link href={dashboardHref} passHref>
          <DropdownMenuItem>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>{t('dashboard')}</span>
          </DropdownMenuItem>
        </Link>
        {!isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t('roles')}</DropdownMenuLabel>
            {dashboardLinks.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} passHref>
                    <DropdownMenuItem>
                        <Icon className="mr-2 h-4 w-4" />
                        <span>{t(label)}</span>
                    </DropdownMenuItem>
                </Link>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>{t('logout')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header() {
  const [isCartOpen, setIsCartOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
      <Link
        href="/"
        className="flex items-center gap-2 text-lg font-semibold"
      >
        <span className="font-headline text-primary font-black uppercase italic">Adires</span>
      </Link>
      
      <div className="flex items-center gap-2 md:gap-4">
        <LanguageSwitcher />
        <CartIcon open={isCartOpen} onOpenChange={setIsCartOpen} />
        <UserMenu />
      </div>
    </header>
  );
}
