
'use client';

import { useState, useTransition, useEffect, useMemo, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
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
import type { Store, Product, ProductPrice, User as AppUser, ProductVariant } from '@/lib/types';
import { useFirebase, useDoc, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, addDoc, writeBatch, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Share2, MapPin, Trash2, AlertCircle, Upload, Image as ImageIcon, Loader2, Sparkles, PlusCircle, Edit, Link2, QrCode, Save } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { t } from '@/lib/locales';
import { useAppStore, useMyStorePageStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { generateProductImage } from '@/ai/flows/generate-product-image-flow';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminAuth } from '@/hooks/use-admin-auth';

const createSlug = (text: string) => {
    if(!text) return '';
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-') 
      .replace(/[^\w-]+/g, '') 
      .replace(/--+/g, '-') 
      .replace(/^-+/, '') 
      .replace(/-+$/, ''); 
};

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

const variantSchema = z.object({
  sku: z.string(),
  weight: z.string().min(1, 'Weight is required'),
  price: z.coerce.number().positive('Price must be a positive number'),
  stock: z.coerce.number().int().nonnegative('Stock must be a positive integer'),
});

const productSchema = z.object({
  name: z.string().min(3, 'Product name is required'),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  imageUrl: z.string().optional(),
  variants: z.array(variantSchema).min(1, 'At least one price variant is required'),
});

type StoreFormValues = z.infer<typeof storeSchema>;
type ProductFormValues = z.infer<typeof productSchema>;
type LocationFormValues = z.infer<typeof locationSchema>;

function StoreImageUploader({ store }: { store: Store }) {
    const { toast } = useToast();
    const { firestore } = useFirebase();
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
                    toast({ title: 'Image URL Updated!' });
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
        <Card>
            <CardHeader>
                <CardTitle>{t('store-image')}</CardTitle>
                <CardDescription>Update your store's image by pasting a URL.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="w-full aspect-video relative rounded-md overflow-hidden border bg-muted">
                    {imageUrl ? (
                        <Image src={imageUrl} alt={store.name} fill className="object-cover" />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full bg-muted/50 text-muted-foreground">
                            <ImageIcon className="h-10 w-10 mb-2" />
                            <p className="text-sm">{t('no-image-set')}</p>
                        </div>
                    )}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="store-image-url">Image URL</Label>
                    <Input
                        id="store-image-url"
                        placeholder="https://example.com/your-store.jpg"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        disabled={isSaving}
                    />
                </div>
                <Button onClick={handleSave} disabled={isSaving} className="w-full">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Image URL
                </Button>
            </CardContent>
        </Card>
    );
}

function PromoteStore({ store }: { store: Store }) {
    const { toast } = useToast();

    const handleShare = async () => {
        if (!('contacts' in navigator && 'select' in (navigator as any).contacts)) {
            toast({
                variant: 'destructive',
                title: 'API Not Supported',
                description: 'Your browser does not support the Contact Picker API.',
            });
            return;
        }

        try {
            const contacts = await (navigator as any).contacts.select(['name', 'tel'], { multiple: true });

            if (contacts.length === 0) return;

            const phoneNumbers = contacts.flatMap((c: any) => c.tel || []);
            const shareText = `Check out my store, ${store.name}, on the Adires app! Visit here: ${window.location.origin}/stores/${store.id}`;
            
            if (phoneNumbers.length > 0) {
                 window.open(`sms:${phoneNumbers.join(',')}?&body=${encodeURIComponent(shareText)}`, '_blank');
            } else {
                 toast({
                    variant: 'destructive',
                    title: 'No Phone Numbers Found',
                });
            }
        } catch (ex) {
            toast({
                variant: 'destructive',
                title: 'Share Error',
            });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('promote-your-store')}</CardTitle>
                <CardDescription>
                    {t('share-your-store-with-your-phone-contacts')}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button onClick={handleShare} className="w-full">
                    <Share2 className="mr-2 h-4 w-4" />
                    {t('share-with-contacts')}
                </Button>
            </CardContent>
        </Card>
    );
}

function StoreDetails({ store, onUpdate }: { store: Store, onUpdate: () => void }) {
    const { firestore } = useFirebase();
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const form = useForm<Omit<StoreFormValues, 'latitude' | 'longitude'>>({
        resolver: zodResolver(storeSchema.omit({ latitude: true, longitude: true })),
        defaultValues: { name: store.name, teluguName: store.teluguName || '', description: store.description, address: store.address },
    });
    
    const onSubmit = (data: Omit<StoreFormValues, 'latitude' | 'longitude'>) => {
        if (!firestore) return;
        startTransition(() => {
            const storeRef = doc(firestore, 'stores', store.id);
            updateDoc(storeRef, data)
                .then(() => {
                    toast({ title: "Saved!" });
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
        <Card>
            <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle>Business Information</CardTitle>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild><Button variant="outline" size="sm"><Edit className="h-4 w-4 mr-2"/> Edit</Button></DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader><DialogTitle>Edit Store Details</DialogTitle></DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>)}/>
                                <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field}/></FormControl></FormItem>)}/>
                                <Button type="submit" disabled={isPending}>Save</Button>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent className="text-sm space-y-2"><p><strong>Address:</strong> {store.address}</p><p><strong>Description:</strong> {store.description}</p></CardContent>
        </Card>
    );
}

