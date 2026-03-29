
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
    ArrowRight, 
    Store, 
    ShoppingBag, 
    Users, 
    BarChart3, 
    Smartphone,
    MessageSquare,
    CalendarCheck,
    Utensils,
    Scissors,
    Loader2,
    Zap,
    LayoutGrid,
    Monitor,
    RefreshCw
} from 'lucide-react';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { doc, collection, serverTimestamp, setDoc } from 'firebase/firestore';
import GlobalLoader from '@/components/layout/global-loader';

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
    const [isSaving, setIsSaving] = useState(false);
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
            toast({ variant: 'destructive', title: "Not Supported" });
            return;
        }
        setIsDetecting(true);
        navigator.geolocation.getCurrentPosition((pos) => {
            form.setValue('latitude', pos.coords.latitude, { shouldValidate: true });
            form.setValue('longitude', pos.coords.longitude, { shouldValidate: true });
            setIsDetecting(false);
        }, () => setIsDetecting(false));
    };

    const onSubmit = async (data: CreateStoreFormValues) => {
        if (!user || !firestore) return;
        setIsSaving(true);
        try {
            const storeId = doc(collection(firestore, 'stores')).id;
            const storeRef = doc(firestore, 'stores', storeId);
            const userRef = doc(firestore, 'users', user.uid);

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

            await Promise.all([
                setDoc(storeRef, storeData),
                setDoc(userRef, { accountType: 'restaurant' }, { merge: true })
            ]);

            toast({ title: "Store Created!" });
            onComplete(storeId);
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Setup Failed", description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden bg-white max-w-2xl mx-auto mt-12">
            <CardHeader className="bg-primary/5 border-b border-black/5 p-8 text-center">
                <CardTitle className="text-2xl font-black uppercase tracking-tight italic">Business Identity</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-40">Configure your digital storefront</CardDescription>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="p-8 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase opacity-40">Store Name</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl border-2 font-bold" /></FormControl></FormItem>
                            )} />
                            <FormField control={form.control} name="businessType" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase opacity-40">Business Category</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent className="rounded-xl border-2">
                                            <SelectItem value="restaurant" className="rounded-lg">Restaurant</SelectItem>
                                            <SelectItem value="salon" className="rounded-lg">Salon / Spa</SelectItem>
                                            <SelectItem value="grocery" className="rounded-lg">Grocery Store</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] font-black uppercase opacity-40">Business Bio</FormLabel><FormControl><Textarea {...field} className="min-h-[80px] rounded-xl border-2 font-medium" /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="address" render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] font-black uppercase opacity-40">Physical Address</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl border-2 font-bold" /></FormControl></FormItem>
                        )} />
                        <Button type="button" variant="outline" size="sm" onClick={handleDetectLocation} disabled={isDetecting} className="w-full h-12 rounded-xl border-2 font-black uppercase text-[10px] tracking-widest bg-white">
                            {isDetecting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <LayoutGrid className="h-4 w-4 mr-2" />}
                            Detect GPS Location
                        </Button>
                    </CardContent>
                    <div className="p-8 bg-gray-50 border-t border-black/5">
                        <Button type="submit" disabled={isSaving} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20">
                            {isSaving ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : 'Launch My Business'}
                        </Button>
                    </div>
                </form>
            </Form>
        </Card>
    );
}

