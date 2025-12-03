
'use client';

// This file holds the source code for the sales report feature.

const actionsContent = `
'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { Timestamp } from 'firebase-admin/firestore';
import { collection, getDocs, where, query } from 'firebase/firestore';
import type { Order, OrderItem, Product, ProductPrice, ProductVariant } from '@/lib/types';


// ... (other server actions)

/**
 * Generates a sales report for a given period, categorized into grocery, meat, and vegetables.
 * @param period Specifies whether to generate a 'daily' or 'monthly' report.
 * @returns A promise that resolves with the sales report or an error.
 */
export async function getSalesReport(period: 'daily' | 'monthly'): Promise<{ success: boolean; report?: any; error?: string; }> {
  const { db } = await getAdminServices();

  const now = new Date();
  let startDate: Date;

  if (period === 'daily') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else { // monthly
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const startTimestamp = Timestamp.fromDate(startDate);

  try {
    // Step 1: Fetch all products from the master 'LocalBasket' store to create a product-to-category map.
    const masterStoreQuery = query(collection(db, 'stores'), where('name', '==', 'LocalBasket'));
    const masterStoreSnap = await getDocs(masterStoreQuery);
    if (masterStoreSnap.empty) throw new Error("Master 'LocalBasket' store not found.");
    const masterStoreId = masterStoreSnap.docs[0].id;
    
    const productsSnapshot = await getDocs(collection(db, 'stores', masterStoreId, 'products'));
    // CORRECTED: Use a case-insensitive map for categories.
    const productCategoryMap = new Map<string, string>();
    productsSnapshot.forEach(doc => {
      productCategoryMap.set(doc.data().name.toLowerCase(), doc.data().category);
    });

    // Step 2: Fetch all 'Delivered' orders within the specified date range.
    const ordersQuery = query(
      collection(db, 'orders'),
      where('status', '==', 'Delivered'),
      where('orderDate', '>=', startTimestamp)
    );
    const orderSnapshot = await getDocs(ordersQuery);
    const deliveredOrders = orderSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));

    // Step 3: Initialize the report structure.
    const report = {
      grocery: { totalSales: 0, itemCount: 0, topProducts: new Map<string, number>() },
      meat: { totalSales: 0, itemCount: 0, topProducts: new Map<string, number>() },
      vegetable: { totalSales: 0, itemCount: 0, topProducts: new Map<string, number>() },
    };

    const meatCategories = ['fresh cut', 'meat & fish'];
    const vegetableCategories = ['vegetables'];
    
    // Step 4: Iterate through each delivered order.
    for (const order of deliveredOrders) {
      // Step 4a: Correctly query the 'orderItems' subcollection for each order.
      const itemsQuery = collection(db, 'orders', order.id, 'orderItems');
      const itemsSnapshot = await getDocs(itemsQuery);
      
      if (itemsSnapshot.empty) continue; // Skip if order has no items.

      const items = itemsSnapshot.docs.map(doc => doc.data() as OrderItem);

      // Step 4b: Process each item in the order.
      for (const item of items) {
        const itemTotal = item.price * item.quantity;
        // CORRECTED: Use case-insensitive lookup for the category.
        const category = productCategoryMap.get(item.productName.toLowerCase())?.toLowerCase() || 'grocery';
        
        let reportCategory: 'grocery' | 'meat' | 'vegetable';

        if (meatCategories.includes(category)) {
          reportCategory = 'meat';
        } else if (vegetableCategories.includes(category)) {
          reportCategory = 'vegetable';
        } else {
          reportCategory = 'grocery';
        }

        // Step 4d: Aggregate the sales data.
        report[reportCategory].totalSales += itemTotal;
        report[reportCategory].itemCount += item.quantity;
        
        const currentQty = report[reportCategory].topProducts.get(item.productName) || 0;
        report[reportCategory].topProducts.set(item.productName, currentQty + item.quantity);
      }
    }

    // Step 5: Format the top products list for the final report.
    const formatTopProducts = (topProducts: Map<string, number>) => {
        return Array.from(topProducts.entries())
          .sort((a, b) => b[1] - a[1]) // Sort by count descending
          .slice(0, 5) // Get top 5
          .map(([name, count]) => ({ name, count }));
    };

    return {
        success: true,
        report: {
            grocery: { ...report.grocery, topProducts: formatTopProducts(report.grocery.topProducts) },
            meat: { ...report.meat, topProducts: formatTopProducts(report.meat.topProducts) },
            vegetable: { ...report.vegetable, topProducts: formatTopProducts(report.vegetable.topProducts) },
        }
    };

  } catch (error: any) {
    console.error("Sales report generation failed:", error);
    return { success: false, error: error.message || 'An unknown server error occurred.' };
  }
}
`;

