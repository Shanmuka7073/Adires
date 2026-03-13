
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Order, Store } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, VideoOff, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function LiveOrderPage() {
    const params = useParams();
    const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
    const { firestore } = useFirebase();

    const orderRef = useMemoFirebase(() => firestore && orderId ? doc(firestore, 'orders', orderId) : null, [firestore, orderId]);
    const { data: order, isLoading: orderLoading } = useDoc<Order>(orderRef);

    const storeRef = useMemoFirebase(() => firestore && order?.storeId ? doc(firestore, 'stores', order.storeId) : null, [firestore, order?.storeId]);
    const { data: store, isLoading: storeLoading } = useDoc<Store>(storeRef);

    const isLoading = orderLoading || storeLoading;

    const renderVideo = () => {
        if (!store?.liveVideoUrl) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-12 text-center">
                    <VideoOff className="h-16 w-16 mb-4 opacity-20" />
                    <p className="text-lg font-semibold">Live stream is offline.</p>
                    <p className="text-sm">The store owner has not enabled a live video feed for this location.</p>
                </div>
            );
        }

        // Check for YouTube URLs
        const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/;
        const match = store.liveVideoUrl.match(youtubeRegex);

        if (match && match[1]) {
            const videoId = match[1];
            return (
                <iframe
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&controls=0&mute=1`}
                    title="Live Preparation"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                ></iframe>
            );
        }

        // Fallback for direct video links
        return (
            <video className="w-full h-full" autoPlay loop muted playsInline>
                <source src={store.liveVideoUrl} type="video/mp4" />
                Your browser does not support the video tag.
            </video>
        );
    };

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-4xl mx-auto rounded-[2.5rem] border-0 shadow-2xl overflow-hidden bg-white">
                <CardHeader className="bg-primary/5 border-b border-black/5 pb-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-2xl font-black uppercase tracking-tight text-primary">Live Preparation</CardTitle>
                            <CardDescription className="font-bold">
                                {store ? `Watching: ${store.name}` : 'Connecting to store feed...'}
                            </CardDescription>
                        </div>
                        <Button asChild variant="ghost" size="sm" className="rounded-xl font-bold">
                            <Link href="/dashboard/customer/my-orders"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="aspect-video w-full bg-slate-950 flex items-center justify-center">
                        {isLoading ? (
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        ) : (
                            renderVideo()
                        )}
                    </div>
                     <div className="p-8 text-center bg-gray-50 border-t border-black/5">
                         <p className="text-sm font-medium text-gray-600 mb-6">
                            See your food being prepared fresh at {store?.name || 'the store'}.
                         </p>
                         <Button asChild variant="outline" className="h-12 px-8 rounded-xl font-black text-xs uppercase tracking-widest border-2">
                            <Link href={`/dashboard/customer/my-orders`}>View Order Status</Link>
                         </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
