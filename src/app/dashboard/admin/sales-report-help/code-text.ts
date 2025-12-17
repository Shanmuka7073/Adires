
'use client';

// This file holds the source code for the sales report feature.

const actionsContent = `
'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { Timestamp } from 'firebase-admin/firestore';
import type { Order, OrderItem, Product, ProductPrice, ProductVariant, RestaurantIngredient } from '@/lib/types';


/**
 * Converts a quantity and unit into a base unit (grams or ml).
 * Handles kg, g, l, ml, and pcs.
 * @param quantity The numeric quantity.
 * @param unit The string unit (e.g., "kg", "g", "pc").
 * @returns The quantity in the base unit (grams or ml), or as-is for pieces.
 */
const convertToBaseUnit = (quantity: number, unit: string): number => {
    const u = unit?.toLowerCase() || '';
    if (u === 'kg' || u === 'l' || u === 'litre') return quantity * 1000;
    if (u === 'g' || u === 'gm' || u === 'ml') return quantity;
    // For 'pcs' or other units, we treat them as a base unit of 1 for aggregation
    return quantity;
};

/**
 * Generates a detailed sales and profit report for a given store over a specified period.
 * @param storeId The ID of the store to generate the report for.
 * @param period The time period for the report ('daily', 'weekly', 'monthly').
 * @returns An object containing the report data or an error message.
 */
export async function getStoreSalesReport({
  storeId,
  period,
}: {
  storeId: string;
  period: 'daily' | 'weekly' | 'monthly';
}) {
  const { db } = await getAdminServices();

  if (!storeId) {
    return { success: false, error: 'Store ID is required' };
  }

  // Determine the start date based on the period
  const now = new Date();
  let startDate: Date;
  if (period === 'daily') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === 'weekly') {
    const firstDayOfWeek = now.getDate() - now.getDay();
    startDate = new Date(now.setDate(firstDayOfWeek));
    startDate.setHours(0, 0, 0, 0);
  } else { // monthly
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  const startTimestamp = Timestamp.fromDate(startDate);

  try {
    // Fetch all necessary data in parallel
    const [ordersSnapshot, ingredientsSnapshot] = await Promise.all([
        db.collection('orders')
          .where('storeId', '==', storeId)
          .where('status', 'in', ['Completed', 'Billed'])
          .where('orderDate', '>=', startTimestamp)
          .get(),
        db.collection('restaurantIngredients').get()
    ]);
    
    const validOrders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
    
    // Create a lookup map for ingredient costs
    const masterIngredientCosts = new Map<string, RestaurantIngredient>();
    ingredientsSnapshot.forEach(doc => {
      const data = doc.data() as RestaurantIngredient;
      masterIngredientCosts.set(doc.id, data); // doc.id is the lower-case ingredient name
    });

    if (validOrders.length === 0) {
      return {
        success: true,
        report: { totalSales: 0, totalOrders: 0, totalItems: 0, topProducts: [], ingredientUsage: [], ingredientCost: 0 },
      };
    }

    let totalSales = 0;
    let totalIngredientCost = 0;
    const productMap = new Map<string, number>();
    const ingredientUsageMap = new Map<string, { quantity: number; unit: string; cost: number }>();

    for (const order of validOrders) {
      totalSales += order.totalAmount;
      
      for (const item of order.items || []) {
        // Track top selling products
        const productKey = item.productName.toLowerCase().trim();
        productMap.set(productKey, (productMap.get(productKey) || 0) + item.quantity);

        let itemCost = 0;
        
        // Calculate cost from ingredients if snapshot exists
        for (const ing of item.recipeSnapshot || []) {
           if (!ing.name || typeof ing.qty !== 'number' || !ing.unit) continue;

           const masterIngredient = masterIngredientCosts.get(ing.name.toLowerCase());
           if (!masterIngredient) continue; // Skip if we don't know the cost

           // Normalize master cost to cost per base unit (g or ml)
           const masterBaseQty = convertToBaseUnit(1, masterIngredient.unit);
           const costPerBaseUnit = masterIngredient.cost / masterBaseQty;

           // Normalize recipe ingredient quantity to base unit
           const consumedBaseQty = convertToBaseUnit(ing.qty, ing.unit);
           const consumedCost = consumedBaseQty * costPerBaseUnit * item.quantity;
           
           itemCost += consumedCost;

           // Aggregate ingredient usage and cost
           const prevUsage = ingredientUsageMap.get(ing.name) || { quantity: 0, cost: 0, unit: masterIngredient.unit === 'kg' ? 'g' : masterIngredient.unit };
           ingredientUsageMap.set(ing.name, {
             quantity: prevUsage.quantity + (consumedBaseQty * item.quantity),
             cost: prevUsage.cost + consumedCost,
             unit: prevUsage.unit,
           });
        }
        totalIngredientCost += itemCost;
      }
    }

    const formatAggregatedQuantity = (quantity: number, unit: string) => {
        if ((unit === 'g' || unit === 'gm') && quantity >= 1000) {
            return { quantity: quantity / 1000, unit: 'kg' };
        }
        if (unit === 'ml' && quantity >= 1000) {
            return { quantity: quantity / 1000, unit: 'l' };
        }
        return { quantity, unit };
    };

    return {
      success: true,
      report: {
        totalSales,
        totalOrders: validOrders.length,
        totalItems: Array.from(productMap.values()).reduce((a, b) => a + b, 0),
        topProducts: [...productMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ name, count })),
        ingredientUsage: [...ingredientUsageMap.entries()].map(([name, data]) => {
            const formatted = formatAggregatedQuantity(data.quantity, data.unit);
            return { name, ...formatted, cost: data.cost };
        }),
        ingredientCost: totalIngredientCost,
      },
      error: null,
    };
  } catch (error: any) {
    console.error("Server-side sales report generation failed:", error);
    return { success: false, error: error.message };
  }
}
`;

