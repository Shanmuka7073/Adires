
'use client';

import React, { useEffect, useState, useTransition, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, Download, DollarSign, Receipt, AlertTriangle, List, TrendingUp, TrendingDown, Award, Lightbulb, Search, Sparkles } from 'lucide-react';
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


function SuggestionDetailsDialog({ isOpen, onOpenChange, tableData }: { isOpen: boolean; onOpenChange: (open: boolean) => void; tableData: ReportData['salesByTable'][0] | null }) {
    if (!tableData) return null;

    const TARGET_MARGIN = 0.55;

    // Calculations for Path A: Increase Prices
    const requiredTotalSales = tableData.totalCost / (1 - TARGET_MARGIN);
    const priceIncreaseNeeded = requiredTotalSales - tableData.totalSales;
    const priceIncreasePerOrder = tableData.orderCount > 0 ? priceIncreaseNeeded / tableData.orderCount : 0;

    // Calculations for Path B: Reduce Costs
    const requiredIngredientCost = tableData.totalSales * (1 - TARGET_MARGIN);
    const costReductionNeeded = tableData.totalCost - requiredIngredientCost;
    const costReductionPercent = tableData.totalCost > 0 ? (costReductionNeeded / tableData.totalCost) * 100 : 0;


    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><Lightbulb className="text-amber-500"/> Profit Improvement Suggestions</DialogTitle>
                    <DialogDescription>
                        For Table {tableData.tableNumber}, here's how to increase the profit margin from <strong>{tableData.profitPercentage.toFixed(1)}%</strong> to a healthy <strong>{(TARGET_MARGIN * 100).toFixed(0)}%</strong>.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-4">
                  <div className="space-y-6 py-4">
                      {/* Path A */}
                       <div className="space-y-3 p-4 rounded-lg bg-blue-50 border border-blue-200">
                          <h4 className="text-lg font-semibold text-blue-800">Path A: Increase Selling Price</h4>
                          <p className="text-sm text-blue-700">To reach a 55% margin with your current ingredient cost of <strong>₹{tableData.totalCost.toFixed(2)}</strong>, your total sales for this period would need to be <strong>₹{requiredTotalSales.toFixed(2)}</strong>.</p>
                          <div className="font-mono p-2 bg-blue-100 rounded-md text-xs text-blue-900">
                              Calculation: ₹{tableData.totalCost.toFixed(2)} / (1 - 0.55) = ₹{requiredTotalSales.toFixed(2)}
                          </div>
                          <p className="text-sm text-blue-700">The total increase in sales required is <strong>₹{priceIncreaseNeeded.toFixed(2)}</strong>.</p>
                           <p className="text-sm text-blue-700">Spread across {tableData.orderCount} orders, this means an average price increase of:</p>
                          <p className="text-center font-bold text-2xl text-green-600">~₹{priceIncreasePerOrder.toFixed(2)} per order</p>
                      </div>

                      <Separator />

                      {/* Path B */}
                       <div className="space-y-3 p-4 rounded-lg bg-orange-50 border border-orange-200">
                          <h4 className="text-lg font-semibold text-orange-800">Path B: Reduce Ingredient Costs</h4>
                          <p className="text-sm text-orange-700">To reach a 55% margin from your current sales of <strong>₹{tableData.totalSales.toFixed(2)}</strong>, your total ingredient cost should not exceed <strong>₹{requiredIngredientCost.toFixed(2)}</strong>.</p>
                          <div className="font-mono p-2 bg-orange-100 rounded-md text-xs text-orange-900">
                              Calculation: ₹{tableData.totalSales.toFixed(2)} * (1 - 0.55) = ₹{requiredIngredientCost.toFixed(2)}
                          </div>
                          <p className="text-sm text-orange-700">This means you need to reduce your current costs by <strong>₹{costReductionNeeded.toFixed(2)}</strong>.</p>
                          <p className="text-sm text-orange-700">This represents a total cost reduction of:</p>
                          <p className="text-center font-bold text-2xl text-green-600">~{costReductionPercent.toFixed(1)}%</p>
                      </div>
                  </div>
                </ScrollArea>
                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function GrossProfitDetailsDialog({ isOpen, onOpenChange, report, onSuggestionClick }: { isOpen: boolean, onOpenChange: (open: boolean) => void, report: ReportData | null, onSuggestionClick: (tableData: ReportData['salesByTable'][0]) => void }) {
    if (!report) return null;

    const profit = report.totalSales - report.ingredientCost;
    
    const getProfitColor = (p: number) => p >= 0 ? 'text-green-600' : 'text-red-600';
    
    const getStatusInfo = (p: number): { label: string; className: string; description: string } => {
        if (p >= 55) return { label: 'Healthy', className: 'bg-green-100 text-green-800 border-green-200', description: 'Excellent profit margin.' };
        if (p >= 45) return { label: 'Average', className: 'bg-yellow-100 text-yellow-800 border-yellow-200', description: 'Margin is okay, but can be improved.' };
        return { label: 'Loss Risk', className: 'bg-red-100 text-red-800 border-red-200', description: 'Margin is too low. Action needed.' };
    };

    const getRecommendation = (tableData: ReportData['salesByTable'][0]) => {
        if (tableData.profitPercentage >= 55) return null;
        const targetMargin = 0.55; 
        
        const requiredTotalSales = tableData.totalCost / (1 - targetMargin);
        const priceIncreaseNeeded = requiredTotalSales - tableData.totalSales;
        const priceIncreasePerOrder = tableData.orderCount > 0 ? priceIncreaseNeeded / tableData.orderCount : 0;
        
        const requiredIngredientCost = tableData.totalSales * (1 - targetMargin);
        const costReductionNeeded = tableData.totalCost - requiredIngredientCost;
        const costReductionPercent = tableData.totalCost > 0 ? (costReductionNeeded / tableData.totalCost) * 100 : 0;

        if (priceIncreasePerOrder <= 0 && costReductionPercent <= 0) return null;

        return `Suggestion: Increase dish prices by ~₹${priceIncreasePerOrder.toFixed(0)}/order OR reduce ingredient costs by ${costReductionPercent.toFixed(0)}%.`;
    };

    const sortedByProfit = report.salesByTable?.slice().sort((a,b) => b.profitPercentage - a.profitPercentage);
    const bestTable = sortedByProfit?.[0];
    const worstTable = sortedByProfit?.[sortedByProfit.length - 1];

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Gross Profit Calculation Breakdown</DialogTitle>
                    <DialogDescription>
                        Here's how your gross profit is calculated for this period, broken down by table.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                     <div className="grid grid-cols-3 gap-4 text-center">
                        <Card><CardHeader><CardTitle>₹{report.totalSales.toFixed(2)}</CardTitle><CardDescription>Total Sales</CardDescription></CardHeader></Card>
                        <Card><CardHeader><CardTitle className="text-red-600">₹{report.ingredientCost.toFixed(2)}</CardTitle><CardDescription>Ingredient Cost</CardDescription></CardHeader></Card>
                        <Card className="bg-primary/5 border-primary/20"><CardHeader><CardTitle className={cn("font-extrabold", getProfitColor(profit))}>₹{profit.toFixed(2)}</CardTitle><CardDescription>Gross Profit</CardDescription></CardHeader></Card>
                    </div>
                    {bestTable && worstTable && bestTable.tableNumber !== worstTable.tableNumber && (
                        <div className="grid grid-cols-2 gap-4">
                             <Alert className="bg-green-50 border-green-200">
                                <Award className="h-4 w-4 text-green-600" />
                                <AlertTitle className="text-green-800">Best Performer</AlertTitle>
                                <AlertDescription className="text-green-700">
                                    Table {bestTable.tableNumber} is your most profitable table with a <strong>{bestTable.profitPercentage.toFixed(1)}%</strong> margin.
                                </AlertDescription>
                            </Alert>
                             <Alert className="bg-red-50 border-red-200">
                                <TrendingDown className="h-4 w-4 text-red-600" />
                                <AlertTitle className="text-red-800">Needs Attention</AlertTitle>
                                <AlertDescription className="text-red-700">
                                    Table {worstTable.tableNumber} has the lowest margin at <strong>{worstTable.profitPercentage.toFixed(1)}%</strong>.
                                </AlertDescription>
                            </Alert>
                        </div>
                    )}

                    {report.salesByTable && report.salesByTable.length > 0 && (
                        <div className="pt-4 mt-4 border-t">
                            <h4 className="font-semibold mb-2">Profitability by Table</h4>
                            <ScrollArea className="max-h-60">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Table</TableHead>
                                            <TableHead>Profit %</TableHead>
                                            <TableHead className="text-right">Sales</TableHead>
                                            <TableHead className="text-right">Cost</TableHead>
                                            <TableHead className="text-right">Profit</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {report.salesByTable.map(tableData => {
                                            const status = getStatusInfo(tableData.profitPercentage);
                                            const recommendation = getRecommendation(tableData);
                                            return (
                                                <React.Fragment key={tableData.tableNumber}>
                                                    <TableRow>
                                                        <TableCell className="font-medium">Table {tableData.tableNumber}</TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <span className={cn("font-bold", getProfitColor(tableData.profitPercentage))}>{tableData.profitPercentage.toFixed(1)}%</span>
                                                                <Badge className={cn("text-xs", status.className)}>{status.label}</Badge>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono">₹{tableData.totalSales.toFixed(2)}</TableCell>
                                                        <TableCell className="text-right font-mono text-red-600">₹{tableData.totalCost.toFixed(2)}</TableCell>
                                                        <TableCell className={cn("text-right font-mono font-bold", getProfitColor(tableData.grossProfit))}>
                                                            ₹{tableData.grossProfit.toFixed(2)}
                                                        </TableCell>
                                                    </TableRow>
                                                    {recommendation && (
                                                        <TableRow>
                                                            <TableCell colSpan={5} className="py-2 px-4 bg-amber-50 border-l-4 border-amber-400">
                                                                <button onClick={() => onSuggestionClick(tableData)} className="text-xs text-amber-900 font-medium hover:underline text-left">
                                                                    {recommendation}
                                                                </button>
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
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

function ProfitPerOrderDetailsDialog({ isOpen, onOpenChange, report }: { isOpen: boolean, onOpenChange: (open: boolean) => void, report: ReportData | null }) {
    if (!report || report.totalOrders === 0) return null;

    const profit = report.totalSales - report.ingredientCost;
    const profitPerOrder = profit / report.totalOrders;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Profit Per Order Calculation</DialogTitle>
                    <DialogDescription>
                        This is the average profit you make on each order, broken down by table.
                    </DialogDescription>
                </DialogHeader>
                 <div className="py-4 space-y-4">
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

function CostDetailsDialog({ isOpen, onOpenChange, report }: { isOpen: boolean, onOpenChange: (open: boolean) => void, report: ReportData | null }) {
    if (!report) return null;

    const topDrivers = report.costDrivers.slice(0, 3);
    const otherCost = report.ingredientCost - topDrivers.reduce((acc, d) => acc + d.cost, 0);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Ingredient Cost Breakdown</DialogTitle>
                    <DialogDescription>
                        A complete list of all ingredients consumed and their total cost for this period.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    {report.costDrivers.length > 0 && (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                             <h4 className="font-semibold mb-2 flex items-center gap-2 text-amber-900"><Search className="h-4 w-4"/> Top Cost Drivers</h4>
                            <div className="space-y-2">
                                {topDrivers.map(driver => (
                                    <div key={driver.name} className="flex justify-between items-center text-sm">
                                        <span className="font-medium capitalize">{driver.name}</span>
                                        <Badge variant="destructive" className="bg-red-100 text-red-800">{driver.percentage.toFixed(1)}%</Badge>
                                    </div>
                                ))}
                                {otherCost > 0 && (
                                     <div className="flex justify-between items-center text-sm">
                                        <span className="font-medium">Other Items</span>
                                        <Badge variant="secondary">{(100 - topDrivers.reduce((acc, d) => acc + d.percentage, 0)).toFixed(1)}%</Badge>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    <ScrollArea className="max-h-[40vh] pr-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Ingredient</TableHead>
                                    <TableHead className="text-right">Cost</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {report.ingredientUsage.sort((a,b) => b.cost - a.cost).map(ing => (
                                    <TableRow key={ing.name}>
                                        <TableCell className="font-medium capitalize">{ing.name}</TableCell>
                                        <TableCell className="text-right font-mono">₹{ing.cost.toFixed(2)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>

                     {report.optimizationHint && (
                        <Alert className="mt-4 bg-blue-50 border-blue-200">
                             <Lightbulb className="h-4 w-4 text-blue-600" />
                            <AlertTitle className="text-blue-800">Optimization Hint</AlertTitle>
                            <AlertDescription className="text-blue-700">
                                {report.optimizationHint}
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
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
                                        <TableHead className="text-right">Sales (# Orders)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {report.salesByTable.sort((a,b) => b.totalSales - a.totalSales).map(tableData => (
                                        <TableRow key={tableData.tableNumber}>
                                            <TableCell className="font-medium">Table {tableData.tableNumber}</TableCell>
                                            <TableCell className="text-right font-mono">₹{tableData.totalSales.toFixed(2)} ({tableData.orderCount})</TableCell>
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

function ProfitableDishesDialog({ isOpen, onOpenChange, report }: { isOpen: boolean, onOpenChange: (open: boolean) => void, report: ReportData | null }) {
    if (!report) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Highest Profit Dishes Breakdown</DialogTitle>
                    <DialogDescription>
                        Menu items ranked by their total contribution to your gross profit.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Dish Name</TableHead>
                                <TableHead className="text-right">Units Sold</TableHead>
                                <TableHead className="text-right">Profit / Unit</TableHead>
                                <TableHead className="text-right">Total Profit</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {report.topProfitableProducts.map(product => (
                                <TableRow key={product.name}>
                                    <TableCell className="font-medium capitalize">{product.name}</TableCell>
                                    <TableCell className="text-right">{product.count}</TableCell>
                                    <TableCell className="text-right font-mono text-green-600">₹{product.profitPerUnit.toFixed(2)}</TableCell>
                                    <TableCell className="text-right font-mono font-bold text-green-700">₹{product.totalProfit.toFixed(2)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <p className="text-xs text-muted-foreground mt-4 italic">
                        * Profit is calculated as (Selling Price - Recorded Ingredient Costs) × Units Sold.
                    </p>
                </div>
                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
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
    
    // --- DIALOG STATES ---
    const [isGrossProfitDialogOpen, setIsGrossProfitDialogOpen] = useState(false);
    const [isCostDialogOpen, setIsCostDialogOpen] = useState(false);
    const [isSalesDialogOpen, setIsSalesDialogOpen] = useState(false);
    const [isProfitPerOrderDialogOpen, setIsProfitPerOrderDialogOpen] = useState(false);
    const [isProfitableDishesDialogOpen, setIsProfitableDishesDialogOpen] = useState(false);
    const [isSuggestionDialogOpen, setIsSuggestionDialogOpen] = useState(false);
    const [selectedTableForSuggestion, setSelectedTableForSuggestion] = useState<ReportData['salesByTable'][0] | null>(null);


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

    const handleSuggestionClick = (tableData: ReportData['salesByTable'][0]) => {
        setSelectedTableForSuggestion(tableData);
        setIsSuggestionDialogOpen(true);
    }
    
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
            <GrossProfitDetailsDialog isOpen={isGrossProfitDialogOpen} onOpenChange={setIsGrossProfitDialogOpen} report={report} onSuggestionClick={handleSuggestionClick} />
            <CostDetailsDialog isOpen={isCostDialogOpen} onOpenChange={setIsCostDialogOpen} report={report} />
            <SalesDetailsDialog isOpen={isSalesDialogOpen} onOpenChange={setIsSalesDialogOpen} report={report} />
            <ProfitPerOrderDetailsDialog isOpen={isProfitPerOrderDialogOpen} onOpenChange={setIsProfitPerOrderDialogOpen} report={report} />
            <ProfitableDishesDialog isOpen={isProfitableDishesDialogOpen} onOpenChange={setIsProfitableDishesDialogOpen} report={report} />
            <SuggestionDetailsDialog isOpen={isSuggestionDialogOpen} onOpenChange={setIsSuggestionDialogOpen} tableData={selectedTableForSuggestion} />

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
                                      <StatCard title="Gross Profit" value={`₹${profit.toFixed(0)}`} valueClassName={profitColor} highlight={profit > 0} onClick={() => setIsGrossProfitDialogOpen(true)} />
                                      <StatCard title="Profit Per Order" value={`₹${profitPerOrder.toFixed(0)}`} valueClassName={profitPerOrder > 0 ? 'text-gray-800' : 'text-red-600'} onClick={() => setIsProfitPerOrderDialogOpen(true)} />
                                      <StatCard title="Total Sales" value={`₹${report.totalSales.toFixed(0)}`} onClick={() => setIsSalesDialogOpen(true)} />
                                      <StatCard title="Ingredient Cost" value={`₹${report.ingredientCost.toFixed(0)}`} valueClassName="text-red-600" onClick={() => setIsCostDialogOpen(true)} />
                                      <StatCard title="Total Orders" value={report.totalOrders} />
                                    </div>
                                    
                                    <div className="grid md:grid-cols-2 gap-8">
                                      <div className="space-y-6">
                                        <div onClick={() => setIsProfitableDishesDialogOpen(true)} className="cursor-pointer">
                                            <h3 className="text-xl font-semibold mb-3 flex items-center gap-2 text-primary"><Sparkles className="h-5 w-5"/> Highest Profit Dishes</h3>
                                            {report.topProfitableProducts.length > 0 ? (
                                                <div className="space-y-2">
                                                    {report.topProfitableProducts.map(p => (
                                                        <div key={p.name} className="flex justify-between items-center text-sm p-3 bg-green-50 border border-green-100 rounded-lg">
                                                            <span className="capitalize font-medium">{p.name}</span>
                                                            <div className="text-right">
                                                                <p className="font-bold text-green-700">₹{p.totalProfit.toFixed(2)}</p>
                                                                <p className="text-[10px] text-green-600">₹{p.profitPerUnit.toFixed(2)} / unit</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <p className="text-xs text-center text-muted-foreground mt-2">Click to see all {report.topProfitableProducts.length} profitable items.</p>
                                                </div>
                                            ) : <p className="text-muted-foreground">No data available for dish profitability.</p>}
                                        </div>

                                        <Separator />

                                        <div>
                                            <h3 className="text-xl font-semibold mb-3 flex items-center gap-2 text-primary"><List className="h-5 w-5"/> Most Sold (Volume)</h3>
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
                                      </div>

                                      <div onClick={() => setIsCostDialogOpen(true)} className="cursor-pointer">
                                        <h3 className="text-xl font-semibold mb-3 flex items-center gap-2 text-primary"><Receipt className="h-5 w-5"/> Ingredient Consumption</h3>
                                        {report.ingredientUsage.length > 0 ? (
                                          <div className="space-y-2">
                                            {report.ingredientUsage.slice(0, 5).map(i => (
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
                                            {report.ingredientUsage.length > 5 && <p className="text-xs text-center text-muted-foreground mt-2">Click to see all {report.ingredientUsage.length} ingredients.</p>}
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
