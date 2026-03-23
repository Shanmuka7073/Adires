
'use client';

import { useState, useMemo, useEffect, useTransition } from 'react';
import { useFirebase, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import type { SalarySlip, EmployeeProfile, User, Store } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Eye, AlertTriangle, Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { generateSalarySlipDoc } from '@/lib/generateSalarySlipDoc';
import { useToast } from '@/hooks/use-toast';

function SalarySlipCard({ slip, employeeProfile, storeName }: { slip: SalarySlip, employeeProfile: EmployeeProfile, storeName: string }) {
    const [isDownloading, startDownload] = useTransition();
    const { firestore } = useFirebase();
    const { toast } = useToast();

    const handleDownload = () => {
        if (!firestore) return;
        startDownload(async () => {
            try {
                // Fetch full names for the document
                const userDoc = await getDoc(doc(firestore, 'users', slip.employeeId));
                const userData = userDoc.data() as User;

                await generateSalarySlipDoc({
                    companyName: storeName,
                    payslipNo: `PSL-${slip.id.slice(0, 8)}`,
                    employeeName: `${userData?.firstName || 'Employee'} ${userData?.lastName || ''}`,
                    employeeId: employeeProfile.employeeId,
                    designation: employeeProfile.role,
                    payPeriod: format(new Date(slip.periodStart), 'MMMM yyyy'),
                    totalHours: (slip.baseSalary / employeeProfile.salaryRate) || 0,
                    baseSalary: slip.baseSalary,
                    pf: 0,
                    esi: 0,
                    netPay: slip.netPay,
                });
                toast({ title: "Download started" });
            } catch (error) {
                console.error("DOCX Gen failed:", error);
                toast({ variant: 'destructive', title: "Download failed" });
            }
        });
    };
    
    return (
        <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
                <CardTitle>Pay Period: {format(new Date(slip.periodStart), 'MMMM yyyy')}</CardTitle>
                <CardDescription>Generated on {slip.generatedAt ? format(slip.generatedAt.toDate(), 'PPP') : 'N/A'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Base Salary</span>
                    <span>₹{slip.baseSalary.toFixed(2)}</span>
                </div>
                 <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
                    <span>Net Pay</span>
                    <span className="text-primary">₹{slip.netPay.toFixed(2)}</span>
                </div>
            </CardContent>
            <CardFooter className="grid grid-cols-2 gap-2">
                 <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/salary-slip/${slip.id}?storeId=${slip.storeId}`}>
                        <Eye className="mr-2 h-4 w-4" /> View
                    </Link>
                </Button>
                <Button variant="secondary" size="sm" onClick={handleDownload} disabled={isDownloading}>
                    {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Download
                </Button>
            </CardFooter>
        </Card>
    );
}

export default function EmployeeSalarySlipsPage() {
    const { user, firestore } = useFirebase();

    const employeeProfileRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return doc(firestore, 'employeeProfiles', user.uid);
    }, [user, firestore]);

    const { data: employeeProfile, isLoading: profileLoading } = useDoc<EmployeeProfile>(employeeProfileRef);
    
    const storeRef = useMemoFirebase(() => {
        if (!employeeProfile?.storeId || !firestore) return null;
        return doc(firestore, 'stores', employeeProfile.storeId);
    }, [employeeProfile, firestore]);

    const { data: storeData } = useDoc<Store>(storeRef);

    const salarySlipsQuery = useMemoFirebase(() => {
        if (!firestore || !employeeProfile) return null;
        return query(
            collection(firestore, `stores/${employeeProfile.storeId}/salarySlips`),
            where('employeeId', '==', employeeProfile.userId),
            orderBy('periodStart', 'desc')
        );
    }, [firestore, employeeProfile]);

    const { data: salarySlips, isLoading: slipsLoading, error: slipsError } = useCollection<SalarySlip>(salarySlipsQuery);
    
    const isLoading = profileLoading || slipsLoading;

    if (isLoading) {
        return (
            <div className="container mx-auto py-12 px-4 md:px-6">
                <div className="space-y-4">
                    <Skeleton className="h-12 w-1/2" />
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-48 w-full" />
                </div>
            </div>
        );
    }

    if (slipsError) {
        return (
            <div className="container mx-auto py-12 px-4 md:px-6">
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Error Loading Salary Slips</AlertTitle>
                    <AlertDescription>
                        {slipsError.message}
                        <p className="mt-2 text-xs">If this is a new installation, the required indexes might still be building in the background. Please wait a moment and refresh.</p>
                    </AlertDescription>
                </Alert>
            </div>
        )
    }
    
    if (!employeeProfile) {
        return (
            <div className="container mx-auto py-12 px-4 md:px-6">
                <Alert>
                    <AlertTitle>Not an Employee</AlertTitle>
                    <AlertDescription>
                        This page is for employees. Your account is not linked to an employee profile.
                    </AlertDescription>
                     <Button asChild className="mt-4"><Link href="/dashboard">Go to Dashboard</Link></Button>
                </Alert>
            </div>
        );
    }
    
    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <div className="mb-8">
                <h1 className="text-4xl font-bold font-headline flex items-center gap-3">
                    <FileText className="h-8 w-8 text-primary" />
                    My Salary Slips
                </h1>
                <p className="text-muted-foreground">View and download your monthly salary statements from <strong>{storeData?.name || 'your store'}</strong>.</p>
            </div>
            
            {salarySlips && salarySlips.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {salarySlips.map(slip => (
                        <SalarySlipCard key={slip.id} slip={slip} employeeProfile={employeeProfile} storeName={storeData?.name || 'LocalBasket'} />
                    ))}
                </div>
            ) : (
                <Card className="text-center py-12">
                    <CardHeader>
                        <CardTitle>No Salary Slips Found</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">
                            Your salary slips will appear here once they are generated by your store owner.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
