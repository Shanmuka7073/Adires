
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
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { useTransition, useEffect, useState } from 'react';
import type { User as AppUser } from '@/lib/types';
import { Loader2, LogOut, LayoutDashboard, MapPin, LocateFixed, User as UserIcon, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppStore, useProfileFormStore, type ProfileFormValues } from '@/lib/store';
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
        <Card className="rounded-[2rem] border-0 shadow-lg overflow-hidden">
            <CardHeader className="bg-primary/5 border-b border-black/5">
                <CardTitle className="text-sm font-black uppercase tracking-tight">Identity Visual</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase opacity-40">Paste a direct image URL</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
                 <div className="w-32 h-32 relative rounded-[2.5rem] overflow-hidden border-4 border-white shadow-xl mx-auto bg-muted">
                    {imageUrl ? (
                        <Image src={imageUrl} alt="Profile Picture" fill className="object-cover" />
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <UserIcon className="w-12 h-12 text-muted-foreground opacity-20" />
                        </div>
                    )}
                </div>
                 <div className="space-y-2">
                    <FormField
                      name="imageUrl"
                      render={({ field }) => (
                        <FormItem>
                           <FormControl>
                                <Input
                                    placeholder="https://..."
                                    {...field}
                                    className="h-10 rounded-xl border-2 font-bold"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>
                 <Button onClick={handleSave} disabled={isSaving} className="w-full h-11 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Update Photo
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
                toast({ title: "Location Captured!" });
                setIsFetchingLocation(false);
            },
            () => {
                toast({ variant: 'destructive', title: "Location Error" });
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
                toast({ title: 'Profile Updated' });
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
        router.push('/login');
    }
  };
  
  const dashboardLink = isAdmin ? "/dashboard/admin" : "/dashboard";

  if (isUserLoading || isProfileLoading) {
      return (
        <div className="container mx-auto py-12 text-center h-[60vh] flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" />
            <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Loading Vault...</p>
        </div>
      );
  }
  
  return (
    <div className="container mx-auto py-12 px-4 md:px-6">
         <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden bg-white">
                        <CardHeader className="bg-primary/5 border-b border-black/5 p-8">
                        <CardTitle className="text-3xl font-black font-headline uppercase tracking-tighter italic">{t('my-profile')}</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase opacity-40 tracking-widest">Personal Identity Vault</CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="firstName"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase opacity-40">First Name</FormLabel>
                                        <FormControl>
                                        <Input placeholder="John" {...field} className="h-12 rounded-xl border-2 font-bold" />
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
                                        <Input placeholder="Doe" {...field} className="h-12 rounded-xl border-2 font-bold" />
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
                                    <FormLabel className="text-[10px] font-black uppercase opacity-40">Email Address</FormLabel>
                                    <FormControl>
                                    <Input type="email" {...field} readOnly disabled className="h-12 rounded-xl border-2 font-bold bg-muted/20" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="phone"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase opacity-40">Phone Number</FormLabel>
                                        <FormControl>
                                        <Input placeholder="9876543210" {...field} className="h-12 rounded-xl border-2 font-bold" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <div className="space-y-2">
                                    <FormLabel className="text-[10px] font-black uppercase opacity-40">Coordinate Sync</FormLabel>
                                    <Button type="button" variant="outline" onClick={handleGetLocation} disabled={isFetchingLocation} className="w-full h-12 rounded-xl border-2 font-black uppercase text-[10px] tracking-widest bg-white">
                                        {isFetchingLocation ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LocateFixed className="h-4 w-4 mr-2" />}
                                        Fetch GPS
                                    </Button>
                                </div>
                            </div>
                            <FormField
                                control={form.control}
                                name="address"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase opacity-40">Full Delivery Address</FormLabel>
                                    <FormControl>
                                    <Input placeholder="123 Main St, Area, City" {...field} className="h-12 rounded-xl border-2 font-bold" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </CardContent>
                        <CardFooter className="p-8 bg-gray-50 border-t border-black/5 flex flex-col gap-4">
                            <Button type="submit" disabled={isSaving} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20">
                                {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Save Identity Changes'}
                            </Button>
                            <Button onClick={handleLogout} variant="ghost" className="w-full h-12 rounded-xl font-bold uppercase text-[10px] text-destructive tracking-widest">
                                <LogOut className="mr-2 h-4 w-4" /> {t('logout')}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
                <div className="space-y-8">
                    {userData && <ProfilePictureCard user={userData} />}
                    <Card className="rounded-[2rem] border-0 shadow-lg bg-slate-900 text-white p-6 space-y-4">
                        <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center text-primary">
                            <LayoutDashboard className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-black uppercase text-xs tracking-tight">Access Dashboard</h3>
                            <p className="text-[10px] font-bold text-white/40 leading-relaxed uppercase mt-1">Return to your operational control center.</p>
                        </div>
                        <Button asChild className="w-full h-11 rounded-xl bg-white text-slate-900 hover:bg-white/90 font-black uppercase text-[10px] tracking-widest shadow-xl">
                            <Link href={dashboardLink}>Go to Dashboard</Link>
                        </Button>
                    </Card>
                </div>
            </form>
        </Form>
    </div>
  );
}
