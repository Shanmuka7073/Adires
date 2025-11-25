'use client';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { X, ShoppingCart, Check, Mic, Plus } from 'lucide-react';
import type { Product, ProductPrice, ProductVariant } from '@/lib/types';
import { useCart } from '@/lib/cart';
import { t } from '@/lib/locales';
import Image from 'next/image';
import { getProductImage } from '@/lib/data';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore } from '@/lib/store';
import { Separator } from '../ui/separator';

export interface PriceCheckInfo {
  product: Product;
  priceData: ProductPrice;
  recommendedProducts: Product[];
}

interface PriceCheckDisplayProps {
  info: PriceCheckInfo | null;
  onClose: () => void;
}

function RecommendedItem({ product }: { product: Product }) {
    const { addItem } = useCart();
    const { productPrices } = useAppStore();
    const [image, setImage] = useState({ imageUrl: '', imageHint: 'loading' });

    const priceData = productPrices[product.name.toLowerCase()];
    const smallestVariant = priceData?.variants?.[0];

    useEffect(() => {
        const fetchImage = async () => {
            if (product.imageUrl) {
                setImage({ imageUrl: product.imageUrl, imageHint: product.name });
            } else {
                const fetchedImage = await getProductImage(product.imageId);
                setImage(fetchedImage);
            }
        };
        fetchImage();
    }, [product]);

    const handleAdd = () => {
        if (smallestVariant) {
            addItem(product, smallestVariant, 1);
        }
    }

    return (
        <div className="flex-shrink-0 w-24 space-y-1">
            <div className="w-full h-24 relative rounded-lg overflow-hidden border">
                <Image src={image.imageUrl} alt={product.name} data-ai-hint={image.imageHint} fill className="object-cover" />
            </div>
            <p className="text-xs font-medium truncate">{product.name}</p>
            {smallestVariant && (
                 <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-primary">₹{(smallestVariant.price * 1.20).toFixed(2)}</p>
                    <Button size="icon" variant="outline" className="h-6 w-6" onClick={handleAdd}>
                        <Plus className="h-3 w-3" />
                    </Button>
                </div>
            )}
        </div>
    )
}

export function PriceCheckDisplay({ info, onClose }: PriceCheckDisplayProps) {
  const { addItem } = useCart();
  const [image, setImage] = useState({ imageUrl: '', imageHint: 'loading' });
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

  useEffect(() => {
    if (info?.product) {
      const fetchImage = async () => {
        if (info.product.imageUrl) {
          setImage({ imageUrl: info.product.imageUrl, imageHint: info.product.name });
        } else {
          const fetchedImage = await getProductImage(info.product.imageId);
          setImage(fetchedImage);
        }
      };
      fetchImage();
      // Reset selected variant when a new product is shown
      setSelectedVariant(null);
    }
  }, [info]);

  const handleAddToCart = () => {
    if (info && selectedVariant) {
        const productWithContext = { ...info.product, isAiAssisted: true, matchedAlias: `Price check` };
        addItem(productWithContext, selectedVariant, 1);
        onClose();
    }
  };

  const { product, priceData, recommendedProducts } = info || {};
  const productNameEn = product ? t(product.name.toLowerCase().replace(/ /g, '-'), 'en') : '';
  const productDesc = product ? product.description : '';


  if (!info || !product || !priceData) return null;

  return (
    <AnimatePresence>
      {info && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
            className="fixed bottom-0 left-0 right-0 bg-background z-50 rounded-t-3xl p-5 shadow-2xl w-full max-w-lg mx-auto max-h-[80vh] flex flex-col"
          >
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h2 className="text-lg font-semibold text-foreground">
                {productNameEn} - Select Quantity
              </h2>
              <button onClick={onClose} className="text-2xl text-muted-foreground hover:text-foreground transition-colors">&times;</button>
            </div>
            
            <ScrollArea className="flex-grow pr-3 -mr-3">
                <div className="grid grid-cols-2 gap-4 mb-5 flex-shrink-0">
                  <div className="relative w-full aspect-square rounded-xl overflow-hidden border">
                    <Image
                        src={image.imageUrl}
                        alt={productNameEn}
                        fill
                        className="object-cover"
                        data-ai-hint={image.imageHint}
                      />
                  </div>
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-sm line-clamp-3">{productDesc}</p>
                    <div className="p-3 bg-primary/10 rounded-lg text-primary-foreground">
                        <h4 className="font-semibold text-sm flex items-center gap-1 text-primary"><Mic className="h-4 w-4"/> Try Saying:</h4>
                        <ul className="text-xs list-disc list-inside mt-1 space-y-1 text-primary/90">
                            <li>"Add the first one"</li>
                            <li>"The 50 rupee one"</li>
                            <li>"Select 1 kg"</li>
                        </ul>
                    </div>
                  </div>
                </div>
                
                 {recommendedProducts && recommendedProducts.length > 0 && (
                    <>
                        <div className="space-y-3 mb-6">
                            <h3 className="text-sm font-semibold text-muted-foreground">Recipe Suggestions</h3>
                            <ScrollArea className="w-full">
                                <div className="flex gap-3 pb-2">
                                    {recommendedProducts.map(p => <RecommendedItem key={p.id} product={p} />)}
                                </div>
                            </ScrollArea>
                        </div>
                        <Separator className="my-4" />
                    </>
                )}

                <div className="space-y-3 mb-6">
                    {priceData.variants.map((v, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedVariant(v)}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl shadow-sm border-2 cursor-pointer transition-all ${selectedVariant?.sku === v.sku ? 'border-primary bg-primary/10' : 'bg-muted/50 border-border'}`}
                      >
                        <div className="flex items-center gap-3">
                          {selectedVariant?.sku === v.sku ? (
                              <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                                  <Check className="h-3 w-3" />
                              </div>
                          ) : (
                              <div className="w-5 h-5 rounded-full border-2 border-muted-foreground"></div>
                          )}
                          <p className="text-foreground font-medium">{v.weight}</p>
                        </div>
                        <p className="text-primary font-bold text-lg">₹{(v.price * 1.20).toFixed(2)}</p>
                      </div>
                    ))}
                </div>

            </ScrollArea>

            <div className="flex-shrink-0 pt-4 mt-auto border-t">
                <Button
                    onClick={handleAddToCart}
                    disabled={!selectedVariant}
                    className="w-full h-12 text-lg font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-md disabled:bg-muted"
                >
                <ShoppingCart className="mr-2 h-5 w-5" />
                {selectedVariant ? `Add to Cart - ₹${(selectedVariant.price * 1.20).toFixed(2)}` : "Please select a quantity"}
                </Button>
            </div>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
