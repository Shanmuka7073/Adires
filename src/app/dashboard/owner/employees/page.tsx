
'use client';

import { useState, useMemo, useTransition, useEffect } from 'react';
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
import { Loader2, PlusCircle, Trash2, Users, Edit } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { updateEmployee } from '@/app/actions';


const baseEmployeeSchema = z.object({
  firstName: z.string().min(2, 'First name is required.'),
  lastName: z.string().min(1, 'Last name is required.'),
  email: z.string().email('Invalid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.').optional(),
  phone: z.string().min(10, 'A valid 10-digit phone number is required.'),
  address: z.string().min(10, 'A complete address is required.'),
  role: z.string().min(2, 'Role is required.'),
  salaryRate: z.coerce.number().positive('Salary must be a positive number.'),
  salaryType: z.enum(['hourly', 'monthly']),
  payoutMethod: z.enum(['bank', 'upi']),
  upiId: z.string().optional(),
  accountHolderName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  reportingTo: z.string().optional(), // Manager's user ID
});

const refinedSchemaCheck = (data: any) => {
    if (data.payoutMethod === 'upi') return !!data.upiId && data.upiId.includes('@');
    if (data.payoutMethod === 'bank') return !!data.accountHolderName && !!data.accountNumber && !!data.ifscCode;
    return true;
};

const employeeSchema = baseEmployeeSchema.refine(refinedSchemaCheck, {
    message: "Please fill in the required payment details for the selected method.",
    path: ["payoutMethod"],
});

const editEmployeeSchema = baseEmployeeSchema.omit({ 
    password: true,
}).refine(refinedSchemaCheck, {
    message: "Please fill in the required payment details for the selected method.",
    path: ["payoutMethod"],
});


type EmployeeFormValues = z.infer<typeof employeeSchema>;
type EditEmployeeFormValues = z.infer<typeof editEmployeeSchema>;

