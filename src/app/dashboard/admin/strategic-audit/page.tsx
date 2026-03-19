
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AuditDisplay } from './audit-display';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { Drama, Download, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function StrategicAuditPage() {
    const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
    const router = useRouter();
    const { toast } = useToast();

    if (!isAdminLoading && !isAdmin) {
        router.replace('/dashboard');
        return null;
    }

    if (isAdminLoading) {
        return <div className="p-12 text-center">Analyzing System State...</div>;
    }

    const handleDownload = () => {
        toast({ title: "Audit Exported", description: "Strategic data saved to local memory." });
    };

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 max-w-6xl">
            <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-12 border-b pb-10 border-black/5">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
                            <Drama className="h-6 w-6" />
                        </div>
                        <h1 className="text-5xl font-black font-headline tracking-tighter uppercase italic leading-none">Strategic Audit</h1>
                    </div>
                    <p className="text-muted-foreground font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">FOUNDER & INVESTOR ANALYSIS</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleDownload} variant="outline" className="rounded-full h-12 px-6 font-black uppercase text-[10px] tracking-widest border-2">
                        <Download className="mr-2 h-4 w-4" /> Export Audit
                    </Button>
                    <Button variant="ghost" className="rounded-full h-12 px-6 font-black uppercase text-[10px] tracking-widest hover:bg-black/5">
                        <Share2 className="mr-2 h-4 w-4" /> Share with Board
                    </Button>
                </div>
            </div>

            <AuditDisplay />
        </div>
    );
}
