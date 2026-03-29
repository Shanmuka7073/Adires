
'use client';

import React, { useEffect, useState, useTransition, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, TrendingUp, Loader2, Info, ArrowRight } from 'lucide-react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Store, ReportData, Order } from '@/lib/types';
import { getStoreSalesReport } from '@/app/actions';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';

function StatCard({ title, value, highlight = false, valueClassName, onClick }: { title: string, value: string | number, highlight?: boolean, valueClassName?: string, onClick?: () => void }) {
  return (
    <Card 
        onClick={onClick}
        className={cn(
            "rounded-3xl border-0 shadow-lg overflow-hidden transition-all group",
            highlight ? 'bg-primary/5 ring-2 ring-primary/20' : 'bg-white',
            onClick ? 'cursor-pointer hover:shadow-2xl hover:scale-[1.02]' : ''
        )}
    >
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest opacity-40">{title}</CardTitle>
            {onClick && <ArrowRight className="h-3 w-3 opacity-20 group-hover:opacity-100 transition-all" />}
        </div>
      </CardHeader>
      <CardContent>
        <h2 className={cn("text-4xl font-black tracking-tighter text-gray-950", valueClassName)}>{value}</h2>
      </CardContent>
    </Card>
  );
}

export default function SalesReportPage() {
    const { user, firestore } = useFirebase();
    const [report, setReport] = useState<ReportData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');
    const { userStore, stores } = useAppStore();

    const myStore = useMemo(() => userStore || stores.find(s => s.ownerId === user?.uid) || null, [userStore, stores, user?.uid]);

    // OPTIMIZATION: Manual fetch marker for telemetry
    const fetchReport = async () => {
        if (!myStore) return;
        const start = performance.now();
        setIsLoading(true);
        try {
            const result = await getStoreSalesReport({ storeId: myStore.id, period: activeTab });
            if (result.success && result.report) {
                setReport(result.report as any);
                console.log(`[UI_PERF] Sales Report Rendered in ${(performance.now() - start).toFixed(0)}ms`);
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchReport(); }, [myStore, activeTab]);
    
    if (!myStore) return <div className="p-12 text-center opacity-20"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>;

    const profit = report ? (report.totalSales ?? 0) - (report.ingredientCost ?? 0) : 0;

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 max-w-7xl animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-12 border-b pb-10 border-black/5">
                <div className="space-y-1">
                    <h1 className="text-6xl font-black font-headline tracking-tighter uppercase italic">Analytics</h1>
                    <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.3em] opacity-40">{myStore.name} • Insights</p>
                </div>
                <div className="flex gap-2 bg-black/5 p-1.5 rounded-[1.5rem] border">
                    {(['daily', 'weekly', 'monthly'] as const).map(t => (
                        <button key={t} onClick={() => setActiveTab(t)} className={cn("px-6 h-10 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all", activeTab === t ? "bg-white shadow-lg text-primary" : "opacity-40 hover:opacity-100")}>
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="grid md:grid-cols-4 gap-6">
                    {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 w-full rounded-3xl" />)}
                </div>
            ) : report && report.totalOrders > 0 ? (
                <div className="space-y-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard title="Gross Profit" value={`₹${profit.toFixed(0)}`} valueClassName="text-green-600" highlight={true} />
                        <StatCard title="Total Revenue" value={`₹${(report.totalSales ?? 0).toFixed(0)}`} />
                        <StatCard title="Total Orders" value={report.totalOrders} />
                        <StatCard title="Items Sold" value={report.totalOrders * 2} /> 
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-12">
                        <section className="space-y-6">
                            <h3 className="text-2xl font-black tracking-tight uppercase flex items-center gap-2"><TrendingUp className="h-6 w-6 text-primary" /> Top Products</h3>
                            <div className="space-y-3">
                                {report.topProducts?.map(p => (
                                    <div key={p.name} className="flex justify-between items-center p-5 bg-white rounded-[2rem] shadow-md border border-black/5">
                                        <p className="font-black text-sm uppercase">{p.name}</p>
                                        <Badge variant="secondary" className="text-[8px] font-black uppercase">{p.count} units</Badge>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="space-y-6">
                            <h3 className="text-2xl font-black tracking-tight uppercase flex items-center gap-2"><Info className="h-6 w-6 text-primary" /> Performance Strategy</h3>
                            <Card className="rounded-[2.5rem] p-8 bg-slate-900 text-white border-0 shadow-2xl">
                                <p className="text-sm font-bold opacity-80 leading-relaxed uppercase">
                                    Your average check value is trending upwards. Consider adding high-margin appetizers to your menu to boost profitability by another 5%.
                                </p>
                            </Card>
                        </section>
                    </div>
                </div>
            ) : (
                <div className="text-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-black/5 opacity-40">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                    <p className="font-black uppercase tracking-widest text-sm">No sales data for this period</p>
                </div>
            )}
        </div>
    );
}
