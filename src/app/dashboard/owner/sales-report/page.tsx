
'use client';

import { useEffect, useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, Download, DollarSign, Receipt, AlertTriangle, List, Minus, Equal } from 'lucide-react';
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

// New Dialog Component for Gross Profit Breakdown
function GrossProfitDetailsDialog({ isOpen, onOpenChange, report }: { isOpen: boolean, onOpenChange: (open: boolean) => void, report: ReportData | null }) {
    if (!report) return null;

    const profit = report.totalSales - report.ingredientCost;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Gross Profit Calculation</DialogTitle>
                    <DialogDescription>
                        Here's how your gross profit is calculated for this period, broken down by table.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="flex justify-between items-center text-lg p-3 bg-gray-50 rounded-md">
                        <span className="text-muted-foreground">Total Sales</span>
                        <span className="font-semibold">₹{report.totalSales.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-center">
                        <Minus className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex justify-between items-center text-lg p-3 bg-gray-50 rounded-md">
                        <span className="text-muted-foreground">Ingredient Cost</span>
                        <span className="font-semibold text-red-600">₹{report.ingredientCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-center">
                        <Equal className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex justify-between items-center text-xl p-3 bg-primary/10 rounded-md">
                        <span className="font-extrabold text-primary">Gross Profit</span>
                        <span className="font-extrabold text-primary">₹{profit.toFixed(2)}</span>
                    </div>
                    
                    {report.salesByTable && report.salesByTable.length > 0 && (
                        <div className="pt-4 mt-4 border-t">
                            <h4 className="font-semibold mb-2">Gross Profit by Table</h4>
                            <ScrollArea className="max-h-60">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Table</TableHead>
                                            <TableHead className="text-right">Sales</TableHead>
                                            <TableHead className="text-right">Cost</TableHead>
                                            <TableHead className="text-right">Profit</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {report.salesByTable.map(tableData => (
                                            <TableRow key={tableData.tableNumber}>
                                                <TableCell className="font-medium">Table {tableData.tableNumber}</TableCell>
                                                <TableCell className="text-right font-mono">₹{tableData.totalSales.toFixed(2)}</TableCell>
                                                <TableCell className="text-right font-mono text-red-600">₹{tableData.totalCost.toFixed(2)}</TableCell>
                                                <TableCell className={cn("text-right font-mono font-bold", tableData.grossProfit >= 0 ? "text-green-600" : "text-red-600")}>
                                                    ₹{tableData.grossProfit.toFixed(2)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// New Dialog Component for Profit Per Order Breakdown
function ProfitPerOrderDetailsDialog({ isOpen, onOpenChange, report }: { isOpen: boolean, onOpenChange: (open: boolean) => void, report: ReportData | null }) {
    if (!report || report.totalOrders === 0) return null;

    const profit = report.totalSales - report.ingredientCost;
    const profitPerOrder = profit / report.totalOrders;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Profit Per Order Calculation</DialogTitle>
                    <DialogDescription>
                        This is the average profit you make on each order, broken down by table.
                    </DialogDescription>
                </DialogHeader>
                 <div className="space-y-4 py-4">
                     <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                             <p className="text-sm text-muted-foreground">Gross Profit</p>
                             <p className="font-bold text-lg">₹{profit.toFixed(2)}</p>
                        </div>
                         <div>
                             <p className="text-sm text-muted-foreground">Total Orders</p>
                             <p className="font-bold text-lg">{report.totalOrders}</p>
                        </div>
                    </div>
                     <div className="flex justify-between items-center text-xl p-3 bg-primary/10 rounded-md">
                        <span className="font-extrabold text-primary">Average Profit Per Order</span>
                        <span className="font-extrabold text-primary">₹{profitPerOrder.toFixed(2)}</span>
                    </div>
                     {report.salesByTable && report.salesByTable.length > 0 && (
                        <div className="pt-4">
                            <h4 className="font-semibold mb-2">Profit Breakdown by Table</h4>
                            <ScrollArea className="max-h-60">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Table</TableHead>
                                            <TableHead className="text-right">Profit Per Order</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {report.salesByTable.map(tableData => (
                                            <TableRow key={tableData.tableNumber}>
                                                <TableCell className="font-medium">Table {tableData.tableNumber}</TableCell>
                                                <TableCell className={cn("text-right font-mono", tableData.profitPerOrder >= 0 ? "text-green-600" : "text-red-600")}>
                                                    ₹{tableData.profitPerOrder.toFixed(2)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// New Dialog Component for Ingredient Cost Breakdown
function CostDetailsDialog({ isOpen, onOpenChange, report }: { isOpen: boolean, onOpenChange: (open: boolean) => void, report: ReportData | null }) {
    if (!report) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Ingredient Cost Breakdown</DialogTitle>
                    <DialogDescription>
                        A complete list of all ingredients consumed and their total cost for this period.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[50vh] pr-4">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Ingredient</TableHead>
                                <TableHead className="text-right">Cost</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {report.ingredientUsage.map(ing => (
                                <TableRow key={ing.name}>
                                    <TableCell className="font-medium capitalize">{ing.name}</TableCell>
                                    <TableCell className="text-right font-mono">₹{ing.cost.toFixed(2)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
                <DialogFooter className="border-t pt-4">
                    <div className="w-full flex justify-between items-center text-lg font-bold text-red-600">
                        <span>Total Ingredient Cost</span>
                        <span>₹{report.ingredientCost.toFixed(2)}</span>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// New Dialog Component for Total Sales
function SalesDetailsDialog({ isOpen, onOpenChange, report }: { isOpen: boolean, onOpenChange: (open: boolean) => void, report: ReportData | null }) {
    if (!report) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Total Sales Breakdown</DialogTitle>
                    <DialogDescription>
                        The total revenue generated from completed orders in this period, broken down by table.
                    </DialogDescription>
                </DialogHeader>
                 <div className="py-4 space-y-4">
                    <div className="text-center pb-4 border-b">
                        <p className="text-sm text-muted-foreground">Total Revenue</p>
                        <p className="text-5xl font-extrabold">₹{report.totalSales.toFixed(2)}</p>
                        <p className="text-muted-foreground mt-2">from {report.totalOrders} orders</p>
                    </div>
                    {report.salesByTable && report.salesByTable.length > 0 && (
                        <div className="max-h-60 overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Table</TableHead>
                                        <TableHead className="text-right">Sales</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {report.salesByTable.sort((a,b) => b.totalSales - a.totalSales).map(tableData => (
                                        <TableRow key={tableData.tableNumber}>
                                            <TableCell className="font-medium">Table {tableData.tableNumber} ({tableData.orderCount} orders)</TableCell>
                                            <TableCell className="text-right font-mono">₹{tableData.totalSales.toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


function StatCard({ title, value, highlight = false, description, valueClassName, onClick }: { title: string, value: string | number, highlight?: boolean, description?: string, valueClassName?: string, onClick?: () => void }) {
  return (
    <Card 
        onClick={onClick}
        className={cn(
            highlight ? 'border-green-500 bg-green-50' : 'bg-slate-50',
            onClick ? 'cursor-pointer hover:shadow-md hover:border-gray-300 transition-all' : ''
        )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <h2 className={cn("text-3xl font-bold", valueClassName)}>{value}</h2>
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
    const [isProfitDialogOpen, setIsProfitDialogOpen] = useState(false);
    const [isCostDialogOpen, setIsCostDialogOpen] = useState(false);
    const [isSalesDialogOpen, setIsSalesDialogOpen] = useState(false);
    const [isProfitPerOrderDialogOpen, setIsProfitPerOrderDialogOpen] = useState(false);


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
    
    const profit = report ? report.totalSales - report.ingredientCost : 0;
    const profitColor = profit >= 0 ? 'text-green-600' : 'text-red-600';
    const profitPerOrder = report && report.totalOrders > 0 ? profit / report.totalOrders : 0;
    
    if (storeLoading) {
        return <div className="container mx-auto py-12"><p>Loading store information...</p></div>
    }

    if (!myStore) {
        return <div className="container mx-auto py-12"><p>You must have a store to view sales reports.</p></div>
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <GrossProfitDetailsDialog isOpen={isProfitDialogOpen} onOpenChange={setIsProfitDialogOpen} report={report} />
            <CostDetailsDialog isOpen={isCostDialogOpen} onOpenChange={setIsCostDialogOpen} report={report} />
            <SalesDetailsDialog isOpen={isSalesDialogOpen} onOpenChange={setIsSalesDialogOpen} report={report} />
            <ProfitPerOrderDetailsDialog isOpen={isProfitPerOrderDialogOpen} onOpenChange={setIsProfitPerOrderDialogOpen} report={report} />

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
                            <TabsTrigger value="daily">Today</TabsTrigger>
                            <TabsTrigger value="weekly">This Week</TabsTrigger>
                            <TabsTrigger value="monthly">This Month</TabsTrigger>
                        </TabsList>
                        <TabsContent value={activeTab} className="mt-6">
                            {isLoading ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
                                    <Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" />
                                </div>
                            ) : error ? (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>Error Loading Report</AlertTitle>
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            ) : report && report.totalOrders > 0 ? (
                                <div className="space-y-8">
                                    {profit < 0 && (
                                        <Alert variant="destructive">
                                            <AlertTriangle className="h-4 w-4" />
                                            <AlertTitle>Loss Alert</AlertTitle>
                                            <AlertDescription>
                                            Your ingredient cost is higher than sales. Consider increasing prices or reviewing portion sizes.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                                      <StatCard title="Gross Profit" value={`₹${profit.toFixed(0)}`} valueClassName={profitColor} highlight={profit > 0} onClick={() => setIsProfitDialogOpen(true)} />
                                      <StatCard title="Profit Per Order" value={`₹${profitPerOrder.toFixed(0)}`} valueClassName={profitPerOrder > 0 ? 'text-gray-800' : 'text-red-600'} onClick={() => setIsProfitPerOrderDialogOpen(true)} />
                                      <StatCard title="Ingredient Cost" value={`₹${report.ingredientCost.toFixed(0)}`} valueClassName="text-red-600" onClick={() => setIsCostDialogOpen(true)} />
                                      <StatCard title="Total Sales" value={`₹${report.totalSales.toFixed(0)}`} onClick={() => setIsSalesDialogOpen(true)} />
                                      <StatCard title="Total Orders" value={report.totalOrders} />
                                    </div>
                                    
                                    <div className="grid md:grid-cols-2 gap-8">
                                      <div>
                                        <h3 className="text-xl font-semibold mb-3 flex items-center gap-2"><List className="h-5 w-5 text-primary"/> Top Products</h3>
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
                                      <div onClick={() => setIsCostDialogOpen(true)} className="cursor-pointer">
                                        <h3 className="text-xl font-semibold mb-3 flex items-center gap-2"><Receipt className="h-5 w-5 text-primary"/> Ingredient Consumption</h3>
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
