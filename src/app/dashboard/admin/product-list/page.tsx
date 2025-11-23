
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import groceryData from '@/lib/grocery-data.json';
import { useMemo } from 'react';

// This is now a client component and reads from the imported JSON.
export default function ProductListPage() {
    const productCategories = useMemo(() => groceryData.categories, []);
    const totalProducts = productCategories.reduce((sum, cat) => sum + cat.items.length, 0);

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-3xl font-headline">Master Product List</CardTitle>
                    <CardDescription>
                        A complete inventory of all {totalProducts} products available on the platform, organized by category.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {productCategories.length > 0 ? (
                        <Accordion type="multiple" className="w-full">
                            {productCategories.map(category => (
                                <AccordionItem value={category.categoryName} key={category.categoryName}>
                                    <AccordionTrigger className="text-xl font-semibold">
                                        {category.categoryName} ({category.items.length})
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <ul className="list-disc pl-5 grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2 text-muted-foreground">
                                            {category.items.map(item => (
                                                <li key={item}>{item}</li>
                                            ))}
                                        </ul>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    ) : (
                        <p className="text-muted-foreground">Could not load the product list.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
