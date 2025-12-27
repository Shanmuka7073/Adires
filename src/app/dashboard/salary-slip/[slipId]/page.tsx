
'use client';

import { useMemo, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { getSalarySlipData } from '@/app/actions';
import type { SalarySlip, EmployeeProfile, Store, AttendanceRecord } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import QRCode from 'qrcode.react';
import { format } from 'date-fns';

function SalarySlipDisplay({ slip, employee, store, attendance }: { slip: SalarySlip, employee: EmployeeProfile, store: Store, attendance: any }) {
    
    // Auto-print on mount
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            window.print();
        }, 500);

        return () => clearTimeout(timeoutId);
    }, []);

    const gross = slip.baseSalary + slip.overtimePay;
    const totalDeduction = slip.deductions;
    const netPay = slip.netPay;

    function numberToWords(num: number): string {
        const a = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
        const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
        const g = ['', 'thousand', 'lakh', 'crore'];

        const inWords = (n: number): string => {
            if (n < 20) return a[n];
            const digit = n % 10;
            return b[Math.floor(n / 10)] + (digit ? ' ' + a[digit] : '');
        };

        if (num === 0) return 'Zero';
        let words = '';
        let i = 0;
        while (num > 0) {
            let chunk = num % 100;
            if (i > 0) {
              chunk = num % 1000;
              num = Math.floor(num / 1000);
            } else {
               num = Math.floor(num / 100);
            }
            if (chunk > 0) {
                let s = '';
                if(i===0) { // hundreds place
                    s = inWords(chunk);
                } else {
                    s = inWords(chunk);
                }
                words = s + ' ' + g[i] + ' ' + words;
            }
            i++;
        }
        return words.trim().replace(/\s+/g, ' ').split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
    }


    const netPayInWords = () => {
        const rupees = Math.floor(netPay);
        const paise = Math.round((netPay - rupees) * 100);
        let words = numberToWords(rupees) + ' Rupees';
        if (paise > 0) {
            words += ' and ' + numberToWords(paise) + ' Paise';
        }
        return words + ' Only';
    }
    
    let paymentDetailsHtml = `<p><b>Payment Mode:</b> ${employee.payoutMethod === 'upi' ? 'UPI' : 'Bank Transfer'}</p>`;
    if (employee.payoutMethod === 'upi' && employee.upiId) {
        paymentDetailsHtml += `<p><b>UPI ID:</b> ${employee.upiId}</p>`;
    } else if (employee.payoutMethod === 'bank' && employee.bankDetails) {
        paymentDetailsHtml += `
            <p><b>A/C Holder:</b> ${employee.bankDetails.accountHolderName}</p>
            <p><b>A/C No:</b> ${employee.bankDetails.accountNumber}</p>
            <p><b>IFSC:</b> ${employee.bankDetails.ifscCode || 'N/A'}</p>
        `;
    }

    return `
      <html>
        <head><meta charset='utf-8'><title>Salary Slip for ${format(new Date(slip.periodStart), 'MMMM yyyy')}</title></head>
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; font-size: 14px;">
          <div style="width: 800px; margin: auto; padding: 20px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px;">
              <div>
                <h1 style="font-size: 24px; font-weight: bold; margin: 0;">${store.name}</h1>
                <p style="font-size: 12px; color: #666; margin: 5px 0 0;">${store.address}</p>
              </div>
              <div style="text-align: right;">
                <h2 style="font-size: 20px; font-weight: 600; margin: 0;">Salary Slip</h2>
                <p style="font-size: 12px; margin: 5px 0 0;">For the Month of ${format(new Date(slip.periodStart), 'MMMM yyyy')}</p>
                 <p style="font-size: 12px; margin: 5px 0 0;">Payslip No: ${slip.id.toUpperCase().slice(0, 15)}</p>
                 <p style="font-size: 12px; margin: 5px 0 0;">Generated On: ${format(new Date(), 'dd MMM yyyy')}</p>
              </div>
            </div>
            <table style="width: 100%; margin-bottom: 20px; font-size: 14px;">
              <tr>
                <td style="padding: 5px; vertical-align: top;"><b>Employee Name:</b> ${employee.firstName} ${employee.lastName}</td>
                <td style="padding: 5px; vertical-align: top;"><b>Employee ID:</b> ${employee.employeeId}</td>
              </tr>
              <tr>
                <td style="padding: 5px; vertical-align: top;"><b>Designation:</b> ${employee.role}</td>
                <td style="padding: 5px; vertical-align: top;"><b>Date of Joining:</b> ${format(new Date(employee.hireDate), 'dd MMM yyyy')}</td>
              </tr>
               <tr>
                <td style="padding: 5px;" colspan="2">
                   ${paymentDetailsHtml}
                </td>
              </tr>
            </table>
            <div style="display: flex; justify-content: space-between; text-align: center; margin-bottom: 20px; font-size: 12px; background: #f9f9f9; padding: 10px; border-radius: 5px;">
                <div><b>Total Days in Month:</b> ${attendance.totalDays}</div>
                <div><b>Present Days:</b> ${attendance.presentDays}</div>
                <div><b>Partial Days:</b> ${attendance.partialDays}</div>
                <div><b>Absent/Rejected:</b> ${attendance.absentDays}</div>
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
              <tr style="background-color: #f2f2f2;">
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Earnings</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Amount (₹)</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Deductions</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Amount (₹)</th>
              </tr>
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">Base Salary (${attendance.presentDays} payable days)</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${slip.baseSalary.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">Standard Deductions</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${slip.deductions.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
              </tr>
              <tr style="font-weight: bold;">
                <td style="border: 1px solid #ddd; padding: 8px;">Gross Earnings</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${gross.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">Total Deductions</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totalDeduction.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
              </tr>
            </table>
            <div style="text-align: right; font-size: 18px; font-weight: bold; margin-top: 20px;">
              Net Pay: ₹ ${netPay.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </div>
            <div style="margin-top: 10px; font-size: 14px;">
              <p><b>Amount in Words:</b> ${netPayInWords()}</p>
            </div>
            <div style="margin-top: 50px; font-size: 12px; color: #666; display: flex; justify-content: space-between;">
              <p><i>This is a system-generated payslip.</i></p>
              <p><b>Authorized Signatory</b></p>
            </div>
          </div>
        </body>
      </html>
    `;
}

interface SalaryData {
    slip: SalarySlip;
    employee: EmployeeProfile;
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
                    setData(result);
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
    
    const htmlContent = SalarySlipDisplay(data);

    return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
}
