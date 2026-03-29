
'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Store, User as AppUser } from '@/lib/types';
import { useFirebase, errorEmitter, FirestorePermissionError, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  MapPin,
  ImageIcon,
  Loader2,
  Edit3,
  Save,
  Rocket,
  LocateFixed,
  Store as StoreIcon,
  CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { useAdminAuth } from '@/hooks/use-admin-auth';

const ADIRES_LOGO = "https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png";

const storeSchema = z.object({
  name: z.string().min(2, 'Store name is required'),
  businessType: z.enum(['restaurant', 'salon', 'grocery']),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  address: z.string().min(10, 'Please enter a valid address'),
  latitude: z.coerce.number().refine(n => n !== 0, "GPS Location is required"),
  longitude: z.coerce.number().refine(n => n !== 0, "GPS Location is required"),
});

type StoreFormValues = z.infer<typeof storeSchema>;

function InitializeStoreForm({ onComplete }: { onComplete: (storeId: string) => void }) {
    const { user, firestore } = useFirebase();
    const { toast } = useToast();
    const { setUserStore, incrementWriteCount } = useAppStore();
    const [isSaving, setIsSaving] = useState(false);
    const [isDetecting, setIsDetecting] = useState(false);

    const form = useForm<StoreFormValues>({
        resolver: zodResolver(storeSchema),
        defaultValues: {
            name: 'CHADE',
            businessType: 'restaurant',
            description: 'Professional hub for rapid operations and local commerce.',
            address: '',
            latitude: 0,
            longitude: 0,
        }
    });

    const handleDetectLocation = () => {
        if (!navigator.geolocation) {
            toast({ variant: 'destructive', title: "Not Supported", description: "Your browser does not support GPS." });
            return;
        }
        setIsDetecting(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                form.setValue('latitude', pos.coords.latitude, { shouldValidate: true });
                form.setValue('longitude', pos.coords.longitude, { shouldValidate: true });
                setIsDetecting(false);
                toast({ title: "GPS Locked", description: "Coordinates captured successfully." });
            },
            (err) => {
                setIsDetecting(false);
                toast({ variant: 'destructive', title: "GPS Error", description: "Could not capture your location. Check browser permissions." });
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const onSubmit = async (data: StoreFormValues) => {
        if (!user || !firestore) return;
        setIsSaving(true);
        try {
            const storeId = doc(collection(firestore, 'stores')).id;
            const storeRef = doc(firestore, 'stores', storeId);
            const userRef = doc(firestore, 'users', user.uid);

            const storeData: Store = {
                id: storeId,
                ownerId: user.uid,
                name: data.name,
                businessType: data.businessType,
                description: data.description,
                address: data.address,
                latitude: data.latitude,
                longitude: data.longitude,
                isClosed: false,
                imageId: `store-${Math.floor(Math.random() * 3) + 1}`,
                imageUrl: ADIRES_LOGO
            };

            await Promise.all([
                setDoc(storeRef, { ...storeData, createdAt: serverTimestamp() }),
                setDoc(userRef, { accountType: 'restaurant', address: data.address }, { merge: true })
            ]);

            // Optimistic update for instant branding visibility
            setUserStore(storeData);
            incrementWriteCount(1);
            
            toast({ title: "Business Launched!", description: "Your operational hub is now live." });
            onComplete(storeId);
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Setup Failed", description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden bg-white max-w-2xl mx-auto animate-in zoom-in-95 duration-500">
            <CardHeader className="bg-primary/5 border-b border-black/5 p-8 text-center">
                <div className="h-16 w-16 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto text-primary mb-4">
                    <Rocket className="h-8 w-8" />
                </div>
                <CardTitle className="text-2xl font-black uppercase tracking-tight">Launch Business Hub</CardTitle>
                <CardDescription className="text-xs font-bold uppercase tracking-widest opacity-40">Initialize your digital storefront</CardDescription>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="p-8 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase opacity-40">Business Name</FormLabel>
                                    <FormControl><Input {...field} className="h-12 rounded-xl border-2 font-bold" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="businessType" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase opacity-40">Category</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent className="rounded-xl border-2">
                                            <SelectItem value="restaurant" className="rounded-lg">Restaurant / Cafe</SelectItem>
                                            <SelectItem value="salon" className="rounded-lg">Salon / Spa</SelectItem>
                                            <SelectItem value="grocery" className="rounded-lg">Retail / Grocery</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase opacity-40">Short Bio</FormLabel>
                                <FormControl><Textarea {...field} className="min-h-[80px] rounded-2xl border-2 font-medium" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <div className="space-y-4">
                            <FormField control={form.control} name="address" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase opacity-40">Operational Address</FormLabel>
                                    <FormControl><Input placeholder="Full street address" {...field} className="h-12 rounded-xl border-2 font-bold" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            
                            <div className="p-4 rounded-2xl bg-muted/30 border-2 border-dashed border-black/5 flex flex-col items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <MapPin className={cn("h-4 w-4", form.watch('latitude') !== 0 ? "text-green-600" : "opacity-20")} />
                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40">
                                        {form.watch('latitude') !== 0 ? `GPS LOCKED: ${form.watch('latitude').toFixed(4)}, ${form.watch('longitude').toFixed(4)}` : 'GPS REQUIRED FOR DISPATCH'}
                                    </span>
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={handleDetectLocation} disabled={isDetecting} className="w-full h-11 rounded-xl font-black uppercase text-[10px] tracking-widest border-2 bg-white">
                                    {isDetecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LocateFixed className="h-4 w-4 mr-2" />}
                                    Sync GPS Coordinates
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                    <div className="p-8 bg-gray-50 border-t border-black/5 pb-12">
                        <Button type="submit" disabled={isSaving} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20">
                            {isSaving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                            Go Live as Merchant
                        </Button>
                    </div>
                </form>
            </Form>
        </Card>
    );
}

function StoreImageUploader({ store, onUpdate }: { store: Store, onUpdate?: () => void }) {
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const { incrementWriteCount } = useAppStore();
    const [isSaving, startSaveTransition] = useTransition();
    const [imageUrl, setImageUrl] = useState(store.imageUrl || '');

    useEffect(() => {
        setImageUrl(store.imageUrl || '');
    }, [store.imageUrl]);

    const handleSave = () => {
        if (!imageUrl) {
            toast({ variant: 'destructive', title: 'URL is required.' });
            return;
        }

        startSaveTransition(async () => {
            if (!firestore) return;
            const storeRef = doc(firestore, 'stores', store.id);
            const updateData = { imageUrl: imageUrl, updatedAt: serverTimestamp() };

            updateDoc(storeRef, updateData)
                .then(() => {
                    if (onUpdate) onUpdate();
                    toast({ title: 'Visual Updated!' });
                })
                .catch((e) => {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({
                        path: storeRef.path,
                        operation: 'update',
                        requestResourceData: updateData,
                    }));
                });
            
            incrementWriteCount(1);
        });
    };

    return (
        <Card className="rounded-[1.5rem] border-0 shadow-lg overflow-hidden bg-white">
            <CardContent className="p-3 space-y-3">
                <div className="flex justify-between items-center">
                    <h3 className="text-[9px] font-black uppercase tracking-widest opacity-40">Storefront Visual</h3>
                    <div className="flex gap-1.5">
                        <Input
                            placeholder="Direct URL..."
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            disabled={isSaving}
                            className="h-8 rounded-lg border-2 bg-muted/20 text-[10px] w-40"
                        />
                        <Button 
                            size="sm"
                            onClick={handleSave} 
                            disabled={isSaving} 
                            className="h-8 rounded-lg font-black uppercase text-[8px] tracking-widest px-3 shadow-md"
                        >
                            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                            Update
                        </Button>
                    </div>
                </div>
                <div className="w-full h-24 relative rounded-xl overflow-hidden border bg-muted">
                    <Image 
                        src={imageUrl || store.imageUrl || ADIRES_LOGO} 
                        alt="Storefront" 
                        fill 
                        className="object-cover" 
                    />
                </div>
            </CardContent>
        </Card>
    );
}

function StoreDetails({ store, onUpdate }: { store: Store, onUpdate: () => void }) {
    const { firestore } = useFirebase();
    const { incrementWriteCount } = useAppStore();
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    
    const form = useForm<StoreFormValues>({
        resolver: zodResolver(storeSchema),
        defaultValues: {
            name: store.name,
            businessType: store.businessType || 'restaurant',
            description: store.description,
            address: store.address,
            latitude: store.latitude,
            longitude: store.longitude,
        },
    });
    
    const onSubmit = (data: StoreFormValues) => {
        if (!firestore) return;
        startTransition(() => {
            const storeRef = doc(firestore, 'stores', store.id);
            updateDoc(storeRef, { ...data, updatedAt: serverTimestamp() })
                .catch((e) => {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({
                        path: storeRef.path,
                        operation: 'update',
                        requestResourceData: data,
                    }));
                });
            
            toast({ title: "Profile Synchronized!" });
            incrementWriteCount(1);
            setIsOpen(false);
            onUpdate();
        });
    };

    return (
        <Card className="rounded-[1.5rem] border-0 shadow-lg overflow-hidden bg-white">
            <CardHeader className="flex flex-row justify-between items-center bg-primary/5 border-b border-black/5 p-3">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-gray-950">Business Profile</CardTitle>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="rounded-lg font-black text-[8px] uppercase tracking-widest border-2 h-7 px-3 gap-1">
                            <Edit3 className="h-3 w-3" /> Edit
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-[2rem] border-0 shadow-2xl">
                        <DialogHeader>
                            <DialogTitle className="font-black uppercase">Edit Business Hub</DialogTitle>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
                                <FormField control={form.control} name="name" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[9px] uppercase font-black opacity-40">Store Name</FormLabel><FormControl><Input {...field} className="h-10 rounded-xl border-2" /></FormControl></FormItem>
                                )}/>
                                <FormField control={form.control} name="address" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[9px] uppercase font-black opacity-40">Address</FormLabel><FormControl><Input {...field} className="h-10 rounded-xl border-2" /></FormControl></FormItem>
                                )}/>
                                <FormField control={form.control} name="description" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[9px] uppercase font-black opacity-40">Bio</FormLabel><FormControl><Textarea {...field} className="min-h-[80px] rounded-xl border-2" /></FormControl></FormItem>
                                )}/>
                                <Button type="submit" disabled={isPending} className="w-full h-11 rounded-xl font-black uppercase tracking-widest text-[9px]">
                                    {isPending ? 'Syncing...' : 'Save Updates'}
                                </Button>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent className="p-3">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-0.5 text-left">
                        <p className="text-[8px] font-black uppercase opacity-40 tracking-widest">Address</p>
                        <p className="font-bold text-gray-700 text-[11px] leading-tight truncate">{store.address}</p>
                    </div>
                    <div className="space-y-0.5 text-right">
                        <p className="text-[8px] font-black uppercase opacity-40 tracking-widest">GPS Meta</p>
                        <p className="font-mono font-bold text-primary flex items-center justify-end gap-1 text-[10px]">
                            <MapPin className="h-2.5 w-2.5" /> {store.latitude?.toFixed(2)}, {store.longitude?.toFixed(2)}
                        </p>
                    </div>
                </div>
                <div className="mt-3 pt-2 border-t border-black/5 text-left">
                    <p className="text-[8px] font-black uppercase opacity-40 tracking-widest mb-0.5">Business Bio</p>
                    <p className="text-gray-600 font-bold text-[10px] leading-tight truncate">{store.description}</p>
                </div>
            </CardContent>
        </Card>
    );
}

