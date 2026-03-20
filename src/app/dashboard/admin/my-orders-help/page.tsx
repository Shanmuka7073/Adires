'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CodeDisplay } from '@/components/admin/code-display';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { Package } from 'lucide-react';

const codeText = `
// FILE: src/app/dashboard/customer/my-orders/page.tsx
// CUSTOMER TRACKING & STATUS TIMELINE

function OrderStatusTimeline({ status }) {
    // Maps status strings to step indices
    const getStep = (s) => {
        if (s === 'Pending') return 1;
        if (s === 'Processing') return 2;
        if (['Billed', 'Out for Delivery'].includes(s)) return 3;
        if (['Completed', 'Delivered'].includes(s)) return 4;
        return 0;
    };

    const currentStep = getStep(status);
    // Dynamic progress bar rendering logic...
}
`;

export default function MyOrdersHelpPage() {
    const { isAdmin, isLoading } = useAdminAuth();
    const router = useRouter();
    if (!isLoading && !isAdmin) router.replace('/dashboard');
    if (isLoading || !isAdmin) return null;

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-3xl font-headline flex items-center gap-2"><Package className="h-8 w-8 text-primary" /> Order History Source Code</CardTitle>
                    <CardDescription>Logic for customer tracking and status visualization.</CardDescription>
                </CardHeader>
                <CardContent><CodeDisplay codeText={codeText} /></CardContent>
            </Card>
        </div>
    );
}
