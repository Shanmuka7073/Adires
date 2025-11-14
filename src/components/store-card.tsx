'use client';

import Link from 'next/link';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Store } from '@/lib/types';
<<<<<<< HEAD
import { ArrowRight, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
=======
import { getStoreImage } from '@/lib/data';
import { ArrowRight, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFirebase } from '@/firebase';
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584

interface StoreCardProps {
  store: Store;
}

export default function StoreCard({ store }: StoreCardProps) {
<<<<<<< HEAD

  return (
    <Card className="flex flex-col h-full overflow-hidden transition-all hover:shadow-xl hover:scale-[1.02] duration-300">
      <Link href={`/stores/${store.id}`} className="block overflow-hidden">
        <div className="w-full h-48 bg-muted" />
      </Link>
      <CardContent className="p-4 flex-1 flex flex-col">
        <h3 className="text-lg font-bold font-headline mb-1">{store.name}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2 flex-1">{store.description}</p>
      </CardContent>
      <CardFooter className="p-4 pt-0 flex flex-col items-start gap-4">
        {store.distance && (
          <div className="flex items-center text-xs text-muted-foreground font-medium">
            <MapPin className="mr-1.5 h-4 w-4 text-primary" />
            <span>{store.distance.toFixed(2)} km away</span>
          </div>
        )}
        <Button asChild variant="secondary" className="w-full">
=======
    const { firestore } = useFirebase();
    const [image, setImage] = useState({ imageUrl: 'https://placehold.co/400x300/E2E8F0/64748B?text=Loading...', imageHint: 'loading' });

    useEffect(() => {
        const fetchImage = async () => {
            const fetchedImage = await getStoreImage(store);
            setImage(fetchedImage);
        }
        fetchImage();
    }, [store]);

  return (
    <Card className="flex flex-col h-full overflow-hidden transition-all hover:shadow-lg">
      <CardHeader className="p-0 relative">
        <Link href={`/stores/${store.id}`}>
          <Image
            src={image.imageUrl}
            alt={store.name}
            data-ai-hint={image.imageHint}
            width={400}
            height={300}
            className="w-full h-48 object-cover"
          />
        </Link>
      </CardHeader>
      <CardContent className="p-4 space-y-2 flex-1 flex flex-col">
        <CardTitle className="text-xl font-headline">{store.name}</CardTitle>
        <CardDescription className="flex-1">{store.description}</CardDescription>
        <p className="text-sm text-muted-foreground">{store.address}</p>
        {store.distance && (
          <div className="flex items-center text-sm text-muted-foreground font-medium">
            <MapPin className="mr-2 h-4 w-4 text-primary" />
            <span>{store.distance.toFixed(2)} km away</span>
          </div>
        )}
        <Button asChild variant="outline" className="w-full mt-auto">
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
          <Link href={`/stores/${store.id}`}>
            Visit Store <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
