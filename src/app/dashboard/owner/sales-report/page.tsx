'use client';

import { useEffect, useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, TrendingUp, ShoppingCart, Download, DollarSign, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Store } from '@/lib/types';
import { getStoreSalesReport } from '@/app/actions';

type ReportData = {
  totalSales: number;
  totalItems: number;
  topProducts: { name: string; count: number }[];
};

function ReportDisplayCard({ title, data, isLoading }: { title: string; data: ReportData | null; isLoading: boolean }) {
    if (isLoading) {
        return (
             <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-20 w-full" />
                </CardContent>
            </Card>
        )
    }

    if (!data || data.totalSales === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">No sales data available for this period.</p>
                </CardContent>
            </Card>
        );
    }


    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex justify-between items-baseline p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-green-500" />
                        <span className="text-sm text-muted-foreground">Total Sales</span>
                    </div>
                    <p className="text-2xl font-bold">₹{data.totalSales.toFixed(2)}</p>
                </div>
                <div className="flex justify-between items-baseline p-4 bg-muted/50 rounded-lg">
                     <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-blue-500" />
                        <span className="text-sm text-muted-foreground">Items Sold</span>
                    </div>
                    <p className="text-2xl font-bold">{data.totalItems}</p>
                </div>
                <div>
                    <h4 className="font-semibold text-sm mb-2">Top Selling Products:</h4>
                    {data.topProducts.length > 0 ? (
                         <div className="flex flex-col gap-2">
                            {data.topProducts.map(p => (
                                <div key={p.name} className="flex justify-between items-center text-sm p-2 bg-background rounded-md border">
                                    <span className="font-medium truncate">{p.name}</span>
                                    <span className="font-bold">{p.count} units</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground">No products sold in this period yet.</p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}


export default function SalesReportPage() {
    const { user, firestore } = useFirebase();
    const [report, setReport] = useState<ReportData | null>(null);
    const [isLoading, startLoading] = useTransition();
    const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');

    const storeQuery = useMemoFirebase(() =>
        firestore && user
        ? query(collection(firestore, 'stores'), where('ownerId', '==', user.uid))
        : null,
    [firestore, user]);

    const { data: myStores, isLoading: storeLoading } = useCollection<Store>(storeQuery);
    const myStore = myStores?.[0];

    useEffect(() => {
        if (myStore) {
            startLoading(async () => {
                const result = await getStoreSalesReport({ storeId: myStore.id, period: activeTab });
                if (result.success) {
                    setReport(result.report);
                } else {
                    console.error("Failed to fetch sales report:", result.error);
                    setReport(null);
                }
            });
        }
    }, [myStore, activeTab]);
    
    const handleDownload = () => {
        if (!report) return;

        const headers = ["Product Name", "Quantity Sold"];
        let csvContent = headers.join(",") + "\n";
        
        report.topProducts.forEach(p => {
             csvContent += `"${p.name}",${p.count}\n`;
        });
        
        const summary = `Total Sales,${report.totalSales.toFixed(2)}\nTotal Items,${report.totalItems}\n`;
        csvContent = `Period,${activeTab}\n${summary}\n${csvContent}`;
        
        const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${myStore?.name}_${activeTab}_sales_report.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    if (storeLoading) {
        return <div className="container mx-auto py-12"><p>Loading store information...</p></div>
    }

    if (!myStore) {
        return <div className="container mx-auto py-12"><p>You must have a store to view sales reports.</p></div>
    }


    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                        <div className="flex items-center gap-3">
                            <BarChart3 className="h-8 w-8 text-primary" />
                            <div>
                                <CardTitle className="text-3xl font-headline">Sales Report: {myStore.name}</CardTitle>
                                <CardDescription>
                                    An overview of your sales performance.
                                </CardDescription>
                            </div>
                        </div>
                        <Button onClick={handleDownload} variant="outline" disabled={isLoading || !report}>
                            <Download className="mr-2 h-4 w-4" />
                            Download Report
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="daily" value={activeTab} onValueChange={(value) => setActiveTab(value as 'daily' | 'weekly' | 'monthly')} className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="daily">Today's Report</TabsTrigger>
                            <TabsTrigger value="weekly">This Week's Report</TabsTrigger>
                            <TabsTrigger value="monthly">This Month's Report</TabsTrigger>
                        </TabsList>
                        <TabsContent value="daily" className="mt-6">
                             <ReportDisplayCard title="Today's Performance" data={report} isLoading={isLoading} />
                        </TabsContent>
                         <TabsContent value="weekly" className="mt-6">
                             <ReportDisplayCard title="This Week's Performance" data={report} isLoading={isLoading} />
                        </TabsContent>
                        <TabsContent value="monthly" className="mt-6">
                           <ReportDisplayCard title="This Month's Performance" data={report} isLoading={isLoading} />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
