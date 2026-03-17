
'use client';

import { useState, useTransition, useEffect, useMemo, useRef, RefObject } from 'react';
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
import { useFirebase, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, addDoc, writeBatch, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { updateStoreImageUrl } from '@/app/actions';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Share2, MapPin, Trash2, AlertCircle, Upload, Image as ImageIcon, Loader2, Camera, CameraOff, Sparkles, PlusCircle, Edit, Link2, QrCode, ClipboardList, Save, Video, CreditCard, LayoutGrid, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';
import { t } from '@/lib/locales';
import { useAppStore, useMyStorePageStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { generateProductImage } from '@/ai/flows/generate-product-image-flow';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


const ADMIN_EMAIL = 'admin@gmail.com';

const standardUnits = ["100gm", "250gm", "500gm", "1kg", "2kg", "5kg", "250ml", "500ml", "1 litre", "2 litres", "1 pack", "1 pc"];

const storeSchema = z.object({
  name: z.string().min(3, 'Store name must be at least 3 characters'),
  teluguName: z.string().optional(),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters'),
  address: z.string().min(10, 'Please enter a valid address'),
  latitude: z.coerce.number().min(-90, "Invalid latitude").max(90, "Invalid latitude"),
  longitude: z.coerce.number().min(-180, "Invalid longitude").max(180, "Invalid longitude"),
  tables: z.array(z.string()).optional(),
  liveVideoUrl: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  upiId: z.string().optional().refine((val) => !val || val.includes('@'), { message: "Invalid UPI ID format" }),
});

const locationSchema = z.object({
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
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

function StoreImageUploader({ store }: { store: Store }) {
    const { toast } = useToast();
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
            const result = await updateStoreImageUrl(store.id, imageUrl);

            if (result.success) {
                toast({ title: 'Image URL Updated!' });
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Update Failed',
                    description: result.error || 'The server action failed.',
                });
            }
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

function TableManager({ store }: { store: Store }) {
    const { firestore } = useFirebase();
    const [newTableName, setNewTableName] = useState('');
    const [isSaving, startSaveTransition] = useTransition();
    const { toast } = useToast();

    const handleAddTable = () => {
        if (!newTableName.trim()) return;
        const currentTables = store.tables || [];
        const updatedTables = [...new Set([...currentTables, newTableName.trim()])];
        
        startSaveTransition(() => {
            updateDoc(doc(firestore, 'stores', store.id), { tables: updatedTables })
                .then(() => {
                    toast({ title: "Table Added", description: `"${newTableName}" has been added.` });
                    setNewTableName('');
                })
                .catch(err => {
                    console.error("Error adding table:", err);
                    toast({ variant: "destructive", title: "Save Failed", description: err.message });
                });
        });
    };
    
    const handleRemoveTable = (tableToRemove: string) => {
        const updatedTables = (store.tables || []).filter(t => t !== tableToRemove);
        startSaveTransition(() => {
            updateDoc(doc(firestore, 'stores', store.id), { tables: updatedTables })
                .then(() => toast({ title: "Table Removed", description: `"${tableToRemove}" has been removed.` }))
                .catch(err => {
                    console.error("Error removing table:", err);
                    toast({ variant: "destructive", title: "Update Failed", description: err.message });
                });
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Table Management</CardTitle>
                <CardDescription>Add or remove table identifiers for your restaurant to generate QR codes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2">
                    <Input 
                        placeholder="e.g., Garden Table 1, First Floor 2"
                        value={newTableName}
                        onChange={(e) => setNewTableName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddTable(); }}
                    />
                    <Button onClick={handleAddTable} disabled={isSaving || !newTableName.trim()}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                        Add
                    </Button>
                </div>
                 {store.tables && store.tables.length > 0 && (
                     <div className="space-y-2">
                         <Label>Your Tables</Label>
                         <div className="space-y-2 rounded-md border p-2">
                             {store.tables.map(table => (
                                 <div key={table} className="flex items-center justify-between p-2 bg-background rounded-md">
                                     <span className="font-medium">{table}</span>
                                     <Button variant="ghost" size="icon" onClick={() => handleRemoveTable(table)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                     </Button>
                                 </div>
                             ))}
                         </div>
                     </div>
                 )}
            </CardContent>
        </Card>
    );
}

function PromoteStore({ store }: { store: Store }) {
    const { toast } = useToast();

    const handleShare = async () => {
        if (!('contacts' in navigator && 'select' in navigator.contacts)) {
            toast({
                variant: 'destructive',
                title: 'API Not Supported',
                description: 'Your browser does not support the Contact Picker API.',
            });
            return;
        }

        try {
            const contacts = await (navigator as any).contacts.select(['name', 'email', 'tel'], { multiple: true });

            if (contacts.length === 0) {
                toast({ title: 'No contacts selected.' });
                return;
            }

            const phoneNumbers = contacts.flatMap((c: { tel: any; }) => c.tel || []);
            const shareText = `Check out my store, ${store.name}, on the LocalBasket app! Visit my storefront here: ${window.location.origin}/stores/${store.id}`;
            
            if (phoneNumbers.length > 0) {
                 const smsLink = `sms:${phoneNumbers.join(',')}?&body=${encodeURIComponent(shareText)}`;
                 window.open(smsLink, '_blank');
            } else {
                 toast({
                    variant: 'destructive',
                    title: 'No Phone Numbers Found',
                    description: 'The selected contacts do not have phone numbers.',
                });
            }
        } catch (ex) {
            toast({
                variant: 'destructive',
                title: 'Could not access contacts',
                description: 'There was an error trying to access your contacts.',
            });
            console.error(ex);
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
                <p className="text-xs text-muted-foreground mt-2 text-center">
                    {t('this-will-open-your-phones-contact-picker')}
                </p>
            </CardContent>
        </Card>
    );
}

function UpdateLocationForm({ store, onUpdate }: { store: Store, onUpdate: () => void }) {
    const { firestore } = useFirebase();
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const [isLocating, setIsLocating] = useState(false);

    const form = useForm<LocationFormValues>({
        resolver: zodResolver(locationSchema),
        defaultValues: {
            latitude: store.latitude || 0,
            longitude: store.longitude || 0,
        },
    });

    const handleGetLocation = () => {
        if (navigator.geolocation) {
            setIsLocating(true);
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    form.setValue('latitude', position.coords.latitude, { shouldValidate: true });
                    form.setValue('longitude', position.coords.longitude, { shouldValidate: true });
                    toast({ title: "Location Fetched!", description: "Your current location has been filled in." });
                    setIsLocating(false);
                },
                () => {
                    toast({ variant: 'destructive', title: "Location Error", description: "Could not retrieve your location. Please enter it manually." });
                    setIsLocating(false);
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
        } else {
            toast({ variant: 'destructive', title: "Not Supported", description: "Geolocation is not supported by your browser." });
        }
    };
    
    const onSubmit = (data: LocationFormValues) => {
        if (!firestore) return;
        startTransition(() => {
            const storeRef = doc(firestore, 'stores', store.id);
            updateDoc(storeRef, data)
                .then(() => {
                    toast({ title: "Store Location Updated!", description: "Your store's location has been saved." });
                    onUpdate(); 
                })
                .catch((error) => {
                    const permissionError = new FirestorePermissionError({
                        path: storeRef.path,
                        operation: 'update',
                        requestResourceData: data,
                    });
                    errorEmitter.emit('permission-error', permissionError);
                });
        });
    };

    return (
        <Alert variant="destructive">
            <AlertTitle>{t('action-required-update-your-stores-location')}</AlertTitle>
            <AlertDescription>
                {t('your-store-is-missing-gps-coordinates')}
            </AlertDescription>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                    <div className="flex items-end gap-4">
                        <div className="grid grid-cols-2 gap-4 flex-1">
                            <FormField control={form.control} name="latitude" render={({ field }) => (
                                <FormItem><FormLabel className="text-xs text-muted-foreground">{t('latitude')}</FormLabel><FormControl><Input type="number" step="any" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="longitude" render={({ field }) => (
                                <FormItem><FormLabel className="text-xs text-muted-foreground">{t('longitude')}</FormLabel><FormControl><Input type="number" step="any" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                         <Button type="button" variant="outline" onClick={handleGetLocation} disabled={isLocating}>
                            {isLocating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
                            {isLocating ? 'Locating...' : t('get-current-location')}
                        </Button>
                    </div>
                     <Button type="submit" disabled={isPending}>
                        {isPending ? t('saving') : t('save-location')}
                    </Button>
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
            const storeRef = doc(firestore, 'stores', store.id);
            try {
                await updateDoc(storeRef, { isClosed: true });
                toast({
                    title: "Store Closed",
                    description: `${store.name} has been closed and will no longer be visible to customers.`,
                });
            } catch (error) {
                console.error("Failed to close store:", error);
                const permissionError = new FirestorePermissionError({
                    path: storeRef.path,
                    operation: 'update',
                    requestResourceData: { isClosed: true },
                });
                errorEmitter.emit('permission-error', permissionError);
            }
        });
    };

    return (
        <Card className="border-destructive">
            <CardHeader>
                <CardTitle className="text-destructive">{t('danger-zone')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                    <div>
                        <p className="font-medium">{t('close-store')}</p>
                        <p className="text-sm text-muted-foreground">
                            {t('this-will-make-your-store-invisible')}
                        </p>
                    </div>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive">{t('close-store')}</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>{t('are-you-sure')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                    {t('your-store-and-all-its-products-will-no-longer-be-visible')}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                <AlertDialogAction onClick={handleCloseStore} disabled={isClosing}>
                                    {isClosing ? t('closing') : t('yes-close-my-store')}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardContent>
        </Card>
    );
}

function StoreDetails({ store, onUpdate }: { store: Store, onUpdate: () => void }) {
    const { firestore } = useFirebase();
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const { getAllAliases } = useAppStore();

    const form = useForm<StoreFormValues>({
        resolver: zodResolver(storeSchema),
        defaultValues: {
            name: store.name,
            teluguName: store.teluguName || '',
            description: store.description,
            address: store.address,
            latitude: store.latitude || 0,
            longitude: store.longitude || 0,
            liveVideoUrl: store.liveVideoUrl || '',
            upiId: store.upiId || '',
        },
    });
    
    const onSubmit = (data: StoreFormValues) => {
        if (!firestore) return;

        startTransition(() => {
            const storeRef = doc(firestore, 'stores', store.id);
            updateDoc(storeRef, data)
                .then(() => {
                    toast({ title: "Store Details Updated!", description: "Your store's information has been saved." });
                    setIsOpen(false);
                    onUpdate(); 
                })
                .catch((error) => {
                    const permissionError = new FirestorePermissionError({
                        path: storeRef.path,
                        operation: 'update',
                        requestResourceData: data,
                    });
                    errorEmitter.emit('permission-error', permissionError);
                });
        });
    };

    const storeAliases = useMemo(() => {
        const key = createSlug(store.name);
        return getAllAliases(key);
    }, [store.name, getAllAliases]);

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>{t('store-details')}</CardTitle>
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                                <Edit className="mr-2 h-4 w-4" /> {t('edit')}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>{t('edit-store-details')}</DialogTitle>
                                <DialogDescription>{t('update-your-stores-public-information')}</DialogDescription>
                            </DialogHeader>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('store-name')}</FormLabel>
                                                <FormControl>
                                                    <Input {...field} disabled={store.name === 'LocalBasket'} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="teluguName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Store Name (Telugu)</FormLabel>
                                                <FormControl>
                                                    <Input {...field} placeholder="e.g., పటేల్ కిరాణా స్టోర్" />
                                                </FormControl>
                                                 <FormDescription>This name will be used for Telugu voice commands.</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="description"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('description')}</FormLabel>
                                                <FormControl><Textarea {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="address"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('address')}</FormLabel>
                                                <FormControl><Input {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="liveVideoUrl"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="flex items-center gap-2"><Video className="h-4 w-4" /> Live Preparation URL</FormLabel>
                                                    <FormControl><Input placeholder="e.g., https://www.youtube.com/watch?v=..." {...field} /></FormControl>
                                                    <FormDescription>A YouTube Live link for customers to watch your kitchen.</FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="upiId"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Store UPI ID</FormLabel>
                                                    <FormControl><Input placeholder="e.g., merchant@okaxis" {...field} /></FormControl>
                                                    <FormDescription>Used to generate dynamic payment QR codes.</FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <DialogFooter>
                                        <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>{t('cancel')}</Button>
                                        <Button type="submit" disabled={isPending}>{isPending ? t('saving') : t('save-changes')}</Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
                <div className="flex flex-wrap gap-2 mb-2">
                    <Badge variant="outline" className="capitalize bg-muted/50">
                        <LayoutGrid className="h-3 w-3 mr-1.5" />
                        Vertical: {store.businessType || 'Grocery'}
                    </Badge>
                </div>
                <p><strong>{t('description')}:</strong> {store.description}</p>
                <p><strong>{t('address')}:</strong> {store.address}</p>
                 <p><strong>Telugu Name:</strong> {store.teluguName || 'Not set'}</p>
                <p><strong>{t('location')}:</strong> {store.latitude}, {store.longitude}</p>
                <div className="flex flex-wrap gap-4">
                    {store.liveVideoUrl && (
                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 flex gap-1.5 items-center">
                            <Video className="h-3 w-3" /> Live Feed Enabled
                        </Badge>
                    )}
                    {store.upiId && (
                        <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 flex gap-1.5 items-center">
                            <CreditCard className="h-3 w-3" /> Payments: {store.upiId}
                        </Badge>
                    )}
                </div>
                <div>
                  <strong>Voice Aliases:</strong>
                  <div className="flex flex-wrap gap-1 mt-1">
                      {Object.entries(storeAliases).flatMap(([lang, aliases]) =>
                          aliases.map(alias => (
                              <Badge key={`${lang}-${alias}`} variant="secondary">{alias} ({lang})</Badge>
                          ))
                      )}
                  </div>
                </div>
            </CardContent>
        </Card>
    );
}

function ManageStoreView({ store, isAdmin, adminStoreId }: { store: Store; isAdmin: boolean, adminStoreId?: string; }) {
    const { firestore, user } = useFirebase();
    const { toast } = useToast();
    const [isOpening, startOpenTransition] = useTransition();

    if (store.isClosed) {
        return (
            <Alert variant="destructive">
                 <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t('this-store-is-closed')}</AlertTitle>
                <AlertDescription>
                    {t('your-store-is-currently-not-visible')}
                </AlertDescription>
                <Button onClick={() => {}} disabled={isOpening} className="mt-4">
                    {isOpening ? t('re-opening') : t('re-open-store')}
                </Button>
            </Alert>
        )
    }


    return (
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="inventory">Inventory & Menu</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-6 space-y-6">
            <StoreDetails store={store} onUpdate={() => {}} />
            <div className="grid md:grid-cols-2 gap-8">
                <StoreImageUploader store={store} />
                <PromoteStore store={store} />
            </div>
            <DangerZone store={store} />
        </TabsContent>
        <TabsContent value="inventory" className="mt-6 space-y-6">
            {store.businessType === 'grocery' ? (
                adminStoreId ? (
                    <ProductChecklist storeId={store.id} adminStoreId={adminStoreId} />
                ) : (
                    <Alert><Info className="h-4 w-4" /><AlertTitle>Catalog Unavailable</AlertTitle><AlertDescription>The master grocery catalog is not set up.</AlertDescription></Alert>
                )
            ) : (
                <>
                    <TableManager store={store} />
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <QrCode className="h-6 w-6 text-primary" />
                                Digital Menu Manager
                            </CardTitle>
                            <CardDescription>Create a digital menu for your {store.businessType} services.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button asChild className="w-full">
                                <Link href="/dashboard/owner/menu-manager">Go to Menu Manager</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </>
            )}
        </TabsContent>
      </Tabs>
    )
}

function CreateStoreForm({ user, isAdmin, profile, onAutoCreate }: { user: any; isAdmin: boolean; profile?: AppUser | null; onAutoCreate: (coords: { lat: number; lng: number }) => void; }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const { firestore } = useFirebase();
    const [isLocationConfirmOpen, setIsLocationConfirmOpen] = useState(false);
    const [capturedCoords, setCapturedCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [isLocating, setIsLocating] = useState(false);

    const form = useForm<StoreFormValues>({
        resolver: zodResolver(storeSchema),
        defaultValues: {
            name: isAdmin ? 'LocalBasket' : (profile ? `${profile.firstName}'s Store` : ''),
            description: isAdmin ? 'The master store for setting canonical product prices.' : (profile ? `Fresh services and goods from ${profile.firstName}'s Store.` : ''),
            address: isAdmin ? 'Platform-wide' : (profile?.address || ''),
            latitude: profile?.latitude || 0,
            longitude: profile?.longitude || 0,
            teluguName: '',
        },
    });

    useEffect(() => {
        if (!isAdmin && profile) {
            if (profile.latitude && profile.longitude) {
                form.setValue('latitude', profile.latitude, { shouldValidate: true });
                form.setValue('longitude', profile.longitude, { shouldValidate: true });
            } else {
                handleGetLocation(true); 
            }
        }
    }, [isAdmin, profile]);
    
    const handleGetLocation = (isAuto = false) => {
        if (!navigator.geolocation) {
            toast({ variant: "destructive", title: "Not Supported", description: "Geolocation is not supported by your browser." });
            return;
        }

        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
                if (isAuto) {
                    setCapturedCoords(coords);
                    setIsLocationConfirmOpen(true);
                } else {
                    form.setValue('latitude', coords.lat, { shouldValidate: true, shouldDirty: true });
                    form.setValue('longitude', coords.lng, { shouldValidate: true, shouldDirty: true });
                    toast({ title: "Location Fetched!", description: "Your current location has been filled in." });
                }
                setIsLocating(false);
            },
            () => {
                if (isAuto) {
                    toast({ variant: 'destructive', title: "Automatic Creation Failed", description: "Could not retrieve your location. Please create your store manually." });
                } else {
                    toast({ variant: 'destructive', title: "Location Error", description: "Could not retrieve your location. Please enter it manually." });
                }
                setIsLocating(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const handleConfirmLocation = (confirmed: boolean) => {
        setIsLocationConfirmOpen(false);
        if (confirmed && capturedCoords) {
            onAutoCreate(capturedCoords);
        } else {
            toast({ title: 'Automatic Creation Cancelled', description: 'Please create your store manually from your store location.' });
        }
    };

    const onSubmit = (data: StoreFormValues) => {
        if (!user || !firestore) {
            toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be logged in.' });
            return;
        }
        if (!isAdmin && (data.latitude === 0 || data.longitude === 0)) {
            toast({ variant: 'destructive', title: 'Location Required', description: 'Please provide your store\'s GPS location.' });
            return;
        }

        startTransition(() => {
            const storeData = { ...data, ownerId: user.uid, imageId: `store-${Math.floor(Math.random() * 3) + 1}`, isClosed: false };
            addDoc(collection(firestore, 'stores'), storeData)
                .then(() => {
                    toast({ title: 'Store Created!', description: `Your store "${data.name}" is now live.` });
                })
                .catch((serverError) => {
                    const permissionError = new FirestorePermissionError({ path: 'stores', operation: 'create', requestResourceData: storeData });
                    errorEmitter.emit('permission-error', permissionError);
                });
        });
    };

    return (
        <Card className="max-w-3xl mx-auto">
            <CardHeader>
                <CardTitle className="text-3xl font-headline">{isAdmin ? t('create-master-store') : t('create-your-store')}</CardTitle>
                <CardDescription>
                    {isAdmin ? t('this-is-the-master-store-for-the-platform') : t('fill-out-the-details-to-get-your-shop-listed')}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                         <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('store-name')}</FormLabel>
                                <FormControl>
                                <Input placeholder="e.g., Patel Kirana Store" {...field} disabled={isAdmin} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="teluguName"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Store Name (Telugu)</FormLabel>
                                <FormControl>
                                <Input placeholder="e.g., పటేల్ కిరాణా స్టోర్" {...field} />
                                </FormControl>
                                <FormDescription>This name will be used for Telugu voice commands.</FormDescription>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('store-description')}</FormLabel>
                                <FormControl><Textarea placeholder={t('describe-what-makes-your-store-special')} {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="address"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('full-store-address')}</FormLabel>
                                <FormControl><Input placeholder="123 Market Street, Mumbai" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                         {!isAdmin && (
                            <div className="space-y-2">
                                    <FormLabel>{t('store-location-gps')}</FormLabel>
                                    <div className="flex items-end gap-4">
                                        <div className="grid grid-cols-2 gap-4 flex-1">
                                            <FormField control={form.control} name="latitude" render={({ field }) => (
                                                <FormItem><FormLabel className="text-xs text-muted-foreground">{t('latitude')}</FormLabel><FormControl><Input type="number" step="any" placeholder="e.g., 19.0760" {...field} /></FormControl><FormMessage /></FormItem>
                                            )} />
                                            <FormField control={form.control} name="longitude" render={({ field }) => (
                                                <FormItem><FormLabel className="text-xs text-muted-foreground">{t('longitude')}</FormLabel><FormControl><Input type="number" step="any" placeholder="e.g., 72.8777" {...field} /></FormControl><FormMessage /></FormItem>
                                            )} />
                                        </div>
                                        <Button type="button" variant="outline" onClick={() => handleGetLocation(false)} disabled={isLocating}>
                                            {isLocating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
                                            {isLocating ? 'Locating...' : t('get-current-location')}
                                        </Button>
                                    </div>
                            </div>
                            )}
                        <Button type="submit" className="w-full" disabled={isPending || !user}>{isPending ? t('creating') : t('create-store')}</Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}

export default function MyStorePage() {
    const { user, isUserLoading, firestore } = useFirebase();
    const router = useRouter();
    const { toast } = useToast();
    const [isCreating, startCreationTransition] = useTransition();
    const { language } = useAppStore();

    const isAdmin = useMemo(() => user?.email === ADMIN_EMAIL, [user]);

    const ownerStoreQuery = useMemoFirebase(() => {
        if (!firestore || !user || isAdmin) return null;
        return query(collection(firestore, 'stores'), where('ownerId', '==', user.uid));
    }, [firestore, user, isAdmin]);

    const adminStoreQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'stores'), where('name', '==', 'LocalBasket'));
    }, [firestore]);

    const userProfileQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);

    const { data: ownerStores, isLoading: isOwnerStoreLoading } = useCollection<Store>(ownerStoreQuery);
    const { data: adminStores, isLoading: isAdminStoreLoading } = useCollection<Store>(adminStoreQuery);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<AppUser>(userProfileQuery);
    
    const myStore = ownerStores?.[0];
    const adminStore = adminStores?.[0];

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login?redirectTo=/dashboard/owner/my-store');
        }
    }, [isUserLoading, user, router]);

    const handleAutoCreateStore = (coords: { lat: number; lng: number }) => {
        if (!user || !firestore || !userProfile) {
             toast({ variant: 'destructive', title: 'Error', description: 'User profile not found.' });
             return;
        }

        startCreationTransition(() => {
             const storeData = {
                name: `${userProfile.firstName}'s Store`,
                teluguName: `${userProfile.firstName} గారి స్టోర్`,
                description: `Fresh services and goods from ${userProfile.firstName}'s Store.`,
                address: userProfile.address,
                latitude: coords.lat,
                longitude: coords.lng,
                ownerId: user.uid,
                imageId: `store-${Math.floor(Math.random() * 3) + 1}`,
                isClosed: false,
                businessType: userProfile.accountType === 'restaurant' ? 'restaurant' : 'grocery',
            };
            addDoc(collection(firestore, 'stores'), storeData)
                .then(() => {
                    toast({ title: 'Store Created!', description: `Your store "${storeData.name}" is now live.` });
                })
                .catch((serverError) => {
                    const permissionError = new FirestorePermissionError({ path: 'stores', operation: 'create', requestResourceData: storeData });
                    errorEmitter.emit('permission-error', permissionError);
                });
        });
    };

    const isLoading = isUserLoading || isOwnerStoreLoading || isAdminStoreLoading || isProfileLoading;

    if (isLoading) {
        return <div className="container mx-auto py-12 px-4 md:px-6">{t('loading-your-store')}...</div>
    }

    const renderContent = () => {
        if (!user) return null;

        if (isAdmin) {
            return adminStore ? <ManageStoreView store={adminStore} isAdmin={true} /> : <CreateStoreForm user={user} isAdmin={true} onAutoCreate={() => {}} />;
        }

        if (myStore) {
            return <ManageStoreView store={myStore} isAdmin={false} adminStoreId={adminStore?.id} />;
        }
        
        if (!userProfile) {
            return (
                 <Card className="max-w-3xl mx-auto">
                    <CardHeader>
                        <CardTitle className="text-3xl font-headline">{t('complete-your-profile-first')}</CardTitle>
                        <CardDescription>
                            {t('to-automatically-create-your-store')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Button asChild>
                            <Link href="/dashboard/customer/my-profile">{t('go-to-my-profile')}</Link>
                        </Button>
                    </CardContent>
                </Card>
            )
        }

        return <CreateStoreForm user={user} isAdmin={false} profile={userProfile} onAutoCreate={handleAutoCreateStore} />;
    };
    
    const pageTitleKey = isAdmin
        ? (adminStore ? `Master Catalog: ${adminStore.name}` : 'create-master-store')
        : (myStore ? `Dashboard: ${myStore.name}` : 'create-your-store');
    
    const pageTitle = (myStore || adminStore) ? pageTitleKey : t(pageTitleKey);


    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <h1 className="text-4xl font-bold font-headline mb-8">{pageTitle}</h1>
            {renderContent()}
        </div>
    );
}
