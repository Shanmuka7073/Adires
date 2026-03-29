
'use client';

import { useFirebase, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';
import type { SalarySlip, EmployeeProfile, Store } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Eye, AlertTriangle, Download } from 'lucide-react';
import { format } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';

function SalarySlipCard({ slip, employeeProfile, storeName }: { slip: SalarySlip, employeeProfile: EmployeeProfile, storeName: string }) {
    const handleDownload = () => {
        window.open(`/api/salary-slip/docx?slipId=${slip.id}&storeId=${slip.storeId}`, '_blank');
    };
    
    return (
        <Card className="rounded-[2rem] border-0 shadow-lg overflow-hidden bg-white hover:shadow-2xl transition-all">
            <CardHeader className="bg-primary/5 border-b border-black/5">
                <CardTitle className="text-sm font-black uppercase tracking-tight">
                    {format(new Date(slip.periodStart), 'MMMM yyyy')}
                </CardTitle>
                <CardDescription className="text-[10px] font-bold opacity-40 uppercase">
                    Generated: {slip.generatedAt ? format(slip.generatedAt.toDate(), 'dd MMM') : '—'}
                </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
                 <div className="flex justify-between items-baseline">
                    <span className="text-[10px] font-black uppercase opacity-40">Net Payout</span>
                    <span className="text-2xl font-black text-primary tracking-tighter">₹{slip.netPay.toFixed(0)}</span>
                </div>
            </CardContent>
            <CardFooter className="p-4 bg-gray-50 border-t border-black/5 grid grid-cols-2 gap-2">
                 <Button asChild variant="ghost" size="sm" className="rounded-xl font-bold text-[10px] uppercase">
                    <Link href={`/dashboard/salary-slip/${slip.id}?storeId=${slip.storeId}`}>
                        <Eye className="mr-2 h-3.5 w-3.5" /> View
                    </Link>
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload} className="rounded-xl font-black text-[10px] uppercase border-2">
                    <Download className="mr-2 h-3.5 w-3.5" /> Word
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
                <div className="grid md:grid-cols-3 gap-6">
                    <Skeleton className="h-48 w-full rounded-[2rem]" />
                    <Skeleton className="h-48 w-full rounded-[2rem]" />
                </div>
            </div>
        );
    }

    if (!employeeProfile) {
        return (
            <div className="container mx-auto py-24 px-4 text-center">
                <p className="text-muted-foreground font-black uppercase text-xs tracking-widest opacity-40">No employee profile active.</p>
            </div>
        );
    }
    
    return (
        <div className="container mx-auto py-12 px-4 md:px-6 max-w-5xl space-y-10">
            <div className="border-b pb-10 border-black/5">
                <h1 className="text-5xl font-black font-headline tracking-tighter uppercase italic leading-none">Salary Slips</h1>
                <p className="text-muted-foreground font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">
                    Verified statements from {storeData?.name || 'Authorized Hub'}
                </p>
            </div>
            
            {salarySlips && salarySlips.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {salarySlips.map(slip => (
                        <SalarySlipCard key={slip.id} slip={slip} employeeProfile={employeeProfile} storeName={storeData?.name || 'LocalBasket'} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-black/5 opacity-40">
                    <FileText className="h-12 w-12 mx-auto mb-4" />
                    <p className="font-black uppercase tracking-widest text-xs">No statements issued yet</p>
                </div>
            )}
        </div>
    );
}
