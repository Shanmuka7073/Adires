
'use client';

import React, { useEffect, useState, useTransition, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, Receipt, TrendingUp, Lightbulb, Loader2, Info, ShoppingBag, Package, DollarSign, ArrowRight, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Store, ReportData, Order } from '@/lib/types';
import { getStoreSalesReport } from '@/app/actions';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

function RevenueDetailsDialog({ isOpen, onOpenChange, orders }: { isOpen: boolean, onOpenChange: (open: boolean) => void, orders: Order[] }) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl rounded-[2.5rem] border-0 shadow-2xl overflow-hidden flex flex-col h-[80vh]">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle className="text-xl font-black uppercase tracking-tight">Revenue Breakdown</DialogTitle>
                    <DialogDescription className="font-bold opacity-60 uppercase text-[10px]">Recent successful transactions</DialogDescription>
                </DialogHeader>
                <div className="flex-1 min-h-0 p-6">
                    <ScrollArea className="h-full pr-4">
                        <Table>
                            <TableHeader className="bg-black/5">
                                <TableRow>
                                    <TableHead className="text-[10px] font-black uppercase">Order</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase">Customer</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orders.map(o => (
                                    <TableRow key={o.id} className="hover:bg-muted/30">
                                        <TableCell>
                                            <p className="font-black text-[10px] uppercase">#{o.id.slice(-6)}</p>
                                            <p className="text-[8px] opacity-40 font-bold">{new Date(o.orderDate as string).toLocaleDateString()}</p>
                                        </TableCell>
                                        <TableCell className="font-bold text-xs uppercase opacity-60">{o.customerName || 'Guest'}</TableCell>
                                        <TableCell className="text-right font-black text-xs text-primary">₹{o.totalAmount.toFixed(0)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function CostDetailsDialog({ isOpen, onOpenChange, drivers }: { isOpen: boolean, onOpenChange: (open: boolean) => void, drivers: ReportData['costDrivers'] }) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md rounded-[2.5rem] border-0 shadow-2xl overflow-hidden">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle className="text-xl font-black uppercase tracking-tight">Expense Audit</DialogTitle>
                    <DialogDescription className="font-bold opacity-60 uppercase text-[10px]">Direct cost allocation</DialogDescription>
                </DialogHeader>
                <div className="p-6 space-y-6">
                    {drivers.map(d => (
                        <div key={d.name} className="p-4 rounded-3xl bg-red-50 border-2 border-red-100 flex justify-between items-center">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-red-800/40 mb-1">{d.name}</p>
                                <p className="text-sm font-black text-red-900">{d.percentage}% Total Share</p>
                            </div>
                            <p className="text-xl font-black text-red-600">₹{d.cost.toFixed(0)}</p>
                        </div>
                    ))}
                    <div className="p-4 rounded-3xl bg-blue-50 border-2 border-blue-100 flex items-start gap-3">
                        <Info className="h-5 w-5 text-blue-600 shrink-0" />
                        <p className="text-[10px] font-bold text-blue-900/60 leading-tight uppercase">These costs are derived from your master ingredient catalog and dish recipes.</p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function ProfitDetailsDialog({ isOpen, onOpenChange, salesByTable, onSuggestionClick }: { isOpen: boolean, onOpenChange: (open: boolean) => void, salesByTable: ReportData['salesByTable'], onSuggestionClick: (t: any) => void }) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl rounded-[2.5rem] border-0 shadow-2xl overflow-hidden flex flex-col h-[70vh]">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle className="text-xl font-black uppercase tracking-tight">Zone Profitability</DialogTitle>
                    <DialogDescription className="font-bold opacity-60 uppercase text-[10px]">Margin performance per table/area</DialogDescription>
                </DialogHeader>
                <div className="flex-1 min-h-0 p-6">
                    <ScrollArea className="h-full pr-4">
                        <div className="grid gap-3">
                            {salesByTable.map(t => (
                                <div key={t.tableNumber} onClick={() => onSuggestionClick(t)} className="p-4 rounded-3xl bg-white border-2 border-black/5 hover:border-primary transition-all cursor-pointer flex justify-between items-center group">
                                    <div className="min-w-0">
                                        <p className="font-black text-xs uppercase text-gray-950">Table {t.tableNumber}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className="text-[8px] font-black uppercase">{t.orderCount} Orders</Badge>
                                            <span className={cn("text-[10px] font-black uppercase", t.profitPercentage >= 55 ? "text-green-600" : "text-amber-600")}>
                                                {t.profitPercentage.toFixed(0)}% Margin
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-lg text-primary tracking-tighter leading-none mb-1">₹{t.grossProfit.toFixed(0)}</p>
                                        <ArrowRight className="h-3.5 w-3.5 ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function SuggestionDetailsDialog({ isOpen, onOpenChange, tableData }: { isOpen: boolean; onOpenChange: (open: boolean) => void; tableData: ReportData['salesByTable'][0] | null }) {
    if (!tableData) return null;
    const TARGET_MARGIN = 0.55;
    const priceIncreasePerOrder = tableData.orderCount > 0 ? (tableData.totalCost / (1 - TARGET_MARGIN) - tableData.totalSales) / tableData.orderCount : 0;
    const costReductionPercent = tableData.totalCost > 0 ? ((tableData.totalCost - tableData.totalSales * (1 - TARGET_MARGIN)) / tableData.totalCost) * 100 : 0;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md rounded-[2rem] border-0 shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 font-black uppercase text-xl"><Lightbulb className="text-amber-500 h-6 w-6"/> Strategic Correction</DialogTitle>
                    <DialogDescription className="font-bold opacity-60">Table {tableData.tableNumber} Path to 55% Margin</DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                    <div className="p-4 rounded-3xl bg-blue-50 border-2 border-blue-100 space-y-2">
                        <h4 className="text-xs font-black uppercase tracking-widest text-blue-800">Option A: Upsell</h4>
                        <p className="text-sm font-bold text-blue-900 leading-tight">Increase average check by ₹{priceIncreasePerOrder.toFixed(0)} per visit.</p>
                    </div>
                    <div className="p-4 rounded-3xl bg-orange-50 border-2 border-orange-100 space-y-2">
                        <h4 className="text-xs font-black uppercase tracking-widest text-orange-800">Option B: Efficiency</h4>
                        <p className="text-sm font-bold text-orange-900 leading-tight">Reduce waste or source cheaper by {costReductionPercent.toFixed(0)}%.</p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

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
            <CardTitle className="text-[10px] font-black uppercase tracking-widest opacity-40 group-hover:opacity-100 transition-opacity">{title}</CardTitle>
            {onClick && <ArrowRight className="h-3 w-3 opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />}
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
    const [isLoading, startLoading] = useTransition();
    const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');
    
    const [activeDialog, setActiveDialog] = useState<'revenue' | 'cost' | 'profit' | 'suggestion' | null>(null);
    const [selectedTable, setSelectedTable] = useState<any>(null);

    const storeQuery = useMemoFirebase(() =>
        firestore && user ? query(collection(firestore, 'stores'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]);

    const { data: myStores, isLoading: storeLoading } = useCollection<Store>(storeQuery);
    const myStore = myStores?.[0];

    useEffect(() => {
        if (myStore) {
            startLoading(async () => {
                const result = await getStoreSalesReport({ storeId: myStore.id, period: activeTab });
                if (result.success && result.report) setReport(result.report as any);
            });
        }
    }, [myStore, activeTab]);
    
    if (storeLoading) return <div className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto opacity-20" /></div>;
    if (!myStore) return <div className="p-12 text-center"><p className="font-black uppercase tracking-widest text-xs opacity-40">Store not found.</p></div>;

    const profit = report ? (report.totalSales ?? 0) - (report.ingredientCost ?? 0) : 0;
    const profitPerOrder = report && report.totalOrders > 0 ? profit / report.totalOrders : 0;

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 max-w-7xl animate-in fade-in duration-500">
            <RevenueDetailsDialog isOpen={activeDialog === 'revenue'} onOpenChange={() => setActiveDialog(null)} orders={report?.orders || []} />
            <CostDetailsDialog isOpen={activeDialog === 'cost'} onOpenChange={() => setActiveDialog(null)} drivers={report?.costDrivers || []} />
            <ProfitDetailsDialog isOpen={activeDialog === 'profit'} onOpenChange={() => setActiveDialog(null)} salesByTable={report?.salesByTable || []} onSuggestionClick={(t) => { setSelectedTable(t); setActiveDialog('suggestion'); }} />
            <SuggestionDetailsDialog isOpen={activeDialog === 'suggestion'} onOpenChange={() => setActiveDialog(null)} tableData={selectedTable} />

            <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-12 border-b pb-10 border-black/5">
                <div className="space-y-1">
                    <h1 className="text-6xl font-black font-headline tracking-tighter uppercase italic">Business Insights</h1>
                    <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.3em] opacity-40">{myStore.name} • Live Audit</p>
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
                        <StatCard title="Gross Profit" value={`₹${profit.toFixed(0)}`} valueClassName={profit >= 0 ? "text-green-600" : "text-red-600"} highlight={profit > 0} onClick={() => setActiveDialog('profit')} />
                        <StatCard title="Profit / Order" value={`₹${profitPerOrder.toFixed(0)}`} />
                        <StatCard title="Revenue" value={`₹${(report.totalSales ?? 0).toFixed(0)}`} onClick={() => setActiveDialog('revenue')} />
                        <StatCard title="Ingredient Cost" value={`₹${(report.ingredientCost ?? 0).toFixed(0)}`} valueClassName="text-red-600" onClick={() => setActiveDialog('cost')} />
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-12">
                        <section className="space-y-6">
                            <h3 className="text-2xl font-black tracking-tight uppercase flex items-center gap-2"><TrendingUp className="h-6 w-6 text-primary" /> Top Performers</h3>
                            <div className="space-y-3">
                                {report.topProfitableProducts?.map(p => (
                                    <div key={p.name} className="flex justify-between items-center p-5 bg-white rounded-[2rem] shadow-md border border-black/5">
                                        <div className="min-w-0">
                                            <p className="font-black text-sm uppercase truncate leading-none mb-1.5">{p.name}</p>
                                            <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{p.count} units sold</p>
                                        </div>
                                        <p className="font-black text-xl text-green-600 tracking-tighter">₹{p.totalProfit.toFixed(0)}</p>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="space-y-6">
                            <h3 className="text-2xl font-black tracking-tight uppercase flex items-center gap-2"><Receipt className="h-6 w-6 text-primary" /> Cost Profile</h3>
                            <div className="bg-white rounded-[2.5rem] shadow-xl p-8 border border-black/5">
                                <div className="space-y-6">
                                    {report.costDrivers?.map(driver => (
                                        <div key={driver.name} className="space-y-2">
                                            <div className="flex justify-between items-baseline">
                                                <span className="text-[10px] font-black uppercase tracking-tight">{driver.name}</span>
                                                <span className="text-[10px] font-black opacity-40">₹{driver.cost.toFixed(0)}</span>
                                            </div>
                                            <div className="h-2 w-full bg-black/5 rounded-full overflow-hidden">
                                                <div className="h-full bg-red-500 rounded-full" style={{ width: `${driver.percentage}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
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
