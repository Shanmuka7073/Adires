
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import type { Store } from '@/lib/types';
import { getStoreImage } from '@/lib/data';
import { Star, Clock } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';

interface StoreCardProps {
  store: Store;
}

export default function StoreCard({ store }: StoreCardProps) {
    const [image, setImage] = useState({ imageUrl: 'https://placehold.co/400x300/E2E8F0/64748B?text=Loading...', imageHint: 'loading' });
    
    // Fake rating and time for visual similarity to the screenshot
    const rating = useMemo(() => (4 + Math.random()).toFixed(1), [store.id]);
    const deliveryTime = useMemo(() => Math.floor(Math.random() * 20) + 20, [store.id]);


    useEffect(() => {
        const fetchImage = async () => {
            if (store) {
                const fetchedImage = await getStoreImage(store);
                setImage(fetchedImage);
            }
        }
        fetchImage();
    }, [store]);

  return (
    <Link href={`/stores/${store.id}`} className="block overflow-hidden rounded-xl transition-all hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary">
        <Card className="h-full border-0 shadow-md hover:shadow-xl transition-shadow">
            <div className="relative">
                <Image
                    src={image.imageUrl}
                    alt={store.name}
                    data-ai-hint={image.imageHint}
                    width={400}
                    height={300}
                    className="w-full h-36 object-cover"
                />
                 <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-green-600 px-2 py-1 text-xs font-bold text-white">
                    <Star className="h-3 w-3 fill-white" />
                    <span>{rating}</span>
                </div>
            </div>
            <CardContent className="p-3">
                <h3 className="font-semibold text-lg truncate">{store.name}</h3>
                <p className="text-sm text-muted-foreground truncate">{store.description}</p>
                <div className="flex items-center text-sm text-muted-foreground mt-2">
                    <Clock className="h-4 w-4 mr-1.5" />
                    <span>{deliveryTime}-{deliveryTime + 5} mins</span>
                     {store.distance && <span className="mx-2">•</span>}
                    {store.distance && <span>{store.distance.toFixed(1)} km</span>}
                </div>
            </CardContent>
        </Card>
    </Link>
  );
}
