
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
  Copy,
  ExternalLink
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
                    toast({ title: 'Image URL Updated!' });
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
        <Card className="rounded-[1.5rem] border-0 shadow-lg overflow-hidden bg-white">
            <CardHeader className="flex flex-row justify-between items-center bg-primary/5 border-b border-black/5 p-3">
                <div>
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest text-gray-950">Business Profile</CardTitle>
                </div>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="rounded-lg font-black text-[8px] uppercase tracking-widest border-2 h-7 px-3 gap-1">
                            <Edit3 className="h-3 w-3" /> Edit
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-[2rem] border-0 shadow-2xl">
                        <DialogHeader>
                            <DialogTitle className="font-black uppercase">Edit Profile</DialogTitle>
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
                    <div className="space-y-0.5">
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
                <div className="mt-3 pt-2 border-t border-black/5">
                    <p className="text-[8px] font-black uppercase opacity-40 tracking-widest mb-0.5">Business Bio</p>
                    <p className="text-gray-600 font-bold text-[10px] leading-tight truncate">{store.description}</p>
                </div>
            </CardContent>
        </Card>
    );
}

function PromoteStore() {
    return (
        <Card className="rounded-[1.5rem] border-0 shadow-lg overflow-hidden bg-white">
            <CardContent className="p-3 flex justify-between items-center">
                <div className="flex flex-col">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest">Promote Business</CardTitle>
                    <p className="text-[8px] font-bold text-gray-400 uppercase leading-none mt-1">Growth Engine Enabled</p>
                </div>
                <Button className="h-9 rounded-xl font-black uppercase text-[8px] tracking-widest shadow-lg shadow-primary/20 gap-2 px-4">
                    <Share2 className="h-3.5 w-3.5" /> Share Contacts
                </Button>
            </CardContent>
        </Card>
    );
}

export default function MyStorePage() {
    const { user, firestore } = useFirebase();
    const router = useRouter();
    const { isRestaurantOwner, isLoading: isRoleLoading } = useAdminAuth();
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

    if (isRoleLoading) return <div className="p-12 text-center h-[80vh] flex flex-col items-center justify-center gap-4"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div>;

    if (!myStore) return <div className="p-12 text-center py-32"><p className="font-black uppercase tracking-widest text-xs opacity-40">Store not found.</p></div>;

    return (
        <div className="container mx-auto py-3 px-3 space-y-3 pb-24 animate-in fade-in duration-500">
            <div className="flex justify-between items-center border-b pb-3 border-black/5">
                <div className="min-w-0">
                    <h1 className="text-xl font-black tracking-tight text-gray-950 truncate uppercase leading-none">{myStore.name}</h1>
                    <p className="text-muted-foreground font-black uppercase text-[8px] tracking-[0.2em] opacity-40 mt-1">Operational Hub</p>
                </div>
                <Badge variant="outline" className="rounded-lg border-2 border-primary/20 text-primary font-black uppercase text-[7px] tracking-widest px-2 py-1 bg-primary/5">
                    <CheckCircle2 className="h-2.5 w-2.5 mr-1 fill-current" /> Active
                </Badge>
            </div>

            <div className="grid grid-cols-1 gap-3">
                <StoreDetails store={myStore} onUpdate={() => fetchInitialData(firestore!, user?.uid)} />
                
                <StoreImageUploader store={myStore} />
                
                <PromoteStore />

                <Button asChild variant="outline" className="w-full h-11 rounded-xl border-2 border-primary/20 bg-primary/5 text-primary font-black uppercase text-[9px] tracking-widest hover:bg-primary/10 shadow-sm transition-all active:scale-95">
                    <Link href="/dashboard/owner/menu-manager">
                        <ImageIcon className="mr-2 h-4 w-4" /> Edit Digital Catalog
                    </Link>
                </Button>
            </div>
        </div>
    );
}
