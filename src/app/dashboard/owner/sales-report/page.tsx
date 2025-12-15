
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
  totalOrders: number;
  topProducts: { name: string; count: number }[];
};

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
                    setReport(result.report!);
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
                        <TabsContent value={activeTab} className="mt-6">
                            {isLoading ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                                    <Skeleton className="h-32" />
                                    <Skeleton className="h-32" />
                                    <Skeleton className="h-32" />
                                </div>
                            ) : report ? (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                                <Card>
                                  <CardContent className="p-6">
                                    <p className="text-sm text-muted-foreground">Total Sales</p>
                                    <h2 className="text-3xl font-bold">₹{report.totalSales.toFixed(2)}</h2>
                                  </CardContent>
                                </Card>

                                <Card>
                                  <CardContent className="p-6">
                                    <p className="text-sm text-muted-foreground">Orders</p>
                                    <h2 className="text-3xl font-bold">{report.totalOrders}</h2>
                                  </CardContent>
                                </Card>

                                <Card>
                                  <CardContent className="p-6">
                                    <p className="text-sm text-muted-foreground">Items Sold</p>
                                    <h2 className="text-3xl font-bold">{report.totalItems}</h2>
                                  </CardContent>
                                </Card>
                              </div>
                            ) : null}

                            {report?.topProducts?.length === 0 && !isLoading ? (
                              <div className="mt-6 text-center text-muted-foreground">
                                Waiting for first completed payment for this period.
                              </div>
                            ) : report?.topProducts && report.topProducts.length > 0 && !isLoading ? (
                                <div className="mt-6">
                                    <h3 className="text-lg font-semibold mb-2">Top Products</h3>
                                    <div className="space-y-2">
                                        {report.topProducts.map(p => (
                                            <div key={p.name} className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded-md">
                                                <span>{p.name}</span>
                                                <span className="font-bold">{p.count} units</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}

