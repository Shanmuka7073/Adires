
'use client';

import Link from 'next/link';
import { UserCircle, Globe, LogOut, Download, LayoutDashboard, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CartIcon } from '@/components/cart/cart-icon';
import { usePathname } from 'next/navigation';
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
import { t } from '@/lib/locales';
import { useAppStore } from '@/lib/store';
import { useInstall } from '../install-provider';
import Image from 'next/image';
import { useAdminAuth } from '@/hooks/use-admin-auth';

const ADIRES_LOGO = "https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png";

function GlobalInstallButton() {
    const { canInstall, triggerInstall } = useInstall();
    if (!canInstall) return null;

    return (
        <Button 
            onClick={triggerInstall} 
            variant="default" 
            size="sm" 
            className="rounded-full h-7 px-3 font-black text-[8px] uppercase tracking-widest shadow-md bg-primary text-white border-0 transition-all active:scale-95"
        >
            <Download className="h-3 w-3 mr-1.5" />
            <span className="hidden sm:inline-block">Install</span>
        </Button>
    );
}

function LanguageSwitcher() {
    const { language, setLanguage } = useAppStore();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg border-2">
                    <Globe className="h-3.5 w-3.5" />
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
  const { isAdmin, isRestaurantOwner } = useAdminAuth();
  const dashboardHref = isAdmin ? '/dashboard/admin' : (isRestaurantOwner ? '/dashboard/restaurant' : '/dashboard');
  const { canInstall, triggerInstall } = useInstall();

  const handleLogout = async () => {
    const auth = getAuth();
    await signOut(auth);
  };

  if (isUserLoading) {
    return <Skeleton className="h-7 w-7 rounded-full" />;
  }

  if (!user) {
    return (
      <Button asChild variant="outline" size="sm" className="rounded-lg h-7 px-2 font-black text-[8px] uppercase tracking-widest border-2">
        <Link href="/login">{t('login')}</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" className="rounded-full h-7 w-7 border-2 border-primary/10">
          <UserCircle className="h-4 w-4" />
          <span className="sr-only">Toggle user menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl overflow-hidden">
        <DropdownMenuLabel className="font-bold">{t('my-account')}</DropdownMenuLabel>
        <DropdownMenuItem disabled className="text-xs opacity-60">{user.email}</DropdownMenuItem>
        <DropdownMenuSeparator />
        
        {canInstall && (
          <>
            <DropdownMenuItem 
                onClick={triggerInstall} 
                className="rounded-lg cursor-pointer bg-primary text-white focus:bg-primary/90 focus:text-white font-black uppercase text-[10px] tracking-widest py-3 mb-1 shadow-md flex items-center gap-2"
            >
                <Download className="h-4 w-4" />
                <span>Install Now</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        <Link href={dashboardHref} passHref>
          <DropdownMenuItem className="rounded-lg cursor-pointer">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>{t('dashboard')}</span>
          </DropdownMenuItem>
        </Link>
        
         <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:bg-destructive/10 focus:text-destructive rounded-lg cursor-pointer mt-1">
            <LogOut className="mr-2 h-4 w-4" />
            <span>{t('logout')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header() {
  const pathname = usePathname();
  const { isCartOpen, setCartOpen, userStore } = useAppStore();
  const { isRestaurantOwner, isAdmin } = useAdminAuth();

  if (pathname.startsWith('/menu/')) return null;

  const showShoppingControls = !isRestaurantOwner;
  const homeHref = isAdmin ? '/dashboard/admin' : (isRestaurantOwner ? '/dashboard/restaurant' : '/');
  
  const logoUrl = userStore?.imageUrl || ADIRES_LOGO;
  const brandName = userStore?.name || "ADIRES";

  return (
    <header className="sticky top-0 z-50 flex h-10 items-center gap-2 border-b bg-background/90 backdrop-blur-md px-3">
      <Link href={homeHref} className="flex items-center gap-2 group shrink-0 min-w-0">
        <div className="relative w-7 h-7 rounded-full overflow-hidden border bg-white shrink-0 shadow-sm">
          <Image 
            src={logoUrl} 
            alt="Logo" 
            width={28} 
            height={28} 
            className="object-cover w-full h-full" 
            priority 
          />
        </div>
        <div className="flex items-baseline gap-1.5 min-w-0 overflow-hidden">
            <span className="font-headline font-black text-gray-950 text-xs leading-none tracking-tight truncate uppercase">
                {brandName}
            </span>
            {(isAdmin || isRestaurantOwner) && (
                <div className="flex items-center gap-0.5 opacity-60">
                    <CheckCircle2 className="h-2 w-2 text-green-600 fill-current" />
                    <span className="text-[7px] font-black text-green-600 uppercase tracking-tighter">Verified</span>
                </div>
            )}
        </div>
      </Link>
      
      <div className="flex-1" />

      <div className="flex items-center gap-1.5">
        <GlobalInstallButton />
        {showShoppingControls && <LanguageSwitcher />}
        {showShoppingControls && <CartIcon open={isCartOpen} onOpenChange={setCartOpen} />}
        <UserMenu />
      </div>
    </header>
  );
}
