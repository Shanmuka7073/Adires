
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { 
    ArrowRight, 
    Store, 
    ShoppingBag, 
    Users, 
    FileText, 
    Scissors, 
    Utensils, 
    Loader2, 
    BarChart3, 
    WifiOff, 
    Download, 
    Smartphone,
    CheckCircle2,
    Sparkles,
    MapPin,
    LocateFixed,
    Save,
    ShoppingBasket,
    MessageSquare
} from 'lucide-react';
import Link from 'next/link';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useFirebase } from '@/firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { useInstall } from '@/components/install-provider';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';

const createStoreSchema = z.object({
  name: z.string().min(3, 'Store name must be at least 3 characters'),
  businessType: z.enum(['restaurant', 'salon', 'grocery']),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  address: z.string().min(10, 'Please enter a valid address'),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
});

type CreateStoreFormValues = z.infer<typeof createStoreSchema>;

function CreateStoreForm({ onComplete }: { onComplete: (storeId: string) => void }) {
    const { user, firestore } = useFirebase();
    const { toast } = useToast();
    const [isSaving, startSave] = useTransition();
    const [isDetecting, setIsDetecting] = useState(false);

    const form = useForm<CreateStoreFormValues>({
        resolver: zodResolver(createStoreSchema),
        defaultValues: {
            name: '',
            businessType: 'restaurant',
            description: '',
            address: '',
            latitude: 0,
            longitude: 0,
        }
    });

    const handleDetectLocation = () => {
        if (!navigator.geolocation) {
            toast({ variant: 'destructive', title: "Not Supported", description: "GPS is not available in this browser." });
            return;
        }

        setIsDetecting(true);
        navigator.geolocation.getCurrentPosition((pos) => {
            const { latitude, longitude } = pos.coords;
            form.setValue('latitude', latitude, { shouldValidate: true });
            form.setValue('longitude', longitude, { shouldValidate: true });
            toast({ title: "Location Captured!", description: `Coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}` });
            setIsDetecting(false);
        }, () => {
            toast({ variant: 'destructive', title: "Access Denied", description: "Please enable location permissions or enter coordinates manually." });
            setIsDetecting(false);
        });
    };

    const onSubmit = (data: CreateStoreFormValues) => {
        if (!user || !firestore) return;

        startSave(async () => {
            try {
                const storeId = doc(collection(firestore, 'stores')).id;
                const storeRef = doc(firestore, 'stores', storeId);

                const storeData = {
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
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                };

                await setDoc(storeRef, storeData);
                toast({ title: "Store Created!", description: "Welcome to the Adires marketplace." });
                onComplete(storeId);
            } catch (error: any) {
                toast({ variant: 'destructive', title: "Setup Failed", description: error.message });
            }
        });
    };

    return (
        <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden bg-white max-w-2xl mx-auto">
            <CardHeader className="bg-primary/5 border-b border-black/5 p-8 text-center">
                <div className="mx-auto h-16 w-16 rounded-3xl bg-primary flex items-center justify-center text-white shadow-xl shadow-primary/20 mb-4">
                    <Store className="h-8 w-8" />
                </div>
                <CardTitle className="text-2xl font-black uppercase tracking-tight">Business Identity</CardTitle>
                <CardDescription className="font-bold text-[10px] uppercase opacity-40 tracking-[0.2em]">
                    Digital Storefront Activation
                </CardDescription>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="p-8 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase opacity-40">Store Name</FormLabel>
                                    <FormControl><Input placeholder="e.g., Royal Tiffins" {...field} className="h-12 rounded-xl border-2 font-bold" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="businessType" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase opacity-40">Business Category</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="h-12 rounded-xl border-2 font-bold">
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="rounded-xl border-2">
                                            <SelectItem value="restaurant" className="rounded-lg">
                                                <div className="flex items-center gap-2"><Utensils className="h-3 w-3" /> Restaurant</div>
                                            </SelectItem>
                                            <SelectItem value="salon" className="rounded-lg">
                                                <div className="flex items-center gap-2"><Scissors className="h-3 w-3" /> Salon / Spa</div>
                                            </SelectItem>
                                            <SelectItem value="grocery" className="rounded-lg">
                                                <div className="flex items-center gap-2"><ShoppingBasket className="h-3 w-3" /> Grocery Store</div>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase opacity-40">Business Bio</FormLabel>
                                <FormControl><Textarea placeholder="Tell customers what makes your store special..." {...field} className="min-h-[100px] rounded-2xl border-2 font-medium" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField control={form.control} name="address" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase opacity-40">Physical Address</FormLabel>
                                <FormControl><Input placeholder="Complete address for customers" {...field} className="h-12 rounded-xl border-2 font-bold" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <div className="p-6 rounded-2xl bg-muted/30 border-2 border-dashed border-black/10 space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="text-[10px] font-black uppercase opacity-40">GPS Coordinates</h4>
                                <Button type="button" variant="outline" size="sm" onClick={handleDetectLocation} disabled={isDetecting} className="h-8 rounded-lg text-[8px] font-black uppercase bg-white border-2">
                                    {isDetecting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <LocateFixed className="h-3 w-3 mr-1" />}
                                    Auto-Detect
                                </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="latitude" render={({ field }) => (
                                    <FormItem><FormControl><Input type="number" step="any" {...field} className="h-10 rounded-lg text-xs font-mono" placeholder="Lat" /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="longitude" render={({ field }) => (
                                    <FormItem><FormControl><Input type="number" step="any" {...field} className="h-10 rounded-lg text-xs font-mono" placeholder="Lng" /></FormControl></FormItem>
                                )} />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="p-8 bg-gray-50 border-t border-black/5">
                        <Button type="submit" disabled={isSaving} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl shadow-primary/20">
                            {isSaving ? (
                                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Finalizing Profile...</>
                            ) : (
                                <><CheckCircle2 className="mr-2 h-5 w-5" /> Launch My Business</>
                            )}
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}

export default function ServiceDashboardPage() {
    const { user, firestore } = useFirebase();
    const { isRestaurantOwner, isAdmin, isLoading } = useAdminAuth();
    const router = useRouter();
    const { stores, userStore, fetchUserStore, isInitialized } = useAppStore();
    const { canInstall, triggerInstall } = useInstall();

    const store = useMemo(() => {
        if (userStore) return userStore;
        return stores.find(s => s.ownerId === user?.uid);
    }, [userStore, stores, user?.uid]);

    useEffect(() => {
        if (!isLoading) {
            if (!user) {
                router.replace('/login?redirectTo=/dashboard/restaurant');
            } else if (!isRestaurantOwner && !isAdmin) {
                router.replace('/dashboard');
            }
        }
    }, [isLoading, user, isRestaurantOwner, isAdmin, router]);

    useEffect(() => {
        if (firestore && user && !store && isInitialized) {
            fetchUserStore(firestore, user.uid);
        }
    }, [firestore, user, store, isInitialized, fetchUserStore]);

    const { dashboardTitle, DashboardIcon, serviceLinks } = useMemo(() => {
        const isSalon = store?.businessType === 'salon';
        
        const links = [
            { title: 'MY STORE', description: 'Manage products & orders', href: '/dashboard/owner/my-store', icon: Store },
            { title: isSalon ? 'BOOKINGS' : 'STORE ORDERS', description: isSalon ? 'Live appointments' : 'Live table orders', href: isSalon ? '/dashboard/owner/bookings' : '/dashboard/owner/orders', icon: ShoppingBag },
            { title: 'MESSAGES', description: 'Customer support chat', href: '/chat', icon: MessageSquare },
            { title: 'ANALYTICS', description: 'Sales & profit insights', href: '/dashboard/owner/sales-report', icon: BarChart3, highlight: true },
            { title: 'OFFLINE AUDIT', description: 'Device sync status', href: '/dashboard/offline-audit', icon: WifiOff },
            { title: 'EMPLOYEES', description: 'Manage staff', href: '/dashboard/owner/employees', icon: Users },
            { title: 'SALARY', description: 'Salary reports', href: '/dashboard/owner/salary', icon: FileText }
        ];

        if (isSalon) return { dashboardTitle: 'Salon Hub', DashboardIcon: Scissors, serviceLinks: links };
        return { dashboardTitle: 'Restaurant Hub', DashboardIcon: Utensils, serviceLinks: links };
    }, [store]);

    if (isLoading) {
        return (
            <div className="h-[80vh] flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin h-10 w-10 text-primary opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Verifying Authority...</p>
            </div>
        );
    }

    if (!user || (!isRestaurantOwner && !isAdmin)) {
        return null;
    }

    if (!store && isInitialized) {
        return (
            <div className="container mx-auto px-4 py-12 max-w-4xl space-y-12 animate-in fade-in duration-700">
                <div className="text-center space-y-2">
                    <h1 className="text-5xl font-black font-headline tracking-tighter uppercase italic text-gray-950">Welcome Partner</h1>
                    <p className="text-muted-foreground font-bold text-[10px] tracking-widest uppercase opacity-40">Let's build your digital presence</p>
                </div>
                
                <CreateStoreForm onComplete={() => {
                    if (firestore && user) fetchUserStore(firestore, user.uid);
                }} />

                <div className="max-w-2xl mx-auto p-8 rounded-[3rem] bg-white border-2 border-black/5 shadow-sm flex items-start gap-6">
                    <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary shrink-0">
                        <Sparkles className="h-6 w-6" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="font-black uppercase text-xs tracking-tight">Setup Instructions</h3>
                        <p className="text-[11px] font-bold text-gray-500 leading-relaxed uppercase">
                            Fill in your business details above to generate your public hub. After creation, you can upload a logo and add products to your digital menu.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-3 py-3 max-w-2xl space-y-3 pb-24 animate-in fade-in duration-500">
            <div className="flex items-center gap-3 border-b pb-3 border-black/5">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                    <DashboardIcon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                    <h1 className="text-sm font-black uppercase tracking-tight truncate leading-none">{dashboardTitle}</h1>
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">Operational Control</p>
                </div>
                <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-green-600 bg-green-50 px-2.5 py-1.5 rounded-full border border-green-100 shadow-sm">
                    <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                    Online
                </div>
            </div>

            <div className="space-y-2">
                {serviceLinks.map((card) => (
                    <Link href={card.href} key={card.href} className="group block">
                        <Card className={cn(
                            "rounded-2xl border-0 shadow-sm transition-all active:scale-[0.98] bg-white border-2 border-transparent hover:border-primary/10",
                            card.highlight && "bg-primary/5 ring-1 ring-primary/10"
                        )}>
                            <div className="flex items-center gap-3 p-2.5">
                                <div className={cn(
                                    "h-9 w-9 rounded-xl flex items-center justify-center shadow-inner shrink-0",
                                    card.highlight ? "bg-primary text-white" : "bg-primary/5 text-primary"
                                )}>
                                    <card.icon className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-[11px] font-black uppercase tracking-tight text-gray-950 leading-none">{card.title}</h3>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter mt-1 leading-none truncate">{card.description}</p>
                                </div>
                                <ArrowRight className="h-3.5 w-3.5 text-primary opacity-20 group-hover:opacity-100 transition-opacity shrink-0" />
                            </div>
                        </Card>
                    </Link>
                ))}
            </div>

            {canInstall && (
                <Card className="rounded-2xl bg-gray-950 text-white p-3 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 rotate-12 transition-transform group-hover:rotate-45 duration-700">
                        <Smartphone className="h-12 w-12" />
                    </div>
                    <div className="flex items-center justify-between relative z-10">
                        <div className="min-w-0">
                            <h2 className="text-[10px] font-black uppercase tracking-widest text-primary">Native Experience</h2>
                            <p className="text-[8px] font-bold opacity-40 uppercase tracking-tighter mt-0.5">Install the Adires Pro Shell</p>
                        </div>
                        <Button onClick={triggerInstall} className="h-8 px-4 bg-white text-gray-950 text-[9px] font-black uppercase tracking-widest rounded-lg shadow-xl">
                            <Download className="mr-1.5 h-3 w-3" /> Install
                        </Button>
                    </div>
                </Card>
            )}

            <Card className="rounded-2xl border-0 shadow-sm bg-white p-3 flex items-center justify-between gap-4 group">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-black/5 flex items-center justify-center text-gray-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        <Smartphone className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-[10px] font-black uppercase tracking-tight text-gray-950 leading-none">Identity Sync</h3>
                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter mt-1">Audit device persistence</p>
                    </div>
                </div>
                <Button asChild variant="outline" className="rounded-lg font-black text-[8px] uppercase tracking-widest border-2 h-8 px-3 shrink-0">
                    <Link href="/dashboard/offline-audit">Open Audit</Link>
                </Button>
            </Card>
        </div>
    );
}
