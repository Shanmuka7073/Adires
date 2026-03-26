
'use client';

import { useState, useMemo, useTransition, useEffect } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import type { Booking, Store } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, isToday } from 'date-fns';
import { 
    CalendarCheck, 
    CheckCircle2, 
    Clock, 
    User, 
    Phone, 
    TrendingUp, 
    ArrowRight, 
    Loader2, 
    Scissors,
    AlertCircle,
    XCircle,
    PlayCircle,
    RefreshCw
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { updateBookingStatus } from '@/app/actions';

function BookingActionRow({ booking, onUpdate }: { booking: Booking, onUpdate: () => void }) {
    const [isUpdating, startUpdate] = useTransition();

    const handleAction = (status: Booking['status']) => {
        startUpdate(async () => {
            const res = await updateBookingStatus(booking.id, status);
            if (res.success) {
                onUpdate();
            }
        });
    };

    return (
        <TableRow className={cn("hover:bg-muted/30 transition-colors", booking.status === 'Completed' && "opacity-50")}>
            <TableCell className="py-6">
                <p className="font-black text-xs uppercase text-gray-950">{booking.customerName}</p>
                <p className="text-[10px] font-bold opacity-40 uppercase tracking-tighter">{booking.serviceName}</p>
            </TableCell>
            <TableCell>
                <p className="font-black text-xs uppercase text-primary leading-none">{booking.time}</p>
                <p className="text-[8px] font-bold opacity-40 uppercase mt-1">{format(new Date(booking.date), 'dd MMM')}</p>
            </TableCell>
            <TableCell>
                <Badge className={cn(
                    "text-[8px] font-black uppercase h-5",
                    booking.status === 'Completed' ? 'bg-green-500' : 
                    booking.status === 'In Progress' ? 'bg-amber-500 animate-pulse' : 
                    booking.status === 'Booked' ? 'bg-blue-500' : 'bg-gray-400'
                )}>{booking.status}</Badge>
            </TableCell>
            <TableCell className="text-right pr-6">
                <div className="flex justify-end gap-1">
                    {booking.status === 'Booked' && (
                        <button onClick={() => handleAction('In Progress')} disabled={isUpdating} className="h-8 w-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center hover:bg-amber-200 transition-all">
                            {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                        </button>
                    )}
                    {booking.status === 'In Progress' && (
                        <button onClick={() => handleAction('Completed')} disabled={isUpdating} className="h-8 w-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-200 transition-all">
                            {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        </button>
                    )}
                    {booking.status !== 'Completed' && booking.status !== 'Cancelled' && (
                        <button onClick={() => handleAction('Cancelled')} disabled={isUpdating} className="h-8 w-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center hover:bg-red-200 transition-all">
                            <XCircle className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </TableCell>
        </TableRow>
    );
}

export default function SalonBookingsPage() {
    const { firestore, user } = useFirebase();
    const { userStore, stores, fetchInitialData, isInitialized } = useAppStore();
    const { toast } = useToast();
    const [filter, setFilter] = useState<'all' | 'booked' | 'active' | 'completed'>('all');

    useEffect(() => {
        if (firestore && !isInitialized) fetchInitialData(firestore, user?.uid);
    }, [firestore, isInitialized, fetchInitialData, user?.uid]);

    const myStore = useMemo(() => userStore || stores.find(s => s.ownerId === user?.uid) || null, [userStore, stores, user?.uid]);

    const bookingsQuery = useMemoFirebase(() => {
        if (!firestore || !myStore) return null;
        return query(
            collection(firestore, 'bookings'),
            where('storeId', '==', myStore.id),
            orderBy('date', 'desc'),
            orderBy('time', 'desc'),
            limit(100)
        );
    }, [firestore, myStore]);

    const { data: bookings, isLoading, refetch } = useCollection<Booking>(bookingsQuery);

    const stats = useMemo(() => {
        if (!bookings) return { today: 0, revenue: 0, total: 0 };
        const todayBookings = bookings.filter(b => isToday(new Date(b.date)));
        const completedRevenue = bookings.filter(b => b.status === 'Completed').reduce((acc, b) => acc + b.price, 0);
        return {
            today: todayBookings.length,
            revenue: completedRevenue,
            total: bookings.length
        };
    }, [bookings]);

    const filteredBookings = useMemo(() => {
        if (!bookings) return [];
        if (filter === 'all') return bookings;
        if (filter === 'booked') return bookings.filter(b => b.status === 'Booked');
        if (filter === 'active') return bookings.filter(b => b.status === 'In Progress');
        if (filter === 'completed') return bookings.filter(b => b.status === 'Completed');
        return bookings;
    }, [bookings, filter]);

    if (!myStore) return <div className="p-12 text-center opacity-20"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>;

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 space-y-12 pb-32 animate-in fade-in duration-500">
            <div className="flex justify-between items-end border-b pb-10 border-black/5">
                <div>
                    <h1 className="text-5xl font-black font-headline tracking-tighter uppercase italic leading-none">Salon Pulse</h1>
                    <p className="text-muted-foreground font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">{myStore.name} • Appointment Hub</p>
                </div>
                <button onClick={() => refetch()} className="h-10 w-10 rounded-full border-2 border-black/5 flex items-center justify-center active:scale-90 transition-all">
                    <RefreshCw className={cn("h-4 w-4 opacity-40", isLoading && "animate-spin")} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="rounded-[2rem] border-0 shadow-lg bg-white overflow-hidden">
                    <div className="p-6 space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Revenue (Closed)</p>
                        <p className="text-4xl font-black tracking-tighter text-primary italic">₹{stats.revenue.toFixed(0)}</p>
                    </div>
                </Card>
                <Card className="rounded-[2rem] border-0 shadow-lg bg-white overflow-hidden">
                    <div className="p-6 space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Today's Sessions</p>
                        <p className="text-4xl font-black tracking-tighter text-gray-950 italic">{stats.today}</p>
                    </div>
                </Card>
                <Card className="rounded-[2rem] border-0 shadow-lg bg-white overflow-hidden">
                    <div className="p-6 space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Total Pipeline</p>
                        <p className="text-4xl font-black tracking-tighter text-blue-600 italic">{stats.total}</p>
                    </div>
                </Card>
            </div>

            <section className="space-y-6">
                <div className="flex gap-2 overflow-x-auto no-scrollbar px-1">
                    {[
                        { k: 'all', l: 'All Jobs' },
                        { k: 'booked', l: 'Upcoming' },
                        { k: 'active', l: 'In Chair' },
                        { k: 'completed', l: 'Finished' }
                    ].map(f => (
                        <button 
                            key={f.k}
                            onClick={() => setFilter(f.k as any)}
                            className={cn(
                                "px-6 h-10 rounded-xl font-black text-[10px] uppercase tracking-widest border-2 transition-all shrink-0",
                                filter === f.k ? "bg-gray-950 border-gray-950 text-white shadow-lg" : "bg-white border-black/5 text-gray-400"
                            )}
                        >
                            {f.l}
                        </button>
                    ))}
                </div>

                <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden bg-white">
                    {isLoading ? (
                        <div className="p-20 text-center opacity-20"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>
                    ) : filteredBookings.length === 0 ? (
                        <div className="p-32 text-center opacity-30">
                            <CalendarCheck className="h-16 w-16 mx-auto mb-4 opacity-20" />
                            <p className="font-black uppercase tracking-widest text-[10px]">Zero matches in this view</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader className="bg-black/5">
                                <TableRow>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40 pl-6">Client / Service</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Appointment</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Status</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest opacity-40 pr-6">Ops</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredBookings.map(b => (
                                    <BookingActionRow key={b.id} booking={b} onUpdate={() => refetch && refetch()} />
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </Card>
            </section>
        </div>
    );
}
