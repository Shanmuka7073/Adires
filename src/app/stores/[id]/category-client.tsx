
'use client';
import { useState, useMemo, useEffect } from 'react';
import { Product, ProductPrice, Store } from '@/lib/types';
import { useCart } from '@/lib/cart';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import ProductCard from '@/components/product-card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchParams } from 'next/navigation';
import CategoryIcon from '@/components/features/CategoryIcon';
import Image from 'next/image';
import { getProductImage } from '@/lib/data';

interface CategoryClientProps {
  store: Store;
  initialCategories: { categoryName: string; items: string[] }[];
  allProducts: Product[];
  productPrices: Record<string, ProductPrice | null>;
  isLoading: boolean;
}

// Single Category Button component for the new sidebar
function CategoryButton({ category, isSelected, onSelectCategory }) {
    const [image, setImage] = useState({ imageUrl: '', imageHint: '' });
    const [isImageLoading, setIsImageLoading] = useState(true);

    useEffect(() => {
        const fetchImage = async () => {
            setIsImageLoading(true);
            const imageId = `cat-${category.categoryName.toLowerCase().replace(/ & /g, '-&-').replace(/ /g, '-')}`;
            try {
                const fetchedImage = await getProductImage(imageId);
                setImage(fetchedImage);
            } catch (error) {
                console.error("Failed to fetch image for category:", category.categoryName, error);
                // Set a fallback image
                setImage({ imageUrl: 'https://picsum.photos/seed/placeholder/128/128', imageHint: 'placeholder' });
            }
            setIsImageLoading(false);
        };
        fetchImage();
    }, [category.categoryName]);

    return (
        <button
            onClick={() => onSelectCategory(category.categoryName)}
            className={cn(
                "flex flex-col items-center w-20 bg-white rounded-2xl shadow-sm py-3 px-2 transition-all hover:shadow-md hover:-translate-y-1",
                isSelected && "ring-2 ring-primary"
            )}
        >
            {isImageLoading ? (
                 <Skeleton className="w-12 h-12 rounded-full" />
            ) : (
                <Image
                    src={image.imageUrl}
                    alt={category.categoryName}
                    width={48}
                    height={48}
                    data-ai-hint={image.imageHint}
                    className="w-12 h-12 object-cover rounded-full border"
                />
            )}
            <span className="text-xs text-gray-700 font-medium mt-2 text-center truncate w-full">
              {category.categoryName}
            </span>
        </button>
    );
}

function CategorySidebar({ categories, selectedCategory, onSelectCategory }) {
  return (
      <aside className="w-24 bg-[#f4f9f0] h-screen overflow-y-auto py-4 border-r border-gray-200 sticky top-0">
        <ScrollArea className="h-full">
            <div className="flex flex-col items-center space-y-4">
                {categories.map((cat) => (
                    <CategoryButton 
                        key={cat.categoryName}
                        category={cat}
                        isSelected={cat.categoryName === selectedCategory}
                        onSelectCategory={onSelectCategory}
                    />
                ))}
            </div>
        </ScrollArea>
      </aside>
  );
}

export function CategoryClient({ store, initialCategories, allProducts, productPrices, isLoading }: CategoryClientProps) {
  const searchParams = useSearchParams();
  const categoryFromUrl = searchParams.get('category');
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryFromUrl);
  const [searchTerm, setSearchTerm] = useState('');
  const { setActiveStoreId } = useCart();

  useEffect(() => {
    // Set the active store in the cart context when visiting this page
    if (store.id) {
        setActiveStoreId(store.id);
    }
    // Cleanup function to clear the active store when leaving the page
    return () => {
      setActiveStoreId(null);
    };
  }, [store.id, setActiveStoreId]);

  useEffect(() => {
    // If a category is passed via URL, use it.
    if (categoryFromUrl && initialCategories.some(c => c.categoryName === categoryFromUrl)) {
      setSelectedCategory(categoryFromUrl);
    } 
    // Otherwise, if no category is selected and categories are loaded, default to the first one.
    else if (!selectedCategory && initialCategories.length > 0) {
      setSelectedCategory(initialCategories[0].categoryName);
    }
  }, [initialCategories, selectedCategory, categoryFromUrl]);

  const filteredProducts = useMemo(() => {
    if (searchTerm) {
      return allProducts.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (selectedCategory) {
      return allProducts.filter(p => p.category === selectedCategory);
    }
    return [];
  }, [allProducts, selectedCategory, searchTerm]);

  return (
    <div className="flex w-full h-screen bg-[#f4f9f0]">
      <CategorySidebar categories={initialCategories} selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
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
                <>
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-64 w-full" />
                </>
            ) : filteredProducts.length > 0 ? (
              filteredProducts.map((product) => {
                const priceData = productPrices[product.name.toLowerCase()];
                return <ProductCard key={product.id} product={product} priceData={priceData} />;
              })
            ) : (
              <p className="text-muted-foreground col-span-full">No products found matching your criteria.</p>
            )}
          </div>
        </main>
    </div>
  );
}
