
'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { getSalarySlipData } from '@/app/actions';
import type { SalarySlip, EmployeeProfile, Store, User } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { generateSalarySlipDoc } from '@/lib/generateSalarySlipDoc';
import { Card, CardContent } from '@/components/ui/card';
import { Printer, Download, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function SalarySlipDisplay({ slip, employee, store, attendance }: { slip: SalarySlip, employee: EmployeeProfile & User, store: Store, attendance: any }) {
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            await generateSalarySlipDoc({
                companyName: store.name,
                payslipNo: `PSL-${slip.id.slice(0, 8)}`,
                employeeName: `${employee.firstName} ${employee.lastName}`,
                employeeId: employee.employeeId,
                designation: employee.role,
                payPeriod: format(new Date(slip.periodStart), 'MMMM yyyy'),
                totalHours: (attendance?.presentDays || 0) * 8,
                baseSalary: slip.baseSalary,
                pf: 0,
                esi: 0,
                netPay: slip.netPay,
            });
        } catch (error) {
            console.error("Failed to generate DOCX:", error);
        } finally {
            setIsDownloading(false);
        }
    };
    
    return (
        <div className="min-h-screen bg-muted/30 py-8 px-4">
            <div className="no-print max-w-[850px] mx-auto mb-6 flex flex-wrap justify-between items-center gap-4">
                <Button asChild variant="ghost" size="sm">
                    <Link href="/dashboard/employee/salary-slips">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to History
                    </Link>
                </Button>
                <div className="flex gap-2">
                    <Button onClick={() => window.print()} variant="outline">
                        <Printer className="mr-2 h-4 w-4" /> Print / PDF
                    </Button>
                    <Button onClick={handleDownload} disabled={isDownloading}>
                        {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        Download Word
                    </Button>
                </div>
            </div>

            <Card id="payslip-container" className="max-w-[850px] mx-auto bg-white shadow-xl print:shadow-none print:border-none">
                <CardContent className="p-8 md:p-12">
                    <div style={{ fontFamily: 'Arial, sans-serif' }}>
                        {/* Header */}
                        <div className="flex justify-between items-start border-b-2 border-primary pb-6 mb-8">
                            <div>
                                <h1 className="text-3xl font-bold text-primary mb-1 uppercase tracking-tight">{store.name}</h1>
                                <p className="text-sm text-muted-foreground max-w-xs">{store.address}</p>
                            </div>
                            <div className="text-right">
                                <h2 className="text-2xl font-bold text-gray-800 mb-1">SALARY SLIP</h2>
                                <p className="text-sm font-semibold text-muted-foreground">{format(new Date(slip.periodStart), 'MMMM yyyy')}</p>
                                <p className="text-xs text-muted-foreground mt-2">Payslip No: <span className="font-mono">{slip.id.toUpperCase().slice(0, 12)}</span></p>
                            </div>
                        </div>

                        {/* Employee Info Grid */}
                        <div className="grid grid-cols-2 gap-y-4 mb-10 text-sm">
                            <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground uppercase font-bold mb-1">Employee Name</span>
                                <span className="font-semibold text-base">{employee.firstName} {employee.lastName}</span>
                            </div>
                            <div className="flex flex-col text-right">
                                <span className="text-xs text-muted-foreground uppercase font-bold mb-1">Employee ID</span>
                                <span className="font-mono font-semibold text-base">{employee.employeeId}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground uppercase font-bold mb-1">Designation</span>
                                <span className="font-semibold text-base">{employee.role}</span>
                            </div>
                            <div className="flex flex-col text-right">
                                <span className="text-xs text-muted-foreground uppercase font-bold mb-1">Pay Period</span>
                                <span className="font-semibold text-base">{format(new Date(slip.periodStart), 'dd MMM')} - {format(new Date(slip.periodEnd), 'dd MMM yyyy')}</span>
                            </div>
                        </div>

                        {/* Salary Table */}
                        <div className="border rounded-lg overflow-hidden mb-8">
                            <div className="grid grid-cols-2 bg-muted/50 border-b font-bold text-sm">
                                <div className="p-3 border-r">EARNINGS</div>
                                <div className="p-3 text-right">AMOUNT (₹)</div>
                            </div>
                            <div className="grid grid-cols-2 border-b text-sm">
                                <div className="p-3 border-r">Basic Salary</div>
                                <div className="p-3 text-right font-mono">₹{slip.baseSalary.toFixed(2)}</div>
                            </div>
                            <div className="grid grid-cols-2 border-b text-sm">
                                <div className="p-3 border-r">Incentives / Bonus</div>
                                <div className="p-3 text-right font-mono">₹0.00</div>
                            </div>
                            <div className="grid grid-cols-2 bg-primary/10 font-bold text-lg">
                                <div className="p-4 border-r">TOTAL NET PAY</div>
                                <div className="p-4 text-right text-primary font-mono">₹{slip.netPay.toFixed(2)}</div>
                            </div>
                        </div>

                        {/* Attendance Summary */}
                        <div className="bg-muted/20 rounded-lg p-4 mb-10 border border-dashed border-muted-foreground/30">
                            <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3">Attendance Summary</h4>
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div>
                                    <p className="text-2xl font-bold">{attendance?.totalDays || 0}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase">Total Days</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-green-600">{attendance?.presentDays || 0}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase">Present</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-red-500">{attendance?.absentDays || 0}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase">Absent</p>
                                </div>
                            </div>
                        </div>

                        {/* Signature Area */}
                        <div className="flex justify-between items-end mt-12">
                            <div className="text-center border-t border-gray-300 pt-2 px-8">
                                <p className="text-[10px] text-muted-foreground uppercase mb-8">Employee Signature</p>
                            </div>
                            <div className="text-center border-t border-gray-300 pt-2 px-8">
                                <p className="font-bold text-sm mb-1">{store.name}</p>
                                <p className="text-[10px] text-muted-foreground uppercase">Authorized Signatory</p>
                            </div>
                        </div>

                        {/* Footer Disclaimer */}
                        <div className="mt-12 text-center text-[10px] text-muted-foreground italic">
                            This is a system-generated document and does not require a physical stamp or signature.
                        </div>
                    </div>
                </CardContent>
            </Card>
             <style jsx global>{`
                @media print {
                    body { background: white !important; }
                    .no-print { display: none !important; }
                    #payslip-container { border: none !important; box-shadow: none !important; margin: 0 !important; max-width: 100% !important; width: 100% !important; }
                }
            `}</style>
        </div>
    );
}

