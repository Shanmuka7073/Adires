
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { Store, User as AppUser } from '@/lib/types';
import { useFirebase, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, doc, updateDoc, setDoc, limit } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Share2,
  MapPin,
  ImageIcon,
  Loader2,
  Edit3,
  Save,
  CheckCircle2,
  Send,
  ArrowRight,
  User as UserIcon,
  Copy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useAdminAuth } from '@/hooks/use-admin-auth';

const ADIRES_LOGO = "https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png";

const storeSchema = z.object({
  name: z.string().min(3, 'Store name must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  address: z.string().min(10, 'Please enter a valid address'),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
});

type StoreFormValues = z.infer<typeof storeSchema>;

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
        <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-950 px-1">Storefront Visual</h3>
            <Card className="rounded-[2.5rem] border-0 shadow-lg overflow-hidden bg-white">
                <CardContent className="p-6 space-y-6">
                    <div className="w-full aspect-video relative rounded-3xl overflow-hidden border-2 bg-muted shadow-inner">
                        <Image 
                            src={imageUrl || store.imageUrl || ADIRES_LOGO} 
                            alt="Storefront" 
                            fill 
                            className="object-cover" 
                        />
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                            <Label className="text-[8px] font-black uppercase tracking-widest opacity-40">Direct Image URL</Label>
                            <Copy className="h-3 w-3 opacity-20" />
                        </div>
                        <Input
                            placeholder="https://images.unsplash.com/..."
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            disabled={isSaving}
                            className="h-12 rounded-xl border-2 bg-muted/20 text-xs font-bold"
                        />
                    </div>
                    <Button 
                        onClick={handleSave} 
                        disabled={isSaving} 
                        className="w-full h-14 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95"
                    >
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Visuals
                    </Button>
                </CardContent>
            </Card>
        </div>
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
            updateDoc(storeRef, data)
                .then(() => {
                    toast({ title: "Identity Updated!" });
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
            <CardHeader className="flex flex-row justify-between items-center bg-primary/5 border-b border-black/5 pb-6">
                <div>
                    <CardTitle className="text-sm font-black uppercase tracking-widest text-gray-950">Business Profile</CardTitle>
                    <CardDescription className="text-[10px] font-bold opacity-40 uppercase">Identity Hub</CardDescription>
                </div>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="rounded-xl font-black text-[9px] uppercase tracking-widest border-2 h-10 px-4 gap-2">
                            <Edit3 className="h-3.5 w-3.5" /> Edit Profile
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-[2.5rem] border-0 shadow-2xl">
                        <DialogHeader>
                            <DialogTitle className="font-black uppercase">Edit Business Data</DialogTitle>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
                                <FormField control={form.control} name="name" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase opacity-40">Store Name</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl border-2" /></FormControl></FormItem>
                                )}/>
                                <FormField control={form.control} name="address" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase opacity-40">Physical Address</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl border-2" /></FormControl></FormItem>
                                )}/>
                                <FormField control={form.control} name="description" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase opacity-40">Bio / Description</FormLabel><FormControl><Textarea {...field} className="min-h-[100px] rounded-xl border-2" /></FormControl></FormItem>
                                )}/>
                                <Button type="submit" disabled={isPending} className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-[10px]">
                                    {isPending ? 'Syncing...' : 'Save Updates'}
                                </Button>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
                <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase opacity-40 tracking-widest">Address</p>
                    <p className="font-bold text-gray-700 text-sm">{store.address}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase opacity-40 tracking-widest">Coordinates</p>
                    <p className="font-mono font-bold text-primary flex items-center gap-2 text-sm">
                        <MapPin className="h-3.5 w-3.5" /> {store.latitude?.toFixed(4)}, {store.longitude?.toFixed(4)}
                    </p>
                </div>
                <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase opacity-40 tracking-widest">Bio</p>
                    <p className="text-gray-600 font-medium text-xs leading-relaxed">{store.description}</p>
                </div>
            </CardContent>
        </Card>
    );
}

function PromoteStore() {
    return (
        <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-950 px-1">Promote Business</h3>
            <Card className="rounded-[2.5rem] border-0 shadow-lg overflow-hidden bg-white">
                <CardHeader className="bg-primary/5 border-b border-black/5 pb-4">
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-xs font-black uppercase tracking-widest">Growth Engine</CardTitle>
                        <Badge variant="outline" className="bg-primary/10 text-primary border-0 font-black text-[8px] uppercase px-2 py-0.5 flex gap-1 items-center">
                            <Send className="h-2.5 w-2.5" /> Share
                        </Badge>
                    </div>
                    <CardDescription className="text-[9px] font-bold text-gray-400 uppercase mt-1">Grow your customer base</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                    <Button className="w-full h-14 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20 gap-3">
                        <Share2 className="h-5 w-5" /> Share with Contacts
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

export default function MyStorePage() {
    const { user, firestore } = useFirebase();
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

    if (isRoleLoading) return <div className="p-12 text-center h-[80vh] flex flex-col items-center justify-center gap-4"><Loader2 className="animate-spin h-10 w-10 text-primary opacity-20" /><p className="text-[10px] font-black uppercase tracking-widest opacity-40">Syncing Identity...</p></div>;

    if (!myStore) return <div className="p-12 text-center py-32"><p className="font-black uppercase tracking-widest text-xs opacity-40">Business hub not found.</p></div>;

    return (
        <div className="container mx-auto py-8 px-4 md:px-6 space-y-10 pb-32 animate-in fade-in duration-700">
            <div className="flex justify-between items-end border-b pb-8 border-black/5">
                <div className="space-y-1">
                    <h1 className="text-4xl md:text-5xl font-black font-headline tracking-tighter text-gray-950 truncate max-w-[300px] sm:max-w-md">{myStore.name}</h1>
                    <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.3em] opacity-40">Operational Dashboard</p>
                </div>
                <div className="hidden sm:block">
                    <Badge variant="outline" className="rounded-full border-2 border-primary/20 text-primary font-black uppercase text-[10px] tracking-widest px-4 py-1.5 bg-primary/5">
                        <CheckCircle2 className="h-3 w-3 mr-2 fill-current" /> Verified Store
                    </Badge>
                </div>
            </div>

            <div className="space-y-10">
                <StoreDetails store={myStore} onUpdate={() => fetchInitialData(firestore!, user?.uid)} />
                
                <StoreImageUploader store={myStore} />
                
                <PromoteStore />

                <div className="pt-4">
                    <Button asChild variant="outline" className="w-full h-14 rounded-2xl border-2 border-primary/20 bg-primary/5 text-primary font-black uppercase text-[10px] tracking-widest hover:bg-primary/10 shadow-sm transition-all active:scale-95">
                        <Link href="/dashboard/owner/menu-manager">
                            <ImageIcon className="mr-2 h-4 w-4" /> Edit Digital Menu
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
