'use client';

import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Copy, Share2, List } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

function ProductListDisplay() {
    const { masterProducts, loading } = useAppStore();
    const { toast } = useToast();
    const [isShareSupported, setIsShareSupported] = useState(false);

    useEffect(() => {
        // Detect Web Share API support on the client side to avoid build-time errors and hydration mismatches
        if (typeof navigator !== 'undefined' && !!(navigator as any).share) {
            setIsShareSupported(true);
        }
    }, []);

    const productListText = useMemo(() => {
        if (!masterProducts) return '';
        return masterProducts.map(p => p.name).join('\n');
    }, [masterProducts]);

    const handleCopy = () => {
        if (typeof navigator === 'undefined' || !navigator.clipboard) return;
        navigator.clipboard.writeText(productListText).then(() => {
            toast({
                title: "Product List Copied!",
                description: "The complete list of products has been copied to your clipboard.",
            });
        }).catch(err => {
            toast({
                variant: 'destructive',
                title: "Copy Failed",
                description: "Could not copy the product list.",
            });
        });
    };

    const handleShare = () => {
        if (typeof navigator !== 'undefined' && (navigator as any).share) {
            (navigator as any).share({
                title: 'Adires Master Product List',
                text: productListText,
            }).catch((err: any) => console.error("Share failed:", err));
        } else {
            handleCopy(); // Fallback to copy if share API is not available
        }
    };

    if (loading) {
        return (
             <div className="space-y-4">
                <div className="flex gap-4">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-24" />
                </div>
                <Skeleton className="h-96 w-full" />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex gap-4">
                <Button onClick={handleCopy}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy List
                </Button>
                {isShareSupported && (
                     <Button variant="outline" onClick={handleShare}>
                        <Share2 className="mr-2 h-4 w-4" />
                        Share
                    </Button>
                )}
            </div>
            <ScrollArea className="h-96 w-full rounded-md border">
                 <pre className="p-4 text-sm whitespace-pre-wrap font-sans">
                    <code>{productListText}</code>
                </pre>
            </ScrollArea>
        </div>
    );
}


export default function ProductListPage() {
    const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
    const router = useRouter();

    if (!isAdminLoading && !isAdmin) {
        router.replace('/dashboard');
        return <p>Redirecting...</p>;
    }

    if (isAdminLoading) {
        return <p>Loading...</p>
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                     <div className="flex items-center gap-3">
                        <List className="h-8 w-8 text-primary" />
                        <div>
                            <CardTitle className="text-3xl font-headline italic">Master Product List</CardTitle>
                            <CardDescription className="font-bold opacity-60 uppercase text-[10px] tracking-widest">
                                Comprehensive catalog audit.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                   <ProductListDisplay />
                </CardContent>
            </Card>
        </div>
    );
}