interface SalaryData {
    slip: SalarySlip;
    employee: EmployeeProfile & User;
    store: Store;
    attendance: any;
}

export default function SalarySlipPage() {
    const { slipId } = useParams<{ slipId: string }>();
    const storeId = useSearchParams().get('storeId');
    const { user } = useFirebase();

    const [data, setData] = useState<SalaryData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            if (!user || !slipId) {
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            setError(null);

            try {
                // Pass storeId to server action for faster, non-indexed lookup
                const result = await getSalarySlipData(slipId, user.uid, storeId || undefined);
                if (result) {
                    setData(result as SalaryData);
                } else {
                    setError("Salary slip not found or you do not have permission to view it.");
                }
            } catch (error: any) {
                console.error("Error fetching salary slip data:", error);
                setError(error.message || "An unexpected error occurred.");
            } finally {
                setIsLoading(false);
            }
        }

        fetchData();
    }, [user, slipId, storeId]);

    if (isLoading) {
        return (
            <div className="p-8">
                <Skeleton className="max-w-3xl mx-auto h-[800px]" />
            </div>
        );
    }
    
    if (error || !data) {
        return (
            <div className="container mx-auto py-24 px-4 text-center">
                <h1 className="text-2xl font-bold text-destructive mb-4">Error</h1>
                <p className="text-muted-foreground mb-8">{error || "Salary Slip not found."}</p>
                <div className="flex justify-center gap-4">
                    <Button asChild variant="outline">
                        <Link href="/dashboard/employee/salary-slips">Back to My Slips</Link>
                    </Button>
                    <Button onClick={() => window.location.reload()}>Retry</Button>
                </div>
            </div>
        );
    }
    
    return <SalarySlipDisplay {...data} />;
}
