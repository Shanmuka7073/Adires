
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
import { collection, query, where, addDoc, writeBatch, doc, updateDoc, setDoc, deleteDoc, limit } from 'firebase/firestore';
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
import { Share2, MapPin, Trash2, AlertCircle, ImageIcon, Loader2, Sparkles, PlusCircle, Edit, Link2, QrCode, Save, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { t } from '@/lib/locales';
import { useAppStore, useMyStorePageStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { generateProductImage } from '@/ai/flows/generate-product-image-flow';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { OnboardingChatbot } from '@/components/features/onboarding-chatbot';

const ADMIN_EMAIL = 'admin@gmail.com';

const storeSchema = z.object({
  name: z.string().min(3, 'Store name must be at least 3 characters'),
  teluguName: z.string().optional(),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters'),
  address: z.string().min(10, 'Please enter a valid address'),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

type StoreFormValues = z.infer<typeof storeSchema>;

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
        <Card className="rounded-3xl border-0 shadow-lg overflow-hidden">
            <CardHeader className="bg-primary/5 border-b border-black/5">
                <CardTitle className="text-sm font-black uppercase tracking-tight">Business Visual</CardTitle>
                <CardDescription className="text-[10px] font-bold opacity-40 uppercase">Update your digital storefront image</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
                 <div className="w-full aspect-video relative rounded-2xl overflow-hidden border-2 bg-muted shadow-inner">
                    {imageUrl ? (
                        <Image src={imageUrl} alt={store.name} fill className="object-cover" />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full bg-muted/50 text-muted-foreground">
                            <ImageIcon className="h-10 w-10 mb-2 opacity-20" />
                            <p className="text-[10px] font-black uppercase opacity-20">No Image Set</p>
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
                    {isTyping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Identity Image
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
                    toast({ title: "Zone Added", description: `"${newTableName}" added to floor map.` });
                    setNewTableName('');
                })
                .catch(err => {
                    toast({ variant: "destructive", title: "Save Failed", description: err.message });
                });
        });
    };
    
    const handleRemoveTable = (tableToRemove: string) => {
        const updatedTables = (store.tables || []).filter(t => t !== tableToRemove);
        startSaveTransition(() => {
            updateDoc(doc(firestore, 'stores', store.id), { tables: updatedTables })
                .then(() => toast({ title: "Zone Removed" }))
                .catch(err => {
                    toast({ variant: "destructive", title: "Update Failed", description: err.message });
                });
        });
    };

    return (
        <Card className="rounded-3xl border-0 shadow-lg overflow-hidden">
            <CardHeader className="bg-primary/5 border-b border-black/5">
                <CardTitle className="text-sm font-black uppercase tracking-tight">Floor Management</CardTitle>
                <CardDescription className="text-[10px] font-bold opacity-40 uppercase">Manage tables, chairs or service zones</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
                <div className="flex gap-2">
                    <Input 
                        placeholder="e.g., Table 5"
                        value={newTableName}
                        onChange={(e) => setNewTableName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddTable(); }}
                        className="h-11 rounded-xl border-2"
                    />
                    <Button onClick={handleAddTable} disabled={isSaving || !newTableName.trim()} className="rounded-xl h-11 px-6 font-black uppercase text-[10px]">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                    </Button>
                </div>
                 {store.tables && store.tables.length > 0 && (
                     <div className="space-y-2">
                         <Label className="text-[8px] font-black uppercase opacity-40">Active Zones</Label>
                         <div className="grid grid-cols-2 gap-2">
                             {store.tables.map(table => (
                                 <div key={table} className="flex items-center justify-between p-2 pl-4 bg-muted/30 rounded-xl border border-black/5">
                                     <span className="font-bold text-xs">{table}</span>
                                     <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-red-50 text-destructive" onClick={() => handleRemoveTable(table)}>
                                        <Trash2 className="h-3.5 w-3.5" />
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

function StoreDetails({ store, onUpdate }: { store: Store, onUpdate: () => void }) {
    const { firestore } = useFirebase();
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
                    toast({ title: "Identity Updated" });
                    setIsOpen(false);
                    onUpdate();
                });
        });
    };

    return (
        <Card className="rounded-[2rem] border-0 shadow-lg overflow-hidden bg-white">
            <CardHeader className="flex flex-row justify-between items-center border-b border-black/5 bg-primary/5 pb-6">
                <div>
                    <CardTitle className="text-xl font-black uppercase tracking-tight">Business Identity</CardTitle>
                    <CardDescription className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Public Information Hub</CardDescription>
                </div>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="rounded-xl font-black text-[9px] uppercase tracking-widest border-2 h-9 px-4">
                            <Edit className="mr-2 h-3.5 w-3.5" /> Edit Details
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
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase opacity-40">Business Name</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl border-2" /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <FormField control={form.control} name="description" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase opacity-40">Description</FormLabel><FormControl><Textarea {...field} className="min-h-[100px] rounded-xl border-2" /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <DialogFooter>
                                    <Button type="submit" disabled={isPending} className="h-12 rounded-xl font-black uppercase tracking-widest text-[10px] w-full">
                                        {isPending ? 'Processing...' : 'Save Updates'}
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
                                <MapPin className="h-3 w-3" /> {store.latitude.toFixed(4)}, {store.longitude.toFixed(4)}
                            </p>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase opacity-40 tracking-[0.2em]">Description</p>
                        <p className="text-gray-600 font-medium leading-relaxed">{store.description}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function ManageStoreView({ store, onUpdate }: { store: Store, onUpdate: () => void }) {
    if (store.isClosed) return <Alert variant="destructive" className="rounded-3xl border-2"><AlertTitle className="font-black uppercase tracking-tight">Business Deactivated</AlertTitle><AlertDescription className="font-bold opacity-60">This store is currently not visible to customers.</AlertDescription></Alert>;
    
    return (
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-black/5 p-1 rounded-2xl border mb-10 h-12">
          <TabsTrigger value="overview" className="rounded-xl font-black text-[10px] uppercase h-10">Identity</TabsTrigger>
          <TabsTrigger value="ops" className="rounded-xl font-black text-[10px] uppercase h-10">Operations</TabsTrigger>
          <TabsTrigger value="visibility" className="rounded-xl font-black text-[10px] uppercase h-10">Exposure</TabsTrigger>
          <TabsTrigger value="security" className="rounded-xl font-black text-[10px] uppercase h-10 text-red-600">Danger</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="mt-0 space-y-8 animate-in fade-in slide-in-from-bottom-2">
            <StoreDetails store={store} onUpdate={onUpdate} />
            <div className="grid md:grid-cols-2 gap-8">
                <StoreImageUploader store={store} />
                <Card className="rounded-[2.5rem] border-0 shadow-lg overflow-hidden bg-primary/5 border-2 border-primary/10">
                    <CardHeader><CardTitle className="text-sm font-black uppercase">Digital Presence</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-xs font-bold text-primary/60 uppercase tracking-tight">Your digital menu is active and ready for customers to scan QR codes at your location.</p>
                        <Button asChild className="w-full h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20">
                            <Link href="/dashboard/owner/menu-manager"><QrCode className="mr-2 h-4 w-4" /> Manage Digital Menu</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>

        <TabsContent value="ops" className="mt-0 space-y-8 animate-in fade-in slide-in-from-bottom-2">
            <TableManager store={store} />
        </TabsContent>

        <TabsContent value="visibility" className="mt-0 space-y-8 animate-in fade-in slide-in-from-bottom-2">
            <PromoteStore store={store} />
        </TabsContent>

        <TabsContent value="security" className="mt-0 space-y-8 animate-in fade-in slide-in-from-bottom-2">
            <DangerZone store={store} />
        </TabsContent>
    </Tabs>
    )
}

export default function MyStorePage() {
    const { user, isUserLoading, firestore } = useFirebase();
    const router = useRouter();
    const { isAdmin, isRestaurantOwner, isLoading: isRoleLoading } = useAdminAuth();
    const { stores, userStore, fetchInitialData, setUserStore } = useAppStore();
    const { toast } = useToast();

    const ownerStoreQuery = useMemoFirebase(() => {
        if (!firestore || !user || isAdmin) return null;
        return query(collection(firestore, 'stores'), where('ownerId', '==', user.uid), limit(1));
    }, [firestore, user, isAdmin]);

    const { data: ownerStores, isLoading: isOwnerStoreLoading, refetch } = useCollection<Store>(ownerStoreQuery);
    const myStore = useMemo(() => userStore || ownerStores?.[0], [userStore, ownerStores]);

    useEffect(() => { if (!isUserLoading && !user) router.push('/login'); }, [isUserLoading, user, router]);
    
    useEffect(() => {
        if (ownerStores && ownerStores.length > 0) {
            setUserStore(ownerStores[0]);
        }
    }, [ownerStores, setUserStore]);

    if (isUserLoading || isRoleLoading || isOwnerStoreLoading) return <div className="p-12 text-center h-screen flex flex-col items-center justify-center gap-4"><Loader2 className="animate-spin h-10 w-10 text-primary opacity-20" /><p className="text-[10px] font-black uppercase tracking-widest opacity-40">Connecting to Business Hub...</p></div>;

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 space-y-12 pb-32">
            {!myStore && isRestaurantOwner ? (
                <div className="space-y-12">
                    <div className="text-center max-w-2xl mx-auto space-y-4">
                        <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-2">
                            <Smartphone className="h-10 w-10 text-primary" />
                        </div>
                        <h1 className="text-4xl font-black font-headline tracking-tight text-gray-950 uppercase italic">Onboarding Assistant</h1>
                        <p className="text-muted-foreground font-bold">Welcome! I'm your digital partner. Let's build your store presence together through a quick conversation.</p>
                    </div>
                    <OnboardingChatbot onComplete={(id) => {
                        toast({ title: "Setup Complete!", description: "Refreshing your business dashboard..." });
                        if (firestore) fetchInitialData(firestore, user?.uid);
                        if (refetch) refetch();
                    }} />
                </div>
            ) : myStore ? (
                <>
                    <div className="flex justify-between items-end border-b pb-10 border-black/5">
                        <div className="space-y-1">
                            <h1 className="text-6xl font-black font-headline tracking-tighter uppercase italic leading-none text-gray-950 truncate max-w-[600px]">{myStore.name}</h1>
                            <p className="text-muted-foreground font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">Operational Command & Identity</p>
                        </div>
                        <div className="hidden sm:block">
                            <Badge variant="outline" className="rounded-full border-2 border-primary/20 text-primary font-black uppercase text-[10px] tracking-widest px-4 py-1.5 bg-primary/5">
                                <CheckCircle2 className="h-3 w-3 mr-2 fill-current" /> Store Live
                            </Badge>
                        </div>
                    </div>
                    <ManageStoreView store={myStore} onUpdate={() => refetch && refetch()} />
                </>
            ) : (
                <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed opacity-40 max-w-2xl mx-auto">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4" />
                    <p className="font-black uppercase tracking-widest text-sm mb-6">Unauthorized access detected</p>
                    <Button asChild className="rounded-xl h-12 px-8 font-black uppercase text-[10px] tracking-widest shadow-xl"><Link href="/dashboard">Return to Dashboard</Link></Button>
                </div>
            )}
        </div>
    );
}