const pageContent = `
'use client';

import { useEffect, useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, Download, DollarSign, Package, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Store } from '@/lib/types';
import { getStoreSalesReport } from '@/app/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type ReportData = {
  totalSales: number;
  totalItems: number;
  totalOrders: number;
  topProducts: { name: string; count: number }[];
  ingredientUsage: { name: string; quantity: number, unit: string, cost: number }[];
  ingredientCost: number;
};

function StatCard({ title, value, highlight = false }: { title: string, value: string | number, highlight?: boolean }) {
  return (
    <Card className={highlight ? 'border-green-500 bg-green-50' : 'bg-slate-50'}>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{title}</p>
        <h2 className="text-2xl font-bold mt-1">{value}</h2>
      </CardContent>
    </Card>
  );
}

export default function SalesReportPage() {
    const { user, firestore } = useFirebase();
    const [report, setReport] = useState<ReportData | null>(null);
    const [error, setError] = useState<string | null>(null);
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
                setError(null);
                const result = await getStoreSalesReport({ storeId: myStore.id, period: activeTab });
                if (result.success && result.report) {
                    setReport(result.report as ReportData);
                } else {
                    console.error("Failed to fetch sales report:", result.error);
                    setError(result.error || 'An unknown error occurred while fetching the report.');
                    setReport(null);
                }
            });
        }
    }, [myStore, activeTab]);
    
    const handleDownload = () => {
        if (!report) return;

        const headers = ["Product Name", "Quantity Sold"];
        let csvContent = headers.join(",") + "\\n";
        
        report.topProducts.forEach(p => {
             csvContent += \`"\${p.name}",\${p.count}\\n\`;
        });

        const summary = \`Total Sales,\${report.totalSales.toFixed(2)}\\nTotal Items,\${report.totalItems}\\n\`;
        csvContent = \`Period,\${activeTab}\\n\${summary}\\n\${csvContent}\`;
        
        const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", \`\${myStore?.name}_\${activeTab}_sales_report.csv\`);
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
                                <CardTitle className="text-3xl font-headline">Sales & Profit Report</CardTitle>
                                <CardDescription>
                                    An overview of your sales, costs, and profitability.
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
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                                    <Skeleton className="h-24" />
                                    <Skeleton className="h-24" />
                                    <Skeleton className="h-24" />
                                    <Skeleton className="h-24" />
                                </div>
                            ) : error ? (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>Error Loading Report</AlertTitle>
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            ) : report && report.totalOrders > 0 ? (
                                <div className="space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                      <StatCard title="Total Sales" value={\`₹\${report.totalSales.toFixed(0)}\`} />
                                      <StatCard title="Ingredient Cost" value={\`₹\${report.ingredientCost.toFixed(0)}\`} />
                                      <StatCard title="Gross Profit" value={\`₹\${(report.totalSales - report.ingredientCost).toFixed(0)}\`} highlight={true} />
                                      <StatCard title="Total Orders" value={report.totalOrders} />
                                    </div>
                                    
                                    <div className="grid md:grid-cols-2 gap-8">
                                      <div>
                                        <h3 className="text-xl font-semibold mb-3">Top Products</h3>
                                        {report.topProducts.length > 0 ? (
                                            <div className="space-y-2">
                                                {report.topProducts.map(p => (
                                                    <div key={p.name} className="flex justify-between items-center text-sm p-3 bg-slate-50 rounded-lg">
                                                        <span className="capitalize font-medium">{p.name}</span>
                                                        <span className="font-bold">{p.count} units</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : <p className="text-muted-foreground">No products sold in this period.</p>}
                                      </div>
                                      <div>
                                        <h3 className="text-xl font-semibold mb-3">Ingredient Consumption</h3>
                                        {report.ingredientUsage.length > 0 ? (
                                          <div className="space-y-2">
                                            {report.ingredientUsage.map(i => (
                                              <div
                                                key={i.name}
                                                className="flex justify-between bg-slate-50 p-3 rounded-lg"
                                              >
                                                <span className="capitalize font-medium">{i.name}</span>
                                                <div className="text-right">
                                                    <p className="font-mono font-semibold">
                                                    {i.quantity.toFixed(2)} {i.unit}
                                                    </p>
                                                     <p className="text-xs text-red-600 font-semibold">
                                                        (Cost: ₹{i.cost.toFixed(2)})
                                                     </p>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-muted-foreground">
                                            No ingredient consumption data for this period.
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-6 text-center text-muted-foreground py-8">
                                    <p>No sales data for this period yet.</p>
                                </div>
                            )}
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
        path: 'src/app/dashboard/owner/sales-report/page.tsx',
        content: pageContent
    }
];

