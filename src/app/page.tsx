
'use client';
import { Button } from '@/components/ui/button';
import { useFirebase } from '@/firebase';
import { Store } from '@/lib/types';
import Link from 'next/link';
import { t } from '@/lib/locales';
import { ArrowRight, ShoppingCart, Send, Map, Target, Eye, Heart } from 'lucide-react';
import Image from 'next/image';

function InfoCard({ icon: Icon, title, description }: { icon: React.ElementType, title: string, description: string }) {
    return (
        <div className="flex flex-col items-center text-center p-6 bg-card rounded-xl shadow-sm h-full">
            <div className="p-4 bg-primary/10 rounded-full mb-4">
                <Icon className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-bold mb-2 font-headline">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
        </div>
    );
}


export default function Home() {
  const { firestore } = useFirebase();

  return (
    <div className="flex flex-col">
       <section className="relative w-full h-[60vh] min-h-[400px] md:h-[70vh] flex items-center justify-center text-center text-white">
        <div className="absolute inset-0 bg-black/50 z-10" />
         <Image
            src="https://images.unsplash.com/photo-1601614393967-a2f6dd023f74?q=80&w=2070&auto=format&fit=crop"
            alt="Fresh groceries"
            fill
            className="object-cover"
        />
        <div className="container relative z-20 px-4 md:px-6">
          <div className="flex flex-col items-center space-y-6">
             <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl font-headline drop-shadow-md">
                Shop Fresh. Shop Local.
            </h1>
            <p className="max-w-[700px] text-lg md:text-xl drop-shadow">
                Your hands-free shopping assistant for local groceries. Order from your favorite neighborhood stores just by using your voice.
            </p>
            <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Link href="/stores">
                    Explore Nearby Stores <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="w-full py-16 md:py-24 lg:py-32">
        <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
                <div className="inline-block rounded-lg bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">How It Works</div>
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl font-headline">
                    Order in 3 Simple Steps
                </h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                    Get your groceries delivered without the hassle.
                </p>
            </div>
            <div className="mx-auto grid max-w-5xl items-start gap-8 sm:grid-cols-3">
                <InfoCard
                    icon={Map}
                    title="1. Find Your Store"
                    description="Browse a list of stores in your area or simply say 'Find stores near me'."
                />
                <InfoCard
                    icon={ShoppingCart}
                    title="2. Place Your Order"
                    description="Add items to your cart manually or say 'Order 1kg of onions and a packet of milk'."
                />
                 <InfoCard
                    icon={Send}
                    title="3. Get It Delivered"
                    description="Your order is sent to the store owner for fulfillment and delivery to your doorstep."
                />
            </div>
        </div>
      </section>

      <section className="w-full py-16 md:py-24 lg:py-32 bg-secondary/30">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
              <div className="inline-block rounded-lg bg-accent/10 px-3 py-1 text-sm font-semibold text-accent-foreground">Our Story</div>
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl font-headline">
                AI for Bharat
              </h2>
              <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                We are building the fastest, smartest, and most natural grocery voice engine in India, designed specially for Indian languages, accents, and real-life speech.
              </p>
          </div>
           <div className="mx-auto grid max-w-5xl items-start gap-8 sm:grid-cols-3">
               <InfoCard
                    icon={Target}
                    title="The Problem"
                    description="Most grocery apps fail when users speak naturally with mixed languages, slang, or regional accents. We solve this."
                />
                <InfoCard
                    icon={Eye}
                    title="Our Vision"
                    description="To become India’s No.1 AI Grocery Voice Platform, powering every home and every store with simple, voice-based shopping."
                />
                 <InfoCard
                    icon={Heart}
                    title="Our Mission"
                    description="To empower local neighborhood stores and connect them directly with customers through technology that understands them."
                />
          </div>
        </div>
      </section>
    </div>
  );
}
