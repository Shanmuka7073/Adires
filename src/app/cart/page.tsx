
'use client';

import { useCart, UnidentifiedCartItem } from '@/lib/cart';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Trash2, Minus, Plus, Loader2, AlertTriangle, BrainCircuit } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { getProductImage } from '@/lib/data';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/locales';

const DELIVERY_FEE = 30;

function UnidentifiedCartRow({ item }: { item: UnidentifiedCartItem }) {
    const { status, term } = item;
    const { removeUnidentifiedItem } = useCart();
    return (
        <TableRow className={status === 'failed' ? 'bg-destructive/10' : 'bg-muted/50'}>
            <TableCell>
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center">
                        {status === 'pending' && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
                        {status === 'failed' && <AlertTriangle className="h-6 w-6 text-destructive" />}
                    </div>
                    <div>
                        <span className="font-medium italic">{term}</span>
                         <p className="text-sm text-muted-foreground flex items-center gap-1">
                             {status === 'pending' && <><BrainCircuit className="h-3 w-3" />AI is identifying this item...</>}
                             {status === 'failed' && 'Could not identify this item.'}
                         </p>
                    </div>
                </div>
            </TableCell>
            <TableCell>—</TableCell>
            <TableCell className="text-center">—</TableCell>
            <TableCell className="text-right">—</TableCell>
            <TableCell>
                 {status === 'failed' && (
                    <Button variant="ghost" size="icon" onClick={() => removeUnidentifiedItem(item.id)}>
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Remove unidentified item</span>
                    </Button>
                )}
            </TableCell>
        </TableRow>
    )
}

function CartRow({ item, image }) {
  const { removeItem, updateQuantity } = useCart();
  const { product, variant, quantity } = item;
  const finalPrice = variant.price * 1.20;

  const productNameKey = product.name.toLowerCase().replace(/ /g, '-');
  const englishName = t(productNameKey, 'en');
  const teluguName = t(productNameKey, 'te');

  return (
    <TableRow className={product.isAiAssisted ? "bg-green-500/10" : ""}>
      <TableCell>
        <div className="flex items-center gap-4">
          <Image
            src={image.imageUrl}
            alt={product.name}
            data-ai-hint={image.imageHint}
            width={64}
            height={64}
            className="rounded-md object-cover"
          />
          <div>
            <div className="flex items-center gap-2">
                <span className="font-medium">{englishName}</span>
                 {product.isAiAssisted && <BrainCircuit className="h-4 w-4 text-green-600" title="Identified by AI" />}
            </div>
            <p className="text-sm text-muted-foreground">{teluguName}</p>
            <p className="text-sm text-muted-foreground">{variant.weight}</p>
             {product.isAiAssisted && <p className="text-xs text-green-700 font-medium">Was: "{product.matchedAlias}"</p>}
          </div>
        </div>
      </TableCell>
      <TableCell>₹{finalPrice.toFixed(2)}</TableCell>
      <TableCell>
        <Input
          type="number"
          min="0"
          value={quantity}
          onChange={(e) => updateQuantity(variant.sku, parseInt(e.target.value) || 0)}
          className="w-20 text-center mx-auto"
          aria-label={`Quantity for ${product.name} ${variant.weight}`}
        />
      </TableCell>
      <TableCell className="text-right">
        ₹{(finalPrice * quantity).toFixed(2)}
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="icon" onClick={() => removeItem(variant.sku)}>
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Remove {product.name} {variant.weight}</span>
        </Button>
      </TableCell>
    </TableRow>
  );
}

function MobileCartItem({ item, image }) {
    const { removeItem, updateQuantity } = useCart();
    const { product, variant, quantity } = item;
    const finalPrice = variant.price * 1.20;

    const productNameKey = product.name.toLowerCase().replace(/ /g, '-');
    const englishName = t(productNameKey, 'en');
    const teluguName = t(productNameKey, 'te');

    return (
        <Card className={product.isAiAssisted ? "bg-green-500/10 border-green-500/30" : ""}>
            <CardContent className="flex items-center gap-4 p-4">
                <Image
                    src={image.imageUrl}
                    alt={product.name}
                    data-ai-hint={image.imageHint}
                    width={80}
                    height={80}
                    className="rounded-lg object-cover"
                />
                <div className="flex-1 space-y-2">
                    <div>
                        <div className="flex items-center gap-2">
                             <p className="font-semibold">{englishName} <span className="font-normal text-muted-foreground">({variant.weight})</span></p>
                             {product.isAiAssisted && <BrainCircuit className="h-4 w-4 text-green-600" title="Identified by AI" />}
                        </div>
                        <p className="text-xs text-muted-foreground">{teluguName}</p>
                         {product.isAiAssisted && <p className="text-xs text-green-700 font-medium">Was: "{product.matchedAlias}"</p>}
                    </div>
                    <p className="font-bold text-lg">₹{(finalPrice * quantity).toFixed(2)}</p>
                     <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(variant.sku, quantity - 1)}>
                            <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                            type="number"
                            min="0"
                            value={quantity}
                            onChange={(e) => updateQuantity(variant.sku, parseInt(e.target.value) || 0)}
                            className="w-14 h-8 text-center"
                            aria-label={`Quantity for ${product.name} ${variant.weight}`}
                        />
                         <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(variant.sku, quantity + 1)}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                 <Button variant="ghost" size="icon" onClick={() => removeItem(variant.sku)} className="self-start">
                    <Trash2 className="h-5 w-5 text-muted-foreground" />
                </Button>
            </CardContent>
        </Card>
    )
}

