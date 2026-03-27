
'use client';

import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import type { Booking, Store } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { CalendarCheck, Clock, MapPin, Loader2, Sparkles, History, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

export default function MyBookingsPage() {
    const { firestore, user } = useFirebase();
    const { deviceId, stores, isInitialized } = useAppStore();
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => { setHasMounted(true); }, []);

    const bookingsQuery = useMemoFirebase(() => {
        if (!hasMounted || !firestore || !isInitialized) return null;
        const identifier = user?.uid || deviceId;
        if (!identifier) return null;

        const baseCol = collection(firestore, 'bookings');
        if (user?.uid) {
            return query(baseCol, where('userId', '==', user.uid), orderBy('date', 'desc'), limit(50));
        }
        return query(baseCol, where('deviceId', '==', deviceId), orderBy('date', 'desc'), limit(50));
    }, [hasMounted, firestore, user?.uid, deviceId, isInitialized]);

    const { data: bookings, isLoading } = useCollection<Booking>(bookingsQuery);

    const bookingsWithStores = (bookings || []).map(b => {
        const store = stores.find(s => s.id === b.storeId);
        return { ...b, store };
    });

    if (!hasMounted || isLoading) return <div className="p-12 text-center opacity-20"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>;

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 max-w-2xl space-y-10 pb-32">
            <div className="border-b pb-10 border-black/5">
                <h1 className="text-5xl font-black font-headline tracking-tighter uppercase italic leading-none">My Sessions</h1>
                <p className="text-muted-foreground font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">Beauty & Wellness Itinerary</p>
            </div>

            {bookingsWithStores.length === 0 ? (
                <div className="p-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-black/5 opacity-40">
                    <CalendarCheck className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p className="font-black uppercase tracking-widest text-xs">No upcoming sessions</p>
                    <Button asChild variant="link" className="mt-4"><Link href="/stores?category=salons">Explore Salons</Link></Button>
                </div>
            ) : (
                <div className="space-y-6">
                    {bookingsWithStores.map((booking) => (
                        <Card key={booking.id} className="rounded-[2.5rem] border-0 shadow-lg overflow-hidden bg-white">
                            <div className="p-6 space-y-6">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5">
                                            <Sparkles className="h-3 w-3" /> {booking.serviceName}
                                        </p>
                                        <h3 className="text-xl font-black tracking-tight text-gray-950 uppercase italic leading-none">
                                            {booking.store?.name || 'Authorized Hub'}
                                        </h3>
                                    </div>
                                    <Badge className={cn(
                                        "rounded-md font-black uppercase text-[9px] tracking-widest",
                                        booking.status === 'Completed' ? 'bg-green-500' : 
                                        booking.status === 'Booked' ? 'bg-blue-500' : 
                                        booking.status === 'In Progress' ? 'bg-amber-500' : 'bg-gray-400'
                                    )}>
                                        {booking.status}
                                    </Badge>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 rounded-2xl bg-muted/30 border border-black/5">
                                        <p className="text-[8px] font-black uppercase opacity-40 mb-1">Date & Time</p>
                                        <p className="text-sm font-black text-gray-900 leading-tight">
                                            {format(new Date(booking.date), 'dd MMM')} • {booking.time}
                                        </p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-muted/30 border border-black/5">
                                        <p className="text-[8px] font-black uppercase opacity-40 mb-1">Service Cost</p>
                                        <p className="text-sm font-black text-primary leading-tight">₹{booking.price}</p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between border-t border-dashed pt-4">
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500">
                                        <MapPin className="h-3.5 w-3.5 text-primary" />
                                        <span className="truncate max-w-[150px] uppercase tracking-tighter">{booking.store?.address}</span>
                                    </div>
                                    <Button asChild variant="ghost" size="sm" className="h-8 rounded-xl font-black uppercase text-[8px] tracking-widest hover:bg-black/5">
                                        <Link href={`/menu/${booking.storeId}`}>Re-Visit Hub <ArrowRight className="ml-1 h-3 w-3" /></Link>
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
