
'use client';

import { useState, useMemo, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import type { Store, EmployeeProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, PlusCircle, Trash2, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';


const employeeSchema = z.object({
  firstName: z.string().min(2, 'First name is required.'),
  lastName: z.string().min(1, 'Last name is required.'),
  email: z.string().email('Invalid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  role: z.string().min(2, 'Role is required.'),
  salaryRate: z.coerce.number().positive('Salary must be a positive number.'),
  salaryType: z.enum(['hourly', 'monthly']),
});

type EmployeeFormValues = z.infer<typeof employeeSchema>;

export default function ManageEmployeesPage() {
  const { user, auth, firestore, firebaseApp } = useFirebase();
  const { toast } = useToast();
  const [isProcessing, startProcessing] = useTransition();

  const storeQuery = useMemoFirebase(() => (user ? query(collection(firestore, 'stores'), where('ownerId', '==', user.uid)) : null), [user, firestore]);
  const { data: stores, isLoading: storeLoading } = useCollection<Store>(storeQuery);
  const myStore = useMemo(() => stores?.[0], [stores]);

  const employeesQuery = useMemoFirebase(() => (myStore ? query(collection(firestore, 'employeeProfiles'), where('storeId', '==', myStore.id)) : null), [myStore, firestore]);
  const { data: employees, isLoading: employeesLoading } = useCollection<EmployeeProfile>(employeesQuery);

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '', role: '', salaryRate: 0, salaryType: 'monthly' },
  });

  const onSubmit = (data: EmployeeFormValues) => {
    if (!myStore || !firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'Cannot create employee. Store or auth service not available.' });
      return;
    }

    startProcessing(async () => {
      // Create a temporary, secondary Firebase app instance to create the user
      // without signing out the current store owner.
      const tempAppName = `temp-employee-creation-${Date.now()}`;
      const tempApp = initializeApp(firebaseApp.options, tempAppName);
      const tempAuth = getAuth(tempApp);

      try {
        const { user: newEmployeeAuth } = await createUserWithEmailAndPassword(tempAuth, data.email, data.password);
        const uid = newEmployeeAuth.uid;

        const batch = writeBatch(firestore);

        const userDocRef = doc(firestore, 'users', uid);
        batch.set(userDocRef, {
            id: uid,
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            accountType: 'employee',
        });

        const employeeProfileRef = doc(firestore, 'employeeProfiles', uid);
        batch.set(employeeProfileRef, {
            userId: uid,
            storeId: myStore.id,
            employeeId: `EMP-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
            role: data.role,
            hireDate: new Date().toISOString().split('T')[0],
            salaryRate: data.salaryRate,
            salaryType: data.salaryType,
        });
        
        await batch.commit();

        toast({ title: 'Employee Added!', description: `${data.email} has been added to your store.` });
        form.reset();

      } catch (error: any) {
        console.error("Failed to add employee:", error);
        toast({ variant: 'destructive', title: 'Error Adding Employee', description: error.message });
      } finally {
        // Clean up the temporary app instance
        await deleteApp(tempApp);
      }
    });
  };
  
  const handleDelete = (employee: EmployeeProfile) => {
      if (!confirm(`Are you sure you want to remove ${employee.role}? This cannot be undone.`)) return;
      
      deleteDoc(doc(firestore, 'employeeProfiles', employee.userId))
        .then(() => toast({ title: 'Employee Removed' }))
        .catch(err => toast({ variant: 'destructive', title: 'Error', description: err.message }));
  }

  if (storeLoading) {
      return <div className="container mx-auto py-12">Loading store information...</div>
  }
  
  if (!myStore) {
      return <div className="container mx-auto py-12">You must create a store before managing employees.</div>
  }

  return (
    <div className="container mx-auto py-12 px-4 md:px-6">
       <Card className="max-w-4xl mx-auto">
        <CardHeader>
            <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                <div>
                    <CardTitle className="text-3xl font-headline">Manage Employees</CardTitle>
                    <CardDescription>Add new employees and set their roles and salary information for {myStore.name}.</CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>Add New Employee</CardTitle>
                    <CardDescription>This will create a new login for the employee.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="firstName" render={({ field }) => (
                                    <FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="John" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="lastName" render={({ field }) => (
                                    <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input placeholder="Doe" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="email" render={({ field }) => (
                                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="employee@email.com" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="password" render={({ field }) => (
                                    <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="role" render={({ field }) => (
                                    <FormItem><FormLabel>Role</FormLabel><FormControl><Input placeholder="e.g., Cashier, Delivery Staff" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="salaryType" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Salary Type</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="monthly">Monthly</SelectItem>
                                            <SelectItem value="hourly">Hourly</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                                )} />
                                <FormField control={form.control} name="salaryRate" render={({ field }) => (
                                    <FormItem className="md:col-span-2">
                                        <FormLabel>Salary Rate (₹)</FormLabel>
                                        <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                        <FormDescription>Enter the amount per month or per hour.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                            <Button type="submit" disabled={isProcessing}>
                                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                                Add Employee
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
             <Card>
                <CardHeader><CardTitle>Current Employees</CardTitle></CardHeader>
                <CardContent>
                    {employeesLoading ? (
                        <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Employee ID</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Salary</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {employees?.map(emp => (
                                    <TableRow key={emp.userId}>
                                        <TableCell className="font-mono">{emp.employeeId}</TableCell>
                                        <TableCell>{emp.role}</TableCell>
                                        <TableCell>₹{emp.salaryRate.toFixed(2)} / {emp.salaryType}</TableCell>
                                        <TableCell className="text-right">
                                             <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>This will delete the employee's profile. It does not delete their user account.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(emp)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
             </Card>
        </CardContent>
      </Card>
    </div>
  );
}