const pageContent = `
'use client';

import { useEffect, useState, useTransition } from 'react';
import { getSalesReport } from '@/app/actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, TrendingUp, ShoppingCart, Beef, Carrot, Grape, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

type ReportCategory = {
  totalSales: number;
  itemCount: number;
  topProducts: { name: string; count: number }[];
};

type ReportData = {
  grocery: ReportCategory;
  meat: ReportCategory;
  vegetable: ReportCategory;
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

    if (!data) return null;

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
                        <ShoppingCart className="h-5 w-5 text-blue-500" />
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


export default function SalesReportPage() {
    const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
    const router = useRouter();
    const [dailyReport, setDailyReport] = useState<ReportData | null>(null);
    const [monthlyReport, setMonthlyReport] = useState<ReportData | null>(null);
    const [isLoading, startLoading] = useTransition();
    const [activeTab, setActiveTab] = useState<'daily' | 'monthly'>('daily');

    useEffect(() => {
        if (!isAdminLoading && !isAdmin) {
            router.replace('/dashboard');
        }
    }, [isAdmin, isAdminLoading, router]);

    const fetchReports = async () => {
        startLoading(async () => {
            try {
                const [dailyResult, monthlyResult] = await Promise.all([
                    getSalesReport('daily'),
                    getSalesReport('monthly')
                ]);

                if (dailyResult.success) {
                    setDailyReport(dailyResult.report as ReportData);
                } else {
                    console.error("Failed to fetch daily report:", dailyResult.error);
                }

                if (monthlyResult.success) {
                    setMonthlyReport(monthlyResult.report as ReportData);
                } else {
                     console.error("Failed to fetch monthly report:", monthlyResult.error);
                }

            } catch (error) {
                console.error("Error fetching sales reports:", error);
            }
        });
    };

    useEffect(() => {
        fetchReports();
    }, []);
    
    const handleDownload = () => {
        const reportToDownload = activeTab === 'daily' ? dailyReport : monthlyReport;
        if (!reportToDownload) return;

        const headers = ["Category", "Total Sales (INR)", "Items Sold", "Top Product 1", "Top Product 1 Qty", "Top Product 2", "Top Product 2 Qty"];
        let csvContent = headers.join(",") + "\\n";

        Object.entries(reportToDownload).forEach(([categoryName, categoryData]) => {
            const topProducts = categoryData.topProducts.slice(0, 2);
            const row = [
                `"${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)}"`,
                categoryData.totalSales.toFixed(2),
                String(categoryData.itemCount),
                \`"${topProducts[0]?.name || ''}"\`,
                String(topProducts[0]?.count || 0),
                \`"${topProducts[1]?.name || ''}"\`,
                String(topProducts[1]?.count || 0),
            ];
            csvContent += row.join(",") + "\\n";
        });
        
        const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", \`\${activeTab}_sales_report.csv\`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const reportCards = [
        { title: 'Meat', dataKey: 'meat', icon: Beef },
        { title: 'Vegetable', dataKey: 'vegetable', icon: Carrot },
        { title: 'Grocery', dataKey: 'grocery', icon: Grape },
    ] as const;

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                        <div className="flex items-center gap-3">
                            <BarChart3 className="h-8 w-8 text-primary" />
                            <div>
                                <CardTitle className="text-3xl font-headline">Sales Reports</CardTitle>
                                <CardDescription>
                                    An overview of your daily and monthly sales performance.
                                </CardDescription>
                            </div>
                        </div>
                        <Button onClick={handleDownload} variant="outline">
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
                                        data={dailyReport ? dailyReport[card.dataKey] : null}
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
                                        data={monthlyReport ? monthlyReport[card.dataKey] : null}
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
`;


export const salesReportCodeText = [
    {
        path: 'src/app/actions.ts',
        content: actionsContent,
    },
    {
        path: 'src/app/dashboard/admin/sales-report/page.tsx',
        content: pageContent
    }
];

