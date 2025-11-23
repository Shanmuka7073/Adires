

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
import { useTransition, useEffect } from 'react';
import type { User as AppUser } from '@/lib/types';
import { Loader2, Sparkles, Fingerprint, ShoppingBag, Store, Truck, ArrowRight, Voicemail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useProfileFormStore } from '@/lib/store';
import Link from 'next/link';
import { t } from '@/lib/locales';

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email(),
  phone: z.string().min(10, 'A valid phone number is required'),
  address: z.string().min(10, 'A valid address is required'),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

const dashboardLinks = [
    { title: 'My Store', description: 'Manage your store, products, and incoming orders.', href: '/dashboard/owner/my-store', icon: Store },
    { title: 'Deliveries', description: 'View and accept available delivery jobs.', href: '/dashboard/delivery/deliveries', icon: Truck },
];

function DashboardLinkCard({ title, description, href, icon: Icon }) {
    return (
        <Card className="hover:bg-muted/50 transition-colors">
            <Link href={href} className="block h-full">
                <CardHeader className="flex flex-row items-center gap-4">
                    <Icon className="h-8 w-8 text-primary" />
                    <div>
                        <CardTitle>{title}</CardTitle>
                        <CardDescription>{description}</CardDescription>
                    </div>
                </CardHeader>
                <CardFooter>
                    <Button variant="link" className="p-0">
                        Go to {title} <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </CardFooter>
            </Link>
        </Card>
    );
}

export default function MyProfilePage() {
  const { user, isUserLoading, firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  const [isSaving, startSaveTransition] = useTransition();

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
    },
  });
  
  // Expose form instance to global state
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
  
  const onSubmit = (data: ProfileFormValues) => {
    if (!firestore || !user || !userDocRef) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in.' });
        return;
    }
    
    startSaveTransition(() => {
        const profileData: Omit<AppUser, 'authenticators' | 'currentChallenge'> = {
            id: user.uid,
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            phoneNumber: data.phone,
            address: data.address,
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
                <CardDescription>Manage your personal information. Activate the voice assistant to fill the form by speaking.</CardDescription>
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
                    <Button type="submit" disabled={isSaving} className="w-full">
                        {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Changes'}
                    </Button>
                    </form>
                </Form>
                </CardContent>
            </Card>
        </div>
         <div className="space-y-8">
            <div className="space-y-4">
                <h2 className="text-xl font-bold font-headline">My Dashboards</h2>
                {dashboardLinks.map(link => <DashboardLinkCard key={link.href} {...link} />)}
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
