'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, ShoppingCart } from 'lucide-react';
import { Product, ProductPrice } from '@/lib/types';
import { useCart } from '@/lib/cart';
import { t } from '@/lib/locales';

export interface PriceCheckInfo {
  product: Product;
  priceData: ProductPrice;
}

interface PriceCheckDisplayProps {
  info: PriceCheckInfo | null;
}

export function PriceCheckDisplay({ info }: PriceCheckDisplayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { addItem } = useCart();

  useEffect(() => {
    if (info) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 5000); // Auto-hide after 5 seconds

      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [info]);

  const handleAddToCart = (variant) => {
    addItem(info!.product, variant, 1);
    setIsVisible(false);
  };

  if (!isVisible || !info) {
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
            <div>
                <CardTitle className="font-headline">{productNameEn}</CardTitle>
                <CardDescription>{productNameTe}</CardDescription>
            </div>
             <Button variant="ghost" size="icon" className="h-6 w-6 -mt-2 -mr-2" onClick={() => setIsVisible(false)}>
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
                        <p className="font-bold text-lg text-primary">₹{(variant.price * 1.20).toFixed(2)}</p>
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
