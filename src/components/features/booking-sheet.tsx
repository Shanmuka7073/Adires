
'use client';

import { useState, useEffect, useTransition } from 'react';
import { SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar as CalendarIcon, Clock, User, Phone, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react';
import { format, addDays, startOfDay } from 'date-fns';
import { getAvailableSlots, createBooking } from '@/app/actions';
import { useFirebase } from '@/firebase';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { MenuItem, Store } from '@/lib/types';

interface BookingSheetProps {
    store: Store;
    service: MenuItem;
    onComplete: () => void;
}

export function BookingSheet({ store, service, onComplete }: BookingSheetProps) {
    const { user } = useFirebase();
    const { deviceId } = useAppStore();
    const { toast } = useToast();
    
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [slots, setSlots] = useState<{time: string, label: string, available: boolean}[]>([]);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [isLoadingSlots, startLoadingSlots] = useTransition();
    const [isBooking, startBooking] = useTransition();
    
    const [customerName, setCustomerName] = useState('');
    const [phone, setPhone] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        const fetchSlots = async () => {
            startLoadingSlots(async () => {
                const res = await getAvailableSlots(store.id, format(selectedDate, 'yyyy-MM-dd'), service.duration || 30);
                if (res.success) {
                    setSlots(res.slots || []);
                } else {
                    console.error("Failed to fetch slots:", res.error);
                    setSlots([]);
                }
            });
        };
        fetchSlots();
    }, [selectedDate, store.id, service.duration]);

    const handleConfirmBooking = () => {
        if (!selectedTime || !customerName || !phone) return;

        startBooking(async () => {
            const res = await createBooking({
                storeId: store.id,
                userId: user?.uid || 'guest',
                deviceId: deviceId || undefined,
                serviceId: service.id,
                serviceName: service.name,
                price: service.price,
                duration: service.duration || 30,
                customerName,
                phone,
                notes,
                date: format(selectedDate, 'yyyy-MM-dd'),
                time: selectedTime,
            });

            if (res.success) {
                toast({ title: "Appointment Confirmed!", description: `${service.name} at ${selectedTime}` });
                onComplete();
            } else {
                toast({ variant: 'destructive', title: "Booking Failed", description: res.error });
            }
        });
    };

    return (
        <SheetContent side="bottom" className="h-[90vh] rounded-t-[3rem] p-0 border-0 overflow-hidden flex flex-col bg-[#FDFCF7]">
            <SheetHeader className="p-6 pb-2 shrink-0 bg-white border-b">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                        <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                        <SheetTitle className="text-xl font-black uppercase tracking-tight">Reserve Session</SheetTitle>
                        <SheetDescription className="font-bold text-[10px] uppercase opacity-40">
                            {service.name} • ₹{service.price} • {service.duration || 30} mins
                        </SheetDescription>
                    </div>
                </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">
                {/* 1. DATE SELECTION */}
                <section className="space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40 px-1 flex items-center gap-2">
                        <CalendarIcon className="h-3 w-3" /> Select Visit Date
                    </h4>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                        {[0, 1, 2, 3, 4, 5, 6].map(offset => {
                            const date = addDays(new Date(), offset);
                            const isSelected = format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                            return (
                                <button
                                    key={offset}
                                    onClick={() => {
                                        setSelectedDate(date);
                                        setSelectedTime(null); // Reset time when date changes
                                    }}
                                    className={cn(
                                        "flex flex-col items-center justify-center min-w-[70px] h-20 rounded-2xl border-2 transition-all shrink-0",
                                        isSelected ? "bg-primary border-primary text-white shadow-lg" : "bg-white border-black/5 text-gray-500"
                                    )}
                                >
                                    <span className="text-[9px] font-black uppercase opacity-60">{format(date, 'EEE')}</span>
                                    <span className="text-lg font-black">{format(date, 'dd')}</span>
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* 2. TIME SLOTS */}
                <section className="space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40 px-1 flex items-center gap-2">
                        <Clock className="h-3 w-3" /> Available Times
                    </h4>
                    {isLoadingSlots ? (
                        <div className="flex justify-center p-8 opacity-20"><Loader2 className="animate-spin h-6 w-6" /></div>
                    ) : slots.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2">
                            {slots.map(slot => (
                                <button
                                    key={slot.time}
                                    disabled={!slot.available}
                                    onClick={() => setSelectedTime(slot.time)}
                                    className={cn(
                                        "h-11 rounded-xl font-black text-[10px] uppercase tracking-tighter border-2 transition-all",
                                        selectedTime === slot.time ? "bg-gray-950 border-gray-950 text-white shadow-md scale-105" : 
                                        slot.available ? "bg-white border-black/5 text-gray-950 hover:border-primary" : "opacity-20 grayscale bg-muted cursor-not-allowed"
                                    )}
                                >
                                    {slot.label}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="p-10 text-center rounded-2xl bg-white border-2 border-dashed border-black/5 flex flex-col items-center">
                            <AlertCircle className="h-8 w-8 text-amber-500 mb-2 opacity-40" />
                            <p className="text-[10px] font-black uppercase opacity-40 tracking-widest">No slots found for this schedule</p>
                        </div>
                    )}
                </section>

                {/* 3. CONTACT INFO */}
                <section className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40 px-1">Your Details</h4>
                    <div className="space-y-3">
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-20" />
                            <Input placeholder="Full Name" value={customerName} onChange={e => setCustomerName(e.target.value)} className="rounded-xl h-12 border-2 pl-10 font-bold" />
                        </div>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-20" />
                            <Input placeholder="Mobile Number" type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="rounded-xl h-12 border-2 pl-10 font-bold" />
                        </div>
                        <textarea 
                            placeholder="Special requests (optional)..." 
                            value={notes} 
                            onChange={e => setNotes(e.target.value)}
                            className="w-full rounded-2xl border-2 p-4 text-xs font-bold bg-white min-h-[80px] focus:outline-none focus:border-primary transition-colors"
                        />
                    </div>
                </section>
            </div>

            <SheetFooter className="p-6 border-t bg-white shrink-0 pb-10 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">
                <Button 
                    onClick={handleConfirmBooking}
                    disabled={!selectedTime || !customerName || !phone || isBooking}
                    className={cn(
                        "w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl transition-all active:scale-95",
                        selectedTime ? "bg-primary text-white shadow-primary/20" : "bg-muted text-muted-foreground shadow-none"
                    )}
                >
                    {isBooking ? (
                        <><Loader2 className="animate-spin h-4 w-4 mr-2" /> Processing...</>
                    ) : (
                        <><CheckCircle2 className="h-4 w-4 mr-2" /> {selectedTime ? 'Confirm Booking' : 'Select a time slot'}</>
                    )}
                </Button>
            </SheetFooter>
        </SheetContent>
    );
}
