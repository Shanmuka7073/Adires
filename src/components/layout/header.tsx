
'use client';

import Link from 'next/link';
import { Package2, Menu, UserCircle, Store, ShoppingBag, Truck, LayoutDashboard, Mic, MicOff, Globe, Sparkles, Box } from 'lucide-react';
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
import { Command } from './voice-commander';
import { useToast } from '@/hooks/use-toast';
import { t } from '@/lib/locales';
import { useAppStore } from '@/lib/store';

const ADMIN_EMAIL = 'admin@gmail.com';

const navLinks = [
  { href: '/', label: 'home' },
];

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
        <DropdownMenuItem onClick={handleLogout}>{t('logout')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface HeaderProps {
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  voiceStatus: string;
  suggestedCommands: Command[];
  isCartOpen: boolean;
  onCartOpenChange: (open: boolean) => void;
}

export function Header({ voiceEnabled, onToggleVoice, voiceStatus, suggestedCommands, isCartOpen, onCartOpenChange }: HeaderProps) {
  const pathname = usePathname();
  const { user, isUserLoading } = useFirebase();
  const { toast } = useToast();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const handleToggleVoiceWithCheck = () => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Login Required',
        description: 'You must be logged in to use voice commands.',
      });
      return;
    }
    onToggleVoice();
  };
  
  const handleSuggestionClick = (command: Command) => {
    command.action();
  }

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
      <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
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
              'transition-colors hover:text-foreground',
              pathname === href ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            {t(label)}
          </Link>
        ))}
      </nav>
      
      <div className="flex w-full items-center justify-end gap-2 md:ml-auto md:gap-2 lg:gap-4">
        <LanguageSwitcher />
        <Button variant={voiceEnabled ? 'secondary' : 'outline'} size="icon" onClick={handleToggleVoiceWithCheck} className="relative">
          {voiceEnabled ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          {voiceEnabled && <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>}
          <span className="sr-only">{voiceEnabled ? 'Stop voice commands' : 'Start voice commands'}</span>
        </Button>
        <CartIcon open={isCartOpen} onOpenChange={onCartOpenChange} />
        <UserMenu />
      </div>
        {hasMounted && voiceEnabled && (
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
