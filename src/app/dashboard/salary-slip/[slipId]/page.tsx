
'use client';

import { useMemo, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import type { SalarySlip, EmployeeProfile, Store, AttendanceRecord } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import QRCode from 'qrcode.react';
import { format, getDaysInMonth } from 'date-fns';

function SalarySlipDisplay({ slip, employee, store, attendance }: { slip: SalarySlip, employee: EmployeeProfile, store: Store, attendance: any }) {
    
    // Auto-print on mount
    useEffect(() => {
        // A short delay ensures the content is rendered before printing
        const timeoutId = setTimeout(() => {
            window.print();
        }, 500);

        return () => clearTimeout(timeoutId);
    }, []);

    const gross = slip.baseSalary + slip.overtimePay;
    const totalDeduction = slip.deductions;
    const netPay = slip.netPay;

    // A simple number to words converter (for demonstration)
    const numberToWords = (num: number): string => {
        // This is a simplified version. A real app would use a robust library.
        const first = ['','one ','two ','three ','four ', 'five ','six ','seven ','eight ','nine ','ten ','eleven ','twelve ','thirteen ','fourteen ','fifteen ','sixteen ','seventeen ','eighteen ','nineteen '];
        const tens = ['', '', 'twenty','thirty','forty','fifty', 'sixty','seventy','eighty','ninety'];
        const mad = ['', 'thousand', 'million', 'billion', 'trillion'];
        let word = '';
        
        for(let i=0; i<mad.length; i++){
            let tempNumber = num % (100 * Math.pow(1000, i));
            if(Math.floor(tempNumber/Math.pow(1000,i)) !== 0){
                if(Math.floor(tempNumber/Math.pow(1000,i)) < 20){
                    word = first[Math.floor(tempNumber/Math.pow(1000,i))] + mad[i] + ' ' + word;
                } else {
                    word = tens[Math.floor(tempNumber/(10*Math.pow(1000,i)))] + '-' + first[Math.floor(tempNumber/Math.pow(1000,i))%10] + mad[i] + ' ' + word;
                }
            }
            tempNumber = num % (Math.pow(1000,i+1));
            if(Math.floor(tempNumber/(100*Math.pow(1000,i))) !== 0) word = first[Math.floor(tempNumber/(100*Math.pow(1000,i)))] + 'hundred ' + word;
        }
        return word.trim().replace(/\s+/g, ' ').split(' ').map(s=>s.charAt(0).toUpperCase() + s.slice(1)).join(' ') + ' Only';
    };
    
    return (
        <div className="bg-gray-100 dark:bg-gray-900 p-4 sm:p-8">
            <div className="watermark"></div>
            <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-8 rounded-lg shadow-lg text-sm">
            
            {/* HEADER */}
            <div className="flex justify-between items-center border-b pb-4 mb-6">
                <div className="flex items-center gap-3">
                {store.imageUrl && <img src={store.imageUrl} alt="Logo" className="h-12" />}
                <div>
                    <h1 className="text-xl font-bold">{store.name}</h1>
                    <p className="text-xs text-gray-500">{store.address}</p>
                </div>
                </div>

                <div className="text-right">
                <h2 className="text-lg font-semibold">Salary Slip</h2>
                <p className="text-xs text-gray-500">Payslip No: <b>{slip.id.toUpperCase().slice(0, 15)}</b></p>
                <p className="text-xs">{format(new Date(slip.periodStart), 'MMMM yyyy')}</p>
                </div>
            </div>

            {/* EMPLOYEE INFO */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                <p><b>Employee Name:</b> {employee.role} ({employee.employeeId})</p>
                <p><b>Employee ID:</b> {employee.employeeId}</p>
                <p><b>Designation:</b> {employee.role}</p>
                </div>
                <div>
                <p><b>Store:</b> {store.name}</p>
                <p><b>Pay Period:</b> {format(new Date(slip.periodStart), 'dd MMM yyyy')} – {format(new Date(slip.periodEnd), 'dd MMM yyyy')}</p>
                <p><b>Date of Joining:</b> {format(new Date(employee.hireDate), 'dd MMM yyyy')}</p>
                </div>
            </div>

            {/* ATTENDANCE SUMMARY */}
            <div className="mb-6">
                 <h3 className="font-semibold border-b mb-2">Attendance Summary</h3>
                 <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2 bg-gray-50 rounded"><p className="font-bold">{attendance.totalDays}</p><p className="text-xs">Total Days</p></div>
                    <div className="p-2 bg-green-50 rounded"><p className="font-bold">{attendance.presentDays}</p><p className="text-xs">Present</p></div>
                    <div className="p-2 bg-yellow-50 rounded"><p className="font-bold">{attendance.partialDays}</p><p className="text-xs">Partial Days</p></div>
                    <div className="p-2 bg-red-50 rounded"><p className="font-bold">{attendance.absentDays}</p><p className="text-xs">Absent</p></div>
                 </div>
            </div>


            {/* SALARY TABLE */}
            <div className="grid grid-cols-2 gap-6">
                <div>
                <h3 className="font-semibold border-b mb-2">Earnings</h3>
                <div className="space-y-1">
                    <div className="flex justify-between"><span>Base Salary ({attendance.presentDays} days)</span><span>₹{slip.baseSalary.toFixed(2)}</span></div>
                    {slip.overtimePay > 0 && <div className="flex justify-between"><span>Overtime Pay ({slip.overtimeHours} hrs)</span><span>₹{slip.overtimePay.toFixed(2)}</span></div>}
                </div>
                </div>

                <div>
                <h3 className="font-semibold border-b mb-2">Deductions</h3>
                 <div className="space-y-1">
                      <div className="flex justify-between"><span>Standard Deductions</span><span>₹{slip.deductions.toFixed(2)}</span></div>
                 </div>
                </div>
            </div>

            {/* SUMMARY */}
            <div className="border-t mt-6 pt-4 space-y-2">
                <div className="flex justify-between font-semibold">
                <span>Gross Earnings</span>
                <span>₹{gross.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                <span>Total Deductions</span>
                <span>₹{totalDeduction.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-green-600">
                <span>Net Pay</span>
                <span>₹{netPay.toFixed(2)}</span>
                </div>
            </div>

            {/* FOOTER */}
            <div className="grid grid-cols-2 gap-4 mt-6 text-xs">
                <div>
                <p><b>Amount in Words:</b></p>
                <p>{numberToWords(netPay)}</p>

                <div className="mt-4">
                    {/* Placeholder for a digital signature if available */}
                    <p className="text-xs mt-1">Authorized Signatory</p>
                </div>
                </div>

                <div className="flex flex-col items-end">
                <QRCode
                    id="qr"
                    value={`https://localbasket.in/verify/${slip.id}`}
                    size={80}
                    level="L"
                    includeMargin
                />
                <p className="mt-1 text-xs text-gray-500">Scan to Verify</p>
                </div>
            </div>

            <p className="text-center text-xs text-gray-500 mt-6">
                This is a system-generated payslip and does not require a physical signature.
            </p>
            </div>
        </div>
    );
}

export default function SalarySlipPage() {
    const { slipId } = useParams<{ slipId: string }>();
    const { user, firestore } = useFirebase();

    const [slip, setSlip] = useState<SalarySlip | null>(null);
    const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
    const [store, setStore] = useState<Store | null>(null);
    const [attendance, setAttendance] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            if (!firestore || !user || !slipId) {
                setIsLoading(false);
                return;
            }
            setIsLoading(true);

            // Since we don't know the storeId from the URL and need it for the path,
            // we first fetch the employee's profile to find their store.
            const empProfileSnap = await getDoc(doc(firestore, 'employeeProfiles', user.uid));
            if (!empProfileSnap.exists()) {
                // If the current user isn't an employee, check if they are a store owner
                // trying to view a slip. This logic would be more complex and require
                // a collectionGroup query on salarySlips, which we avoid for stability.
                // For now, we assume only employees can view their own slips this way.
                setIsLoading(false);
                return;
            }
            const empData = empProfileSnap.data() as EmployeeProfile;
            setEmployee(empData);
            
            // Now we have the storeId to build the correct path to the salary slip.
            const correctSlipRef = doc(firestore, `stores/${empData.storeId}/salarySlips`, slipId);
            const slipSnap = await getDoc(correctSlipRef);
            if (!slipSnap.exists()) {
                setIsLoading(false);
                return;
            }
            const slipData = slipSnap.data() as SalarySlip;
            setSlip(slipData);
            
            // Fetch Store data using the storeId from the employee's profile.
            const storeSnap = await getDoc(doc(firestore, 'stores', empData.storeId));
            if (storeSnap.exists()) {
                setStore(storeSnap.data() as Store);
            }

            // Fetch the attendance summary for the slip's period.
            const attendanceQuery = query(
                collection(firestore, `stores/${empData.storeId}/attendance`),
                where('employeeId', '==', slipData.employeeId), // Use employeeId from slip for correctness
                where('workDate', '>=', slipData.periodStart),
                where('workDate', '<=', slipData.periodEnd)
            );
            const attendanceSnap = await getDocs(attendanceQuery);
            const records = attendanceSnap.docs.map(d => d.data() as AttendanceRecord);
            
            const attendanceSummary = {
                totalDays: getDaysInMonth(new Date(slipData.periodStart)),
                presentDays: records.filter(r => r.status === 'present' || r.status === 'approved').length,
                partialDays: records.filter(r => r.status === 'partially_present').length,
                absentDays: records.filter(r => r.status === 'absent' || r.status === 'rejected').length,
            };
            setAttendance(attendanceSummary);

            setIsLoading(false);
        }

        fetchData();
    }, [firestore, user, slipId]);

    if (isLoading) {
        return (
            <div className="p-8">
                <Skeleton className="max-w-3xl mx-auto h-[800px]" />
            </div>
        );
    }
    
    if (!slip || !employee || !store || !attendance) {
        return <div>Salary Slip not found or you do not have permission to view it.</div>;
    }

    return <SalarySlipDisplay slip={slip} employee={employee} store={store} attendance={attendance} />;
}
