'use client';
import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Globe, Mic, ShoppingCart } from 'lucide-react';
import Image from 'next/image';

export default function LocalBasketHome() {
  const categories = [
    { name: "Vegetables", img: "https://picsum.photos/seed/veg/128/128", imageHint: "vegetables" },
    { name: "Fruits", img: "https://picsum.photos/seed/fruits/128/128", imageHint: "fruits" },
    { name: "Meat & Fish", img: "https://picsum.photos/seed/meat/128/128", imageHint: "meat fish" },
    { name: "Fresh Cut", img: "https://picsum.photos/seed/cut/128/128", imageHint: "fresh cut" },
    { name: "Personal Care", img: "https://picsum.photos/seed/personal/128/128", imageHint: "personal care" },
  ];

  const products = [
    {
      name: "Shampoo",
      telugu: "షాంపూ",
      img: "https://picsum.photos/seed/shampoo/400/300",
      imageHint: "shampoo bottle",
      price: 144,
      cut: 169,
      weight: "200 ml",
    },
    {
      name: "Toothpaste",
      telugu: "టూత్‌పేస్ట్",
      img: "https://picsum.photos/seed/toothpaste/400/300",
      imageHint: "toothpaste tube",
      price: 84,
      cut: 98,
      weight: "150 g",
    },
  ];

  return (
    <div className="min-h-screen flex bg-[#f2f9f2]">
      {/* ----- Sidebar ----- */}
      <aside className="w-24 bg-[#e9f5e9] border-r border-[#d8ead8] py-4 overflow-y-auto">
        <div className="flex flex-col items-center gap-6">
          {categories.map((cat, i) => (
            <div
              key={i}
              className="flex flex-col items-center w-20 bg-white rounded-2xl shadow-sm 
              hover:shadow-md hover:-translate-y-1 transition-all p-3 cursor-pointer"
            >
              <Image
                src={cat.img}
                alt={cat.name}
                data-ai-hint={cat.imageHint}
                width={48}
                height={48}
                className="w-12 h-12 rounded-full object-cover border"
              />
              <span className="mt-2 text-xs text-gray-700 font-medium text-center">
                {cat.name}
              </span>
            </div>
          ))}
        </div>
      </aside>

      {/* ----- Main Content ----- */}
      <main className="flex-1 p-4 overflow-y-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-800">LocalBasket</h1>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="p-2 rounded-xl bg-white shadow-sm">
              <Globe className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="icon" className="p-2 rounded-xl bg-white shadow-sm">
              <Mic className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="icon" className="p-2 rounded-xl bg-white shadow-sm">
              <ShoppingCart className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Section Title */}
        <h2 className="text-xl font-semibold text-gray-800 mb-3">
          Featured Products
        </h2>

        {/* Product Grid */}
        <div className="grid grid-cols-2 gap-4">
          {products.map((p, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all p-3 relative"
            >
              {/* Offer Badge */}
              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full absolute top-2 right-2 z-10">
                15% OFF
              </span>

              <Image
                src={p.img}
                alt={p.name}
                data-ai-hint={p.imageHint}
                width={400}
                height={300}
                className="w-full h-32 object-cover rounded-xl mb-2"
              />

              <h3 className="font-bold text-gray-800 text-sm">{p.name}</h3>
              <p className="text-gray-500 text-xs">{p.telugu}</p>

              <div className="flex items-center gap-2 mt-1">
                <span className="text-green-600 font-semibold text-lg">
                  ₹{p.price}
                </span>
                <span className="line-through text-gray-400 text-sm">
                  ₹{p.cut}
                </span>
              </div>

              <p className="text-gray-500 text-xs mb-2">{p.weight}</p>

              <Button className="w-full bg-[#ff7d1a] hover:bg-[#ff6c00] text-white py-2 rounded-xl font-medium">
                Add to Cart
              </Button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
