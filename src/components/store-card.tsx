
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import type { Store } from '@/lib/types';
import { getStoreImage } from '@/lib/data';
import { Star, Clock, ArrowRight, Scissors, Utensils } from 'lucide-react';
import { useEffect, useState, memo } from 'react';
import { Skeleton } from './ui/skeleton';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';

interface StoreCardProps {
  store: Store;
  priority?: boolean;
}

const ADIRES_LOGO = "https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png";

/**
 * OPTIMIZED STORE CARD
 * Uses React.memo to prevent re-renders when parent state changes.
 * Implements fetchPriority for LCP images.
 */
const StoreCard = memo(function StoreCard({ store, priority = false }: StoreCardProps) {
    const [image, setImage] = useState({ imageUrl: '', imageHint: 'loading' });
    const [rating, setRating] = useState<string | null>(null);
    const [deliveryTime, setDeliveryTime] = useState<number | null>(null);

    useEffect(() => {
        const fetchImage = async () => {
            if (store) {
                const fetchedImage = await getStoreImage(store);
                setImage(fetchedImage);
            }
        }
        fetchImage();
        setRating((4 + Math.random()).toFixed(1));
        setDeliveryTime(Math.floor(Math.random() * 20) + 20);
    }, [store]);

    const isSalon = store.businessType === 'salon';
    const isRestaurant = store.businessType === 'restaurant';
    const destination = (isSalon || isRestaurant) ? `/menu/${store.id}` : `/stores/${store.id}`;

  return (
    <Link href={destination} className="block group">
        <Card className="h-full border-0 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-[2.5rem] overflow-hidden bg-white">
            <div className="relative h-44 w-full">
                {image.imageUrl ? (
                    <Image
                        src={image.imageUrl || ADIRES_LOGO}
                        alt={store.name}
                        data-ai-hint={image.imageHint}
                        fill
                        priority={priority}
                        loading={priority ? "eager" : "lazy"}
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                ) : (
                    <Skeleton className="w-full h-full" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                
                <div className="absolute top-4 left-4 flex gap-2">
                    {rating && (
                        <Badge className="bg-white/90 backdrop-blur-sm text-gray-950 hover:bg-white text-[9px] font-black uppercase tracking-widest border-0">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400 mr-1" /> {rating}
                        </Badge>
                    )}
                    {isSalon && (
                        <Badge className="bg-primary text-white border-0 text-[9px] font-black uppercase tracking-widest flex gap-1 items-center">
                            <Scissors className="h-2.5 w-2.5" /> Salon
                        </Badge>
                    )}
                    {isRestaurant && (
                        <Badge className="bg-orange-500 text-white border-0 text-[9px] font-black uppercase tracking-widest flex gap-1 items-center">
                            <Utensils className="h-2.5 w-2.5" /> Restaurant
                        </Badge>
                    )}
                </div>

                <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="font-black text-xl text-white truncate leading-none">{store.name}</h3>
                    <p className="text-[10px] text-white/80 font-bold uppercase tracking-widest mt-1.5 truncate">
                        {store.description}
                    </p>
                </div>
            </div>
            <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black uppercase text-muted-foreground tracking-widest mb-0.5">Wait Time</span>
                        <div className="flex items-center text-sm font-black text-gray-900">
                            <Clock className="h-3.5 w-3.5 mr-1.5 text-primary" />
                            {deliveryTime ? `${deliveryTime}-${deliveryTime + 10}m` : '...'}
                        </div>
                    </div>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <ArrowRight className="h-5 w-5" />
                </div>
            </CardContent>
        </Card>
    </Link>
  );
});

export default StoreCard;