// Edit Dialog for Existing Employees
function EditEmployeeDialog({ employee, employees, isOpen, onOpenChange, myStore }: { employee: EmployeeProfile, employees: EmployeeProfile[], isOpen: boolean, onOpenChange: (open: boolean) => void, myStore: Store }) {
    const { toast } = useToast();
    const [isSaving, startSave] = useTransition();

    const form = useForm<EditEmployeeFormValues>({
        resolver: zodResolver(editEmployeeSchema),
        defaultValues: {
            ...employee,
            upiId: employee.upiId ?? '',
            reportingTo: employee.reportingTo ?? undefined,
            accountHolderName: employee.bankDetails?.accountHolderName || '',
            accountNumber: employee.bankDetails?.accountNumber || '',
            ifscCode: employee.bankDetails?.ifscCode || '',
        },
    });

    const watchPayoutMethod = form.watch('payoutMethod');
    
    const possibleManagers = useMemo(() => {
        return employees.filter(e => e.userId !== employee.userId);
    }, [employees, employee]);

    const handleSave = async (data: EditEmployeeFormValues) => {
        startSave(async () => {
            const result = await updateEmployee(employee.userId, data);
            
            if (result.success) {
                toast({ title: "Employee Updated", description: "The employee's details and email have been saved." });
                onOpenChange(false);
            } else {
                console.error("Failed to update employee:", result.error);
                toast({ variant: "destructive", title: "Update Failed", description: result.error || "Could not save changes." });
            }
        });
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Edit Employee: {employee.employeeId}</DialogTitle>
                    <DialogDescription>Update details for this employee.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
                        <div className="grid md:grid-cols-2 gap-4">
                             <FormField control={form.control} name="firstName" render={({ field }) => (
                                <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={form.control} name="lastName" render={({ field }) => (
                                <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                              <FormField control={form.control} name="email" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email (Login ID)</FormLabel>
                                    <FormControl><Input type="email" {...field} /></FormControl>
                                    <FormDescription>Changing this will update their login email.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="phone" render={({ field }) => (
                                <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={form.control} name="address" render={({ field }) => (
                                <FormItem className="md:col-span-2"><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="role" render={({ field }) => (
                                <FormItem><FormLabel>Role</FormLabel><FormControl><Input placeholder="e.g., Cashier" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={form.control} name="reportingTo" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Reporting To</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value || ''}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select a manager" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value={myStore.ownerId}>Store Owner</SelectItem>
                                            {possibleManagers.map(mgr => (
                                                <SelectItem key={mgr.userId} value={mgr.userId}>{mgr.role} ({mgr.employeeId})</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                             <FormField control={form.control} name="salaryType" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Salary Type</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="hourly">Hourly</SelectItem></SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                             <FormField control={form.control} name="salaryRate" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Salary Rate (₹)</FormLabel>
                                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        <FormField
                            control={form.control}
                            name="payoutMethod"
                            render={({ field }) => (
                                <FormItem className="space-y-3 rounded-lg border p-4">
                                    <FormLabel>Payout Method</FormLabel>
                                    <FormControl>
                                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                                            <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="bank" /></FormControl><FormLabel className="font-normal">Bank Account</FormLabel></FormItem>
                                            <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="upi" /></FormControl><FormLabel className="font-normal">UPI</FormLabel></FormItem>
                                        </RadioGroup>
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        {watchPayoutMethod === 'upi' && (
                            <FormField control={form.control} name="upiId" render={({ field }) => (
                                <FormItem><FormLabel>UPI ID</FormLabel><FormControl><Input placeholder="your-id@okhdfcbank" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        )}
                        {watchPayoutMethod === 'bank' && (
                            <div className="space-y-4 rounded-lg border p-4">
                                <h4 className="font-medium">Bank Account Details</h4>
                                <FormField control={form.control} name="accountHolderName" render={({ field }) => (
                                    <FormItem><FormLabel>Account Holder Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="accountNumber" render={({ field }) => (
                                    <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input placeholder="1234567890" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="ifscCode" render={({ field }) => (
                                    <FormItem><FormLabel>IFSC Code</FormLabel><FormControl><Input placeholder="SBIN0001234" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                        )}
                        <DialogFooter>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

export default function ManageEmployeesPage() {
  const { user, firestore, firebaseApp } = useFirebase();
  const { toast } = useToast();
  const [isProcessing, startProcessing] = useTransition();
  const [editingEmployee, setEditingEmployee] = useState<EmployeeProfile | null>(null);

  const storeQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'stores'), where('ownerId', '==', user.uid));
  }, [user, firestore]);

  const { data: stores, isLoading: storeLoading } = useCollection<Store>(storeQuery);
  const myStore = useMemo(() => stores?.[0], [stores]);

  const employeesQuery = useMemoFirebase(() => {
    if (!firestore || !myStore) return null;
    return query(collection(firestore, 'employeeProfiles'), where('storeId', '==', myStore.id));
  }, [myStore, firestore]);

  const { data: employees, isLoading: employeesLoading } = useCollection<EmployeeProfile>(employeesQuery);

  const managerMap = useMemo(() => {
    const map = new Map<string, string>();
    if (employees) {
        employees.forEach(e => map.set(e.userId, `${e.role} (${e.employeeId})`));
    }
    if (user && myStore) {
        map.set(user.uid, "Store Owner");
    }
    return map;
  }, [employees, user, myStore]);

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      firstName: '', lastName: '', email: '', password: '', phone: '', address: '', role: '',
      salaryRate: 0, salaryType: 'monthly', payoutMethod: 'bank',
      upiId: '', accountHolderName: '', accountNumber: '', ifscCode: '',
      reportingTo: user?.uid,
    },
  });

  const watchPayoutMethod = form.watch('payoutMethod');

  const onSubmit = (data: EmployeeFormValues) => {
    if (!myStore || !firestore || !firebaseApp) {
      toast({ variant: 'destructive', title: 'Error', description: 'Cannot create employee. Store or auth service not available.' });
      return;
    }
    
    const password = data.password;
    if (!password) {
        toast({ variant: 'destructive', title: 'Error', description: 'Password is required for new employees.'});
        return;
    }

    startProcessing(async () => {
      const tempAppName = `temp-employee-creation-${Date.now()}`;
      const tempApp = initializeApp(firebaseApp.options, tempAppName);
      const tempAuth = getAuth(tempApp);

      try {
        const { user: newEmployeeAuth } = await createUserWithEmailAndPassword(tempAuth, data.email, password);
        const uid = newEmployeeAuth.uid;

        const batch = writeBatch(firestore);

        const userDocRef = doc(firestore, 'users', uid);
        batch.set(userDocRef, {
            id: uid, email: data.email, firstName: data.firstName, lastName: data.lastName,
            phoneNumber: data.phone, address: data.address, accountType: 'employee', storeId: myStore.id,
        });

        const employeeProfileRef = doc(firestore, 'employeeProfiles', uid);
        batch.set(employeeProfileRef, {
            userId: uid, 
            storeId: myStore.id, 
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone,
            address: data.address,
            employeeId: `EMP-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
            role: data.role, 
            hireDate: new Date().toISOString().split('T')[0],
            salaryRate: data.salaryRate, 
            salaryType: data.salaryType,
            payoutMethod: data.payoutMethod,
            reportingTo: data.reportingTo,
            upiId: data.payoutMethod === 'upi' ? data.upiId : null,
            bankDetails: data.payoutMethod === 'bank' ? {
                accountHolderName: data.accountHolderName, accountNumber: data.accountNumber, ifscCode: data.ifscCode,
            } : null,
        });
        
        await batch.commit();
        toast({ title: 'Employee Added!', description: `${data.email} has been added to your store.` });
        form.reset();
      } catch (error: any) {
        console.error("Failed to add employee:", error);
        toast({ variant: 'destructive', title: 'Error Adding Employee', description: error.message });
      } finally {
        await deleteApp(tempApp);
      }
    });
  };
  
  const handleDelete = (employee: EmployeeProfile) => {
      if (!confirm(`Are you sure you want to remove ${employee.role}? This will delete the employee's user account and cannot be undone.`)) return;
      if (!firestore) return;
      
      const batch = writeBatch(firestore);
      batch.delete(doc(firestore, 'employeeProfiles', employee.userId));
      batch.delete(doc(firestore, 'users', employee.userId));
      
      batch.commit()
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
    <>
      {editingEmployee && employees && (
        <EditEmployeeDialog 
            employee={editingEmployee}
            employees={employees}
            myStore={myStore}
            isOpen={!!editingEmployee}
            onOpenChange={() => setEditingEmployee(null)}
        />
      )}
      <div className="container mx-auto py-12 px-4 md:px-6">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
              <div className="flex items-center gap-3">
                  <Users className="h-8 w-8 text-primary" />
                  <div>
                      <CardTitle className="text-3xl font-headline">Manage Employees</CardTitle>
                      <CardDescription>Add new employees, manage their roles and salary information for {myStore.name}.</CardDescription>
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
                                  <FormField control={form.control} name="phone" render={({ field }) => (
                                      <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input type="tel" placeholder="9876543210" {...field} /></FormControl><FormMessage /></FormItem>
                                  )} />
                                  <FormField control={form.control} name="address" render={({ field }) => (
                                      <FormItem><FormLabel>Address</FormLabel><FormControl><Input placeholder="Full residential address" {...field} /></FormControl><FormMessage /></FormItem>
                                  )} />
                                  <FormField control={form.control} name="role" render={({ field }) => (
                                      <FormItem><FormLabel>Role</FormLabel><FormControl><Input placeholder="e.g., Cashier, Delivery Staff" {...field} /></FormControl><FormMessage /></FormItem>
                                  )} />
                                   <FormField control={form.control} name="reportingTo" render={({ field }) => (
                                      <FormItem>
                                          <FormLabel>Reporting To</FormLabel>
                                          <Select onValueChange={field.onChange} defaultValue={field.value || ''}>
                                              <FormControl><SelectTrigger><SelectValue placeholder="Select a manager" /></SelectTrigger></FormControl>
                                              <SelectContent>
                                                  <SelectItem value={user!.uid}>Store Owner</SelectItem>
                                                  {employees?.map(emp => (
                                                      <SelectItem key={emp.userId} value={emp.userId}>{emp.role} ({emp.employeeId})</SelectItem>
                                                  ))}
                                              </SelectContent>
                                          </Select>
                                      </FormItem>
                                  )} />
                                  <FormField control={form.control} name="salaryType" render={({ field }) => (
                                  <FormItem>
                                      <FormLabel>Salary Type</FormLabel>
                                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                          <SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="hourly">Hourly</SelectItem></SelectContent>
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
                              <FormField
                                  control={form.control}
                                  name="payoutMethod"
                                  render={({ field }) => (
                                      <FormItem className="space-y-3 rounded-lg border p-4">
                                          <FormLabel>Payout Method</FormLabel>
                                          <FormControl>
                                              <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                                                  <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="bank" /></FormControl><FormLabel className="font-normal">Bank Account</FormLabel></FormItem>
                                                  <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="upi" /></FormControl><FormLabel className="font-normal">UPI</FormLabel></FormItem>
                                              </RadioGroup>
                                          </FormControl>
                                      </FormItem>
                                  )}
                              />
                              {watchPayoutMethod === 'upi' && (
                                  <FormField control={form.control} name="upiId" render={({ field }) => (
                                      <FormItem><FormLabel>UPI ID</FormLabel><FormControl><Input placeholder="your-id@okhdfcbank" {...field} /></FormControl><FormMessage /></FormItem>
                                  )} />
                              )}
                              {watchPayoutMethod === 'bank' && (
                                  <div className="space-y-4 rounded-lg border p-4">
                                      <h4 className="font-medium">Bank Account Details</h4>
                                      <FormField control={form.control} name="accountHolderName" render={({ field }) => (
                                          <FormItem><FormLabel>Account Holder Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>
                                      )} />
                                      <FormField control={form.control} name="accountNumber" render={({ field }) => (
                                          <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input placeholder="1234567890" {...field} /></FormControl><FormMessage /></FormItem>
                                      )} />
                                      <FormField control={form.control} name="ifscCode" render={({ field }) => (
                                          <FormItem><FormLabel>IFSC Code</FormLabel><FormControl><Input placeholder="SBIN0001234" {...field} /></FormControl><FormMessage /></FormItem>
                                      )} />
                                  </div>
                              )}
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
                                      <TableHead>Name</TableHead>
                                      <TableHead>Role</TableHead>
                                      <TableHead>Reports To</TableHead>
                                      <TableHead>Salary</TableHead>
                                      <TableHead>Payment</TableHead>
                                      <TableHead className="text-right">Actions</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {employees?.map(emp => (
                                      <TableRow key={emp.userId}>
                                          <TableCell className="font-mono">{emp.employeeId}</TableCell>
                                          <TableCell className="font-semibold">{emp.firstName} {emp.lastName}</TableCell>
                                          <TableCell>{emp.role}</TableCell>
                                          <TableCell>{managerMap.get(emp.reportingTo || '') || 'N/A'}</TableCell>
                                          <TableCell>₹{emp.salaryRate.toFixed(2)} / {emp.salaryType}</TableCell>
                                          <TableCell className="capitalize">{emp.payoutMethod}</TableCell>
                                          <TableCell className="text-right space-x-1">
                                              <Button variant="ghost" size="icon" onClick={() => setEditingEmployee(emp)}><Edit className="h-4 w-4"/></Button>
                                              <AlertDialog>
                                                  <AlertDialogTrigger asChild>
                                                      <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                  </AlertDialogTrigger>
                                                  <AlertDialogContent>
                                                      <AlertDialogHeader>
                                                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                          <AlertDialogDescription>This will permanently delete the employee's profile and user account. This cannot be undone.</AlertDialogDescription>
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
    </>
  );
}
