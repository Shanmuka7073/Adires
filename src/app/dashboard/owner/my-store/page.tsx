
'use client';

import { useState, useTransition, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { Store, MenuItem, Menu, MenuTheme } from '@/lib/types';
import { useFirebase, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, addDoc, writeBatch, doc, updateDoc, setDoc, limit, deleteDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Share2, MapPin, Trash2, AlertCircle, ImageIcon, Loader2, Sparkles, PlusCircle, Edit, Save, CheckCircle2, Upload as UploadIcon, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { t } from '@/lib/locales';
import { useAppStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { extractMenuItems } from '@/ai/flows/extract-menu-items-flow';

const ADIRES_LOGO = "https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png";

const storeSchema = z.object({
  name: z.string().min(3, 'Store name must be at least 3 characters'),
  teluguName: z.string().optional(),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters'),
  address: z.string().min(10, 'Please enter a valid address'),
  latitude: z.coerce.number().min(-90, "Invalid latitude").max(90, "Invalid latitude"),
  longitude: z.coerce.number().min(-180, "Invalid longitude").max(180, "Invalid longitude"),
});

const locationSchema = z.object({
    latitude: z.coerce.number().min(-90, "Invalid latitude").max(90, "Invalid latitude"),
    longitude: z.coerce.number().min(-180, "Invalid longitude").max(180, "Invalid longitude"),
});

type StoreFormValues = z.infer<typeof storeSchema>;
type LocationFormValues = z.infer<typeof locationSchema>;

function StoreImageUploader({ store }: { store: Store }) {
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
            const updateData = { imageUrl: imageUrl };

            updateDoc(storeRef, updateData)
                .then(() => {
                    toast({ title: 'Identity Visual Updated!' });
                    incrementWriteCount(1);
                })
                .catch((e) => {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({
                        path: storeRef.path,
                        operation: 'update',
                        requestResourceData: updateData,
                    }));
                });
        });
    };

    return (
        <Card className="rounded-3xl border-0 shadow-lg overflow-hidden bg-white">
            <CardHeader className="bg-primary/5 border-b border-black/5">
                <CardTitle className="text-sm font-black uppercase tracking-tight text-gray-950">Storefront Visual</CardTitle>
                <CardDescription className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Public profile image URL</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
                 <div className="w-full aspect-video relative rounded-2xl overflow-hidden border-2 bg-muted shadow-inner">
                    {imageUrl ? (
                        <Image src={imageUrl} alt={store.name} fill className="object-cover" />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full bg-muted/50 text-muted-foreground">
                            <ImageIcon className="h-10 w-10 mb-2 opacity-20" />
                            <p className="text-[10px] font-black uppercase opacity-20 tracking-widest">No Image Set</p>
                        </div>
                    )}
                </div>
                <div className="space-y-2">
                    <Label className="text-[8px] font-black uppercase tracking-widest opacity-40">Direct Image URL</Label>
                    <Input
                        placeholder="https://example.com/your-store.jpg"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        disabled={isSaving}
                        className="h-11 rounded-xl border-2"
                    />
                </div>
                <Button onClick={handleSave} disabled={isSaving} className="w-full h-11 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Visuals
                </Button>
            </CardContent>
        </Card>
    );
}

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
        if (!file || !firestore) return;

        startProcessing(async () => {
            try {
                const reader = new FileReader();
                const imageData = await new Promise<string>((resolve) => {
                    reader.onload = (e) => resolve(e.target?.result as string);
                    reader.readAsDataURL(file);
                });

                const result = await extractMenuItems({ menuImage: imageData });
                if (result && result.items && result.items.length > 0) {
                    setExtractedData({
                        items: result.items.map(i => ({ ...i, id: i.name.toLowerCase().replace(/\s+/g, '-'), isAvailable: true })),
                        theme: result.theme,
                        businessType: result.businessType
                    });
                    toast({ title: "Menu Scanned!", description: `AI detected ${result.items.length} items.` });
                } else {
                    toast({ variant: 'destructive', title: "Scan Failed", description: "No items detected. Try a clearer photo." });
                }
            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Extraction Failed', description: error.message });
            }
        });
    };

    const updatePreviewItem = (index: number, field: keyof MenuItem, value: any) => {
        if (!extractedData) return;
        const newItems = [...extractedData.items];
        newItems[index] = { ...newItems[index], [field]: value };
        setExtractedData({ ...extractedData, items: newItems });
    };

    const removePreviewItem = (index: number) => {
        if (!extractedData) return;
        const newItems = extractedData.items.filter((_, i) => i !== index);
        setExtractedData({ ...extractedData, items: newItems });
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
                theme: extractedData.theme
            });

            batch.update(doc(firestore, 'stores', storeId), { 
                businessType: extractedData.businessType 
            });

            try {
                await batch.commit();
                incrementWriteCount(2);
                toast({ title: "Business Live!", description: "Digital menu and vertical synced successfully." });
                setExtractedData(null);
                onComplete();
            } catch (error: any) {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: `stores/${storeId}/menus`,
                    operation: 'create',
                    requestResourceData: { items: extractedData.items }
                }));
            }
        });
    };

    return (
        <Card className="rounded-3xl border-0 shadow-xl overflow-hidden bg-primary/5 border-2 border-dashed border-primary/20">
            <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl font-black uppercase tracking-tight">AI Menu Setup</CardTitle>
                <CardDescription className="text-xs font-bold opacity-40 uppercase tracking-widest">Digitize your paper menu instantly</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
                {extractedData ? (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-[10px] font-black uppercase tracking-widest opacity-40">Review & Correct Scanned Items</h3>
                            <Button variant="ghost" size="sm" onClick={() => setExtractedData(null)} className="h-7 text-[8px] font-black uppercase">Cancel</Button>
                        </div>
                        <ScrollArea className="h-80 rounded-2xl border bg-white shadow-inner">
                            <Table>
                                <TableHeader className="bg-black/5 sticky top-0 z-10">
                                    <TableRow>
                                        <TableHead className="text-[10px] font-black uppercase w-32">Category</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase">Item Name</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase w-24">Price (₹)</TableHead>
                                        <TableHead className="w-10"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {extractedData.items.map((i, idx) => (
                                        <TableRow key={idx} className="group border-black/5">
                                            <TableCell className="p-2">
                                                <Input 
                                                    value={i.category} 
                                                    onChange={e => updatePreviewItem(idx, 'category', e.target.value)}
                                                    className="h-8 text-[9px] font-bold uppercase rounded-lg border-0 bg-transparent focus:bg-white"
                                                />
                                            </TableCell>
                                            <TableCell className="p-2">
                                                <Input 
                                                    value={i.name} 
                                                    onChange={e => updatePreviewItem(idx, 'name', e.target.value)}
                                                    className="h-8 text-[11px] font-bold rounded-lg border-0 bg-transparent focus:bg-white"
                                                />
                                            </TableCell>
                                            <TableCell className="p-2">
                                                <Input 
                                                    type="number"
                                                    value={i.price} 
                                                    onChange={e => updatePreviewItem(idx, 'price', Number(e.target.value))}
                                                    className="h-8 text-[11px] font-black rounded-lg border-0 bg-transparent focus:bg-white text-primary"
                                                />
                                            </TableCell>
                                            <TableCell className="p-2">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removePreviewItem(idx)}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            <ScrollBar orientation="vertical" />
                        </ScrollArea>
                        <Button onClick={handleSaveMenu} disabled={isSaving} className="w-full h-14 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20">
                            {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Publish Menu ({extractedData.items.length} Items)
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center">
                        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                            <Sparkles className="h-8 w-8 text-primary" />
                        </div>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                        <Button 
                            onClick={() => fileInputRef.current?.click()} 
                            disabled={isProcessing}
                            className="w-full h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20"
                        >
                            {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UploadIcon className="mr-2 h-5 w-5" />}
                            {isProcessing ? 'AI Reading Menu...' : 'Upload Menu Photo'}
                        </Button>
                    </div>
                )}
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
    
    const form = useForm<Omit<StoreFormValues, 'latitude' | 'longitude'>>({
        resolver: zodResolver(storeSchema.omit({ latitude: true, longitude: true })),
        defaultValues: {
            name: store.name,
            teluguName: store.teluguName || '',
            description: store.description,
            address: store.address,
        },
    });
    
    const onSubmit = (data: Omit<StoreFormValues, 'latitude' | 'longitude'>) => {
        if (!firestore) return;
        startTransition(() => {
            const storeRef = doc(firestore, 'stores', store.id);
            updateDoc(storeRef, data)
                .then(() => {
                    toast({ title: "Business Identity Updated!" });
                    incrementWriteCount(1);
                    setIsOpen(false);
                    onUpdate();
                })
                .catch((e) => {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({
                        path: storeRef.path,
                        operation: 'update',
                        requestResourceData: data,
                    }));
                });
        });
    };

    return (
        <Card className="rounded-[2.5rem] border-0 shadow-lg overflow-hidden bg-white">
            <CardHeader className="flex flex-row justify-between items-center border-b border-black/5 bg-primary/5 pb-6">
                <div>
                    <CardTitle className="text-xl font-black uppercase tracking-tight text-gray-950">Business Profile</CardTitle>
                    <CardDescription className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Identity Hub</CardDescription>
                </div>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="rounded-xl font-black text-[9px] uppercase tracking-widest border-2 h-9 px-4">
                            <Edit className="mr-2 h-3.5 w-3.5" /> Edit Profile
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl rounded-[2.5rem] border-0 shadow-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-black uppercase tracking-tight">Modify Identity</DialogTitle>
                            <DialogDescription>Update your public-facing business profile.</DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
                                <FormField control={form.control} name="name" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase opacity-40">Store Name</FormLabel>
                                        <FormControl><Input {...field} className="h-12 rounded-xl border-2" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <FormField control={form.control} name="teluguName" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase opacity-40">Name in Telugu</FormLabel>
                                        <FormControl><Input {...field} placeholder="e.g., చంద్రా మోహన్" className="h-12 rounded-xl border-2" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <FormField control={form.control} name="description" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase opacity-40">Description</FormLabel>
                                        <FormControl><Textarea {...field} className="min-h-[100px] rounded-xl border-2" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <FormField control={form.control} name="address" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase opacity-40">Address</FormLabel>
                                        <FormControl><Input {...field} className="h-12 rounded-xl border-2" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <DialogFooter>
                                    <Button type="submit" disabled={isPending} className="h-12 rounded-xl font-black uppercase tracking-widest text-[10px] w-full shadow-xl">
                                        {isPending ? 'Syncing...' : 'Save Updates'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent className="p-8 text-sm space-y-6">
                <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <p className="text-[9px] font-black uppercase opacity-40 tracking-[0.2em]">Address</p>
                            <p className="font-bold text-gray-700 leading-relaxed">{store.address}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[9px] font-black uppercase opacity-40 tracking-[0.2em]">Coordinates</p>
                            <p className="font-mono font-bold text-primary flex items-center gap-2">
                                <MapPin className="h-3 w-3" /> {store.latitude?.toFixed(4)}, {store.longitude?.toFixed(4)}
                            </p>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase opacity-40 tracking-[0.2em]">Bio</p>
                        <p className="text-gray-600 font-medium leading-relaxed">{store.description}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function UpdateLocationForm({ store, onUpdate }: { store: Store, onUpdate: () => void }) {
    const { firestore } = useFirebase();
    const { incrementWriteCount } = useAppStore();
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const form = useForm<LocationFormValues>({
        resolver: zodResolver(locationSchema),
        defaultValues: {
            latitude: store.latitude || 0,
            longitude: store.longitude || 0,
        },
    });

    const handleGetLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    form.setValue('latitude', position.coords.latitude, { shouldValidate: true });
                    form.setValue('longitude', position.coords.longitude, { shouldValidate: true });
                    toast({ title: "Location Captured!" });
                },
                () => {
                    toast({ variant: 'destructive', title: "Location Error", description: "Could not retrieve your location." });
                }
            );
        }
    };
    
    const onSubmit = (data: LocationFormValues) => {
        if (!firestore) return;
        startTransition(async () => {
            const storeRef = doc(firestore, 'stores', store.id);
            try {
                await updateDoc(storeRef, data);
                incrementWriteCount(1);
                toast({ title: "Store Location Updated!" });
                onUpdate();
            } catch (error) {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: storeRef.path,
                    operation: 'update',
                    requestResourceData: data,
                }));
            }
        });
    };

    return (
        <Alert variant="destructive" className="rounded-[2.5rem] border-2 border-red-100 bg-red-50/30 p-6">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <AlertTitle className="font-black uppercase tracking-tight text-red-900">Location Missing</AlertTitle>
            <AlertDescription className="font-bold text-red-800/60 text-xs mt-1">
                GPS coordinates are required for your business hub.
            </AlertDescription>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="latitude" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[8px] font-black uppercase opacity-40">Latitude</FormLabel>
                                <FormControl><Input type="number" step="any" {...field} className="h-10 rounded-xl border-2" /></FormControl>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="longitude" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[8px] font-black uppercase opacity-40">Longitude</FormLabel>
                                <FormControl><Input type="number" step="any" {...field} className="h-10 rounded-xl border-2" /></FormControl>
                            </FormItem>
                        )} />
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={handleGetLocation} className="rounded-xl h-10 px-4 font-black text-[10px] uppercase tracking-widest border-2">
                            <MapPin className="mr-2 h-4 w-4" /> Detect GPS
                        </Button>
                        <Button type="submit" disabled={isPending} className="flex-1 h-10 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">
                            {isPending ? 'Syncing...' : 'Save Location'}
                        </Button>
                    </div>
                </form>
            </Form>
        </Alert>
    );
}