function UpdateLocationForm({ store, onUpdate }: { store: Store, onUpdate: () => void }) {
    const { firestore } = useFirebase();
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const form = useForm<LocationFormValues>({ resolver: zodResolver(locationSchema), defaultValues: { latitude: store.latitude || 0, longitude: store.longitude || 0 } });
    
    const handleGetLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                form.setValue('latitude', position.coords.latitude, { shouldValidate: true });
                form.setValue('longitude', position.coords.longitude, { shouldValidate: true });
                toast({ title: "Location Fetched!" });
            });
        }
    };

    const onSubmit = (data: LocationFormValues) => {
        if (!firestore) return;
        startTransition(() => {
            const storeRef = doc(firestore, 'stores', store.id);
            updateDoc(storeRef, data).then(() => { toast({ title: "Updated!" }); onUpdate(); });
        });
    };

    return (
        <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Location Missing</AlertTitle>
            <AlertDescription>GPS coordinates required for mapping.</AlertDescription>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="latitude" render={({ field }) => (<FormItem><FormControl><Input type="number" step="any" {...field} /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="longitude" render={({ field }) => (<FormItem><FormControl><Input type="number" step="any" {...field} /></FormControl></FormItem>)} />
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={handleGetLocation}>Get GPS</Button>
                        <Button type="submit" disabled={isPending}>Save</Button>
                    </div>
                </form>
            </Form>
        </Alert>
    );
}

function DangerZone({ store }: { store: Store }) {
    const { firestore } = useFirebase();
    const [isClosing, startCloseTransition] = useTransition();
    const { toast } = useToast();
    const handleCloseStore = () => {
        if (!firestore) return;
        startCloseTransition(async () => {
            await updateDoc(doc(firestore, 'stores', store.id), { isClosed: true });
            toast({ title: "Store Closed" });
        });
    };
    return (
        <Card className="border-destructive">
            <CardHeader><CardTitle className="text-destructive">Danger Zone</CardTitle></CardHeader>
            <CardContent><Button variant="destructive" onClick={handleCloseStore} disabled={isClosing}>Close Store</Button></CardContent>
        </Card>
    );
}

function ManageStoreView({ store, isAdmin, onUpdate }: { store: Store; isAdmin: boolean, onUpdate: () => void }) {
    if (store.isClosed) return <Alert variant="destructive"><AlertTitle>Closed</AlertTitle><AlertDescription>Store is hidden.</AlertDescription></Alert>;
    
    const needsLocationUpdate = !store.latitude || !store.longitude;

    return (
      <div className="space-y-8">
        {needsLocationUpdate && <UpdateLocationForm store={store} onUpdate={onUpdate} />}
        <StoreDetails store={store} onUpdate={onUpdate} />
        <div className="grid md:grid-cols-2 gap-8">
            <StoreImageUploader store={store} />
            <PromoteStore store={store} />
        </div>
        <DangerZone store={store} />
      </div>
    )
}

export default function MyStorePage() {
    const { user, isUserLoading, firestore } = useFirebase();
    const router = useRouter();
    const { isAdmin, isRestaurantOwner, isLoading: isRoleLoading } = useAdminAuth();
    const { stores, userStore, fetchInitialData } = useAppStore();

    const myStore = useMemo(() => userStore || stores.find(s => s.ownerId === user?.uid), [userStore, stores, user?.uid]);

    useEffect(() => { if (!isUserLoading && !user) router.push('/login'); }, [isUserLoading, user, router]);
    useEffect(() => { if (firestore && user && !myStore) fetchInitialData(firestore, user.uid); }, [firestore, user, myStore, fetchInitialData]);

    if (isUserLoading || isRoleLoading) return <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto opacity-20" /></div>;

    if (!myStore) return (
        <div className="container mx-auto py-12 p-6 text-center">
            <h1 className="text-3xl font-black mb-4">No Store Found</h1>
            <Button asChild><Link href="/dashboard">Return to Dashboard</Link></Button>
        </div>
    );

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 space-y-12">
            <div className="border-b pb-8"><h1 className="text-5xl font-black font-headline tracking-tighter uppercase italic">{myStore.name}</h1><p className="text-muted-foreground font-black text-[10px] tracking-widest uppercase opacity-40">Store Control Panel</p></div>
            <ManageStoreView store={myStore} isAdmin={isAdmin} onUpdate={() => fetchInitialData(firestore!, user?.uid)} />
        </div>
    );
}
