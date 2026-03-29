
'use client';

import Link from 'next/link';
import { UserCircle, LogOut, LayoutDashboard, CheckCircle2, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CartIcon } from '@/components/cart/cart-icon';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { signOut } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { t } from '@/lib/locales';
import { useAppStore } from '@/lib/store';
import Image from 'next/image';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useVoiceCommanderContext } from './voice-commander-context';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

const ADIRES_LOGO = "https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png";

function UserMenu() {
  const { user, isUserLoading, auth } = useFirebase();
  const { isAdmin, isRestaurantOwner } = useAdminAuth();
  const { resetApp } = useAppStore();
  const router = useRouter();
  
  const dashboardHref = isAdmin ? '/dashboard/admin' : (isRestaurantOwner ? '/dashboard/owner/my-store' : '/dashboard');

  const handleLogout = async () => {
    if (auth) {
        await signOut(auth);
        resetApp(); 
        router.push('/login');
    }
  };

  if (isUserLoading) return <Skeleton className="h-7 w-7 rounded-full" />;

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
        <Button variant="secondary" size="icon" className="rounded-full h-8 w-8 border-2 border-primary/10">
          <UserCircle className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl overflow-hidden">
        <DropdownMenuLabel className="font-bold">{t('my-account')}</DropdownMenuLabel>
        <DropdownMenuItem disabled className="text-xs opacity-60">{user.email}</DropdownMenuItem>
        <DropdownMenuSeparator />
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
  const { setCartOpen, isCartOpen, userStore } = useAppStore();
  const { isAdmin, isRestaurantOwner, user } = useAdminAuth();
  const { onToggleVoice, voiceEnabled } = useVoiceCommanderContext();

  const logoUrl = userStore?.imageUrl || ADIRES_LOGO;
  const brandName = userStore?.name || "ADIRES";

  const logoHref = useMemo(() => {
    if (!user) return "/";
    if (isAdmin) return "/dashboard/admin";
    if (isRestaurantOwner) return "/dashboard/owner/my-store";
    return "/dashboard";
  }, [user, isAdmin, isRestaurantOwner]);

  return (
    <header className="sticky top-0 z-50 flex h-10 items-center gap-1 border-b bg-background/90 backdrop-blur px-2">
      <Link href={logoHref} className="flex items-center gap-1 min-w-0">
        <div className="relative w-6 h-6 rounded-full overflow-hidden border bg-white">
          <Image src={logoUrl} alt="Logo" width={24} height={24} className="object-cover w-full h-full" priority />
        </div>
        <div className="flex items-center gap-1 min-w-0 overflow-hidden">
          <span className="font-black text-[10px] truncate uppercase">{brandName}</span>
          {(isAdmin || isRestaurantOwner) && (
            <div className="flex items-center gap-0.5">
              <CheckCircle2 className="h-2 w-2 text-green-600 fill-current" />
              <span className="text-[7px] font-black text-green-600">V</span>
            </div>
          )}
        </div>
      </Link>
      <div className="flex-1" />
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-full", voiceEnabled && "bg-primary text-white animate-pulse")} onClick={onToggleVoice}>
            <Mic className="h-4 w-4" />
        </Button>
        <CartIcon open={isCartOpen} onOpenChange={setCartOpen} />
        <UserMenu />
      </div>
    </header>
  );
}
