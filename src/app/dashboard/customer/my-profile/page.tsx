
'use client';

import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { doc, setDoc } from 'firebase/firestore';
import { useTransition, useEffect } from 'react';
import type { User as AppUser } from '@/lib/types';
import { Loader2, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { signOut } from 'firebase/auth';

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email(),
  phone: z.string().min(10, 'A valid phone number is required'),
  address: z.string().min(10, 'A valid address is required'),
});

export default function MyProfilePage() {
  const { user, firestore, auth } = useFirebase();
  const { resetApp } = useAppStore();
  const { toast } = useToast();
  const router = useRouter();
  const [isSaving, startSaveTransition] = useTransition();

  const userDocRef = useMemoFirebase(() => (firestore && user) ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userData, isLoading: isProfileLoading } = useDoc<AppUser>(userDocRef);

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { firstName: '', lastName: '', email: '', phone: '', address: '' },
  });

  useEffect(() => {
    if (userData) {
      form.reset({
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        email: user?.email || '',
        phone: userData.phoneNumber || '',
        address: userData.address || '',
      });
    }
  }, [userData, user, form]);

  const onSubmit = (data: z.infer<typeof profileSchema>) => {
    if (!firestore || !user) return;
    startSaveTransition(async () => {
        await setDoc(doc(firestore, 'users', user.uid), { ...data, id: user.uid }, { merge: true });
        toast({ title: 'Profile Updated' });
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

  if (isProfileLoading) return <div className="p-12 text-center opacity-20"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>;

  return (
    <div className="container mx-auto py-12 px-4 max-w-2xl">
        <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden bg-white">
            <CardHeader className="bg-primary/5 p-8 border-b">
                <CardTitle className="text-3xl font-black italic uppercase tracking-tight">Identity Hub</CardTitle>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="p-8 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="firstName" render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase opacity-40">First Name</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl border-2 font-bold" /></FormControl></FormItem>
                            )} />
                            <FormField control={form.control} name="lastName" render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase opacity-40">Last Name</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl border-2 font-bold" /></FormControl></FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="address" render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] font-black uppercase opacity-40">Shipping Address</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl border-2 font-bold" /></FormControl></FormItem>
                        )} />
                    </CardContent>
                    <CardFooter className="p-8 bg-gray-50 border-t flex flex-col gap-4">
                        <Button type="submit" disabled={isSaving} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl">
                            {isSaving ? 'Syncing...' : 'Save Profile'}
                        </Button>
                        <Button onClick={handleLogout} variant="ghost" className="w-full h-12 text-destructive font-black uppercase tracking-widest text-[10px]">
                            <LogOut className="mr-2 h-4 w-4" /> Terminate Session
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    </div>
  );
}
