'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, ShoppingCart } from 'lucide-react';
import { Product, ProductPrice, ProductVariant } from '@/lib/types';
import { useCart } from '@/lib/cart';
import { t } from '@/lib/locales';
import Image from 'next/image';
import { getProductImage } from '@/lib/data';

export interface PriceCheckInfo {
  product: Product;
  priceData: ProductPrice;
}

interface PriceCheckDisplayProps {
  info: PriceCheckInfo | null;
  onClose: () => void;
}

export function PriceCheckDisplay({ info, onClose }: PriceCheckDisplayProps) {
  const { addItem } = useCart();
  const [image, setImage] = useState({ imageUrl: '', imageHint: 'loading' });

  useEffect(() => {
    if (info?.product) {
      const fetchImage = async () => {
        // Prioritize the direct imageUrl if it exists on the product
        if (info.product.imageUrl) {
          setImage({ imageUrl: info.product.imageUrl, imageHint: info.product.name });
        } else {
          // Fallback to fetching from placeholder data
          const fetchedImage = await getProductImage(info.product.imageId);
          setImage(fetchedImage);
        }
      };
      fetchImage();
    }
  }, [info]);

  const handleAddToCart = (variant: ProductVariant) => {
    if (info) {
        const productWithContext = { ...info.product, isAiAssisted: true, matchedAlias: `Price check` };
        addItem(productWithContext, variant, 1);
        onClose();
    }
  };

  if (!info) {
    return null;
  }

  const { product, priceData } = info;
  const productNameEn = t(product.name.toLowerCase().replace(/ /g, '-'), 'en');
  const productNameTe = t(product.name.toLowerCase().replace(/ /g, '-'), 'te');

  return (
    <div className="fixed bottom-4 right-4 z-[100] w-full max-w-sm">
      <Card className="shadow-2xl animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
        <CardHeader>
          <div className="flex justify-between items-start">
             <div className="flex items-start gap-4">
                 <div className="relative h-16 w-16 rounded-md overflow-hidden bg-muted">
                    <Image
                        src={image.imageUrl}
                        alt={product.name}
                        data-ai-hint={image.imageHint}
                        fill
                        className="object-cover"
                    />
                 </div>
                <div>
                    <CardTitle className="font-headline text-xl">{productNameEn}</CardTitle>
                    <CardDescription>{productNameTe}</CardDescription>
                </div>
            </div>
             <Button variant="ghost" size="icon" className="h-7 w-7 -mt-2 -mr-2 flex-shrink-0" onClick={onClose}>
                <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
            {priceData.variants.map((variant) => (
                <div key={variant.sku} className="flex justify-between items-center p-2 rounded-md hover:bg-muted">
                    <div>
                        <p className="font-semibold">{variant.weight}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <p className="font-bold text-lg text-primary">₹{(variant.price).toFixed(2)}</p>
                        <Button size="sm" onClick={() => handleAddToCart(variant)}>
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Add
                        </Button>
                    </div>
                </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
