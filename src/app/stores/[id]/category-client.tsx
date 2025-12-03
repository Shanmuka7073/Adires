
'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import { Product, ProductPrice, Store } from '@/lib/types';
import { useCart } from '@/lib/cart';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import ProductCard from '@/components/product-card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { getProductImage } from '@/lib/data';
import { Button } from '@/components/ui/button';

interface CategoryClientProps {
  store: Store;
  allProducts: Product[];
  productPrices: Record<string, ProductPrice | null>;
  isLoading: boolean;
}

// Single Category Button component for the new sidebar
function CategoryButton({ category, isSelected, onSelectCategory }) {
    const [image, setImage] = useState({ imageUrl: '', imageHint: '' });
    const [isImageLoading, setIsImageLoading] = useState(true);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (isSelected && buttonRef.current) {
            buttonRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, [isSelected]);

    useEffect(() => {
        const fetchImage = async () => {
            setIsImageLoading(true);
            const imageId = `cat-${category.name.toLowerCase().replace(/ & /g, '-&-').replace(/ /g, '-')}`;
            try {
                const fetchedImage = await getProductImage(imageId);
                setImage(fetchedImage);
            } catch (error) {
                console.error("Failed to fetch image for category:", category.name, error);
                setImage({ imageUrl: 'https://picsum.photos/seed/placeholder/128/128', imageHint: 'placeholder' });
            } finally {
                setIsImageLoading(false);
            }
        };
        fetchImage();
    }, [category.name]);

    return (
        <button
            ref={buttonRef}
            onClick={() => onSelectCategory(category.name)}
            className={cn(
                "flex flex-col items-center justify-start w-20 flex-shrink-0 text-center gap-2 py-3 px-1 rounded-2xl transition-all duration-200",
                isSelected ? "bg-white shadow-md ring-2 ring-primary" : "bg-white/80"
            )}
        >
            {isImageLoading ? (
                 <Skeleton className="w-10 h-10 rounded-full" />
            ) : (
                <Image
                    src={image.imageUrl}
                    alt={category.name}
                    width={40}
                    height={40}
                    data-ai-hint={image.imageHint}
                    className="w-10 h-10 object-cover rounded-full border-2 border-white ring-1 ring-gray-200"
                />
            )}
            <span className="text-xs text-gray-700 font-medium truncate w-full">
              {category.name}
            </span>
        </button>
    );
}

// Sidebar for Desktop
function DesktopCategorySidebar({ categories, selectedCategory, onSelectCategory }) {
  return (
      <aside className="hidden md:block w-24 bg-[#f4f9f0] h-full overflow-y-auto py-4 border-r border-gray-200 sticky top-16">
        <ScrollArea className="h-full">
            <div className="flex flex-col items-center space-y-4">
                {categories.map((cat) => (
                    <CategoryButton 
                        key={cat.name}
                        category={cat}
                        isSelected={cat.name === selectedCategory}
                        onSelectCategory={onSelectCategory}
                    />
                ))}
            </div>
        </ScrollArea>
      </aside>
  );
}

// Horizontal Scroll for Mobile
function MobileCategoryScroller({ categories, selectedCategory, onSelectCategory }) {
    return (
        <div className="md:hidden w-full bg-[#f4f9f0] border-b border-gray-200">
            <ScrollArea className="w-full whitespace-nowrap">
                 <div className="flex space-x-4 p-4">
                    {categories.map((cat) => (
                         <CategoryButton 
                            key={cat.name}
                            category={cat}
                            isSelected={cat.name === selectedCategory}
                            onSelectCategory={onSelectCategory}
                        />
                    ))}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>
    );
}

export function CategoryClient({ store, allProducts, productPrices, isLoading }: CategoryClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const categoryFromUrl = searchParams.get('category');
  const highlightProduct = searchParams.get('highlight');
  
  const categories = useMemo(() => {
    if (!allProducts) return [];
    const categorySet = new Set<string>();
    allProducts.forEach(p => {
        if (p.category) {
            categorySet.add(p.category);
        }
    });
    return Array.from(categorySet).map(name => ({ name }));
  }, [allProducts]);
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryFromUrl);
  const [searchTerm, setSearchTerm] = useState('');
  const { setActiveStoreId } = useCart();
  const highlightedProductRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (store.id) {
        setActiveStoreId(store.id);
    }
    return () => {
      setActiveStoreId(null);
    };
  }, [store.id, setActiveStoreId]);

  useEffect(() => {
    // This effect now correctly handles setting the initial category from the URL,
    // or defaulting to the first category if none is provided.
    const initialCategory = categoryFromUrl && categories.some(c => c.name === categoryFromUrl) 
      ? categoryFromUrl 
      : categories.length > 0 ? categories[0].name : null;
    
    setSelectedCategory(initialCategory);

  }, [categories, categoryFromUrl]);

  const handleSelectCategory = (categoryName: string) => {
    setSelectedCategory(categoryName);
    router.push(`/stores/${store.id}?category=${categoryName}`, { scroll: false });
  };

  const filteredProducts = useMemo(() => {
    let productsToFilter = allProducts;
    
    if (searchTerm) {
      productsToFilter = productsToFilter.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } else if (selectedCategory) {
      productsToFilter = productsToFilter.filter(p => p.category === selectedCategory);
    }

    if (highlightProduct) {
        const highlighted = productsToFilter.find(p => p.name === highlightProduct);
        if (highlighted) {
            return [
                highlighted,
                ...productsToFilter.filter(p => p.name !== highlightProduct)
            ];
        }
    }
    
    return productsToFilter;
  }, [allProducts, selectedCategory, searchTerm, highlightProduct]);
  
  // Effect to scroll to the highlighted product
  useEffect(() => {
    if (highlightProduct && highlightedProductRef.current) {
        setTimeout(() => {
            highlightedProductRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        }, 300); // Small delay to ensure render is complete
    }
  }, [highlightProduct, filteredProducts]); // Rerun when highlightProduct or the list of products changes

  return (
    <div className="flex flex-col md:flex-row w-full h-full bg-[#f4f9f0]">
      <DesktopCategorySidebar categories={categories} selectedCategory={selectedCategory} onSelectCategory={handleSelectCategory} />
      <div className="flex flex-col flex-1">
        <MobileCategoryScroller categories={categories} selectedCategory={selectedCategory} onSelectCategory={handleSelectCategory} />
        <main className="flex-1 overflow-y-auto p-4">
            <div className="flex justify-between items-start md:items-center mb-6 flex-col md:flex-row gap-4">
              <div>
                <h2 className="text-2xl font-bold font-headline">{searchTerm ? "Search Results" : selectedCategory}</h2>
                <p className="text-sm text-muted-foreground">
                  {searchTerm ? `Found ${filteredProducts.length} products` : `Showing ${filteredProducts.length} products in this category.`}
                </p>
              </div>
              <div className="w-full md:max-w-sm">
                <Input
                  placeholder={`Search all products in ${store.name}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)
              ) : filteredProducts.length > 0 ? (
                filteredProducts.map((product) => {
                  const priceData = productPrices[product.name.toLowerCase()];
                  const isHighlighted = product.name === highlightProduct;
                  
                  return (
                    <div ref={isHighlighted ? highlightedProductRef : null} key={product.id}>
                        <ProductCard 
                            product={product} 
                            priceData={priceData} 
                        />
                    </div>
                  );
                })
              ) : (
                <p className="text-muted-foreground col-span-full">No products found matching your criteria.</p>
              )}
            </div>
        </main>
      </div>
    </div>
  );
}

    