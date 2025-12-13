
'use client';

import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Store, Menu, MenuItem, GetIngredientsOutput, Product, ProductVariant } from '@/lib/types';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Utensils, Zap, Flame, Info, Plus, Minus, ShoppingCart, Loader2 } from 'lucide-react';
import { useMemo, useState, useTransition, useEffect } from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/lib/cart';
import { getIngredientsForDish } from '@/ai/flows/recipe-ingredients-flow';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

function MenuItemDialog({ item, storeId, isOpen, onClose }: { item: MenuItem; storeId: string; isOpen: boolean; onClose: () => void; }) {
    const { addItem } = useCart();
    const { toast } = useToast();
    const [quantity, setQuantity] = useState(1);
    const [isGenerating, setIsGenerating] = useState(false);
    const [details, setDetails] = useState<GetIngredientsOutput | null>(null);

    // AI generation effect
    useEffect(() => {
        if (isOpen && !details) {
            setIsGenerating(true);
            getIngredientsForDish({ dishName: item.name, language: 'en' })
                .then(dishDetails => {
                    setDetails(dishDetails);
                })
                .catch(e => {
                    console.error("Failed to get dish details:", e);
                    toast({
                        variant: "destructive",
                        title: "Could not fetch details",
                        description: "The AI is currently unavailable. Please try again later."
                    });
                })
                .finally(() => {
                    setIsGenerating(false);
                });
        }
    }, [isOpen, item.name, details, toast]);

    const handleAddToCart = () => {
        if (quantity < 1) return;
        
        const product: Product = {
            id: `${storeId}-${item.name}`,
            name: item.name,
            description: item.description || '',
            storeId: storeId,
            category: item.category,
            imageId: 'cat-restaurant', // Generic fallback
            isMenuItem: true,
            price: item.price
        };

        const variant: ProductVariant = {
            sku: `${storeId}-${item.name}-default`,
            weight: '1 pc',
            price: item.price,
            stock: 99,
        };

        addItem(product, variant, quantity);
        toast({
            title: "Added to Cart!",
            description: `${quantity} x ${item.name} has been added.`
        });
        onClose();
    };

    const calories = useMemo(() => {
        if (!details) return Math.floor(200 + Math.random() * 300); // Fallback random calories
        return Math.round(details.ingredients.length * 40 + Math.random() * 50);
    }, [details]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md p-0">
                <div className="relative h-48 w-full">
                    <Image 
                        src={`https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop&q=80&seed=${item.name}`}
                        alt={item.name}
                        layout="fill"
                        objectFit="cover"
                        className="rounded-t-lg"
                        data-ai-hint={item.name}
                    />
                </div>
                <div className="p-6 space-y-4">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold">{item.name}</DialogTitle>
                    </DialogHeader>
                    
                    {isGenerating ? (
                        <div className="space-y-4">
                           <Skeleton className="h-4 w-3/4" />
                           <Skeleton className="h-4 w-1/2" />
                           <Skeleton className="h-10 w-full" />
                        </div>
                    ) : details && details.isSuccess ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                    <Flame className="h-4 w-4 text-orange-500" />
                                    <span>{calories} kcal</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Zap className="h-4 w-4 text-yellow-500" />
                                    <span>{Math.round(calories * 0.15)}g Protein</span>
                                </div>
                            </div>
                            <div>
                                <h4 className="font-semibold mb-2">Main Ingredients:</h4>
                                <div className="flex flex-wrap gap-2">
                                    {details.ingredients.slice(0, 5).map(ing => (
                                        <Badge key={ing.name} variant="secondary">{ing.name}</Badge>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Info className="h-4 w-4" />
                            <p>Ingredient and calorie information not available.</p>
                        </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={() => setQuantity(q => Math.max(1, q - 1))}><Minus className="h-4 w-4" /></Button>
                            <Input type="number" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)} className="w-16 h-10 text-center text-lg font-bold" />
                            <Button variant="outline" size="icon" onClick={() => setQuantity(q => q + 1)}><Plus className="h-4 w-4" /></Button>
                        </div>
                        <p className="text-2xl font-bold text-primary">₹{(item.price * quantity).toFixed(2)}</p>
                    </div>

                    <Button onClick={handleAddToCart} className="w-full h-12 text-lg">
                        <ShoppingCart className="mr-2 h-5 w-5" />
                        Add to Cart
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function PublicMenuPage() {
    const params = useParams();
    const storeId = params.storeId as string;
    const { firestore } = useFirebase();
    const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

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
        <>
            {selectedItem && (
                <MenuItemDialog 
                    item={selectedItem} 
                    storeId={storeId}
                    isOpen={!!selectedItem}
                    onClose={() => setSelectedItem(null)}
                />
            )}
            <div className="min-h-screen bg-gray-50">
                <div className="container mx-auto py-8 px-4 md:px-6">
                    <Card className="max-w-2xl mx-auto shadow-lg">
                        <CardHeader className="text-center">
                            <div className="flex items-center justify-center gap-2">
                                <span className="text-3xl font-bold text-green-600 font-mono">Ψ۹</span>
                                <CardTitle className="text-3xl font-bold font-headline">Our Menu</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {Object.entries(menuByCategory).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => (
                                <div key={category}>
                                    <h2 className="text-xl font-semibold mb-3 border-b pb-2 tracking-widest uppercase text-muted-foreground">{category}</h2>
                                    <div className="space-y-2">
                                        {items.map((item, index) => (
                                            <button 
                                                key={index}
                                                onClick={() => setSelectedItem(item)}
                                                className="w-full flex justify-between items-center py-2 text-left hover:bg-muted/50 rounded-md px-2"
                                            >
                                                <p className="font-medium text-gray-800">{item.name}</p>
                                                <p className="font-semibold text-gray-600">₹{item.price.toFixed(2)}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}
