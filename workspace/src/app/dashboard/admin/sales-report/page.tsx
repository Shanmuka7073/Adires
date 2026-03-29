'use client';

import { useEffect, useState, useTransition, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Beef, Carrot, Grape, Download, Loader2, ArrowRight, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useFirebase } from '@/firebase';
import { collection, query, where, Timestamp, getDocs, orderBy } from 'firebase/firestore';
import type { Order } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type ReportCategory = {
  totalSales: number;
  itemCount: number;
  topProducts: { name: string; count: number }[];
};

function RevenueDetailsDialog({ isOpen, onOpenChange, orders }: { isOpen: boolean, onOpenChange: (open: boolean) => void, orders: Order[] }) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl rounded-[2.5rem] border-0 shadow-2xl overflow-hidden flex flex-col h-[80vh]">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle className="text-xl font-black uppercase tracking-tight">Revenue Audit</DialogTitle>
                    <DialogDescription className="font-bold opacity-60 uppercase text-[10px]">Successful transaction log</DialogDescription>
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

function ReportCard({ title, data, icon: Icon, isLoading, onClick }: { title: string; data: ReportCategory | null; icon: React.ElementType; isLoading: boolean, onClick?: () => void }) {
    if (isLoading) {
        return (
             <Card className="rounded-3xl border-0 shadow-lg">
                <CardHeader>
                    <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-20 w-full" />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card onClick={onClick} className={cn("rounded-3xl border-0 shadow-lg overflow-hidden group transition-all", onClick && "cursor-pointer hover:shadow-2xl hover:scale-[1.02]")}>
            <CardHeader className="pb-2 bg-primary/5">
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-tight">
                        <Icon className="h-4 w-4 text-primary" />
                        {title}
                    </CardTitle>
                    {onClick && <ArrowRight className="h-3 w-3 opacity-20 group-hover:translate-x-1 group-hover:opacity-100 transition-all" />}
                </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
                <div className="flex justify-between items-baseline">
                    <p className="text-2xl font-black text-gray-950 tracking-tighter">₹{data?.totalSales.toFixed(0) || 0}</p>
                    <Badge variant="outline" className="text-[8px] font-black uppercase">{data?.itemCount || 0} items</Badge>
                </div>
                <div className="space-y-1.5">
                    {data?.topProducts.slice(0, 3).map(p => (
                        <div key={p.name} className="flex justify-between items-center text-[10px] font-bold uppercase text-gray-500">
                            <span className="truncate pr-2">{p.name}</span>
                            <span className="opacity-40">{p.count} sold</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

export default function SalesReportPage() {
    const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
    const router = useRouter();
    const { firestore } = useFirebase();
    const [dailyReport, setDailyReport] = useState<any | null>(null);
    const [monthlyReport, setMonthlyReport] = useState<any | null>(null);
    const [isLoading, startLoading] = useTransition();
    const [activeTab, setActiveTab] = useState<'daily' | 'monthly'>('daily');
    const [isRevenueDialogOpen, setIsRevenueDialogOpen] = useState(false);

    const generateReport = async (db: any, period: 'daily' | 'monthly'): Promise<any | null> => {
        const now = new Date();
        let startDate: Date;

        if (period === 'daily') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else { // monthly
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        const startTimestamp = Timestamp.fromDate(startDate);
        
        try {
            const ordersQuery = query(
                collection(db, 'orders'),
                where('status', 'in', ['Delivered', 'Completed']),
                where('orderDate', '>=', startTimestamp),
                orderBy('orderDate', 'desc')
            );
            const orderSnapshot = await getDocs(ordersQuery);
            const deliveredOrders = orderSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));

            const report = {
                grocery: { totalSales: 0, itemCount: 0, topProducts: new Map() },
                meat: { totalSales: 0, itemCount: 0, topProducts: new Map() },
                vegetable: { totalSales: 0, itemCount: 0, topProducts: new Map() },
                orders: deliveredOrders
            };
            const meatCategories = ['fresh cut', 'meat & fish', 'meat'];
            const vegetableCategories = ['vegetables'];

            for (const order of deliveredOrders) {
                const items = order.items || [];

                for (const item of items) {
                    const itemTotal = item.price * item.quantity;
                    const category = (item.productName || 'grocery').toLowerCase();
                    
                    let reportCategory: 'grocery' | 'meat' | 'vegetable';
                    if (meatCategories.some(kw => category.includes(kw))) {
                        reportCategory = 'meat';
                    } else if (vegetableCategories.some(kw => category.includes(kw))) {
                        reportCategory = 'vegetable';
                    } else {
                        reportCategory = 'grocery';
                    }
                    
                    report[reportCategory].totalSales += itemTotal;
                    report[reportCategory].itemCount += item.quantity;
                    
                    const currentQty = report[reportCategory].topProducts.get(item.productName) || 0;
                    report[reportCategory].topProducts.set(item.productName, currentQty + item.quantity);
                }
            }
            
            const formatTopProducts = (topProductsMap: Map<string, number>) => {
                return Array.from(topProductsMap.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([name, count]) => ({ name, count }));
            };

            return {
                grocery: { ...report.grocery, topProducts: formatTopProducts(report.grocery.topProducts) },
                meat: { ...report.meat, topProducts: formatTopProducts(report.meat.topProducts) },
                vegetable: { ...report.vegetable, topProducts: formatTopProducts(report.vegetable.topProducts) },
                orders: deliveredOrders
            };

        } catch (error) {
            console.error("Client-side sales report generation failed:", error);
            return null;
        }
    };

    const fetchReports = useCallback(async () => {
        if (!firestore) return;
        startLoading(async () => {
            const [dailyData, monthlyData] = await Promise.all([
                generateReport(firestore, 'daily'),
                generateReport(firestore, 'monthly')
            ]);
            setDailyReport(dailyData);
            setMonthlyReport(monthlyData);
        });
    }, [firestore]);

    useEffect(() => {
        if (isAdmin && firestore) {
          fetchReports();
        }
    }, [isAdmin, firestore, fetchReports]);
    
    const handleDownload = () => {
        const reportToDownload = activeTab === 'daily' ? dailyReport : monthlyReport;
        if (!reportToDownload) return;

        const headers = ["Category", "Total Sales", "Items Sold"];
        let csvContent = headers.join(",") + "\n";

        ['grocery', 'meat', 'vegetable'].forEach(cat => {
            const data = reportToDownload[cat as keyof typeof reportToDownload];
            csvContent += `"${cat.toUpperCase()}",${data.totalSales.toFixed(2)},${data.itemCount}\n`;
        });
        
        const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${activeTab}_platform_report.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const reportCards = [
        { title: 'Protein / Meat', dataKey: 'meat', icon: Beef },
        { title: 'Fresh Vegetables', dataKey: 'vegetable', icon: Carrot },
        { title: 'Pantry / Grocery', dataKey: 'grocery', icon: Grape },
    ] as const;

    if (isAdminLoading) return <div className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto opacity-20" /></div>;

    const currentReport = activeTab === 'daily' ? dailyReport : monthlyReport;

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 max-w-7xl animate-in fade-in duration-500">
            <RevenueDetailsDialog isOpen={isRevenueDialogOpen} onOpenChange={setIsRevenueDialogOpen} orders={currentReport?.orders || []} />

            <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-12 border-b pb-10 border-black/5">
                <div className="space-y-1">
                    <h1 className="text-6xl font-black font-headline tracking-tighter uppercase italic">Market Intel</h1>
                    <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.3em] opacity-40">Global Platform Sales Audit</p>
                </div>
                <div className="flex gap-2 bg-black/5 p-1.5 rounded-[1.5rem] border">
                    {(['daily', 'monthly'] as const).map(t => (
                        <button key={t} onClick={() => setActiveTab(t)} className={cn("px-8 h-10 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all", activeTab === t ? "bg-white shadow-lg text-primary" : "opacity-40 hover:opacity-100")}>
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-12">
                <div className="grid md:grid-cols-3 gap-6">
                    {reportCards.map(card => (
                        <ReportCard 
                            key={card.dataKey}
                            title={card.title}
                            data={currentReport?.[card.dataKey] ?? { totalSales: 0, itemCount: 0, topProducts: [] }}
                            icon={card.icon}
                            isLoading={isLoading}
                            onClick={() => setIsRevenueDialogOpen(true)}
                        />
                    ))}
                </div>

                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <Button onClick={handleDownload} variant="outline" className="rounded-xl h-12 px-8 border-2 font-black text-[10px] uppercase tracking-widest">
                        <Download className="mr-2 h-4 w-4" /> Download Full CSV
                    </Button>
                    <Button variant="ghost" onClick={fetchReports} disabled={isLoading} className="rounded-xl h-12 px-8 font-black text-[10px] uppercase tracking-widest opacity-40">
                        <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} /> Re-Sync Data
                    </Button>
                </div>
            </div>
        </div>
    );
}
