'use client';

import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Store, Menu, MenuItem } from '@/lib/types';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Utensils } from 'lucide-react';
import { useMemo } from 'react';
import Image from 'next/image';

export default function PublicMenuPage() {
    const params = useParams();
    const storeId = params.storeId as string;
    const { firestore } = useFirebase();

    const storeQuery = useMemoFirebase(() => {
        if (!firestore || !storeId) return null;
        return query(collection(firestore, 'stores'), where('__name__', '==', storeId));
    }, [firestore, storeId]);

    const menuQuery = useMemoFirebase(() => {
        if (!firestore || !storeId) return null;
        return query(collection(firestore, `stores/${storeId}/menus`));
    }, [firestore, storeId]);
    
    const { data: stores, isLoading: storeLoading } = useCollection<Store>(storeQuery);
    const { data: menus, isLoading: menuLoading } = useCollection<Menu>(menuQuery);

    const store = stores?.[0];
    const menu = menus?.[0];

    const menuByCategory = useMemo(() => {
        if (!menu?.items) return {};
        return menu.items.reduce((acc, item) => {
            const category = item.category || 'Miscellaneous';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(item);
            return acc;
        }, {} as Record<string, MenuItem[]>);
    }, [menu]);

    const isLoading = storeLoading || menuLoading;

    if (isLoading) {
        return <div className="container mx-auto py-12 text-center">Loading menu...</div>;
    }

    if (!store) {
        return <div className="container mx-auto py-12 text-center">Store not found.</div>;
    }
    
    if (!menu) {
        return <div className="container mx-auto py-12 text-center">This store does not have a digital menu yet.</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="relative h-48 md:h-64">
                {store.imageUrl && (
                    <Image src={store.imageUrl} alt={store.name} layout="fill" objectFit="cover" className="opacity-50" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent"></div>
                <div className="absolute bottom-0 left-0 p-8 text-white">
                    <h1 className="text-4xl md:text-6xl font-bold font-headline drop-shadow-lg">{store.name}</h1>
                    <p className="text-lg mt-2 drop-shadow-md">{store.description}</p>
                </div>
            </header>

            <main className="container mx-auto py-12 px-4 md:px-6">
                <Card className="max-w-4xl mx-auto">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-3xl">
                            <Utensils className="h-8 w-8 text-primary" />
                            Our Menu
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        {Object.entries(menuByCategory).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => (
                            <div key={category}>
                                <h2 className="text-2xl font-semibold mb-4 border-b pb-2">{category}</h2>
                                <Table>
                                    <TableBody>
                                        {items.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell>
                                                    <p className="font-semibold">{item.name}</p>
                                                    {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                                                </TableCell>
                                                <TableCell className="text-right font-medium">₹{item.price.toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