function ManageStoreView({ store, isAdmin, onUpdate }: { store: Store; isAdmin: boolean, onUpdate: () => void }) {
    const { firestore } = useFirebase();
    const menuQuery = useMemoFirebase(() => (firestore && store.id) ? query(collection(firestore, `stores/${store.id}/menus`), limit(1)) : null, [firestore, store.id]);
    const { data: menus } = useCollection<Menu>(menuQuery);
    const menu = menus?.[0];

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
        {!store.latitude && <UpdateLocationForm store={store} onUpdate={onUpdate} />}
        <StoreDetails store={store} onUpdate={onUpdate} />
        <div className="grid md:grid-cols-2 gap-8">
            <StoreImageUploader store={store} />
            <div className="space-y-8">
                <Card className="rounded-3xl border-0 shadow-lg overflow-hidden bg-white">
                    <CardHeader className="bg-primary/5 border-b border-black/5"><CardTitle className="text-sm font-black uppercase tracking-tight">Promote Business</CardTitle></CardHeader>
                    <CardContent className="p-6">
                        <Button className="w-full h-11 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg" onClick={() => {}}>
                            <Share2 className="mr-2 h-4 w-4" /> Share with Contacts
                        </Button>
                    </CardContent>
                </Card>
                {menu && (
                    <Button asChild variant="outline" className="w-full h-14 rounded-2xl border-2 border-primary/20 bg-primary/5 text-primary font-black uppercase text-[10px] tracking-widest hover:bg-primary/10">
                        <Link href="/dashboard/owner/menu-manager">
                            <Edit className="mr-2 h-4 w-4" /> Edit Digital Menu
                        </Link>
                    </Button>
                )}
            </div>
        </div>
        {!menu && <MenuOnboardingTool storeId={store.id} onComplete={onUpdate} />}
    </div>
    )
}

