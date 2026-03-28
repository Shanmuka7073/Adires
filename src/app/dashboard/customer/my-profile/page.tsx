
'use client';

import { useFirebase, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useForm, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { useTransition, useEffect, useState } from 'react';
import type { User as AppUser } from '@/lib/types';
import { Loader2, LogOut, LayoutDashboard, MapPin, LocateFixed, User as UserIcon, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useProfileFormStore, type ProfileFormValues, useAppStore } from '@/lib/store';
import Link from 'next/link';
import { t } from '@/lib/locales';
import { signOut } from 'firebase/auth';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import Image from 'next/image';

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email(),
  phone: z.string().min(10, 'A valid phone number is required'),
  address: z.string().min(10, 'A valid address is required'),
  imageUrl: z.string().url().optional().or(z.literal('')),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

function ProfilePictureCard({ user }: { user: AppUser }) {
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const [isSaving, startSave] = useTransition();
    const { watch } = useFormContext<ProfileFormValues>();
    const imageUrl = watch('imageUrl');

    const handleSave = () => {
        if (!user || !imageUrl || !firestore) return;
        startSave(async () => {
            const userRef = doc(firestore, 'users', user.id);
            const updateData = { imageUrl: imageUrl };

            updateDoc(userRef, updateData)
                .then(() => {
                    toast({ title: "Profile Picture Updated!" });
                })
                .catch((e) => {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({
                        path: userRef.path,
                        operation: 'update',
                        requestResourceData: updateData,
                    }));
                });
        });
    };

    return (
        <Card className="rounded-[2rem] border-0 shadow-lg bg-white overflow-hidden">
            <CardHeader className="bg-primary/5 border-b border-black/5">
                <CardTitle className="text-sm font-black uppercase tracking-tight">Profile Picture</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase opacity-40">Public Visual Identity</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
                 <div className="w-32 h-32 relative rounded-full overflow-hidden border-4 border-white shadow-xl mx-auto bg-muted">
                    {imageUrl ? (
                        <Image src={imageUrl} alt="Profile Picture" fill className="object-cover" />
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <UserIcon className="w-16 h-16 text-muted-foreground opacity-20" />
                        </div>
                    )}
                </div>
                 <div className="space-y-2">
                    <FormField
                      name="imageUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase opacity-40">Image Direct URL</FormLabel>
                           <FormControl>
                                <Input
                                    placeholder="https://example.com/photo.jpg"
                                    {...field}
                                    className="h-10 rounded-xl border-2"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>
                 <Button onClick={handleSave} disabled={isSaving} className="w-full h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-md">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Image
                </Button>
            </CardContent>
        </Card>
    );
}


