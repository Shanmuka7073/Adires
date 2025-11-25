'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, ShoppingCart } from 'lucide-react';
import type { Product, ProductPrice, ProductVariant } from '@/lib/types';
import { useCart } from '@/lib/cart';
import { t } from '@/lib/locales';
import Image from 'next/image';
import { getProductImage } from '@/lib/data';
import { motion, AnimatePresence } from 'framer-motion';

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

  const { product, priceData } = info || {};
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
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
            className="fixed bottom-0 left-0 right-0 bg-white z-50 rounded-t-3xl p-5 pb-8 md:pb-5 shadow-2xl max-h-[80vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {productNameEn} - Select Quantity
              </h2>
              <button onClick={onClose} className="text-2xl text-gray-500 hover:text-gray-900 transition-colors">×</button>
            </div>
            <div className="flex items-center gap-4 mb-5">
              <div className="relative w-20 h-20 rounded-xl overflow-hidden border">
                <Image
                    src={image.imageUrl}
                    alt={productNameEn}
                    fill
                    className="object-cover"
                    data-ai-hint={image.imageHint}
                  />
              </div>
              <div>
                <p className="text-gray-600 text-sm">{productDesc}</p>
              </div>
            </div>
            <div className="space-y-3 mb-6">
              {priceData.variants.map((v, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedVariant(v)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl shadow-sm border-2 cursor-pointer transition-all ${selectedVariant?.sku === v.sku ? 'border-primary bg-primary/10' : 'bg-gray-50 border-gray-100'}`}
                >
                  <div className="flex items-center gap-3">
                     {selectedVariant?.sku === v.sku ? (
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white">
                            <Check className="h-3 w-3" />
                        </div>
                     ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-gray-300"></div>
                     )}
                    <p className="text-gray-800 font-medium">{v.weight}</p>
                  </div>
                  <p className="text-primary font-bold text-lg">₹{(v.price * 1.20).toFixed(2)}</p>
                </div>
              ))}
            </div>
            <Button
                onClick={handleAddToCart}
                disabled={!selectedVariant}
                className="w-full h-12 text-lg font-bold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-md disabled:bg-gray-300"
            >
              <ShoppingCart className="mr-2 h-5 w-5" />
              {selectedVariant ? `Add to Cart - ₹${(selectedVariant.price * 1.20).toFixed(2)}` : "Please select a quantity"}
            </Button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
