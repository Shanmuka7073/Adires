
'use client';
<<<<<<< HEAD

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowRight, ShoppingCart, Store, Truck, Mic } from 'lucide-react';
import Link from 'next/link';
import { t } from '@/lib/locales';
=======
import { Button } from '@/components/ui/button';
import { getStores } from '@/lib/data';
import StoreCard from '@/components/store-card';
import { useFirebase } from '@/firebase';
import { Store } from '@/lib/types';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { t } from '@/lib/locales';


export default function Home() {
  const { firestore } = useFirebase();
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584

const roleCards = [
    {
        title: 'start-shopping',
        description: 'browse-local-stores-and-find-fresh-groceries',
        href: '/stores',
        icon: ShoppingCart,
    },
    {
        title: 'voice-order',
        description: 'record-your-shopping-list-and-have-a-local-shopkeeper-fulfill-it',
        href: '/checkout',
        icon: Mic,
    },
    {
        title: 'store-owner',
        description: 'manage-your-store-products-and-incoming-orders',
        href: '/dashboard/owner/my-store',
        icon: Store,
    },
    {
        title: 'delivery-partner',
        description: 'view-and-accept-available-delivery-jobs',
        href: '/dashboard/delivery/deliveries',
        icon: Truck,
    }
];

<<<<<<< HEAD
export default function DashboardPage() {
    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold font-headline">{t('your-dashboard')}</h1>
                <p className="text-lg text-muted-foreground mt-2">{t('select-your-role-to-access-your-tools')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
                {roleCards.map((card) => (
                     <Link href={card.href} key={card.title} className="block hover:shadow-xl transition-shadow rounded-lg">
                        <Card className="h-full flex flex-col">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-2xl font-bold font-headline">{t(card.title)}</CardTitle>
                                <card.icon className="h-8 w-8 text-primary" />
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col justify-between">
                                <CardDescription>{t(card.description)}</CardDescription>
                                <div className="flex items-center text-primary font-semibold mt-4">
                                    <span>{t('go-to')} {t(card.title)}</span>
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
=======
  const displayedStores = useMemo(() => {
    return allStores.slice(0, 3);
  }, [allStores]);


  return (
    <div className="flex flex-col">
      <section className="w-full py-12 md:py-24 lg:py-32 bg-primary/10">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center space-y-8">
            <div className="space-y-4 text-center">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none font-headline">
                {t('shop-fresh-shop-local-just-by-voice')}
              </h1>
              <p className="max-w-[600px] text-foreground/80 md:text-xl">
                {t('your-hands-free-shopping-assistant')}
              </p>
            </div>
            <div className="w-full max-w-sm space-y-4">
                 <Button asChild>
                    <Link href="/stores">{t('browse-all-stores')}</Link>
                 </Button>
                 <p className="text-sm text-foreground/60 text-center">
                  {t('try-saying-find-bananas')}
                </p>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full py-12 md:py-24 lg:py-32">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl font-headline">
                {t('or-browse-featured-stores')}
              </h2>
              <p className="max-w-[900px] text-foreground/80 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                {t('explore-top-rated-local-stores-right-in-your-neighborhood')}
              </p>
            </div>
          </div>
          <div className="mx-auto grid grid-cols-1 gap-6 py-12 sm:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              <p>{t('loading-stores')}...</p>
            ) : displayedStores.length > 0 ? (
              displayedStores.map((store) => (
                <StoreCard key={store.id} store={store} />
              ))
            ) : (
              <p>{t('no-stores-found')}</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
}