export default function MyProfilePage() {
  const { user, isUserLoading, firestore, auth } = useFirebase();
  const { isAdmin } = useAdminAuth();
  const { resetApp } = useAppStore();
  const { toast } = useToast();
  const router = useRouter();
  const [isSaving, startSaveTransition] = useTransition();
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userData, isLoading: isProfileLoading } = useDoc<AppUser>(userDocRef);
  
  const { setForm } = useProfileFormStore();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: user?.email || '',
      phone: '',
      address: '',
      imageUrl: '',
      latitude: undefined,
      longitude: undefined,
    },
  });
  
  useEffect(() => {
    setForm(form);
    return () => setForm(null); 
  }, [form, setForm]);


  useEffect(() => {
    if (userData) {
      form.reset({
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        email: user?.email || '',
        phone: userData.phoneNumber || '',
        address: userData.address || '',
        imageUrl: userData.imageUrl || '',
        latitude: userData.latitude,
        longitude: userData.longitude,
      });
    } else if (user) {
        form.setValue('email', user.email || '');
    }
  }, [userData, user, form]);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login?redirectTo=/dashboard/customer/my-profile');
    }
  }, [isUserLoading, user, router]);

  const handleGetLocation = () => {
    if (navigator.geolocation) {
        setIsFetchingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                form.setValue('latitude', position.coords.latitude, { shouldValidate: true });
                form.setValue('longitude', position.coords.longitude, { shouldValidate: true });
                toast({ title: "Location Captured!", description: "Save changes to store these coordinates." });
                setIsFetchingLocation(false);
            },
            () => {
                toast({ variant: 'destructive', title: "Location Error", description: "Could not retrieve your location." });
                setIsFetchingLocation(false);
            }
        );
    }
  }
  
  const onSubmit = (data: ProfileFormValues) => {
    if (!firestore || !user || !userDocRef) return;
    
    startSaveTransition(() => {
        const profileData: Partial<AppUser> = {
            id: user.uid,
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            phoneNumber: data.phone,
            address: data.address,
            imageUrl: data.imageUrl,
            latitude: data.latitude,
            longitude: data.longitude,
        };

        setDoc(userDocRef, profileData, { merge: true })
            .then(() => {
                toast({ title: 'Profile Updated', description: 'Information saved successfully.' });
            })
            .catch((error) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: userDocRef.path,
                    operation: 'write',
                    requestResourceData: profileData
                }));
            });
    });
  };

  const handleLogout = async () => {
    if (auth) {
        await signOut(auth);
        resetApp();
        useAppStore.persist.clearStorage();
        router.push('/login');
    }
  };
  
  const dashboardLink = isAdmin ? "/dashboard/admin" : "/dashboard";

  if (isUserLoading || isProfileLoading) {
      return <div className="container mx-auto py-12 flex justify-center opacity-20"><Loader2 className="animate-spin h-8 w-8" /></div>;
  }
  
  return (
    <div className="container mx-auto py-12 px-4 md:px-6 max-w-6xl pb-32">
         <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid lg:grid-cols-3 gap-12">
                <div className="lg:col-span-2 space-y-8">
                    <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden bg-white">
                        <CardHeader className="bg-primary/5 border-b border-black/5 p-8">
                            <CardTitle className="text-3xl font-black font-headline tracking-tighter uppercase italic">{t('my-profile')}</CardTitle>
                            <CardDescription className="font-bold text-[10px] uppercase opacity-40 tracking-widest">Personal & Shipping Intelligence</CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="firstName"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase opacity-40">First Name</FormLabel>
                                        <FormControl>
                                        <Input {...field} className="h-12 rounded-xl border-2 font-bold" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="lastName"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase opacity-40">Last Name</FormLabel>
                                        <FormControl>
                                        <Input {...field} className="h-12 rounded-xl border-2 font-bold" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                            </div>
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase opacity-40">Email (Verified Identity)</FormLabel>
                                    <FormControl>
                                    <Input type="email" {...field} readOnly disabled className="h-12 rounded-xl border-2 bg-muted/30 font-bold" />
                                    </FormControl>
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase opacity-40">Mobile Number</FormLabel>
                                    <FormControl>
                                    <Input placeholder="9876543210" {...field} className="h-12 rounded-xl border-2 font-bold" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="address"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase opacity-40">Full Address</FormLabel>
                                    <FormControl>
                                    <Input placeholder="Plot, Street, City, Zip" {...field} className="h-12 rounded-xl border-2 font-bold" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />

                            <div className="p-6 rounded-[2rem] border-2 border-dashed border-black/10 bg-muted/20 space-y-4">
                                <div className="flex justify-between items-center px-1">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40">GPS Coordinates</h4>
                                    <Button type="button" variant="outline" size="sm" className="rounded-lg h-8 px-3 font-black text-[8px] uppercase tracking-widest bg-white border-2" onClick={handleGetLocation} disabled={isFetchingLocation}>
                                        {isFetchingLocation ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <LocateFixed className="mr-2 h-3 w-3" />}
                                        Auto-Detect
                                    </Button>
                                </div>
                                <div className="flex items-center gap-4 text-[10px] font-mono font-bold text-primary px-1">
                                    <MapPin className="h-4 w-4 shrink-0" />
                                    <span>Lat: {form.watch('latitude')?.toFixed(4) || '—'}, Lng: {form.watch('longitude')?.toFixed(4) || '—'}</span>
                                </div>
                            </div>

                        </CardContent>
                        <CardFooter className="p-8 bg-gray-50 border-t border-black/5 flex flex-col gap-4">
                            <Button type="submit" disabled={isSaving} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20">
                                {isSaving ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Syncing...</> : 'Save Changes'}
                            </Button>
                            <Button onClick={handleLogout} variant="ghost" className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-[9px] text-destructive hover:bg-red-50">
                                <LogOut className="mr-2 h-4 w-4" />
                                Terminate Session
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
                <div className="space-y-8">
                    {user && userData && <ProfilePictureCard user={userData} />}
                    
                    <Card className="rounded-[2rem] border-0 shadow-lg bg-slate-900 text-white overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-6 opacity-10 rotate-12"><LayoutDashboard className="h-24 w-24" /></div>
                        <CardHeader className="relative z-10">
                            <CardTitle className="text-sm font-black uppercase tracking-widest text-primary">Command Hub</CardTitle>
                            <CardDescription className="text-white/40 font-bold text-[10px] uppercase">Navigate to restricted zones</CardDescription>
                        </CardHeader>
                        <CardContent className="relative z-10">
                            <Button asChild className="w-full h-12 rounded-xl bg-white text-slate-900 font-black uppercase tracking-widest text-[10px] hover:bg-white/90 shadow-xl">
                                <Link href={dashboardLink}>Open Dashboard</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </form>
        </Form>
    </div>
  );
}
