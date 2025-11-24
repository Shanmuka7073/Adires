'use client'

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCart } from '@/lib/cart';
import type { Product, ProductPrice, ProductVariant } from '@/lib/types';
import { ShoppingCart, BadgePercent } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from './ui/skeleton';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/locales';
import Image from 'next/image';
import { getProductImage } from '@/lib/data';
import { Badge } from './ui/badge';

interface ProductCardProps {
  product: Product;
  priceData?: ProductPrice | null;
}

export default function ProductCard({ product, priceData }: ProductCardProps) {
  const { addItem, setActiveStoreId } = useCart();
  const { toast } = useToast();
  
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [image, setImage] = useState({ imageUrl: '', imageHint: 'loading' });
  
  const priceVariants = useMemo(() => priceData?.variants || [], [priceData]);
  const isLoadingPrice = priceData === undefined;
  
  const productNameKey = product.name.toLowerCase().replace(/ /g, '-');
  const englishName = t(productNameKey, 'en');
  const teluguName = t(productNameKey, 'te');

  useEffect(() => {
    const fetchImage = async () => {
      if (product) {
        if (product.imageUrl) {
            setImage({ imageUrl: product.imageUrl, imageHint: product.name });
        } else {
            const fetchedImage = await getProductImage(product.imageId);
            setImage(fetchedImage);
        }
      }
    };
    fetchImage();
  }, [product]);

  useEffect(() => {
    if (priceVariants.length > 0 && !selectedVariant) {
      setSelectedVariant(priceVariants[0]);
    } else if (priceVariants.length > 0 && selectedVariant) {
        // Ensure the selected variant is still valid after a potential data update
        if (!priceVariants.find(v => v.sku === selectedVariant.sku)) {
            setSelectedVariant(priceVariants[0]);
        }
    } else if (priceVariants.length === 0) {
        setSelectedVariant(null);
    }
  }, [priceVariants, selectedVariant]);
  
  const handleAddToCart = () => {
    if (selectedVariant) {
      addItem(product, selectedVariant);
    } else {
      toast({
        variant: 'destructive',
        title: 'Please select a variant',
        description: 'You must choose a weight or size before adding to the cart.',
      });
    }
  };
  
  const handleVariantChange = (sku: string) => {
    const variant = priceVariants.find(v => v.sku === sku);
    if (variant) {
      setSelectedVariant(variant);
    }
  };
  
  useEffect(() => {
    if(product.storeId) {
      setActiveStoreId(product.storeId);
    }
  }, [product.storeId, setActiveStoreId]);

  const finalPrice = useMemo(() => {
    if (!selectedVariant) return 0;
    return selectedVariant.price * 1.20;
  }, [selectedVariant]);

  const originalPrice = useMemo(() => {
    if (finalPrice === 0) return 0;
    return finalPrice / 0.85;
  }, [finalPrice]);


  return (
    <Card className="flex flex-col h-full overflow-hidden transition-all hover:shadow-lg">
      <CardHeader className="p-0">
        <div className="w-full h-36 bg-muted relative">
          {image.imageUrl ? (
            <Image
              src={image.imageUrl}
              alt={product.name}
              data-ai-hint={image.imageHint}
              fill
              className="object-cover"
            />
          ) : (
             <Skeleton className="h-full w-full" />
          )}
           <Badge className="absolute top-2 right-2 bg-destructive text-destructive-foreground">15% OFF</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-2 pb-1 flex-1 text-center">
        <CardTitle className="text-sm font-headline truncate">{englishName}</CardTitle>
        <p className="text-xs text-muted-foreground">{teluguName}</p>
        {isLoadingPrice ? (
            <Skeleton className="h-6 w-20 mx-auto mt-1" />
        ) : finalPrice > 0 ? (
            <div className="flex items-center justify-center gap-2 mt-1">
              <p className="text-lg font-bold text-primary">₹{finalPrice.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground line-through">₹{originalPrice.toFixed(2)}</p>
            </div>
        ) : (
             <div className="h-6 w-20 mx-auto mt-1" /> // Placeholder for when price is 0 or null
        )}
      </CardContent>
      <CardFooter className="p-2 pt-0 flex-col items-stretch gap-2">
         {isLoadingPrice ? (
            <Skeleton className="h-9 w-full" />
         ) : priceVariants.length > 1 ? (
             <Select onValueChange={handleVariantChange} defaultValue={selectedVariant?.sku}>
                <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder={t('select-weight')} />
                </SelectTrigger>
                <SelectContent>
                    {priceVariants.map(variant => (
                        <SelectItem key={variant.sku} value={variant.sku}>
                            {variant.weight} - ₹{(variant.price * 1.20).toFixed(2)}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
         ) : priceVariants.length === 1 ? (
            <div className="h-9 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">{selectedVariant?.weight}</p>
            </div>
         ) : (
            <div className="h-9 flex items-center justify-center">
                <p className="text-xs text-destructive">{t('no-prices-set')}</p>
            </div>
         )}
        <Button
          onClick={handleAddToCart}
          className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-xs h-9"
          disabled={!selectedVariant || isLoadingPrice}
        >
          <ShoppingCart className="mr-1 h-3.5 w-3.5" />
          {t('add-to-cart')}
        </Button>
      </CardFooter>
    </Card>
  );
}
