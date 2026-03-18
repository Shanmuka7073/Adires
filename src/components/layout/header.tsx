
'use client';

import Link from 'next/link';
import { UserCircle, Mic, MicOff, Globe, LogOut, Download } from 'lucide-react';
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
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl">
                    <Globe className="h-4 w-4" />
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
    return <Skeleton className="h-9 w-9 rounded-full" />;
  }

  if (!user) {
    return (
      <Button asChild variant="outline" size="sm" className="rounded-xl">
        <Link href="/login">{t('login')}</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" className="rounded-full h-9 w-9 border-2 border-primary/10">
          <UserCircle className="h-5 w-5" />
          <span className="sr-only">Toggle user menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl">
        <DropdownMenuLabel className="font-bold">{t('my-account')}</DropdownMenuLabel>
        <DropdownMenuItem disabled className="text-xs opacity-60">{user.email}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <Link href={dashboardHref} passHref>
          <DropdownMenuItem className="rounded-lg cursor-pointer">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>{t('dashboard')}</span>
          </DropdownMenuItem>
        </Link>
        <DropdownMenuSeparator />
        {canInstall && (
          <DropdownMenuItem onClick={triggerInstall} className="rounded-lg cursor-pointer">
            <Download className="mr-2 h-4 w-4" />
            <span>Install App</span>
          </DropdownMenuItem>
        )}
         <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:bg-destructive/10 focus:text-destructive rounded-lg cursor-pointer">
            <LogOut className="mr-2 h-4 w-4" />
            <span>{t('logout')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface HeaderProps {
  suggestedCommands?: any[];
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
  
  const logoUrl = userStore?.imageUrl || ADIRES_LOGO;
  const brandName = userStore?.name || "Adires";

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-md px-4 md:px-6">
      {/* Branding Section: Logo and Name (Now always visible) */}
      <Link href={homeHref} className="flex items-center gap-2.5 group shrink-0">
        <div className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-primary/20 bg-white shadow-sm transition-transform group-hover:scale-105 group-active:scale-95">
          <Image src={logoUrl} alt={brandName} fill className="object-cover" priority />
        </div>
        <div className="flex flex-col">
            <span className="font-headline font-black text-gray-950 text-sm leading-none tracking-tight truncate max-w-[100px] md:max-w-[200px] uppercase italic">
                {brandName}
            </span>
            <span className="text-[8px] font-black text-primary uppercase tracking-[0.2em] mt-0.5 opacity-60">Verified Store</span>
        </div>
      </Link>
      
      {/* Navigation Spacer */}
      <div className="flex-1" />

      {/* Control Center: Right aligned icons */}
      <div className="flex items-center gap-1.5 md:gap-3">
        {showShoppingControls && <LanguageSwitcher />}
        {showShoppingControls && (
            <Button 
                variant={voiceEnabled ? 'secondary' : 'outline'} 
                size="icon" 
                onClick={onToggleVoice} 
                className={cn(
                    "relative h-9 w-9 rounded-xl transition-all",
                    voiceEnabled ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "border-2"
                )}
            >
              {voiceEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 opacity-40" />}
              {voiceEnabled && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 border-2 border-white animate-pulse"></span>}
            </Button>
        )}
        {showShoppingControls && <CartIcon open={isCartOpen} onOpenChange={onCartOpenChange} />}
        <UserMenu />
      </div>

      {/* Voice Status Overlay */}
      {hasMounted && voiceEnabled && showShoppingControls && (
          <div className="absolute top-16 left-0 w-full bg-primary text-white text-center py-1 text-[10px] font-black uppercase tracking-widest z-40 shadow-lg">
              {voiceStatus}
          </div>
      )}
    </header>
  );
}