export default function MerchantDashboardPage() {
    const { user, firestore } = useFirebase();
    const { isMerchant, isLoading, isAdmin } = useAdminAuth();
    const router = useRouter();
    const { userStore, fetchUserStore, isInitialized, isUserDataLoaded } = useAppStore();

    useEffect(() => {
        if (isLoading) return;
        if (!user) { router.replace('/login'); return; }
        if (!isMerchant) { router.replace('/dashboard'); return; }

        if (firestore && !userStore && !isUserDataLoaded) {
            fetchUserStore(firestore, user.uid);
        }
    }, [isLoading, isMerchant, user, firestore, userStore, isUserDataLoaded, fetchUserStore, router]);

    const serviceLinks = useMemo(() => {
        const isSalon = userStore?.businessType === 'salon';
        return [
            { title: 'POS Terminal', description: 'Counter billing & walk-ins', href: '/dashboard/owner/pos', icon: Monitor, highlight: true },
            { title: isSalon ? 'Live Bookings' : 'Live Orders', description: isSalon ? 'Appointments queue' : 'Active table sessions', href: isSalon ? '/dashboard/owner/bookings' : '/dashboard/owner/orders', icon: isSalon ? CalendarCheck : ShoppingBag, highlight: true },
            { title: 'Hub Messenger', description: 'Customer support chat', href: '/chat', icon: MessageSquare },
            { title: 'Operational Analytics', description: 'Gross profit & check trends', href: '/dashboard/owner/sales-report', icon: BarChart3 },
            { title: 'Digital Menu Hub', description: 'Catalog & QR assignments', href: '/dashboard/owner/menu-manager', icon: Utensils },
            { title: 'Business Profile', description: 'Manage storefront & photo', href: '/dashboard/owner/my-store', icon: Store }
        ];
    }, [userStore]);

    if (isLoading || !isUserDataLoaded) return <GlobalLoader />;
    
    if (!userStore && isInitialized) {
        return (
            <div className="container mx-auto px-4 py-12 max-w-4xl space-y-12 animate-in fade-in duration-700">
                <CreateStoreForm onComplete={() => firestore && fetchUserStore(firestore, user!.uid)} />
            </div>
        );
    }

    return (
        <div className="container mx-auto px-3 py-6 max-w-2xl space-y-6 pb-24 animate-in fade-in duration-500">
            <div className="flex items-center gap-4 border-b pb-6 border-black/5">
                <div className="h-14 w-14 rounded-3xl bg-primary/10 flex items-center justify-center text-primary shadow-inner border-2 border-white">
                    {userStore?.businessType === 'salon' ? <Scissors className="h-7 w-7" /> : <Utensils className="h-7 w-7" />}
                </div>
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-black uppercase tracking-tight truncate leading-none text-gray-950 italic">{userStore?.name || 'Business Hub'}</h1>
                    <div className="flex items-center gap-2 mt-2">
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest">Operational Hub</p>
                        <div className="h-1 w-1 rounded-full bg-black/10" />
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{userStore?.businessType}</p>
                    </div>
                </div>
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-2" onClick={() => window.location.reload()}>
                    <RefreshCw className="h-4 w-4 opacity-40" />
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {serviceLinks.map((card) => (
                    <a href={card.href} key={card.href} className="group block">
                        <Card className={cn(
                            "rounded-2xl border-0 shadow-lg transition-all active:scale-[0.98] bg-white border-2 border-transparent hover:border-primary/10",
                            card.highlight && "bg-primary/5 ring-2 ring-primary/10 border-primary/20"
                        )}>
                            <div className="flex items-center gap-4 p-4">
                                <div className={cn(
                                    "h-12 w-12 rounded-2xl flex items-center justify-center shadow-inner shrink-0",
                                    card.highlight ? "bg-primary text-white" : "bg-primary/5 text-primary"
                                )}>
                                    <card.icon className="h-6 w-6" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-black uppercase tracking-tight text-gray-950 leading-none">{card.title}</h3>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1.5 leading-none truncate">{card.description}</p>
                                </div>
                                <ArrowRight className="h-4 w-4 text-primary opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all shrink-0" />
                            </div>
                        </Card>
                    </a>
                ))}
            </div>

            <Card className="rounded-[2.5rem] border-0 shadow-xl bg-slate-900 text-white p-8 overflow-hidden relative mt-6">
                <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
                    <Zap className="h-24 w-24" />
                </div>
                <div className="relative z-10 space-y-2">
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary">System Pulse</h3>
                    <p className="text-sm font-bold opacity-60 leading-relaxed uppercase">
                        All local table sessions are synchronized with the kitchen display. Ensure your device has a stable internet connection for live updates.
                    </p>
                </div>
            </Card>
        </div>
    );
}
