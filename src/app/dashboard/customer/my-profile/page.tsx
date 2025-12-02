
'use client';

import { useFirebase, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { doc, setDoc } from 'firebase/firestore';
import { useTransition, useEffect, useState } from 'react';
import type { User as AppUser } from '@/lib/types';
import { Loader2, Fingerprint, Store, Truck, Voicemail, LogOut, LayoutDashboard, MapPin, LocateFixed } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useProfileFormStore, ProfileFormValues } from '@/lib/store';
import Link from 'next/link';
import { t } from '@/lib/locales';
import { getAuth, signOut } from 'firebase/auth';
import { useAdminAuth } from '@/hooks/use-admin-auth';

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email(),
  phone: z.string().min(10, 'A valid phone number is required'),
  address: z.string().min(10, 'A valid address is required'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export default function MyProfilePage() {
  const { user, isUserLoading, firestore } = useFirebase();
  const { isAdmin } = useAdminAuth();
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
      latitude: undefined,
      longitude: undefined,
    },
  });
  
  useEffect(() => {
    setForm(form);
    return () => setForm(null); // Cleanup
  }, [form, setForm]);


  useEffect(() => {
    if (userData) {
      form.reset({
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        email: user?.email || '',
        phone: userData.phoneNumber || '',
        address: userData.address || '',
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
                toast({ title: "Location Captured!", description: "Your coordinates have been filled. Save changes to store them." });
                setIsFetchingLocation(false);
            },
            () => {
                toast({ variant: 'destructive', title: "Location Error", description: "Could not retrieve your location. Please check browser permissions." });
                setIsFetchingLocation(false);
            }
        );
    } else {
        toast({ variant: 'destructive', title: "Not Supported", description: "Geolocation is not supported by this browser." });
    }
  }
  
  const onSubmit = (data: ProfileFormValues) => {
    if (!firestore || !user || !userDocRef) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in.' });
        return;
    }
    
    startSaveTransition(() => {
        const profileData: Partial<AppUser> = {
            id: user.uid,
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            phoneNumber: data.phone,
            address: data.address,
            latitude: data.latitude,
            longitude: data.longitude,
        };

        setDoc(userDocRef, profileData, { merge: true })
            .then(() => {
                toast({
                    title: 'Profile Updated',
                    description: 'Your information has been saved successfully.',
                });
            })
            .catch((error) => {
                console.error("Error saving profile:", error);
                const permissionError = new FirestorePermissionError({
                    path: userDocRef.path,
                    operation: 'write',
                    requestResourceData: profileData
                });
                errorEmitter.emit('permission-error', permissionError);
            });
    });
  };

  const handleLogout = async () => {
    const auth = getAuth();
    await signOut(auth);
    router.push('/login');
  };
  
  const dashboardLink = isAdmin ? "/dashboard/admin" : "/dashboard";

  if (isUserLoading || isProfileLoading) {
      return <div className="container mx-auto py-12">Loading your profile...</div>;
  }
  
  return (
    <div className="container mx-auto py-12 px-4 md:px-6">
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
            <Card>
                <CardHeader>
                <CardTitle className="text-3xl font-headline">{t('my-profile')}</CardTitle>
                <CardDescription>Manage your personal information. You can use your voice to fill the form.</CardDescription>
                </CardHeader>
                <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="firstName"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>First Name</FormLabel>
                                    <FormControl>
                                    <Input placeholder="John" {...field} />
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
                                    <FormLabel>Last Name</FormLabel>
                                    <FormControl>
                                    <Input placeholder="Doe" {...field} />
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
                            <FormLabel>Email Address</FormLabel>
                            <FormControl>
                            <Input type="email" {...field} readOnly disabled />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                        <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Phone Number</FormLabel>
                                <FormControl>
                                <Input placeholder="9876543210" {...field} />
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
                                <FormLabel>Full Address</FormLabel>
                                <FormControl>
                                <Input placeholder="123 Main St, Anytown, USA 12345" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />

                        <div className="p-4 border rounded-lg space-y-3">
                            <h4 className="font-medium">Home Location (GPS)</h4>
                             <Button type="button" variant="outline" className="w-full" onClick={handleGetLocation} disabled={isFetchingLocation}>
                                {isFetchingLocation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LocateFixed className="mr-2 h-4 w-4" />}
                                Get Current Location
                            </Button>
                            <div className="flex items-center gap-2 text-sm">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span className="font-mono">
                                    Lat: {form.watch('latitude')?.toFixed(4) || 'Not set'}, Lng: {form.watch('longitude')?.toFixed(4) || 'Not set'}
                                </span>
                            </div>
                        </div>

                    <Button type="submit" disabled={isSaving} className="w-full">
                        {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Changes'}
                    </Button>
                    </form>
                </Form>
                </CardContent>
                <CardFooter>
                  <Button onClick={handleLogout} variant="destructive" className="w-full">
                      <LogOut className="mr-2 h-4 w-4" />
                      {t('logout')}
                  </Button>
                </CardFooter>
            </Card>
        </div>
         <div className="space-y-8">
            <div className="space-y-4">
                 <h2 className="text-xl font-bold font-headline">My Dashboards</h2>
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                           <LayoutDashboard className="h-5 w-5 text-primary" />
                           Main Dashboard
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Button asChild className="w-full" variant="outline">
                           <Link href={dashboardLink}>
                                Go to Dashboard
                            </Link>
                        </Button>
                    </CardContent>
                 </Card>
            </div>
            <div className="space-y-4">
                 <h2 className="text-xl font-bold font-headline">Account Security</h2>
                 <Card className="bg-secondary/20 border-secondary/40">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Fingerprint className="h-5 w-5 text-secondary-foreground" />
                            Fingerprint Login
                        </CardTitle>
                        <CardDescription>
                            Enable passwordless login by registering your device's fingerprint sensor.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild className="w-full">
                            <Link href="/dashboard/customer/fingerprint">
                                Manage Fingerprint Login
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
                 <Card className="bg-primary/5 border-primary/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Voicemail className="h-5 w-5 text-primary" />
                            Voice ID
                        </CardTitle>
                        <CardDescription>
                            Set up a voice password for a faster, more secure way to log in and confirm actions.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild className="w-full">
                            <Link href="/dashboard/customer/voice-id">
                                Manage Your Voice ID
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
      </div>
    </div>
  );
}