export default function MyStorePage() {
    const { user, firestore } = useFirebase();
    const { isRestaurantOwner, isLoading: isRoleLoading } = useAdminAuth();
    const { userStore, fetchUserStore, isUserDataLoaded } = useAppStore();

    useEffect(() => {
        if (firestore && user && !userStore) {
            fetchUserStore(firestore, user.uid);
        }
    }, [firestore, user, userStore, fetchUserStore]);

    if (isRoleLoading) return <div className="p-12 text-center h-[80vh] flex flex-col items-center justify-center gap-4"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div>;

    if (!userStore && isUserDataLoaded) {
        return (
            <div className="container mx-auto py-12 px-4 animate-in fade-in duration-700">
                <InitializeStoreForm onComplete={() => firestore && fetchUserStore(firestore, user!.uid)} />
            </div>
        );
    }

    if (!userStore) return null;

    return (
        <div className="container mx-auto py-3 px-3 space-y-3 pb-24 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 gap-3">
                <StoreDetails store={userStore} onUpdate={() => fetchUserStore(firestore!, user!.uid)} />
                <StoreImageUploader store={userStore} onUpdate={() => fetchUserStore(firestore!, user!.uid)} />
                <Button asChild variant="outline" className="w-full h-11 rounded-xl border-2 border-primary/20 bg-primary/5 text-primary font-black uppercase text-[9px] tracking-widest hover:bg-primary/10 shadow-sm transition-all active:scale-95">
                    <Link href="/dashboard/owner/menu-manager">
                        <ImageIcon className="mr-2 h-4 w-4" /> Go to Digital Menu
                    </Link>
                </Button>
            </div>
        </div>
    );
}
