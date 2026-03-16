
'use client';

import { useFirebase, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection,
  query,
  where,
  doc,
  deleteDoc,
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
  Minus,
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
  Sparkles,
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
                <p className="text-[8px] font-black uppercase opacity-40" style={{ color: theme?.textColor || '#fff' }}>Hour</p>
                <Select value={h} onValueChange={(v) => update(v, m, p)}>
                    <SelectTrigger className="w-20 h-14 rounded-xl border-2 text-xl font-black bg-black/5" style={{ borderColor: theme?.primaryColor + '40', color: theme?.textColor || '#fff' }}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {hours.map(hr => <SelectItem key={hr} value={hr}>{hr}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <span className="text-2xl font-black mt-5" style={{ color: theme?.textColor || '#fff' }}>:</span>
            <div className="flex flex-col items-center gap-1.5">
                <p className="text-[8px] font-black uppercase opacity-40" style={{ color: theme?.textColor || '#fff' }}>Min</p>
                <Select value={m} onValueChange={(v) => update(h, v, p)}>
                    <SelectTrigger className="w-20 h-14 rounded-xl border-2 text-xl font-black bg-black/5" style={{ borderColor: theme?.primaryColor + '40', color: theme?.textColor || '#fff' }}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {minutes.map(min => <SelectItem key={min} value={min}>{min}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex flex-col items-center gap-1.5 ml-2">
                <p className="text-[8px] font-black uppercase opacity-40" style={{ color: theme?.textColor || '#fff' }}>Period</p>
                <div className="flex border-2 rounded-xl overflow-hidden h-14 bg-black/5" style={{ borderColor: theme?.primaryColor + '40' }}>
                    <button 
                        className={cn("px-4 text-xs font-black transition-all", p === 'AM' ? "shadow-inner" : "opacity-30")}
                        style={{ backgroundColor: p === 'AM' ? theme?.primaryColor : 'transparent', color: p === 'AM' ? theme?.backgroundColor : theme?.textColor || '#fff' }}
                        onClick={() => update(h, m, 'AM')}
                    >AM</button>
                    <button 
                        className={cn("px-4 text-xs font-black transition-all", p === 'PM' ? "shadow-inner" : "opacity-30")}
                        style={{ backgroundColor: p === 'PM' ? theme?.primaryColor : 'transparent', color: p === 'PM' ? theme?.backgroundColor : theme?.textColor || '#fff' }}
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
            <DialogContent className="rounded-[2.5rem] border-0 shadow-2xl p-8 flex flex-col items-center text-center max-w-sm mx-auto" style={{ backgroundColor: theme?.backgroundColor || '#1A1616' }}>
                <DialogHeader className="mb-4">
                    <DialogTitle className="text-xl font-black uppercase tracking-tight" style={{ color: theme?.primaryColor || '#FBC02D' }}>Pay Bill</DialogTitle>
                    <DialogDescription style={{ color: theme?.textColor || '#fff', opacity: 0.6 }}>Choose your preferred payment method.</DialogDescription>
                </DialogHeader>
                <div className="p-6 bg-white rounded-[2.5rem] shadow-inner border-4 border-black/5 mb-6">
                    <QRCode value={upiUrl} size={180} level="H" includeMargin={true} />
                    <p className="mt-4 text-[10px] font-black uppercase tracking-widest opacity-40">Scan QR to Pay</p>
                </div>
                <div className="w-full space-y-4">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black opacity-40 uppercase tracking-widest" style={{ color: theme?.textColor || '#fff' }}>Amount to Pay</p>
                        <p className="text-4xl font-black" style={{ color: theme?.primaryColor || '#FBC02D' }}>₹{order.totalAmount.toFixed(2)}</p>
                    </div>
                    <Button onClick={() => window.location.href = upiUrl} className="w-full h-14 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 flex items-center justify-center gap-3" style={{ backgroundColor: theme?.primaryColor || '#FBC02D', color: theme?.backgroundColor || '#1A1616' }}>
                        <Smartphone className="h-5 w-5" /> Pay via UPI App
                    </Button>
                    <Alert className="bg-primary/5 border-primary/10 rounded-2xl text-left">
                        <Info className="h-4 w-4" style={{ color: theme?.primaryColor || '#FBC02D' }} />
                        <AlertDescription className="text-[9px] font-bold leading-tight" style={{ color: theme?.textColor || '#fff' }}>After payment, show the confirmation to staff.</AlertDescription>
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
            <DialogContent className="rounded-[2rem] border-0 shadow-2xl p-6" style={{ backgroundColor: theme?.backgroundColor || '#1A1616' }}>
                <DialogHeader className="mb-4">
                    <DialogTitle className="text-xl font-black uppercase tracking-tight" style={{ color: theme?.primaryColor || '#FBC02D' }}>Your Details</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-black opacity-40 ml-1" style={{ color: theme?.textColor || '#fff' }}>Your Name</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" className="rounded-xl h-12 border-2 bg-black/20 text-white" style={{ borderColor: theme?.primaryColor + '20' }} />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-black opacity-40 ml-1" style={{ color: theme?.textColor || '#fff' }}>Phone</Label>
                        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile Number" className="rounded-xl h-12 border-2 bg-black/20 text-white" style={{ borderColor: theme?.primaryColor + '20' }} />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-black opacity-40 ml-1" style={{ color: theme?.textColor || '#fff' }}>Address (For Delivery Only)</Label>
                        <div className="flex gap-2">
                            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House No, Street..." className="rounded-xl h-12 border-2 flex-1 bg-black/20 text-white" style={{ borderColor: theme?.primaryColor + '20' }} />
                            <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl border-2" style={{ borderColor: theme?.primaryColor + '40', color: theme?.primaryColor || '#FBC02D' }} onClick={handleGetLocation} disabled={isLocating}>
                                {isLocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                </div>
                <DialogFooter className="pt-4">
                    <Button disabled={!name.trim() || !phone.trim() || isLocating} onClick={() => { onSave({ name, phone, address, lat: coords?.lat, lng: coords?.lng }); onOpenChange(false); }} className="w-full h-14 rounded-2xl uppercase font-black tracking-widest text-xs shadow-xl" style={{ backgroundColor: theme?.primaryColor || '#FBC02D', color: theme?.backgroundColor || '#1A1616' }}>
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
            <DialogContent className="rounded-[2rem] border-0 shadow-2xl p-6" style={{ backgroundColor: theme?.backgroundColor || '#1A1616' }}>
                <DialogHeader><DialogTitle className="text-xl uppercase font-black" style={{ color: theme?.primaryColor || '#FBC02D' }}>{isSalon ? 'Service Type' : 'Order Mode'}</DialogTitle></DialogHeader>
                <div className="grid gap-4">
                    <Button variant={currentMode === 'delivery' ? 'default' : 'outline'} className="h-20 rounded-2xl flex flex-col border-2" style={{ backgroundColor: currentMode === 'delivery' ? theme?.primaryColor || '#FBC02D' : 'transparent', color: currentMode === 'delivery' ? theme?.backgroundColor || '#1A1616' : theme?.primaryColor || '#FBC02D', borderColor: theme?.primaryColor || '#FBC02D' }} onClick={() => { onSelectMode('delivery'); onOpenChange(false); }}>
                        <div className="flex items-center gap-2 font-black text-xs uppercase"><Truck className="h-4 w-4"/> {isSalon ? 'Home Service' : 'Home Delivery'}</div>
                    </Button>
                    <div className="relative py-2"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-black/10" /></div><div className="relative flex justify-center text-[8px] font-black uppercase"><span className="px-2" style={{ backgroundColor: theme?.backgroundColor || '#1A1616', color: theme?.textColor || '#fff', opacity: 0.4 }}>Or</span></div></div>
                    <div className="space-y-3">
                        <Label className="text-[10px] uppercase font-black opacity-40 ml-1" style={{ color: theme?.textColor || '#fff' }}>{isSalon ? 'At Salon' : 'Dine-in Table No.'}</Label>
                        <div className="flex gap-2"><Input placeholder={isSalon ? "Chair No. (Optional)" : "Table No."} value={tableVal} onChange={(e) => setTableVal(e.target.value)} className="rounded-xl h-12 border-2 text-center bg-black/20 text-white" style={{ borderColor: theme?.primaryColor + '20' }} /><Button disabled={!isSalon && !tableVal.trim()} onClick={() => { onSelectMode('table', tableVal); onOpenChange(false); }} className="h-12 rounded-xl px-6 font-black uppercase text-[10px]" style={{ backgroundColor: theme?.primaryColor || '#FBC02D', color: theme?.backgroundColor || '#1A1616' }}>Set</Button></div>
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

  if (isLoading) return <div className="flex justify-center p-12 bg-[#1A1616]"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  if (!order || !order.items?.length) return <div className="p-8 text-center bg-[#1A1616]"><p className="opacity-60 text-sm font-medium text-white">Your {isSalon ? 'booking' : 'bill'} is empty.</p></div>;
  
  const isDraft = order.status === 'Draft'; 
  const isLocked = ['Pending', 'Processing', 'Out for Delivery', 'Billed'].includes(order.status);
  const isFinalized = ['Completed', 'Delivered'].includes(order.status);
  
  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: theme?.backgroundColor || '#1A1616' }}>
        <SheetHeader className='p-5 border-b' style={{ borderColor: theme?.primaryColor + '20' }}><SheetTitle className="flex items-center gap-2 text-lg font-bold" style={{ color: theme?.primaryColor || '#FBC02D' }}><Receipt className="h-5 w-5" /> {isSalon ? 'Appointment Summary' : 'Live Bill'}</SheetTitle></SheetHeader>
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
                                    <p className="text-lg font-black" style={{ color: theme?.primaryColor || '#FBC02D' }}>{format(toDateSafe(order.orderDate), 'PPP')}</p>
                                </div>
                                <CalendarDays className="h-6 w-6" style={{ color: theme?.primaryColor || '#FBC02D' }} />
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
                                    <p className="text-lg font-black" style={{ color: theme?.primaryColor || '#FBC02D' }}>{order.appointmentTime.split(' at ')[1]}</p>
                                </div>
                                <Clock className="h-6 w-6" style={{ color: theme?.primaryColor || '#FBC02D' }} />
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
        <div className="p-6 border-t space-y-4 bg-black/20" style={{ borderColor: theme?.primaryColor + '20' }}>
            <div className="flex justify-between items-baseline mb-2"><span className="text-sm font-bold uppercase tracking-widest opacity-60" style={{ color: theme?.textColor || '#fff' }}>Total</span><span className="text-2xl font-black" style={{ color: theme?.primaryColor || '#FBC02D' }}>₹{order.totalAmount.toFixed(2)}</span></div>
            <div className="pt-2">
              {isFinalized ? (
                 <div className="text-center p-5 bg-primary/10 rounded-2xl border-2" style={{ borderColor: theme?.primaryColor + '30' }}><Check className="mx-auto h-8 w-8 mb-2" style={{ color: theme?.primaryColor || '#FBC02D' }} /><p className="font-black text-xs uppercase" style={{ color: theme?.textColor || '#fff' }}>{isSalon ? 'Booking Finalized' : 'Order Finalized'}</p></div>
              ) : store.upiId && isLocked ? (
                  <Button onClick={onShowUpi} className="w-full h-14 rounded-2xl uppercase font-black tracking-widest bg-green-600 hover:bg-green-700 text-white shadow-xl shadow-green-900/20"><CreditCard className="mr-2 h-5 w-5" /> Pay Now with UPI</Button>
              ) : isLocked ? (
                 <div className="text-center p-5 bg-primary/10 rounded-2xl border-2" style={{ borderColor: theme?.primaryColor + '30' }}><Clock className="mx-auto h-8 w-8 mb-2" style={{ color: theme?.primaryColor || '#FBC02D' }} /><p className="font-black text-xs uppercase" style={{ color: theme?.textColor || '#fff' }}>{isSalon ? 'Booking Confirmed' : 'Order Confirmed'}</p></div>
              ) : (
                <AlertDialog><AlertDialogTrigger asChild><Button className="w-full h-14 rounded-2xl text-base font-black uppercase tracking-widest shadow-xl" variant="destructive" disabled={closing || isPastTime}>{closing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{isDraft ? (isSalon ? 'Book Appointment' : 'Place Order') : 'Request Bill'}</Button></AlertDialogTrigger><AlertDialogContent className="rounded-[2rem] border-0 shadow-2xl" style={{ backgroundColor: theme?.backgroundColor || '#1A1616' }}><AlertDialogHeader><AlertDialogTitle className="text-xl font-black uppercase tracking-tight" style={{ color: theme?.primaryColor || '#FBC02D' }}>{isDraft ? (isSalon ? 'Confirm Booking?' : 'Place Order?') : 'Request Final Bill?'}</AlertDialogTitle><AlertDialogDescription style={{ color: theme?.textColor || '#fff', opacity: 0.7 }}>This will notify the staff to start preparation.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="gap-2"><AlertDialogCancel className="rounded-xl font-bold">Not yet</AlertDialogCancel><AlertDialogAction onClick={closeBill} className="rounded-xl font-bold bg-primary hover:bg-primary/90" style={{ backgroundColor: theme?.primaryColor || '#FBC02D', color: theme?.backgroundColor || '#1A1616' }}>Yes, Confirm</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
              )}
            </div>
        </div>
    </div>
  );
}

function MenuCard({ item, onAdd, onShowDetails, isAdding, recentlyAdded, theme }: { item: MenuItem, onAdd: (item: MenuItem, qty: number) => void, onShowDetails: (item: MenuItem) => void, isAdding: boolean, recentlyAdded: boolean, theme: MenuTheme | undefined }) {
    const [qty, setQty] = useState(1);
    
    return (
        <Card className="flex flex-col shadow-xl rounded-[1.2rem] border-0 overflow-hidden group hover:scale-[1.02] transition-all duration-300" style={{ backgroundColor: '#2D2424' }}>
            {/* Top Section: Image - NOW COMPACT 16:9 */}
            <div 
                className="relative aspect-video w-full rounded-t-[1.2rem] overflow-hidden cursor-pointer" 
                onClick={() => onShowDetails(item)}
            >
                <Image src={item.imageUrl || ADIRES_LOGO} alt={item.name} fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                
                {/* Price Overlay */}
                <div className="absolute bottom-1.5 left-1.5 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10">
                    <p className="text-[10px] font-black" style={{ color: theme?.primaryColor || '#FBC02D' }}>₹{item.price.toFixed(0)}</p>
                </div>
            </div>

            {/* Bottom Section: Details & Action */}
            <div className="p-2 flex flex-col gap-2 flex-1 min-w-0">
                <div className="min-w-0">
                    <h3 className="font-black text-[11px] leading-tight text-white mb-0.5 truncate">{item.name}</h3>
                    <div className="flex items-center gap-1 opacity-40">
                        <Sparkles className="h-2 w-2" style={{ color: theme?.primaryColor || '#FBC02D' }} />
                        <span className="text-[7px] font-black uppercase tracking-widest text-white">Popular</span>
                    </div>
                </div>

                {/* Quantity Selector Pill - Compact */}
                <div className="flex items-center justify-between h-7 w-full rounded-full bg-black/40 border border-white/10 px-1 overflow-hidden">
                    <button 
                        onClick={() => setQty(Math.max(1, qty - 1))}
                        className="h-5 w-5 rounded-full flex items-center justify-center text-white hover:bg-white/10"
                    >
                        <Minus className="h-2 w-2" />
                    </button>
                    <span className="text-[10px] font-black text-white">{qty}</span>
                    <button 
                        onClick={() => setQty(qty + 1)}
                        className="h-5 w-5 rounded-full flex items-center justify-center text-white hover:bg-white/10"
                    >
                        <Plus className="h-2 w-2" />
                    </button>
                </div>

                <div className="flex items-center gap-1.5">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 rounded-full opacity-40 hover:opacity-100 bg-white/5" 
                        onClick={() => onShowDetails(item)}
                    >
                        <Eye className="h-3.5 w-3.5 text-white" />
                    </Button>
                    <Button 
                        onClick={() => onAdd(item, qty)} 
                        disabled={isAdding || recentlyAdded} 
                        className={cn(
                            "flex-1 h-8 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95",
                            recentlyAdded ? "bg-green-600 text-white" : ""
                        )} 
                        style={{ 
                            backgroundColor: recentlyAdded ? '' : (theme?.primaryColor || '#FBC02D'), 
                            color: recentlyAdded ? '' : (theme?.backgroundColor || '#1A1616') 
                        }}
                    >
                        {recentlyAdded ? <Check className="h-2.5 w-2.5" /> : 'Add'}
                    </Button>
                </div>
            </div>
        </Card>
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

  const handleAddItem = (item: MenuItem, qty: number = 1) => {
    if (!tableNumber && (!deliveryAddress || !customerName || !phone)) { setIsDeliveryDetailsOpen(true); return; }
    startAdding(async () => {
      const res = await addRestaurantOrderItem({ storeId, sessionId, tableNumber, item, quantity: qty, deliveryAddress, customerName, phone, deliveryLat: deliveryCoords?.lat, deliveryLng: deliveryCoords?.lng });
      if (res.success) { setRecentlyAdded(prev => new Set(prev).add(item.id)); setTimeout(() => setRecentlyAdded(prev => { const n = new Set(prev); n.delete(item.id); return n; }), 2000); }
    });
  };

  const handleShowIngredients = (item: MenuItem) => {
    setIngredientsData(null); 
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

  if (storeLoading || menuLoading || orderLoading || productsLoading) return <div className="p-12 flex items-center justify-center bg-[#1A1616] min-h-screen"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  
  if (!store) return <div className="p-12 text-center opacity-50 bg-[#1A1616] min-h-screen text-white">Store not found.</div>;

  const theme = menu?.theme;

  return (
    <>
      {selectedItemForIngredients && <IngredientsDialog open={!!selectedItemForIngredients} onClose={() => setSelectedItemForIngredients(null)} dishName={selectedItemForIngredients.name} price={selectedItemForIngredients.price} isLoading={isFetchingIngredients} calories={ingredientsData?.nutrition?.calories || 0} protein={ingredientsData?.nutrition?.protein || 0} ingredients={(ingredientsData?.components as any) || []} itemType={ingredientsData?.itemType} onAdd={() => { handleAddItem(selectedItemForIngredients); setSelectedItemForIngredients(null); }} />}
      <DeliveryDetailsDialog isOpen={isDeliveryDetailsOpen} onOpenChange={setIsDeliveryDetailsOpen} onSave={(d) => { setCustomerName(d.name); setPhone(d.phone); setDeliveryAddress(d.address); if(d.lat) setDeliveryCoords({lat:d.lat, lng:d.lng}); localStorage.setItem(`last_name_${storeId}`, d.name); localStorage.setItem(`last_phone_${storeId}`, d.phone); localStorage.setItem(`last_address_${storeId}`, d.address); }} initialData={{ name: customerName, phone, address: deliveryAddress }} theme={theme} />
      <ModeSelectionDialog isOpen={isModeDialogOpen} onOpenChange={setIsModeDialogOpen} onSelectMode={(m, v) => { if(m==='delivery'){ setTableNumber(null); } else if(v){ setTableNumber(v); } handleStartNewOrder(); }} currentMode={tableNumber ? 'table' : 'delivery'} theme={theme} isSalon={isSalon} />
      {order && <UPIPaymentDialog isOpen={isUpiDialogOpen} onOpenChange={setIsUpiDialogOpen} order={order} store={store} theme={theme} />}
      
      <div className="min-h-screen pb-24" style={{ backgroundColor: theme?.backgroundColor || '#1A1616' }}>
          <div className="container mx-auto py-4 px-3 max-w-2xl">
            <div className="space-y-6">
              {/* Header Info - Tighter spacing */}
              <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                      <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-white/10"><Link href="/"><ArrowLeft className="h-4 w-4 text-white" /></Link></Button>
                      <div className="relative h-10 w-10 rounded-xl overflow-hidden border shadow-xl" style={{ borderColor: theme?.primaryColor || '#FBC02D' }}><Image src={store.imageUrl || ADIRES_LOGO} alt={store.name} fill className="object-cover" /></div>
                      <div className="min-w-0">
                          <h1 className="text-base font-black truncate leading-tight" style={{ color: theme?.primaryColor || '#FBC02D' }}>{store.name}</h1>
                          <div className="flex items-center gap-1.5 mt-0.5">
                              {tableNumber ? <Badge className="px-1.5 py-0 text-[8px] font-black uppercase tracking-widest" style={{ backgroundColor: theme?.primaryColor || '#FBC02D', color: theme?.backgroundColor || '#1A1616' }}>{isSalon ? `Chair ${tableNumber}` : `T-${tableNumber}`}</Badge> : <Badge className="px-1.5 py-0 text-[8px] font-black uppercase tracking-widest bg-blue-600 text-white border-0">{isSalon ? 'Home' : 'Delivery'}</Badge>}
                              <button onClick={() => setIsModeDialogOpen(true)} className="text-[8px] font-black uppercase tracking-widest underline opacity-40 hover:opacity-100 transition-opacity" style={{ color: theme?.textColor || '#fff' }}>Change</button>
                          </div>
                      </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                      {store.liveVideoUrl && <Button asChild variant="outline" size="sm" className="h-7 rounded-lg border px-2 font-black text-[8px] uppercase tracking-widest animate-pulse" style={{ color: theme?.primaryColor || '#FBC02D', borderColor: theme?.primaryColor || '#FBC02D' }}><Link href={`/live-order/${orderId}`}><Video className="mr-1 h-3 w-3" /> Live</Link></Button>}
                      {canInstall && <Button variant="ghost" size="icon" onClick={triggerInstall} className="h-8 w-8 rounded-full hover:bg-white/10 text-white"><Download className="h-4 w-4" /></Button>}
                  </div>
              </div>

              {!menu && products && products.length > 0 ? (
                  <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-3">
                          {products.map(p => <ProductCard key={p.id} product={p} priceData={productPrices[p.name.toLowerCase()]} />)}
                      </div>
                  </div>
              ) : !menu ? (
                  <div className="text-center py-20 opacity-20 text-white"><Utensils className="h-12 w-12 mx-auto mb-4" /><p className="font-black uppercase tracking-widest text-xs">No Items Available</p></div>
              ) : (
                <div className="space-y-6">
                    {['Completed', 'Delivered'].includes(order?.status || '') ? (
                        <Card className="rounded-[2.5rem] border-0 shadow-2xl text-center py-16 px-6" style={{ backgroundColor: '#2D2424' }}><div className="mx-auto h-20 w-20 flex items-center justify-center rounded-full mb-6 bg-white/5 border-4 border-white/10 shadow-inner"><Check className="h-10 w-10 text-primary" style={{ color: theme?.primaryColor || '#FBC02D' }} /></div><h2 className="text-2xl font-black mb-4 text-white tracking-tight uppercase">Order Finalized</h2><Button onClick={handleStartNewOrder} className="rounded-xl h-12 px-8 uppercase font-black text-[10px] tracking-[0.2em] shadow-2xl transition-transform active:scale-95" style={{ backgroundColor: theme?.primaryColor || '#FBC02D', color: theme?.backgroundColor || '#1A1616' }}>Start New Session</Button></Card>
                    ) : (
                        <>
                            {/* Category Filter Chips - Tighter */}
                            <ScrollArea className="w-full whitespace-nowrap pb-1">
                                <div className="flex gap-2 px-1">
                                    <button 
                                        onClick={() => setSelectedCategory(null)}
                                        className={cn(
                                            "rounded-lg px-4 h-8 font-black text-[9px] uppercase tracking-widest border transition-all duration-300",
                                            !selectedCategory ? "shadow-lg scale-105" : "opacity-40"
                                        )}
                                        style={{ 
                                            backgroundColor: !selectedCategory ? (theme?.primaryColor || '#FBC02D') : 'transparent', 
                                            color: !selectedCategory ? (theme?.backgroundColor || '#1A1616') : (theme?.primaryColor || '#FBC02D'),
                                            borderColor: theme?.primaryColor || '#FBC02D'
                                        }}
                                    >All</button>
                                    {availableCategories.map(cat => (
                                        <button 
                                            key={cat} 
                                            onClick={() => setSelectedCategory(cat)}
                                            className={cn(
                                                "rounded-lg px-4 h-8 font-black text-[9px] uppercase tracking-widest border transition-all duration-300",
                                                selectedCategory === cat ? "shadow-lg scale-105" : "opacity-40"
                                            )}
                                            style={{ 
                                                backgroundColor: selectedCategory === cat ? (theme?.primaryColor || '#FBC02D') : 'transparent', 
                                                color: selectedCategory === cat ? (theme?.backgroundColor || '#1A1616') : (theme?.primaryColor || '#FBC02D'),
                                                borderColor: theme?.primaryColor || '#FBC02D'
                                            }}
                                        >{cat}</button>
                                    ))}
                                </div>
                                <ScrollBar orientation="horizontal" className="opacity-0" />
                            </ScrollArea>

                            {/* Search Bar - Tighter */}
                            <div className="relative">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 opacity-30 text-white" />
                                <Input 
                                    placeholder="Search dishes..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="h-11 rounded-xl bg-white/5 border pl-10 text-xs text-white placeholder:text-white/20"
                                    style={{ borderColor: theme?.primaryColor + '10' }}
                                />
                            </div>

                            {/* Menu Sections - Tighter Gaps */}
                            {Object.entries(groupedMenu).map(([category, items]) => (
                                <section key={category} className="space-y-3">
                                    <h2 className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 px-1" style={{ color: theme?.textColor || '#fff' }}>{category}</h2>
                                    <div className="grid grid-cols-2 gap-2">
                                        {items.map((item) => (
                                            <MenuCard 
                                                key={item.id} 
                                                item={item} 
                                                onAdd={handleAddItem} 
                                                onShowDetails={handleShowIngredients} 
                                                isAdding={isAdding} 
                                                recentlyAdded={recentlyAdded.has(item.id)} 
                                                theme={theme} 
                                            />
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </>
                    )}
                </div>
              )}
            </div>
          </div>

          {/* Floating Bill Button - Scaled down */}
          {itemCount > 0 && ['Pending', 'Processing', 'Out for Delivery', 'Billed', 'Draft'].includes(order?.status || '') && (
               <Sheet><SheetTrigger asChild><div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-[200px] px-4"><Button className="h-12 w-full rounded-xl shadow-2xl text-[10px] font-black uppercase tracking-[0.1em] border border-white/10" style={{ backgroundColor: theme?.primaryColor || '#FBC02D', color: theme?.backgroundColor || '#1A1616' }}><Receipt className="mr-2 h-4 w-4" /> View {isSalon ? 'Booking' : 'Bill'} <Badge className="ml-2 h-5 min-w-[20px] rounded-md text-[9px] font-black shadow-inner" style={{ backgroundColor: theme?.backgroundColor || '#1A1616', color: theme?.primaryColor || '#FBC02D' }}>{itemCount}</Badge></Button></div></SheetTrigger><SheetContent side="bottom" className="h-[80vh] rounded-t-[2.5rem] p-0 border-0 overflow-hidden shadow-2xl"><LiveBillSheet orderId={order!.id} theme={theme} store={store} onShowUpi={() => setIsUpiDialogOpen(true)} isSalon={isSalon} /></SheetContent></Sheet>
          )}
        </div>
    </>
  );
}
