
'use client';

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { getProductImage } from "@/lib/data";
import { useEffect, useState } from "react";
import { Skeleton } from "../ui/skeleton";

interface CategoryIconProps {
  category: {
    categoryName: string;
    items: string[];
  };
}

// Helper to create a slug from a category name
const createSlug = (name: string) => {
  return name.toLowerCase().replace(/ & /g, '-&-').replace(/ /g, '-');
}

export default function CategoryIcon({ category }: CategoryIconProps) {
  const [image, setImage] = useState({ imageUrl: '', imageHint: '' });
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const fetchImage = async () => {
      setIsLoading(true);
      const imageId = `cat-${createSlug(category.categoryName)}`;
      const fetchedImage = await getProductImage(imageId);
      setImage(fetchedImage);
      setIsLoading(false);
    }
    fetchImage();
  }, [category.categoryName]);

  if (isLoading) {
    return (
        <div className="flex flex-col items-center gap-2">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-4 w-12" />
        </div>
    )
  }

  return (
    <Link href="#" className="group flex flex-col items-center gap-2 text-center">
      <Card className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden transition-all group-hover:shadow-md group-hover:scale-105 border-2 border-transparent group-hover:border-primary">
        <CardContent className="p-0 w-full h-full relative">
            <Image 
                src={image.imageUrl}
                alt={category.categoryName}
                data-ai-hint={image.imageHint}
                width={64}
                height={64}
                className="object-cover"
            />
        </CardContent>
      </Card>
      <span className="text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">{category.categoryName}</span>
    </Link>
  );
}
