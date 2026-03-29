
'use client';

import { 
    Card, 
    CardContent, 
    CardHeader, 
    CardTitle, 
    CardDescription 
} from '@/components/ui/card';
import { 
    ArrowRight, 
    Store, 
    ShoppingBag, 
    BarChart3, 
    Smartphone,
    MessageSquare,
    CalendarCheck,
    Utensils,
    Scissors,
    Loader2,
    RefreshCw,
    MapPin,
    Camera,
    Upload as UploadIcon,
    Sparkles,
    Zap,
    Monitor,
    XCircle
} from 'lucide-react';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition, useRef } from 'react';
import { useFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { useAppStore } from '@/lib/store';
import { cn, createSlug } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { doc, collection, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import GlobalLoader from '@/components/layout/global-loader';
import { ScrollArea } from '@/components/ui/scroll-area';
import { extractMenuItems } from '@/ai/flows/extract-menu-items-flow';
import type { MenuItem, MenuTheme } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';

const createStoreSchema = z.object({
  name: z.string().min(3, 'Store name must be at least 3 characters'),
  address: z.string().min(10, 'Please enter a valid address'),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
});

type CreateStoreFormValues = z.infer<typeof createStoreSchema>;

function MenuOnboardingTool({ storeId, onComplete }: { storeId: string, onComplete: () => void }) {
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const { incrementWriteCount } = useAppStore();
    const [isProcessing, startProcessing] = useTransition();
    const [isSaving, startSave] = useTransition();
    const [extractedData, setExtractedData] = useState<{items: MenuItem[], theme: MenuTheme, businessType: 'restaurant' | 'salon' | 'grocery'} | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        startProcessing(async () => {
            try {
                const reader = new FileReader();
                const imageData = await new Promise<string>((resolve) => {
                    reader.onload = (e) => resolve(e.target?.result as string);
                    reader.readAsDataURL(file);
                });
                const result = await extractMenuItems({ menuImage: imageData });
                if (result && result.items) {
                    setExtractedData({
                        items: result.items.map(i => ({ ...i, id: createSlug(i.name), isAvailable: true })),
                        theme: result.theme,
                        businessType: result.businessType
                    });
                    toast({ title: "Identity Confirmed", description: `Detected: ${result.businessType.toUpperCase()}` });
                }
            } catch (error: any) {
                toast({ variant: 'destructive', title: 'AI Extraction Failed' });
            }
        });
    };

    const handleSaveMenu = () => {
        if (!firestore || !extractedData) return;
        startSave(async () => {
            const batch = writeBatch(firestore);
            const menuRef = doc(collection(firestore, `stores/${storeId}/menus`));
            
            batch.set(menuRef, { 
                id: menuRef.id, 
                storeId, 
                items: extractedData.items, 
                theme: extractedData.theme,
                createdAt: serverTimestamp()
            });

            batch.update(doc(firestore, 'stores', storeId), { 
                businessType: extractedData.businessType,
                updatedAt: serverTimestamp()
            });

            await batch.commit();
            toast({ title: "Store is Live!", description: `Ready for ${extractedData.businessType} operations.` });
            incrementWriteCount(2);
            onComplete();
        });
    };

    return (
        <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden bg-white max-w-2xl mx-auto mt-12 mb-20">
            <CardHeader className="bg-primary/5 border-b border-black/5 p-8 text-center">
                <div className="h-16 w-16 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto text-primary mb-4">
                    <Camera className="h-8 w-8" />
                </div>
                <CardTitle className="text-3xl font-black uppercase tracking-tight italic">Finalize Identity</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-40">Scan menu to determine business type</CardDescription>
            </CardHeader>

            <CardContent className="p-8">
                {extractedData ? (
                    <div className="space-y-6">
                        <div className="p-4 rounded-2xl bg-indigo-50 border-2 border-indigo-100 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">AI Classification</p>
                                <p className="text-xl font-black uppercase tracking-tight text-indigo-900 italic">{extractedData.businessType}</p>
                            </div>
                            <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                                {extractedData.businessType === 'restaurant' && <Utensils className="h-5 w-5 text-indigo-600" />}
                                {extractedData.businessType === 'salon' && <Scissors className="h-5 w-5 text-indigo-600" />}
                                {extractedData.businessType === 'grocery' && <ShoppingBag className="h-5 w-5 text-indigo-600" />}
                            </div>
                        </div>

                        <ScrollArea className="h-64 rounded-2xl border-2 shadow-inner bg-gray-50">
                            <Table>
                                <TableHeader className="bg-black/5">
                                    <TableRow>
                                        <TableHead className="text-[9px] font-black uppercase">Item</TableHead>
                                        <TableHead className="text-right text-[9px] font-black uppercase">Price</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {extractedData.items.map((i, idx) => (
                                        <TableRow key={idx} className="border-b last:border-0 border-black/5">
                                            <TableCell className="font-bold text-xs uppercase">{i.name}</TableCell>
                                            <TableCell className="text-right font-black text-primary">₹{i.price}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                ) : (
                    <div className="flex flex-col items-center py-10">
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                        <Button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="w-full h-20 rounded-[2rem] font-black uppercase tracking-widest shadow-xl shadow-primary/20 text-sm">
                            {isProcessing ? <><Loader2 className="mr-3 h-6 w-6 animate-spin" /> Analyzing Menu...</> : <><UploadIcon className="mr-3 h-6 w-6" /> Upload Menu Photo</>}
                        </Button>
                        <p className="text-[9px] font-bold opacity-40 uppercase mt-8 text-center leading-relaxed">
                            AI will extract items and automatically set your business type.
                        </p>
                    </div>
                )}
            </CardContent>

            {extractedData && (
                <div className="p-8 bg-gray-50 border-t border-black/5">
                    <div className="flex gap-2">
                        <Button onClick={handleSaveMenu} disabled={isSaving} className="flex-1 h-16 rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20">
                            {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <><CheckCircle2 className="h-6 w-6 mr-2" /> Save & Launch Hub</>}
                        </Button>
                        <Button variant="ghost" onClick={() => setExtractedData(null)} className="h-16 rounded-[2rem] font-bold px-6">Retry</Button>
                    </div>
                </div>
            )}
        </Card>
    );
}

function CreateStoreForm({ onComplete }: { onComplete: (storeId: string) => void }) {
    const { user, firestore } = useFirebase();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [isDetecting, setIsDetecting] = useState(false);

    const form = useForm<CreateStoreFormValues>({
        resolver: zodResolver(createStoreSchema),
        defaultValues: { name: '', address: '', latitude: 0, longitude: 0 }
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
            toast({ title: "GPS Locked" });
        }, (err) => {
            setIsDetecting(false);
            toast({ variant: 'destructive', title: "GPS Error", description: err.message });
        });
    };

    const onSubmit = async (data: CreateStoreFormValues) => {
        if (!user || !firestore) return;
        setIsSaving(true);
        try {
            const storeId = doc(collection(firestore, 'stores')).id;
            const storeRef = doc(firestore, 'stores', storeId);
            const userRef = doc(firestore, 'users', user.uid);

            await Promise.all([
                setDoc(storeRef, {
                    id: storeId,
                    ownerId: user.uid,
                    name: data.name,
                    address: data.address,
                    latitude: data.latitude,
                    longitude: data.longitude,
                    isClosed: false,
                    imageId: `store-${Math.floor(Math.random() * 3) + 1}`,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                }),
                setDoc(userRef, { 
                    id: user.uid, 
                    accountType: 'restaurant',
                    address: data.address,
                    latitude: data.latitude,
                    longitude: data.longitude
                }, { merge: true })
            ]);

            toast({ title: "Basic Profile Created", description: "Next: Confirm your business type via menu scan." });
            onComplete(storeId);
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Setup Failed", description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden bg-white max-w-2xl mx-auto mt-12 mb-20">
            <CardHeader className="bg-primary/5 border-b border-black/5 p-8 text-center">
                <CardTitle className="text-3xl font-black uppercase tracking-tight italic">Business Hub Setup</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-40">Step 1: Registration</CardDescription>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="p-8 space-y-6">
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] font-black uppercase opacity-40">Business Name</FormLabel><FormControl><Input {...field} placeholder="e.g. Grand Hub" className="h-12 rounded-xl border-2 font-bold" /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="address" render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] font-black uppercase opacity-40">Location Address</FormLabel><FormControl><Input {...field} placeholder="Full physical location" className="h-12 rounded-xl border-2 font-bold" /></FormControl></FormItem>
                        )} />
                        <Button type="button" variant="outline" size="sm" onClick={handleDetectLocation} disabled={isDetecting} className="w-full h-12 rounded-xl border-2 font-black uppercase text-[10px] tracking-widest">
                            {isDetecting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <MapPin className="h-4 w-4 mr-2" />}
                            Sync GPS Coordinates
                        </Button>
                    </CardContent>
                    <div className="p-8 bg-gray-50 border-t border-black/5">
                        <Button type="submit" disabled={isSaving} className="w-full h-16 rounded-[2rem] font-black uppercase tracking-widest shadow-xl shadow-primary/20 text-sm">
                            {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <><Sparkles className="h-6 w-6 mr-2" /> Proceed to Menu Scan</>}
                        </Button>
                    </div>
                </form>
            </Form>
        </Card>
    );
}

export default function UnifiedDashboardPage() {
    const { user, firestore } = useFirebase();
    const { isMerchant, isAdmin, isCustomer, isLoading } = useAdminAuth();
    const router = useRouter();
    const { userStore, fetchUserStore, isInitialized, isUserDataLoaded } = useAppStore();

    useEffect(() => {
        if (isLoading) return;
        if (!user) { router.replace('/login'); return; }
        
        // ADMINS: Routed to Decision Hub
        if (isAdmin) { router.replace('/dashboard/admin'); return; }

        if (firestore && !userStore && !isUserDataLoaded && isMerchant) {
            fetchUserStore(firestore, user.uid);
        }
    }, [isLoading, isMerchant, isCustomer, isAdmin, user, firestore, userStore, isUserDataLoaded, fetchUserStore, router]);

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
    
    // CUSTOMER VIEW: Access Denied (Non-mandatory redirect)
    if (isCustomer) {
        return (
            <div className="container mx-auto py-24 px-4 text-center space-y-6 max-w-md animate-in fade-in duration-500">
                <div className="h-20 w-20 rounded-[2.5rem] bg-destructive/10 flex items-center justify-center mx-auto text-destructive">
                    <XCircle className="h-10 w-10" />
                </div>
                <div className="space-y-2">
                    <h1 className="text-3xl font-black uppercase tracking-tight italic">Merchant Access</h1>
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest opacity-60 leading-relaxed">
                        This operational hub is reserved for verified store owners and employees.
                    </p>
                </div>
                <Button asChild variant="outline" className="w-full h-14 rounded-2xl border-2 font-black uppercase text-xs tracking-widest shadow-xl">
                    <Link href="/">Return to Marketplace</Link>
                </Button>
            </div>
        );
    }

    // MERCHANT SETUP LOGIC
    if (!userStore && isInitialized) {
        return (
            <div className="container mx-auto px-4 py-12 max-w-4xl animate-in fade-in duration-700">
                <CreateStoreForm onComplete={() => firestore && fetchUserStore(firestore, user!.uid)} />
            </div>
        );
    }

    if (userStore && !userStore.businessType) {
        return (
            <div className="container mx-auto px-4 py-12 max-w-4xl animate-in fade-in duration-700">
                <MenuOnboardingTool storeId={userStore.id} onComplete={() => firestore && fetchUserStore(firestore, user!.uid)} />
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
                        All local table sessions are synchronized with the kitchen display. Ensure your device has a stable internet connection.
                    </p>
                </div>
            </Card>
        </div>
    );
}
