
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { getSalarySlipData } from '@/app/actions';
import type { SalarySlip, EmployeeProfile, Store, User } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { generateSalarySlipDoc } from '@/lib/generateSalarySlipDoc';

function SalarySlipDisplay({ slip, employee, store, attendance }: { slip: SalarySlip, employee: EmployeeProfile & User, store: Store, attendance: any }) {
    
    const handleDownload = async () => {
        try {
            await generateSalarySlipDoc({
                companyName: store.name,
                payslipNo: `PSL-${slip.id.slice(0, 8)}`,
                employeeName: `${employee.firstName} ${employee.lastName}`,
                employeeId: employee.employeeId,
                designation: employee.role,
                payPeriod: format(new Date(slip.periodStart), 'MMMM yyyy'),
                totalHours: attendance.presentDays * 8, // Simplified for now
                baseSalary: slip.baseSalary,
                pf: 0,
                esi: 0,
                netPay: slip.netPay,
            });
        } catch (error) {
            console.error("Failed to generate DOCX:", error);
        }
    };
    
    return (
        <div>
            <div className="no-print max-w-[800px] mx-auto mb-4 flex justify-end gap-2">
                <Button onClick={() => window.print()}>Print / Save as PDF</Button>
                <Button onClick={handleDownload} variant="outline">Download as Word</Button>
            </div>
            <div id="payslip-container" className="w-[800px] mx-auto p-5 border shadow-lg bg-white">
                <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #333', paddingBottom: '10px', marginBottom: '20px' }}>
                        <div>
                            <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0' }}>{store.name}</h1>
                            <p style={{ fontSize: '12px', color: '#666', margin: '5px 0 0' }}>{store.address}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: '600', margin: '0' }}>Salary Slip</h2>
                            <p style={{ fontSize: '12px', margin: '5px 0 0' }}>For the Month of {format(new Date(slip.periodStart), 'MMMM yyyy')}</p>
                            <p style={{ fontSize: '12px', margin: '5px 0 0' }}>Payslip No: {slip.id.toUpperCase().slice(0, 15)}</p>
                            <p style={{ fontSize: '12px', margin: '5px 0 0' }}>Generated On: {format(new Date(slip.generatedAt), 'dd MMM yyyy')}</p>
                        </div>
                    </div>
                    {/* Employee and Payment details here */}
                </div>
            </div>
             <style jsx global>{`
                @media print {
                    body { background: white; -webkit-print-color-adjust: exact; }
                    .no-print { display: none !important; }
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
                const result = await getSalarySlipData(slipId, user.uid);
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
    }, [user, slipId]);

    if (isLoading) {
        return (
            <div className="p-8">
                <Skeleton className="max-w-3xl mx-auto h-[800px]" />
            </div>
        );
    }
    
    if (error || !data) {
        return <div className="p-8 text-center">{error || "Salary Slip not found."}</div>;
    }
    
    return <SalarySlipDisplay {...data} />;
}
