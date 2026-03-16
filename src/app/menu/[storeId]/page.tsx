
'use client';

import { useFirebase, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection,
  query,
  where,
  doc,
  setDoc,
  updateDoc,
  limit,
  Timestamp,
} from 'firebase/firestore';

import type {
  Store,
  Menu,
  MenuItem,
  Order,
  OrderItem,
  MenuTheme,
  GetIngredientsOutput,
  Product,
} from '@/lib/types';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { format, addDays, isSameDay, isToday, isAfter, set } from 'date-fns';

import {
  Utensils,
  Plus,
  Receipt,
  Loader2,
  Check,
  Clock,
  Search,
  X,
  Download,
  Eye,
  Home,
  MapPin,
  Save,
  Video,
  Truck,
  CheckCircle,
  PlusCircle,
  LocateFixed,
  Trash2,
  Smartphone,
  Zap,
  CreditCard,
  QrCode,
  Info,
  CalendarDays,
  AlertTriangle,
  ArrowLeft,
  Store as StoreIcon,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { addRestaurantOrderItem, confirmOrderSession, getIngredientsForDish } from '@/app/actions';
import { useInstall } from '@/components/install-provider';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import IngredientsDialog from '@/components/IngredientsDialog';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import QRCode from 'qrcode.react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ProductCard from '@/components/product-card';
import { useAppStore } from '@/lib/store';

const ADIRES_LOGO = "https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png";

function toDateSafe(d: any): Date {
    if (!d) return new Date();
    if (d instanceof Date) return d;
    if (d instanceof Timestamp) return d.toDate();
    if (typeof d === 'string') return new Date(d);
    if (typeof d === 'object' && d.seconds) return new Date(d.seconds * 1000);
    return new Date();
}

function DateScroller({ value, onChange, theme }: { value: Date, onChange: (val: Date) => void, theme: MenuTheme | undefined }) {
    const dates = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));
    }, []);

    return (
        <ScrollArea className="w-full whitespace-nowrap pb-2">
            <div className="flex gap-3 px-1">
                {dates.map((date) => {
                    const isSelected = isSameDay(date, value);
                    return (
                        <button
                            key={date.toISOString()}
                            onClick={() => onChange(date)}
                            className={cn(
                                "flex flex-col items-center justify-center min-w-[64px] h-20 rounded-2xl border-2 transition-all duration-200",
                                isSelected ? "shadow-lg scale-105" : "opacity-40"
                            )}
                            style={{ 
                                backgroundColor: isSelected ? theme?.primaryColor : 'transparent',
                                borderColor: theme?.primaryColor + (isSelected ? '' : '20'),
                                color: isSelected ? theme?.backgroundColor : theme?.textColor
                            }}
                        >
                            <span className="text-[10px] font-black uppercase tracking-widest">{format(date, 'EEE')}</span>
                            <span className="text-xl font-black">{format(date, 'dd')}</span>
                        </button>
                    );
                })}
            </div>
            <ScrollBar orientation="horizontal" className="opacity-0" />
        </ScrollArea>
    );
}

