'use client';

import React, { useEffect, useState, useTransition, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, Download, Receipt, AlertTriangle, List, TrendingUp, TrendingDown, Award, Lightbulb, Search, Sparkles, Info, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Store, ReportData } from '@/lib/types';
import { getStoreSalesReport } from '@/app/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

function SuggestionDetailsDialog({ isOpen, onOpenChange, tableData }: { isOpen: boolean; onOpenChange: (open: boolean) => void; tableData: ReportData['salesByTable'][0] | null }) {
    if (!tableData) return null;

    const TARGET_MARGIN = 0.55;
    const requiredTotalSales = tableData.totalCost / (1 - TARGET_MARGIN);
    const priceIncreaseNeeded = requiredTotalSales - tableData.totalSales;
    const priceIncreasePerOrder = tableData.orderCount > 0 ? priceIncreaseNeeded / tableData.orderCount : 0;

    const requiredIngredientCost = tableData.totalSales * (1 - TARGET_MARGIN);
    const costReductionNeeded = tableData.totalCost - requiredIngredientCost;
    const costReductionPercent = tableData.totalCost > 0 ? (costReductionNeeded / tableData.totalCost) * 100 : 0;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md rounded-[2rem] border-0 shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 font-black uppercase text-xl"><Lightbulb className="text-amber-500 h-6 w-6"/> Strategic Correction</DialogTitle>
                    <DialogDescription className="font-bold opacity-60">
                        Table {tableData.tableNumber} Improvement Path (Target: 55% Margin)
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                    <div className="p-4 rounded-3xl bg-blue-50 border-2 border-blue-100 space-y-2">
                        <h4 className="text-xs font-black uppercase tracking-widest text-blue-800">Option A: Price Correction</h4>
                        <p className="text-sm font-bold text-blue-900 leading-tight">Increase average check by ₹{priceIncreasePerOrder.toFixed(0)} per visit.</p>
                    </div>
                    <div className="p-4 rounded-3xl bg-orange-50 border-2 border-orange-100 space-y-2">
                        <h4 className="text-xs font-black uppercase tracking-widest text-orange-800">Option B: Cost Correction</h4>
                        <p className="text-sm font-bold text-orange-900 leading-tight">Reduce waste or source cheaper by {costReductionPercent.toFixed(0)}%.</p>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)} className="rounded-xl font-black uppercase text-[10px] tracking-widest h-12 w-full">Got it</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function GrossProfitDetailsDialog({ isOpen, onOpenChange, report, onSuggestionClick }: { isOpen: boolean, onOpenChange: (open: boolean) => void, report: ReportData | null, onSuggestionClick: (tableData: ReportData['salesByTable'][0]) => void }) {
    if (!report) return null;
    const profit = report.totalSales - report.ingredientCost;
    const getProfitColor = (p: number) => p >= 0 ? 'text-green-600' : 'text-red-600';
    
    const getStatusInfo = (p: number): { label: string; className: string } => {
        if (p >= 55) return { label: 'Excellent', className: 'bg-green-100 text-green-800 border-green-200' };
        if (p >= 40) return { label: 'Stable', className: 'bg-blue-100 text-blue-800 border-blue-200' };
        return { label: 'At Risk', className: 'bg-red-100 text-red-800 border-red-200' };
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl rounded-[2.5rem] border-0 shadow-2xl overflow-hidden">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle className="text-2xl font-black uppercase tracking-tight">Performance Breakdown</DialogTitle>
                    <DialogDescription className="font-bold opacity-60">Profitability analysis per operational zone.</DialogDescription>
                </DialogHeader>
                <div className="p-6 space-y-6">
                    <ScrollArea className="h-80 pr-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Zone/Table</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Margin</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest opacity-40">Profit</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {report.salesByTable?.map(tableData => {
                                    const status = getStatusInfo(tableData.profitPercentage);
                                    return (
                                        <TableRow key={tableData.tableNumber} className="group hover:bg-muted/30 cursor-pointer" onClick={() => onSuggestionClick(tableData)}>
                                            <TableCell className="font-black text-xs uppercase tracking-tight">Table {tableData.tableNumber}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <span className={cn("font-black text-sm", getProfitColor(tableData.profitPercentage))}>{tableData.profitPercentage.toFixed(1)}%</span>
                                                    <Badge className={cn("text-[8px] font-black uppercase", status.className)}>{status.label}</Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell className={cn("text-right font-black text-sm", getProfitColor(tableData.grossProfit))}>₹{tableData.grossProfit.toFixed(0)}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                    <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-2xl border-2 border-primary/10">
                        <Info className="h-5 w-5 text-primary" />
                        <p className="text-xs font-bold text-gray-600">Click any table row to see strategic AI recommendations for that zone.</p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function StatCard({ title, value, highlight = false, description, valueClassName, onClick }: { title: string, value: string | number, highlight?: boolean, description?: string, valueClassName?: string, onClick?: () => void }) {
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
        <CardTitle className="text-[10px] font-black uppercase tracking-widest opacity-40 group-hover:opacity-100 transition-opacity">{title}</CardTitle>
        {description && <CardDescription className="text-[8px] font-bold uppercase">{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <h2 className={cn("text-4xl font-black tracking-tighter text-gray-950", valueClassName)}>{value}</h2>
      </CardContent>
    </Card>
  );
}

export default function SalesReportPage() {
    const { user, firestore } = useFirebase();
    const { toast } = useToast();
    const [report, setReport] = useState<ReportData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startLoading] = useTransition();
    const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');
    
    const [isGrossProfitDialogOpen, setIsGrossProfitDialogOpen] = useState(false);
    const [isSuggestionDialogOpen, setIsSuggestionDialogOpen] = useState(false);
    const [selectedTableForSuggestion, setSelectedTableForSuggestion] = useState<ReportData['salesByTable'][0] | null>(null);

    const storeQuery = useMemoFirebase(() =>
        firestore && user ? query(collection(firestore, 'stores'), where('ownerId', '==', user.uid)) : null,
    [firestore, user]);

    const { data: myStores, isLoading: storeLoading } = useCollection<Store>(storeQuery);
    const myStore = myStores?.[0];

    useEffect(() => {
        if (myStore) {
            startLoading(async () => {
                setError(null);
                const result = await getStoreSalesReport({ storeId: myStore.id, period: activeTab });
                if (result.success && result.report) {
                    setReport(result.report as unknown as ReportData);
                } else {
                    setError(result.error || 'Failed to fetch analytics.');
                }
            });
        }
    }, [myStore, activeTab]);
    
    const profit = report ? (report.totalSales ?? 0) - (report.ingredientCost ?? 0) : 0;
    const profitColor = profit >= 0 ? 'text-green-600' : 'text-red-600';
    const profitPerOrder = report && report.totalOrders > 0 ? profit / report.totalOrders : 0;
    
    if (storeLoading) return <div className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto opacity-20" /></div>;
    if (!myStore) return <div className="p-12 text-center"><p className="font-black uppercase tracking-widest text-xs opacity-40">Store not found.</p></div>;

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 max-w-7xl animate-in fade-in duration-500">
            <GrossProfitDetailsDialog isOpen={isGrossProfitDialogOpen} onOpenChange={setIsGrossProfitDialogOpen} report={report} onSuggestionClick={(t) => { setSelectedTableForSuggestion(t); setIsSuggestionDialogOpen(true); }} />
            <SuggestionDetailsDialog isOpen={isSuggestionDialogOpen} onOpenChange={setIsSuggestionDialogOpen} tableData={selectedTableForSuggestion} />

            <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-12 border-b pb-10 border-black/5">
                <div className="space-y-1">
                    <h1 className="text-6xl font-black font-headline tracking-tighter uppercase italic">Business Insights</h1>
                    <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.3em] opacity-40">{myStore.name} • Performance Audit</p>
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
                        <StatCard title="Gross Profit" value={`₹${profit.toFixed(0)}`} valueClassName={profitColor} highlight={profit > 0} onClick={() => setIsGrossProfitDialogOpen(true)} />
                        <StatCard title="Profit / Order" value={`₹${profitPerOrder.toFixed(0)}`} valueClassName={profitPerOrder > 0 ? 'text-gray-800' : 'text-red-600'} />
                        <StatCard title="Revenue" value={`₹${(report.totalSales ?? 0).toFixed(0)}`} />
                        <StatCard title="Ingredient Cost" value={`₹${(report.ingredientCost ?? 0).toFixed(0)}`} valueClassName="text-red-600" />
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-12">
                        <section className="space-y-6">
                            <h3 className="text-2xl font-black tracking-tight uppercase flex items-center gap-2"><Sparkles className="h-6 w-6 text-primary" /> Profitable Dishes</h3>
                            <div className="space-y-3">
                                {report.topProfitableProducts?.map(p => (
                                    <div key={p.name} className="flex justify-between items-center p-5 bg-white rounded-[2rem] shadow-md hover:shadow-xl transition-all border border-transparent hover:border-primary/20">
                                        <div className="min-w-0">
                                            <p className="font-black text-sm uppercase truncate leading-none mb-1.5">{p.name}</p>
                                            <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{p.count} units sold</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-xl text-green-600 tracking-tighter leading-none mb-1">₹{p.totalProfit.toFixed(0)}</p>
                                            <p className="text-[9px] font-black uppercase text-green-600/40">Total Profit</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="space-y-6">
                            <h3 className="text-2xl font-black tracking-tight uppercase flex items-center gap-2"><Receipt className="h-6 w-6 text-primary" /> Cost Drivers</h3>
                            <div className="bg-white rounded-[2.5rem] shadow-xl p-8 border border-black/5">
                                <div className="space-y-6">
                                    {report.costDrivers?.map(driver => (
                                        <div key={driver.name} className="space-y-2">
                                            <div className="flex justify-between items-baseline">
                                                <span className="text-xs font-black uppercase tracking-tight">{driver.name}</span>
                                                <span className="text-[10px] font-black opacity-40">₹{driver.cost.toFixed(0)}</span>
                                            </div>
                                            <div className="h-2 w-full bg-black/5 rounded-full overflow-hidden">
                                                <div className="h-full bg-red-500 rounded-full" style={{ width: `${driver.percentage}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {report.optimizationHint && (
                                    <Alert className="mt-8 bg-blue-50 border-blue-100 rounded-2xl">
                                        <Lightbulb className="h-4 w-4 text-blue-600" />
                                        <AlertTitle className="text-[10px] font-black uppercase tracking-widest text-blue-800">Strategy Hint</AlertTitle>
                                        <AlertDescription className="text-xs font-bold text-blue-900 leading-tight">{report.optimizationHint}</AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        </section>
                    </div>
                </div>
            ) : (
                <div className="text-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-black/5 opacity-40">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                    <p className="font-black uppercase tracking-widest text-sm">No sales data recorded for this period</p>
                </div>
            )}
        </div>
    );
}