function UnidentifiedMobileItem({ item }: { item: UnidentifiedCartItem }) {
    const { term, status } = item;
    const { removeUnidentifiedItem } = useCart();
    return (
        <Card className={status === 'failed' ? 'bg-destructive/10 border-destructive/30' : 'bg-muted/50'}>
             <CardContent className="flex items-center gap-4 p-4">
                 <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center">
                    {status === 'pending' && <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />}
                    {status === 'failed' && <AlertTriangle className="h-8 w-8 text-destructive" />}
                 </div>
                 <div className="flex-1 space-y-2">
                     <p className="font-semibold italic">{term}</p>
                     <p className="text-sm text-muted-foreground flex items-center gap-1">
                        {status === 'pending' && <><BrainCircuit className="h-4 w-4" />AI is identifying this item...</>}
                        {status === 'failed' && 'Could not identify this item.'}
                     </p>
                 </div>
                  {status === 'failed' && (
                    <Button variant="ghost" size="icon" onClick={() => removeUnidentifiedItem(item.id)} className="self-start">
                        <Trash2 className="h-5 w-5 text-muted-foreground" />
                    </Button>
                )}
             </CardContent>
        </Card>
    )
}


export default function CartPage() {
  const { cartItems, cartTotal, cartCount, unidentifiedItems } = useCart();
  const { stores } = useAppStore();
  const firstStoreId = stores[0]?.id;
  const shoppingLink = firstStoreId ? `/stores/${firstStoreId}` : '/';
  
  const [images, setImages] = useState({});

  useEffect(() => {
    const fetchImages = async () => {
      if (cartItems.length > 0) {
        const imagePromises = cartItems.map((item) => {
            if (item.product.imageUrl) {
                return Promise.resolve({ imageUrl: item.product.imageUrl, imageHint: item.product.name });
            }
            return getProductImage(item.product.imageId);
        });
        const resolvedImages = await Promise.all(imagePromises);
        const imageMap = cartItems.reduce((acc, item, index) => {
          acc[item.variant.sku] = resolvedImages[index];
          return acc;
        }, {});
        setImages(imageMap);
      }
    };

    fetchImages();
  }, [cartItems]);

  if (cartCount === 0 && unidentifiedItems.length === 0) {
    return (
      <div className="container mx-auto py-24 text-center">
        <h1 className="text-4xl font-bold mb-4 font-headline">
          {t('your-cart-is-empty')}
        </h1>
        <p className="text-muted-foreground mb-8">
          {t('looks-like-you-havent-added-anything')}
        </p>
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
          <Button asChild size="lg">
            <Link href={shoppingLink}>{t('start-shopping')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 px-4 md:px-6">
      <h1 className="text-3xl md:text-4xl font-bold mb-8 font-headline">
        {t('your-shopping-cart')}
      </h1>
      <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
        <div className="lg:col-span-2 space-y-4">
            {/* Mobile View */}
            <div className="lg:hidden space-y-4">
                 {unidentifiedItems.map((item) => <UnidentifiedMobileItem key={item.id} item={item} />)}
                 {cartItems.map((item) => {
                    const image = images[item.variant.sku] || { imageUrl: 'https://placehold.co/80x80/E2E8F0/64748B?text=...', imageHint: 'loading' };
                    return <MobileCartItem key={item.variant.sku} item={item} image={image} />
                })}
            </div>

            {/* Desktop View */}
            <div className="hidden lg:block">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('product')}</TableHead>
                        <TableHead>{t('price')}</TableHead>
                        <TableHead className="text-center">{t('quantity')}</TableHead>
                        <TableHead className="text-right">{t('total')}</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unidentifiedItems.map(item => <UnidentifiedCartRow key={item.id} item={item} />)}
                      {cartItems.map((item) => {
                        const image = images[item.variant.sku] || { imageUrl: 'https://placehold.co/64x64/E2E8F0/64748B?text=...', imageHint: 'loading' };
                        return <CartRow key={item.variant.sku} item={item} image={image} />;
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
        </div>
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>{t('order-summary')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span>{t('subtotal')}</span>
                <span>₹{cartTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('delivery-fee')}</span>
                <span>₹{DELIVERY_FEE.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg">
                <span>{t('total')}</span>
                <span>₹{(cartTotal + DELIVERY_FEE).toFixed(2)}</span>
              </div>
              <Button asChild className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={unidentifiedItems.some(i => i.status === 'pending')}>
                <Link href="/checkout">{t('proceed-to-checkout')}</Link>
              </Button>
               {unidentifiedItems.some(i => i.status === 'pending') && (
                  <p className="text-xs text-center text-muted-foreground">Waiting for AI to identify all items...</p>
               )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