export default function MyStorePage() {
    const { user, isUserLoading, firestore } = useFirebase();
    const router = useRouter();
    const { isAdmin, isRestaurantOwner, isLoading: isRoleLoading } = useAdminAuth();
    const { stores, userStore, fetchInitialData } = useAppStore();

    useEffect(() => {
        if (firestore && user) {
            fetchInitialData(firestore, user.uid);
        }
    }, [firestore, user, fetchInitialData]);

    const myStore = useMemo(() => {
        if (userStore && userStore.ownerId === user?.uid) return userStore;
        return stores.find(s => s.ownerId === user?.uid) || null;
    }, [userStore, stores, user?.uid]);

    useEffect(() => { if (!isUserLoading && !user) router.push('/login'); }, [isUserLoading, user, router]);

    if (isUserLoading || isRoleLoading) return <div className="p-12 text-center flex flex-col items-center justify-center gap-4 h-[80vh]"><Loader2 className="animate-spin h-10 w-10 text-primary opacity-20" /><p className="text-[10px] font-black uppercase tracking-widest opacity-40">Verifying Authority...</p></div>;

    if (!myStore) return <div className="p-12 text-center">Business hub not found.</div>;

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 space-y-12 pb-32">
            <div className="flex justify-between items-end border-b pb-10 border-black/5">
                <div className="space-y-1">
                    <h1 className="text-4xl md:text-5xl font-black font-headline tracking-tight text-gray-950 truncate max-w-[600px]">{myStore.name || 'Your Business'}</h1>
                    <p className="text-muted-foreground font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">Operational Dashboard</p>
                </div>
                <div className="hidden sm:block">
                    <Badge variant="outline" className="rounded-full border-2 border-primary/20 text-primary font-black uppercase text-[10px] tracking-widest px-4 py-1.5 bg-primary/5">
                        <CheckCircle2 className="h-3 w-3 mr-2 fill-current" /> Business Active
                    </Badge>
                </div>
            </div>
            <ManageStoreView store={myStore} isAdmin={isAdmin} onUpdate={() => fetchInitialData(firestore!, user?.uid)} />
        </div>
    );
}
