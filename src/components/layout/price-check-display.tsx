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
    }
  }, [info]);

  const handleAddToCart = (variant: ProductVariant) => {
    if (info) {
        const productWithContext = { ...info.product, isAiAssisted: true, matchedAlias: `Price check` };
        addItem(productWithContext, variant, 1);
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
            className="fixed bottom-0 left-0 right-0 bg-white z-50 rounded-t-3xl p-5 shadow-2xl max-h-[80vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {productNameEn}
              </h2>
              <button onClick={onClose} className="text-2xl text-gray-500 hover:text-gray-900 transition-colors">×</button>
            </div>
            <div className="flex items-center gap-4 mb-5">
              <Image
                src={image.imageUrl}
                alt={productNameEn}
                width={80}
                height={80}
                className="w-20 h-20 rounded-xl object-cover border"
              />
              <div>
                <p className="text-gray-600 text-sm">{productDesc}</p>
              </div>
            </div>
            <div className="space-y-3">
              {priceData.variants.map((v, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-xl shadow-sm border border-gray-100"
                >
                  <div>
                    <p className="text-gray-800 font-medium">{v.weight}</p>
                    <p className="text-green-600 font-bold text-lg">₹{(v.price * 1.20).toFixed(2)}</p>
                  </div>
                  <Button
                    onClick={() => handleAddToCart(v)}
                    className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-xl shadow-md"
                  >
                    <ShoppingCart className="h-4 w-4" /> Add
                  </Button>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
