
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getSiteConfig } from '@/app/actions';
import type { SiteConfig } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, VideoOff } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function LiveOrderPage() {
    const params = useParams();
    const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;

    const [config, setConfig] = useState<Partial<SiteConfig> | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadConfig() {
            setIsLoading(true);
            const siteConfig = await getSiteConfig('live-order');
            setConfig(siteConfig);
            setIsLoading(false);
        }
        loadConfig();
    }, []);

    const renderVideo = () => {
        if (!config?.liveVideoUrl) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <VideoOff className="h-16 w-16 mb-4" />
                    <p className="text-lg font-semibold">Live stream is currently offline.</p>
                    <p className="text-sm">The store owner has not set up a live video feed.</p>
                </div>
            );
        }

        // Check for YouTube URLs
        const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/;
        const match = config.liveVideoUrl.match(youtubeRegex);

        if (match && match[1]) {
            const videoId = match[1];
            // Embed YouTube video with autoplay and loop
            return (
                <iframe
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&controls=0&mute=1`}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                ></iframe>
            );
        }

        // Fallback for direct video links (.mp4, .webm, etc.)
        return (
            <video className="w-full h-full" autoPlay loop muted playsInline>
                <source src={config.liveVideoUrl} type="video/mp4" />
                Your browser does not support the video tag.
            </video>
        );
    };

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle>Live Order Preparation</CardTitle>
                    <CardDescription>
                        Watch your order being prepared live! This is our commitment to transparency and quality.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="aspect-video w-full bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center">
                        {isLoading ? (
                            <Loader2 className="h-8 w-8 animate-spin text-white" />
                        ) : (
                            renderVideo()
                        )}
                    </div>
                     <div className="mt-6 text-center">
                         <Button asChild variant="outline">
                            <Link href={`/dashboard/customer/my-orders`}>Back to My Orders</Link>
                         </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

