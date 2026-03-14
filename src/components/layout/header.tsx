
'use client';

import Link from 'next/link';
import { Menu, UserCircle, ShoppingBag, Truck, LayoutDashboard, Mic, MicOff, Globe, LogOut, Monitor, Download } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { t } from '@/lib/locales';
import { useAppStore } from '@/lib/store';
import { useVoiceCommanderContext } from './voice-commander-context';
import { useInstall } from '../install-provider';
import Image from 'next/image';
import { useAdminAuth } from '@/hooks/use-admin-auth';

const ADIRES_LOGO = "https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png";

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
  suggestedCommands: any[];
}

export function Header({ suggestedCommands }: HeaderProps) {
  const pathname = usePathname();
  const [hasMounted, setHasMounted] = useState(false);
  const { voiceEnabled, voiceStatus, onToggleVoice, isCartOpen, onCartOpenChange } = useVoiceCommanderContext();
  const { isAdmin, isRestaurantOwner, isEmployee } = useAdminAuth();
  const { userStore } = useAppStore();

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (pathname.startsWith('/menu/')) return null;

  const showShoppingControls = !isRestaurantOwner && !isEmployee;
  const homeHref = isAdmin ? '/dashboard/admin' : (isRestaurantOwner ? '/dashboard/restaurant' : (isEmployee ? '/dashboard/employee/attendance' : '/'));
  
  // Brand details: show restaurant specifics if available
  const logoUrl = userStore?.imageUrl || ADIRES_LOGO;
  const brandName = userStore?.name || "Adires";

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
      <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
        <Link href={homeHref} className="flex items-center gap-2 text-lg font-semibold md:text-base">
          <div className="relative w-8 h-8 rounded-full overflow-hidden border bg-white shadow-sm">
            <Image src={logoUrl} alt={brandName} fill className="object-cover" />
          </div>
          <span className="font-headline font-bold text-primary">{brandName}</span>
        </Link>
      </nav>
      
      <div className="flex w-full items-center justify-end gap-2 md:ml-auto md:gap-2 lg:gap-4">
        {showShoppingControls && <LanguageSwitcher />}
        {showShoppingControls && (
            <Button variant={voiceEnabled ? 'secondary' : 'outline'} size="icon" onClick={onToggleVoice} className="relative">
              {voiceEnabled ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              {voiceEnabled && <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>}
            </Button>
        )}
        {showShoppingControls && <CartIcon open={isCartOpen} onOpenChange={onCartOpenChange} />}
        <UserMenu />
      </div>
        {hasMounted && voiceEnabled && showShoppingControls && (
            <div className="absolute top-16 left-0 w-full bg-secondary text-secondary-foreground text-center py-1 text-sm font-mono z-40">
                {voiceStatus}
            </div>
        )}
    </header>
  );
}
