
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
    Loader2
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
        <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden bg-white max-w-2xl mx-auto">
            <CardHeader className="bg-primary/5 border-b border-black/5 p-8 text-center">
                <CardTitle className="text-2xl font-black uppercase tracking-tight">Business Identity</CardTitle>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="p-8 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>Store Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                            )} />
                            <FormField control={form.control} name="businessType" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Business Category</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="restaurant">Restaurant</SelectItem>
                                            <SelectItem value="salon">Salon / Spa</SelectItem>
                                            <SelectItem value="grocery">Grocery Store</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem><FormLabel>Bio</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="address" render={({ field }) => (
                            <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )} />
                        <Button type="button" variant="outline" size="sm" onClick={handleDetectLocation} disabled={isDetecting} className="w-full h-12 rounded-xl">
                            Detect GPS Location
                        </Button>
                    </CardContent>
                    <div className="p-8 bg-gray-50 border-t border-black/5">
                        <Button type="submit" disabled={isSaving} className="w-full h-14 rounded-2xl font-black uppercase">
                            Launch My Business
                        </Button>
                    </div>
                </form>
            </Form>
        </Card>
    );
}

export default function MerchantDashboardPage() {
    const { user, firestore } = useFirebase();
    const { isMerchant, isLoading } = useAdminAuth();
    const router = useRouter();
    const { userStore, fetchUserStore, isInitialized } = useAppStore();
    const [hasFetched, setHasFetched] = useState(false);

    useEffect(() => {
        if (isLoading) return;
        if (!user) { router.replace('/login'); return; }
        if (!isMerchant) { router.replace('/dashboard'); return; }

        if (firestore && !userStore && !hasFetched) {
            setHasFetched(true);
            fetchUserStore(firestore, user.uid);
        }
    }, [isLoading, isMerchant, user, firestore, userStore, hasFetched, fetchUserStore, router]);

    const serviceLinks = useMemo(() => {
        const isSalon = userStore?.businessType === 'salon';
        return [
            { title: 'MY STORE', description: 'Manage products & profile', href: '/dashboard/owner/my-store', icon: Store },
            { title: isSalon ? 'BOOKINGS' : 'STORE ORDERS', description: isSalon ? 'Live appointments' : 'Live table orders', href: isSalon ? '/dashboard/owner/bookings' : '/dashboard/owner/orders', icon: isSalon ? CalendarCheck : ShoppingBag, highlight: true },
            { title: 'MESSAGES', description: 'Customer support chat', href: '/chat', icon: MessageSquare },
            { title: 'ANALYTICS', description: 'Sales & profit insights', href: '/dashboard/owner/sales-report', icon: BarChart3 },
            { title: 'EMPLOYEES', description: 'Staff & Payroll', href: '/dashboard/owner/employees', icon: Users },
            { title: 'OFFLINE AUDIT', description: 'Audit device persistence', href: '/dashboard/offline-audit', icon: Smartphone }
        ];
    }, [userStore]);

    if (isLoading) return <div className="p-12 text-center opacity-20"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>;
    
    if (!userStore && isInitialized) {
        return (
            <div className="container mx-auto px-4 py-12 max-w-4xl space-y-12 animate-in fade-in duration-700">
                <CreateStoreForm onComplete={() => firestore && fetchUserStore(firestore, user!.uid)} />
            </div>
        );
    }

    return (
        <div className="container mx-auto px-3 py-3 max-w-2xl space-y-3 pb-24">
            <div className="flex items-center gap-3 border-b pb-3 border-black/5">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                    {userStore?.businessType === 'salon' ? <Scissors className="h-5 w-5" /> : <Utensils className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                    <h1 className="text-sm font-black uppercase tracking-tight truncate leading-none">{userStore?.name || 'My Hub'}</h1>
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">Operational Control</p>
                </div>
            </div>

            <div className="space-y-2">
                {serviceLinks.map((card) => (
                    <a href={card.href} key={card.href} className="group block">
                        <Card className={cn(
                            "rounded-2xl border-0 shadow-sm transition-all active:scale-[0.98] bg-white border-2 border-transparent hover:border-primary/10",
                            card.highlight && "bg-primary/5 ring-1 ring-primary/10 border-primary/20"
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
                    </a>
                ))}
            </div>
        </div>
    );
}
