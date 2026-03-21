'use client';

import { useEffect, useState, useTransition, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, TrendingUp, ShoppingBag, Beef, Carrot, Grape, Download, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useFirebase } from '@/firebase';
import { collection, query, where, Timestamp, getDocs } from 'firebase/firestore';
import type { Order } from '@/lib/types';
import { useAppStore } from '@/lib/store';

type ReportCategory = {
  totalSales: number;
  itemCount: number;
  topProducts: { name: string; count: number }[];
};

function ReportCard({ title, data, icon: Icon, isLoading }: { title: string; data: ReportCategory | null; icon: React.ElementType; isLoading: boolean }) {
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

    if (!data || data.itemCount === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Icon className="h-6 w-6 text-muted-foreground" />
                        {title}
                    </CardTitle>
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
                <CardTitle className="flex items-center gap-2">
                    <Icon className="h-6 w-6 text-primary" />
                    {title}
                </CardTitle>
                <CardDescription>
                    Total sales and item counts for the {title.toLowerCase()} category.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex justify-between items-baseline">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-green-500" />
                        <span className="text-sm text-muted-foreground">Total Sales</span>
                    </div>
                    <p className="text-2xl font-bold">₹{data.totalSales.toFixed(2)}</p>
                </div>
                <div className="flex justify-between items-baseline">
                     <div className="flex items-center gap-2">
                        <ShoppingBag className="h-5 w-5 text-blue-500" />
                        <span className="text-sm text-muted-foreground">Items Sold</span>
                    </div>
                    <p className="text-2xl font-bold">{data.itemCount}</p>
                </div>
                <div>
                    <h4 className="font-semibold text-sm mb-2">Top Selling Products:</h4>
                    {data.topProducts.length > 0 ? (
                         <div className="flex flex-col gap-2">
                            {data.topProducts.map(p => (
                                <div key={p.name} className="flex justify-between items-center text-xs">
                                    <span className="font-medium truncate">{p.name}</span>
                                    <Badge variant="secondary">{p.count} units</Badge>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground">No products sold in this category yet.</p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

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
        const { masterProducts } = useAppStore.getState();
        const productCategoryMap = new Map<string, string>();
        
        if (masterProducts) {
            masterProducts.forEach(p => productCategoryMap.set(p.id, p.category?.toLowerCase() || 'grocery'));
        }

        const ordersQuery = query(
            collection(db, 'orders'),
            where('status', 'in', ['Delivered', 'delivered', 'Completed']),
            where('orderDate', '>=', startTimestamp)
        );
        const orderSnapshot = await getDocs(ordersQuery);
        const deliveredOrders = orderSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));

        const report = {
            grocery: { totalSales: 0, itemCount: 0, topProducts: new Map() },
            meat: { totalSales: 0, itemCount: 0, topProducts: new Map() },
            vegetable: { totalSales: 0, itemCount: 0, topProducts: new Map() },
        };
        const meatCategories = ['fresh cut', 'meat & fish'];
        const vegetableCategories = ['vegetables'];

        for (const order of deliveredOrders) {
            const items = order.items || [];

            for (const item of items) {
                const itemTotal = item.price * item.quantity;
                const category = productCategoryMap.get(item.productId) || 'grocery';
                
                let reportCategory: 'grocery' | 'meat' | 'vegetable';
                if (meatCategories.includes(category)) {
                    reportCategory = 'meat';
                } else if (vegetableCategories.includes(category)) {
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
        };

    } catch (error) {
        console.error("Client-side sales report generation failed:", error);
        return null;
    }
}


export default function SalesReportPage() {
    const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
    const router = useRouter();
    const { firestore } = useFirebase();
    const [dailyReport, setDailyReport] = useState<any | null>(null);
    const [monthlyReport, setMonthlyReport] = useState<any | null>(null);
    const [isLoading, startLoading] = useTransition();
    const [activeTab, setActiveTab] = useState<'daily' | 'monthly'>('daily');

    useEffect(() => {
        if (!isAdminLoading && !isAdmin) {
            router.replace('/dashboard');
        }
    }, [isAdmin, isAdminLoading, router]);

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

        const headers = ["Category", "Total Sales (INR)", "Items Sold", "Top Product 1", "Top Product 1 Qty", "Top Product 2", "Top Product 2 Qty"];
        let csvContent = headers.join(",") + "\n";

        Object.entries(reportToDownload).forEach(([categoryName, categoryData]: [string, any]) => {
            const topProducts = categoryData.topProducts.slice(0, 2);
            const row = [
                `"${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)}"`,
                categoryData.totalSales.toFixed(2),
                String(categoryData.itemCount),
                `"${topProducts[0]?.name || ''}"`,
                String(topProducts[0]?.count || 0),
                `"${topProducts[1]?.name || ''}"`,
                String(topProducts[1]?.count || 0),
            ];
            csvContent += row.join(",") + "\n";
        });
        
        const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${activeTab}_sales_report.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const reportCards = [
        { title: 'Meat', dataKey: 'meat', icon: Beef },
        { title: 'Vegetable', dataKey: 'vegetable', icon: Carrot },
        { title: 'Grocery', dataKey: 'grocery', icon: Grape },
    ] as const;

    if (isAdminLoading) {
      return <div className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto opacity-20" /></div>;
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                        <div className="flex items-center gap-3">
                            <BarChart3 className="h-8 w-8 text-primary" />
                            <div>
                                <CardTitle className="text-3xl font-headline">Admin Sales Reports</CardTitle>
                                <CardDescription>
                                    Platform-wide aggregate sales data.
                                </CardDescription>
                            </div>
                        </div>
                        <Button onClick={handleDownload} variant="outline" disabled={isLoading}>
                            <Download className="mr-2 h-4 w-4" />
                            Download {activeTab === 'daily' ? 'Daily' : 'Monthly'} Report
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="daily" value={activeTab} onValueChange={(value) => setActiveTab(value as 'daily' | 'monthly')} className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="daily">Today's Report</TabsTrigger>
                            <TabsTrigger value="monthly">This Month's Report</TabsTrigger>
                        </TabsList>
                        <TabsContent value="daily" className="mt-6">
                             <div className="grid md:grid-cols-3 gap-6">
                                {reportCards.map(card => (
                                    <ReportCard 
                                        key={card.dataKey}
                                        title={card.title}
                                        data={dailyReport?.[card.dataKey] ?? { totalSales: 0, itemCount: 0, topProducts: [] }}
                                        icon={card.icon}
                                        isLoading={isLoading}
                                    />
                                ))}
                            </div>
                        </TabsContent>
                        <TabsContent value="monthly" className="mt-6">
                           <div className="grid md:grid-cols-3 gap-6">
                                {reportCards.map(card => (
                                    <ReportCard 
                                        key={card.dataKey}
                                        title={card.title}
                                        data={monthlyReport?.[card.dataKey] ?? { totalSales: 0, itemCount: 0, topProducts: [] }}
                                        icon={card.icon}
                                        isLoading={isLoading}
                                    />
                                ))}
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