function TimePicker({ value, onChange, theme }: { value: string, onChange: (val: string) => void, theme: MenuTheme | undefined }) {
    const [h, m, p] = useMemo(() => {
        if (!value) return ["10", "00", "AM"];
        const match = value.match(/(\d+):(\d+)\s*(AM|PM)/i);
        return match ? [match[1], match[2], match[3].toUpperCase()] : ["10", "00", "AM"];
    }, [value]);

    const update = (newH: string, newM: string, newP: string) => {
        onChange(`${newH}:${newM} ${newP}`);
    };

    const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
    const minutes = ["00", "15", "30", "45"];

    return (
        <div className="flex items-center justify-center gap-3 py-2">
            <div className="flex flex-col items-center gap-1.5">
                <p className="text-[8px] font-black uppercase opacity-40" style={{ color: theme?.textColor }}>Hour</p>
                <Select value={h} onValueChange={(v) => update(v, m, p)}>
                    <SelectTrigger className="w-20 h-14 rounded-xl border-2 text-xl font-black bg-black/5" style={{ borderColor: theme?.primaryColor + '40', color: theme?.textColor }}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {hours.map(hr => <SelectItem key={hr} value={hr}>{hr}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <span className="text-2xl font-black mt-5" style={{ color: theme?.textColor }}>:</span>
            <div className="flex flex-col items-center gap-1.5">
                <p className="text-[8px] font-black uppercase opacity-40" style={{ color: theme?.textColor }}>Min</p>
                <Select value={m} onValueChange={(v) => update(h, v, p)}>
                    <SelectTrigger className="w-20 h-14 rounded-xl border-2 text-xl font-black bg-black/5" style={{ borderColor: theme?.primaryColor + '40', color: theme?.textColor }}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {minutes.map(min => <SelectItem key={min} value={min}>{min}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex flex-col items-center gap-1.5 ml-2">
                <p className="text-[8px] font-black uppercase opacity-40" style={{ color: theme?.textColor }}>Period</p>
                <div className="flex border-2 rounded-xl overflow-hidden h-14 bg-black/5" style={{ borderColor: theme?.primaryColor + '40' }}>
                    <button 
                        className={cn("px-4 text-xs font-black transition-all", p === 'AM' ? "shadow-inner" : "opacity-30")}
                        style={{ backgroundColor: p === 'AM' ? theme?.primaryColor : 'transparent', color: p === 'AM' ? theme?.backgroundColor : theme?.textColor }}
                        onClick={() => update(h, m, 'AM')}
                    >AM</button>
                    <button 
                        className={cn("px-4 text-xs font-black transition-all", p === 'PM' ? "shadow-inner" : "opacity-30")}
                        style={{ backgroundColor: p === 'PM' ? theme?.primaryColor : 'transparent', color: p === 'PM' ? theme?.backgroundColor : theme?.textColor }}
                        onClick={() => update(h, m, 'PM')}
                    >PM</button>
                </div>
            </div>
        </div>
    );
}

function UPIPaymentDialog({ isOpen, onOpenChange, order, store, theme }: { isOpen: boolean; onOpenChange: (open: boolean) => void; order: Order; store: Store; theme: MenuTheme | undefined; }) {
    if (!store.upiId) return null;
    const itemsSummary = order.items.map(it => `${it.productName}(${it.quantity})`).join(', ');
    const rawNote = `${store.name}: ${itemsSummary} | Total: ₹${order.totalAmount.toFixed(0)}`;
    const finalNote = rawNote.length > 80 ? rawNote.substring(0, 77) + "..." : rawNote;
    const upiUrl = `upi://pay?pa=${encodeURIComponent(store.upiId)}&pn=${encodeURIComponent(store.name)}&am=${order.totalAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(finalNote)}`;
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-[2.5rem] border-0 shadow-2xl p-8 flex flex-col items-center text-center max-w-sm mx-auto" style={{ backgroundColor: theme?.backgroundColor }}>
                <DialogHeader className="mb-4">
                    <DialogTitle className="text-xl font-black uppercase tracking-tight" style={{ color: theme?.primaryColor }}>Pay Bill</DialogTitle>
                    <DialogDescription style={{ color: theme?.textColor, opacity: 0.6 }}>Choose your preferred payment method.</DialogDescription>
                </DialogHeader>
                <div className="p-6 bg-white rounded-[2.5rem] shadow-inner border-4 border-black/5 mb-6">
                    <QRCode value={upiUrl} size={180} level="H" includeMargin={true} />
                    <p className="mt-4 text-[10px] font-black uppercase tracking-widest opacity-40">Scan QR to Pay</p>
                </div>
                <div className="w-full space-y-4">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black opacity-40 uppercase tracking-widest" style={{ color: theme?.textColor }}>Amount to Pay</p>
                        <p className="text-4xl font-black" style={{ color: theme?.primaryColor }}>₹{order.totalAmount.toFixed(2)}</p>
                    </div>
                    <Button onClick={() => window.location.href = upiUrl} className="w-full h-14 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 flex items-center justify-center gap-3" style={{ backgroundColor: theme?.primaryColor, color: theme?.backgroundColor }}>
                        <Smartphone className="h-5 w-5" /> Pay via UPI App
                    </Button>
                    <Alert className="bg-primary/5 border-primary/10 rounded-2xl text-left">
                        <Info className="h-4 w-4" style={{ color: theme?.primaryColor }} />
                        <AlertDescription className="text-[9px] font-bold leading-tight" style={{ color: theme?.textColor }}>After payment, show the confirmation to staff.</AlertDescription>
                    </Alert>
                    <Button variant="ghost" className="w-full font-bold opacity-40" onClick={() => onOpenChange(false)}>Close</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function DeliveryDetailsDialog({ isOpen, onOpenChange, onSave, initialData, theme }: { isOpen: boolean; onOpenChange: (open: boolean) => void; onSave: (data: { name: string, phone: string, address: string, lat?: number, lng?: number }) => void; initialData: { name: string, phone: string, address: string }; theme: MenuTheme | undefined; }) {
    const [name, setName] = useState(initialData.name);
    const [phone, setPhone] = useState(initialData.phone);
    const [address, setAddress] = useState(initialData.address);
    const [coords, setCoords] = useState<{lat: number, lng: number} | null>(null);
    const [isLocating, setIsLocating] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (isOpen) {
            setName(initialData.name);
            setPhone(initialData.phone);
            setAddress(initialData.address);
        }
    }, [isOpen, initialData]);

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            toast({ variant: 'destructive', title: 'Not Supported', description: 'Geolocation is not supported by your browser.' });
            return;
        }
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                setCoords({ lat: latitude, lng: longitude });
                setAddress(`GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
                setIsLocating(false);
                toast({ title: 'Location Captured!', description: 'Your current location has been set as the delivery address.' });
            },
            (err) => {
                console.error("GPS Capture failed", err);
                setIsLocating(false);
                toast({ variant: 'destructive', title: 'Location Error', description: 'Could not retrieve your location. Please check your browser permissions.' });
            },
            { timeout: 10000 }
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-[2rem] border-0 shadow-2xl p-6" style={{ backgroundColor: theme?.backgroundColor }}>
                <DialogHeader className="mb-4">
                    <DialogTitle className="text-xl font-black uppercase tracking-tight" style={{ color: theme?.primaryColor }}>Your Details</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-black opacity-40 ml-1">Your Name</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" className="rounded-xl h-12 border-2" style={{ borderColor: theme?.primaryColor + '20' }} />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-black opacity-40 ml-1">Phone</Label>
                        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile Number" className="rounded-xl h-12 border-2" style={{ borderColor: theme?.primaryColor + '20' }} />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-black opacity-40 ml-1">Address (For Delivery Only)</Label>
                        <div className="flex gap-2">
                            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House No, Street..." className="rounded-xl h-12 border-2 flex-1" style={{ borderColor: theme?.primaryColor + '20' }} />
                            <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl" onClick={handleGetLocation} disabled={isLocating}>
                                {isLocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                </div>
                <DialogFooter className="pt-4">
                    <Button disabled={!name.trim() || !phone.trim() || isLocating} onClick={() => { onSave({ name, phone, address, lat: coords?.lat, lng: coords?.lng }); onOpenChange(false); }} className="w-full h-14 rounded-2xl uppercase font-black tracking-widest text-xs" style={{ backgroundColor: theme?.primaryColor, color: theme?.backgroundColor }}>
                        Confirm & Start
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ModeSelectionDialog({ isOpen, onOpenChange, onSelectMode, currentMode, theme, isSalon }: { isOpen: boolean; onOpenChange: (open: boolean) => void; onSelectMode: (mode: 'table' | 'delivery', value?: string) => void; currentMode: 'table' | 'delivery'; theme: MenuTheme | undefined; isSalon: boolean; }) {
    const [tableVal, setTableVal] = useState('');
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-[2rem] border-0 shadow-2xl p-6" style={{ backgroundColor: theme?.backgroundColor }}>
                <DialogHeader><DialogTitle className="text-xl uppercase font-black" style={{ color: theme?.primaryColor }}>{isSalon ? 'Service Type' : 'Order Mode'}</DialogTitle></DialogHeader>
                <div className="grid gap-4">
                    <Button variant={currentMode === 'delivery' ? 'default' : 'outline'} className="h-20 rounded-2xl flex flex-col border-2" style={{ backgroundColor: currentMode === 'delivery' ? theme?.primaryColor : 'transparent', color: currentMode === 'delivery' ? theme?.backgroundColor : theme?.primaryColor, borderColor: theme?.primaryColor }} onClick={() => { onSelectMode('delivery'); onOpenChange(false); }}>
                        <div className="flex items-center gap-2 font-black text-xs uppercase"><Truck className="h-4 w-4"/> {isSalon ? 'Home Service' : 'Home Delivery'}</div>
                    </Button>
                    <div className="relative py-2"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-black/5" /></div><div className="relative flex justify-center text-[8px] font-black uppercase"><span className="bg-white px-2" style={{ backgroundColor: theme?.backgroundColor }}>Or</span></div></div>
                    <div className="space-y-3">
                        <Label className="text-[10px] uppercase font-black opacity-40 ml-1">{isSalon ? 'At Salon' : 'Dine-in Table No.'}</Label>
                        <div className="flex gap-2"><Input placeholder={isSalon ? "Chair No. (Optional)" : "Table No."} value={tableVal} onChange={(e) => setTableVal(e.target.value)} className="rounded-xl h-12 border-2 text-center" style={{ borderColor: theme?.primaryColor + '20' }} /><Button disabled={!isSalon && !tableVal.trim()} onClick={() => { onSelectMode('table', tableVal); onOpenChange(false); }} className="h-12 rounded-xl px-6 font-black uppercase text-[10px]" style={{ backgroundColor: theme?.primaryColor, color: theme?.backgroundColor }}>Set</Button></div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function LiveBillSheet({ orderId, theme, store, onShowUpi, isSalon }: { orderId: string; theme: MenuTheme | undefined; store: Store; onShowUpi: () => void; isSalon: boolean }) {
  const { firestore } = useFirebase(); const { toast } = useToast(); const [closing, startClose] = useTransition();
  const { data: order, isLoading } = useDoc<Order>(useMemoFirebase(() => (firestore ? doc(firestore, 'orders', orderId) : null), [firestore, orderId]));
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>("10:00 AM");

  const isPastTime = useMemo(() => {
    if (!isSalon) return false;
    if (!isToday(selectedDate)) return false;
    const match = selectedTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return false;
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const period = match[3].toUpperCase();
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    const appointmentDateTime = set(selectedDate, { hours, minutes, seconds: 0, milliseconds: 0 });
    return !isAfter(appointmentDateTime, new Date());
  }, [selectedDate, selectedTime, isSalon]);

  const closeBill = async () => { 
    if (!order) return; 
    startClose(async () => { 
        const result = await confirmOrderSession(order.id); 
        if (result.success) {
            if (isSalon) {
                const finalTimeStr = `${format(selectedDate, 'MMM dd, yyyy')} at ${selectedTime}`;
                await updateDoc(doc(firestore!, 'orders', order.id), { appointmentTime: finalTimeStr });
            }
            toast({ title: order.status === 'Draft' ? (isSalon ? 'Booking Confirmed!' : 'Order Placed!') : 'Bill requested.' }); 
        }
    }); 
  };

  const handleRemoveItem = async (itemToRemove: OrderItem) => {
      if (!firestore || !order) return;
      const orderRef = doc(firestore, 'orders', order.id);
      const updatedItems = (order.items || []).filter(item => item.id !== itemToRemove.id);
      if (updatedItems.length === 0) { try { await deleteDoc(orderRef); } catch (e) {} return; }
      try { await updateDoc(orderRef, { items: updatedItems, totalAmount: updatedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0) }); } catch (e) {}
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8" /></div>;
  if (!order || !order.items?.length) return <div className="p-8 text-center"><p className="opacity-60 text-sm font-medium">Your {isSalon ? 'booking' : 'bill'} is empty.</p></div>;
  
  const isDraft = order.status === 'Draft'; 
  const isLocked = ['Pending', 'Processing', 'Out for Delivery', 'Billed'].includes(order.status);
  const isFinalized = ['Completed', 'Delivered'].includes(order.status);
  
  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: theme?.backgroundColor }}>
        <SheetHeader className='p-5 border-b' style={{ borderColor: theme?.primaryColor + '20' }}><SheetTitle className="flex items-center gap-2 text-lg font-bold" style={{ color: theme?.primaryColor }}><Receipt className="h-5 w-5" /> {isSalon ? 'Appointment Summary' : 'Live Bill'}</SheetTitle></SheetHeader>
        <div className="flex-1 overflow-y-auto p-5 space-y-8">
             {isSalon && (
                 <div className="space-y-6">
                    <div className="space-y-3">
                        <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40" style={{ color: theme?.textColor || '#fff' }}>Select Date</h4>
                        {isDraft ? (
                            <DateScroller value={selectedDate} onChange={setSelectedDate} theme={theme} />
                        ) : (
                            <div className="p-4 rounded-2xl border-2 bg-primary/5 flex items-center justify-between" style={{ borderColor: theme?.primaryColor + '30' }}>
                                <div>
                                    <p className="text-[8px] font-black uppercase opacity-40 mb-0.5" style={{ color: theme?.textColor || '#fff' }}>Appointment Date</p>
                                    <p className="text-lg font-black" style={{ color: theme?.primaryColor }}>{format(toDateSafe(order.orderDate), 'PPP')}</p>
                                </div>
                                <CalendarDays className="h-6 w-6" style={{ color: theme?.primaryColor }} />
                            </div>
                        )}
                    </div>
                    <div className="space-y-3">
                        <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40" style={{ color: theme?.textColor || '#fff' }}>{isDraft ? 'Select Time' : 'Confirmed Arrival'}</h4>
                        {isDraft ? (
                            <>
                                <TimePicker value={selectedTime} onChange={setSelectedTime} theme={theme} />
                                {isPastTime && (
                                    <Alert variant="destructive" className="rounded-xl border-2 py-2">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle className="text-xs font-black uppercase">Time Already Passed</AlertTitle>
                                        <AlertDescription className="text-[10px]">Please select a future time slot.</AlertDescription>
                                    </Alert>
                                )}
                            </>
                        ) : order.appointmentTime ? (
                            <div className="p-4 rounded-2xl border-2 bg-primary/5 flex items-center justify-between" style={{ borderColor: theme?.primaryColor + '30' }}>
                                <div>
                                    <p className="text-[8px] font-black uppercase opacity-40 mb-0.5" style={{ color: theme?.textColor || '#fff' }}>Confirmed Time</p>
                                    <p className="text-lg font-black" style={{ color: theme?.primaryColor }}>{order.appointmentTime.split(' at ')[1]}</p>
                                </div>
                                <Clock className="h-6 w-6" style={{ color: theme?.primaryColor }} />
                            </div>
                        ) : null}
                    </div>
                 </div>
             )}
             <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40" style={{ color: theme?.textColor || '#fff' }}>{isSalon ? 'Selected Services' : 'Order Items'}</h4>
                {order.items.map((it, idx) => (
                <div key={idx} className="flex justify-between items-start text-sm pb-3 border-b last:border-0" style={{borderColor: theme?.primaryColor + '10', color: theme?.textColor || '#fff'}}>
                    <div className="flex-1 pr-4 min-w-0"><span className="font-bold block truncate">{it.productName}</span><span className="text-[10px] opacity-60 font-bold uppercase">Qty: {it.quantity}</span></div>
                    <div className="flex items-center gap-3"><div className="text-right font-bold">₹{(it.price * it.quantity).toFixed(2)}</div>{isDraft && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveItem(it)}><Trash2 className="h-4 w-4" /></Button>}</div>
                </div>
                ))}
             </div>
        </div>
        <div className="p-6 border-t space-y-4 bg-black/5" style={{ borderColor: theme?.primaryColor + '20' }}>
            <div className="flex justify-between items-baseline mb-2"><span className="text-sm font-bold uppercase tracking-widest opacity-60" style={{ color: theme?.textColor || '#fff' }}>Total</span><span className="text-2xl font-black" style={{ color: theme?.primaryColor }}>₹{order.totalAmount.toFixed(2)}</span></div>
            <div className="pt-2">
              {isFinalized ? (
                 <div className="text-center p-5 bg-primary/10 rounded-2xl border-2" style={{ borderColor: theme?.primaryColor + '30' }}><Check className="mx-auto h-8 w-8 mb-2" style={{ color: theme?.primaryColor }} /><p className="font-black text-xs uppercase" style={{ color: theme?.textColor || '#fff' }}>{isSalon ? 'Booking Finalized' : 'Order Finalized'}</p></div>
              ) : store.upiId && isLocked ? (
                  <Button onClick={onShowUpi} className="w-full h-14 rounded-2xl uppercase font-black tracking-widest bg-green-600 hover:bg-green-700 text-white shadow-xl shadow-green-900/20"><CreditCard className="mr-2 h-5 w-5" /> Pay Now with UPI</Button>
              ) : isLocked ? (
                 <div className="text-center p-5 bg-primary/10 rounded-2xl border-2" style={{ borderColor: theme?.primaryColor + '30' }}><Clock className="mx-auto h-8 w-8 mb-2" style={{ color: theme?.primaryColor }} /><p className="font-black text-xs uppercase" style={{ color: theme?.textColor || '#fff' }}>{isSalon ? 'Booking Confirmed' : 'Order Confirmed'}</p></div>
              ) : (
                <AlertDialog><AlertDialogTrigger asChild><Button className="w-full h-14 rounded-2xl text-base font-black uppercase tracking-widest shadow-xl" variant="destructive" disabled={closing || isPastTime}>{closing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{isDraft ? (isSalon ? 'Book Appointment' : 'Place Order') : 'Request Bill'}</Button></AlertDialogTrigger><AlertDialogContent className="rounded-[2rem] border-0 shadow-2xl" style={{ backgroundColor: theme?.backgroundColor }}><AlertDialogHeader><AlertDialogTitle className="text-xl font-black uppercase tracking-tight" style={{ color: theme?.primaryColor }}>{isDraft ? (isSalon ? 'Confirm Booking?' : 'Place Order?') : 'Request Final Bill?'}</AlertDialogTitle><AlertDialogDescription style={{ color: theme?.textColor || '#fff', opacity: 0.7 }}>This will notify the staff to start preparation.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="gap-2"><AlertDialogCancel className="rounded-xl font-bold">Not yet</AlertDialogCancel><AlertDialogAction onClick={closeBill} className="rounded-xl font-bold bg-primary hover:bg-primary/90">Yes, Confirm</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
              )}
            </div>
        </div>
    </div>
  );
}

export default function PublicMenuPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const searchParams = useSearchParams(); const { firestore } = useFirebase(); const { toast } = useToast(); const router = useRouter();
  const [isAdding, startAdding] = useTransition(); const [searchTerm, setSearchTerm] = useState(''); const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isDeliveryDetailsOpen, setIsDeliveryDetailsOpen] = useState(false); const [isModeDialogOpen, setIsModeDialogOpen] = useState(false); const [isUpiDialogOpen, setIsUpiDialogOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState<string | null>(null); const [deliveryAddress, setDeliveryAddress] = useState(''); const [customerName, setCustomerName] = useState(''); const [phone, setPhone] = useState(''); const [deliveryCoords, setDeliveryCoords] = useState<{lat: number, lng: number} | null>(null);
  const [selectedItemForIngredients, setSelectedItemForIngredients] = useState<MenuItem | null>(null); const [ingredientsData, setIngredientsData] = useState<GetIngredientsOutput | null>(null); const [isFetchingIngredients, startFetchingIngredients] = useTransition(); const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());
  const { canInstall, triggerInstall } = useInstall();
  const { masterProducts, productPrices, fetchInitialData, isInitialized } = useAppStore();

  const { data: store, isLoading: storeLoading } = useDoc<Store>(useMemoFirebase(() => firestore ? doc(firestore, 'stores', storeId) : null, [firestore, storeId]));
  const { data: menus, isLoading: menuLoading } = useCollection<Menu>(useMemoFirebase(() => firestore ? query(collection(firestore, `stores/${storeId}/menus`)) : null, [firestore, storeId]));
  const menu = menus?.[0];

  const productsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'stores', storeId, 'products') : null, [firestore, storeId]);
  const { data: products, isLoading: productsLoading } = useCollection<Product>(productsQuery);

  const isSalon = useMemo(() => store?.businessType === 'salon' || store?.name.toLowerCase().includes('salon'), [store]);

  useEffect(() => { if (firestore && !isInitialized) fetchInitialData(firestore); }, [firestore, isInitialized, fetchInitialData]);

  useEffect(() => {
    const urlTable = searchParams.get('table'); if (urlTable) { setTableNumber(urlTable); }
    const sA = localStorage.getItem(`last_address_${storeId}`); const sN = localStorage.getItem(`last_name_${storeId}`); const sP = localStorage.getItem(`last_phone_${storeId}`);
    if (sA) setDeliveryAddress(sA); if (sN) setCustomerName(sN); if (sP) setPhone(sP);
  }, [searchParams, storeId]);

  const sessionId = useMemo(() => {
    const dS = `${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDate()}`;
    const sS = typeof window !== 'undefined' ? localStorage.getItem(`sub_session_${storeId}`) || '1' : '1';
    if (tableNumber) return `table-${tableNumber}-${dS}-${sS}`;
    let dId = localStorage.getItem(`device_session_${storeId}`); if (!dId) { dId = Math.random().toString(36).substring(2, 15); localStorage.setItem(`device_session_${storeId}`, dId); }
    return `home-${dId}-${dS}-${sS}`;
  }, [tableNumber, storeId]);

  const orderId = `${storeId}_${sessionId}`;
  const { data: order, isLoading: orderLoading } = useDoc<Order>(useMemoFirebase(() => (firestore && sessionId ? doc(firestore, 'orders', orderId) : null), [firestore, orderId, sessionId]));
  const itemCount = order?.items?.length || 0;

  const availableCategories = useMemo(() => menu?.items ? Array.from(new Set(menu.items.map(i => i.category))).sort() : [], [menu]);
  
  const groupedMenu = useMemo(() => {
    if (!menu?.items) return {};
    let filtered = menu.items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (selectedCategory) filtered = filtered.filter(i => i.category === selectedCategory);
    return filtered.reduce((acc, i) => { const c = i.category || 'Other'; if(!acc[c]) acc[c] = []; acc[c].push(i); return acc; }, {} as Record<string, MenuItem[]>);
  }, [menu, searchTerm, selectedCategory]);

  const handleAddItem = (item: MenuItem) => {
    if (!tableNumber && (!deliveryAddress || !customerName || !phone)) { setIsDeliveryDetailsOpen(true); return; }
    startAdding(async () => {
      const res = await addRestaurantOrderItem({ storeId, sessionId, tableNumber, item, quantity: 1, deliveryAddress, customerName, phone, deliveryLat: deliveryCoords?.lat, deliveryLng: deliveryCoords?.lng });
      if (res.success) { setRecentlyAdded(prev => new Set(prev).add(item.id)); setTimeout(() => setRecentlyAdded(prev => { const n = new Set(prev); n.delete(item.id); return n; }), 2000); }
    });
  };

  const handleShowIngredients = (item: MenuItem) => {
    setIngredientsData(null); // Clear previous to ensure loader shows or content updates
    setSelectedItemForIngredients(item);
    startFetchingIngredients(async () => {
      const res = await getIngredientsForDish({ dishName: item.name, language: 'en' });
      if (res && res.isSuccess) setIngredientsData(res);
    });
  };

  const handleStartNewOrder = () => {
    const cS = parseInt(localStorage.getItem(`sub_session_${storeId}`) || '1', 10);
    localStorage.setItem(`sub_session_${storeId}`, (cS + 1).toString()); window.location.reload();
  };

  if (storeLoading || menuLoading || orderLoading || productsLoading) return <div className="p-12 flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 opacity-20" /></div>;
  
  if (!store) return <div className="p-12 text-center opacity-50">Store not found.</div>;

  const theme = menu?.theme;

  return (
    <>
      {selectedItemForIngredients && <IngredientsDialog open={!!selectedItemForIngredients} onClose={() => setSelectedItemForIngredients(null)} dishName={selectedItemForIngredients.name} price={selectedItemForIngredients.price} isLoading={isFetchingIngredients} calories={ingredientsData?.nutrition?.calories || 0} protein={ingredientsData?.nutrition?.protein || 0} ingredients={(ingredientsData?.components as any) || []} itemType={ingredientsData?.itemType} onAdd={() => { handleAddItem(selectedItemForIngredients); setSelectedItemForIngredients(null); }} />}
      <DeliveryDetailsDialog isOpen={isDeliveryDetailsOpen} onOpenChange={setIsDeliveryDetailsOpen} onSave={(d) => { setCustomerName(d.name); setPhone(d.phone); setDeliveryAddress(d.address); if(d.lat) setDeliveryCoords({lat:d.lat, lng:d.lng}); localStorage.setItem(`last_name_${storeId}`, d.name); localStorage.setItem(`last_phone_${storeId}`, d.phone); localStorage.setItem(`last_address_${storeId}`, d.address); }} initialData={{ name: customerName, phone, address: deliveryAddress }} theme={theme} />
      <ModeSelectionDialog isOpen={isModeDialogOpen} onOpenChange={setIsModeDialogOpen} onSelectMode={(m, v) => { if(m==='delivery'){ setTableNumber(null); } else if(v){ setTableNumber(v); } handleStartNewOrder(); }} currentMode={tableNumber ? 'table' : 'delivery'} theme={theme} isSalon={isSalon} />
      {order && <UPIPaymentDialog isOpen={isUpiDialogOpen} onOpenChange={setIsUpiDialogOpen} order={order} store={store} theme={theme} />}
      <div className="min-h-screen pb-24" style={{ backgroundColor: theme?.backgroundColor || '#f8fafc' }}>
          <div className="container mx-auto py-6 px-4 max-w-2xl">
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                      <Button asChild variant="ghost" size="icon" className="rounded-full"><Link href="/"><ArrowLeft className="h-5 w-5" /></Link></Button>
                      <div className="relative h-12 w-12 rounded-2xl overflow-hidden border shadow-sm"><Image src={store.imageUrl || ADIRES_LOGO} alt={store.name} fill className="object-cover" /></div>
                      <div className="min-w-0">
                          <h1 className="text-base font-black truncate" style={{ color: theme?.primaryColor || '#000' }}>{store.name}</h1>
                          <div className="flex items-center gap-2">
                              {tableNumber ? <Badge className="px-1.5 py-0 text-[8px] uppercase" style={{ backgroundColor: theme?.primaryColor, color: theme?.backgroundColor }}>{isSalon ? `Chair ${tableNumber}` : `Table ${tableNumber}`}</Badge> : <Badge className="px-1.5 py-0 text-[8px] uppercase bg-blue-600 text-white">{isSalon ? 'Home Service' : 'Delivery'}</Badge>}
                              <button onClick={() => setIsModeDialogOpen(true)} className="text-[8px] uppercase underline opacity-40" style={{ color: theme?.textColor || '#fff' }}>Change</button>
                          </div>
                      </div>
                  </div>
                  <div className="flex items-center gap-2">
                      {store.liveVideoUrl && <Button asChild variant="outline" size="sm" className="h-8 rounded-xl border-2 px-3 font-black text-[8px] uppercase animate-pulse" style={{ color: theme?.primaryColor || '#000', borderColor: theme?.primaryColor || '#000' }}><Link href={`/live-order/${orderId}`}><Video className="mr-1 h-3 w-3" /> Live Feed</Link></Button>}
                      {canInstall && <Button variant="ghost" size="icon" onClick={triggerInstall} className="rounded-full"><Download className="h-4 w-4" /></Button>}
                  </div>
              </div>

              {!menu && products && products.length > 0 ? (
                  <div className="space-y-8">
                      <Alert className="bg-primary/5 border-primary/20 rounded-3xl"><Info className="h-4 w-4"/><AlertTitle className="font-black text-xs uppercase tracking-widest">Catalog Mode</AlertTitle><AlertDescription className="text-xs">Digital menu is not set up. Showing retail products instead.</AlertDescription></Alert>
                      <div className="grid grid-cols-2 gap-4">
                          {products.map(p => <ProductCard key={p.id} product={p} priceData={productPrices[p.name.toLowerCase()]} />)}
                      </div>
                  </div>
              ) : !menu ? (
                  <div className="text-center py-20 opacity-20"><Utensils className="h-12 w-12 mx-auto mb-4" /><p className="font-bold uppercase tracking-widest text-xs">No Items Available</p></div>
              ) : (
                <div className="space-y-6">
                    {['Completed', 'Delivered'].includes(order?.status || '') ? (
                        <Card className="rounded-[2.5rem] border-0 shadow-2xl text-center py-16 px-8" style={{ backgroundColor: '#fafafa' }}><div className="mx-auto h-20 w-20 flex items-center justify-center rounded-full mb-6 bg-white"><Check className="h-10 w-10 text-primary" style={{ color: theme?.primaryColor }} /></div><h2 className="text-2xl font-black mb-3">Order Finalized</h2><Button onClick={handleStartNewOrder} className="rounded-xl h-12 px-8 uppercase font-black text-[10px] tracking-widest shadow-lg" style={{ backgroundColor: theme?.primaryColor, color: theme?.backgroundColor }}>Start New Session</Button></Card>
                    ) : (
                        <>
                            <ScrollArea className="w-full whitespace-nowrap pb-2"><div className="flex gap-2"><Button variant="ghost" size="sm" className={cn("rounded-lg px-3 h-7 font-black text-[9px] uppercase tracking-widest border", !selectedCategory ? "shadow-md" : "opacity-40")} style={{ backgroundColor: !selectedCategory ? theme?.primaryColor : 'transparent', color: !selectedCategory ? theme?.backgroundColor : theme?.primaryColor }} onClick={() => setSelectedCategory(null)}>All</Button>{availableCategories.map(cat => <Button key={cat} variant="ghost" size="sm" className={cn("rounded-lg px-3 h-7 font-black text-[9px] uppercase tracking-widest border", selectedCategory === cat ? "shadow-md" : "opacity-40")} style={{ backgroundColor: selectedCategory === cat ? theme?.primaryColor : 'transparent', color: selectedCategory === cat ? theme?.backgroundColor : theme?.primaryColor }} onClick={() => setSelectedCategory(cat)}>{cat}</Button>)}</div></ScrollArea>
                            {Object.entries(groupedMenu).map(([category, items]) => (
                                <div key={category} className="space-y-3">
                                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 px-1" style={{ color: theme?.textColor || '#fff' }}>{category}</h2>
                                    <div className="grid gap-3">
                                        {items.map((item) => (
                                            <Card key={item.id} className="flex gap-4 p-3 shadow-md rounded-[1.5rem] border-0 bg-white group hover:shadow-xl transition-all">
                                                <div className="relative h-20 w-20 rounded-2xl overflow-hidden bg-muted shrink-0 border">
                                                    <Image src={item.imageUrl || ADIRES_LOGO} alt={item.name} fill className="object-cover group-hover:scale-110 transition-transform" />
                                                </div>
                                                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                                    <div>
                                                        <p className="font-black text-sm truncate mb-0.5 text-slate-900">{item.name}</p>
                                                        <p className="text-[10px] text-slate-500 line-clamp-2 leading-tight">{item.description}</p>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-sm font-black" style={{color: theme?.primaryColor || '#000'}}>₹{item.price.toFixed(2)}</p>
                                                        <div className="flex items-center gap-1">
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-40 hover:opacity-100" onClick={() => handleShowIngredients(item)}><Eye className="h-4 w-4 text-slate-900" /></Button>
                                                            <Button onClick={() => handleAddItem(item)} disabled={isAdding || recentlyAdded.has(item.id)} className={cn("h-8 rounded-xl text-[9px] uppercase font-black min-w-[60px]", recentlyAdded.has(item.id) ? "bg-green-600" : "")} style={{ backgroundColor: recentlyAdded.has(item.id) ? '' : theme?.primaryColor, color: theme?.backgroundColor }}>{recentlyAdded.has(item.id) ? <Check className="h-3 w-3" /> : (isSalon ? 'Book' : 'Add')}</Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
              )}
            </div>
          </div>
          {itemCount > 0 && ['Pending', 'Processing', 'Out for Delivery', 'Billed', 'Draft'].includes(order?.status || '') && (
               <Sheet><SheetTrigger asChild><div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-[200px] px-4"><Button className="h-12 w-full rounded-xl shadow-2xl text-[10px] font-black uppercase tracking-widest" style={{ backgroundColor: theme?.primaryColor, color: theme?.backgroundColor }}><Receipt className="mr-2 h-4 w-4" /> View {isSalon ? 'Booking' : 'Bill'} <Badge className="ml-2 h-5 min-w-[20px] rounded-md text-[9px] font-black" style={{ backgroundColor: theme?.backgroundColor, color: theme?.primaryColor }}>{itemCount}</Badge></Button></div></SheetTrigger><SheetContent side="bottom" className="h-[75vh] rounded-t-[2.5rem] p-0 border-0 overflow-hidden"><LiveBillSheet orderId={order!.id} theme={theme} store={store} onShowUpi={() => setIsUpiDialogOpen(true)} isSalon={isSalon} /></SheetContent></Sheet>
          )}
        </div>
    </>
  );
}
