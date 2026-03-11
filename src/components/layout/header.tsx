
'use client';

import Link from 'next/link';
import { Menu, UserCircle, Store, ShoppingBag, Truck, LayoutDashboard, Mic, MicOff, Globe, Sparkles, Box, LogOut, Monitor, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet';
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
import { useState, useEffect } from 'react';
import type { Command } from './voice-commander';
import { useToast } from '@/hooks/use-toast';
import { t } from '@/lib/locales';
import { useAppStore } from '@/lib/store';
import { useVoiceCommanderContext } from './main-layout';
import { useInstall } from '../install-provider';
import Image from 'next/image';
import { useAdminAuth } from '@/hooks/use-admin-auth';

const navLinks = [
  { href: '/dashboard/desktop', label: 'desktop' },
];

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
  const { isAdmin, isRestaurantOwner, isEmployee } = useAdminAuth();
  const dashboardHref = isAdmin ? '/dashboard/admin' : (isRestaurantOwner ? '/dashboard/restaurant' : '/dashboard');
  const { canInstall, triggerInstall } = useInstall();


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
        {!isAdmin && !isRestaurantOwner && !isEmployee && (
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
             <Link href="/dashboard/owner/packs" passHref>
                <DropdownMenuItem>
                    <Box className="mr-2 h-4 w-4" />
                    <span>Manage Packs</span>
                </DropdownMenuItem>
            </Link>
          </>
        )}
        {isAdmin && (
            <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Admin</DropdownMenuLabel>
                 <Link href="/dashboard/owner/orders" passHref>
                    <DropdownMenuItem>
                        <ShoppingBag className="mr-2 h-4 w-4" />
                        <span>Store Orders</span>
                    </DropdownMenuItem>
                </Link>
                 <Link href="/dashboard/owner/packs" passHref>
                    <DropdownMenuItem>
                        <Box className="mr-2 h-4 w-4" />
                        <span>Manage Packs</span>
                    </DropdownMenuItem>
                </Link>
            </>
        )}
        <DropdownMenuSeparator />
        {canInstall && (
          <DropdownMenuItem onClick={triggerInstall}>
            <Download className="mr-2 h-4 w-4" />
            <span>Install App</span>
          </DropdownMenuItem>
        )}
         <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            <span>{t('logout')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface HeaderProps {
  suggestedCommands: Command[];
}

export function Header({ suggestedCommands }: HeaderProps) {
  const pathname = usePathname();
  const { toast } = useToast();
  const [hasMounted, setHasMounted] = useState(false);
  const { voiceEnabled, voiceStatus, onToggleVoice, isCartOpen, onCartOpenChange } = useVoiceCommanderContext();
  const { isRestaurantOwner, isEmployee } = useAdminAuth();


  useEffect(() => {
    setHasMounted(true);
  }, []);

  const handleSuggestionClick = (command: Command) => {
    command.action();
  }

  // Hide the header on the homepage and menu pages
  if (pathname === '/' || pathname.startsWith('/menu/')) {
    return null;
  }

  const showShoppingControls = !isRestaurantOwner && !isEmployee;

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
      <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold md:text-base"
        >
          <Image src="https://i.ibb.co/WpfhKqjW/android-launchericon-512-512.png" alt="Local Basket Logo" width={32} height={32} />
          <span className="font-headline">LocalBasket</span>
        </Link>
        {showShoppingControls && navLinks.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'transition-colors hover:text-foreground',
              pathname === href ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            {t(label)}
          </Link>
        ))}
      </nav>
      {showShoppingControls && (
        <Sheet>
            <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0 md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
            </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col">
            <SheetHeader>
                <SheetTitle>
                    <Link
                        href="/"
                        className="flex items-center gap-2 text-lg font-semibold"
                        >
                        <Image src="https://i.ibb.co/WpfhKqjW/android-launchericon-512-512.png" alt="Local Basket Logo" width={32} height={32} />
                        <span className="font-headline">LocalBasket</span>
                    </Link>
                </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto">
                <nav className="grid gap-4 text-lg font-medium mt-8">
                    {navLinks.map(({ href, label }) => (
                    <SheetClose asChild key={href}>
                        <Link
                            href={href}
                            className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
                            pathname === href && 'text-primary'
                            )}
                        >
                            {label === 'desktop' ? <Monitor className="h-5 w-5" /> : null}
                            {t(label)}
                        </Link>
                    </SheetClose>
                    ))}
                </nav>
            </div>
            </SheetContent>
        </Sheet>
      )}
      
      <div className="flex w-full items-center justify-end gap-2 md:ml-auto md:gap-2 lg:gap-4">
        {showShoppingControls && <LanguageSwitcher />}
        {showShoppingControls && (
            <Button variant={voiceEnabled ? 'secondary' : 'outline'} size="icon" onClick={onToggleVoice} className="relative">
              {voiceEnabled ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              {voiceEnabled && <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>}
              <span className="sr-only">{voiceEnabled ? 'Stop voice commands' : 'Start voice commands'}</span>
            </Button>
        )}
        {showShoppingControls && <CartIcon open={isCartOpen} onOpenChange={onCartOpenChange} />}
        <UserMenu />
      </div>
        {hasMounted && voiceEnabled && showShoppingControls && (
            <>
                <div className="absolute top-16 left-0 w-full bg-secondary text-secondary-foreground text-center py-1 text-sm font-mono z-40">
                    {voiceStatus}
                </div>
                {suggestedCommands.length > 0 && (
                    <div className="absolute top-24 left-1/2 -translate-x-1/2 w-full max-w-md bg-background border rounded-lg shadow-lg z-50 p-2">
                        <p className="text-sm font-semibold text-muted-foreground px-2 pb-2">Did you mean...?</p>
                        <div className="flex flex-col gap-1">
                            {suggestedCommands.map((cmd, index) => (
                                <Button 
                                    key={index}
                                    variant="ghost"
                                    className="justify-start"
                                    onClick={() => handleSuggestionClick(cmd)}
                                >
                                    {cmd.display}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}
            </>
        )}
    </header>
  );
}
