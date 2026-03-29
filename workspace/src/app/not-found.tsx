'use client';

import Link from 'next/link';
import { Frown } from 'lucide-react';

/**
 * Custom 404 Not Found Page.
 * Refactored to use standard Tailwind CSS for better App Router stability.
 */
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-800 p-6">
      <div className="text-center bg-white p-10 rounded-[3rem] shadow-2xl max-w-lg w-full border-0">
        
        <div className="bg-primary/5 w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
            <Frown className="w-12 h-12 text-primary animate-bounce-slow" />
        </div>

        <h1 className="text-7xl font-black text-gray-900 mb-2 font-headline tracking-tighter">
          404
        </h1>
        
        <h2 className="text-2xl font-bold text-gray-700 mb-4 uppercase tracking-tight">
          Page Not Found
        </h2>
        
        <p className="text-sm font-bold text-gray-500 mb-8 uppercase opacity-60 leading-tight">
          The hub you are looking for doesn't exist or has been moved.
        </p>

        <Button asChild className="h-12 px-8 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20">
            <Link href="/">Return to Home</Link>
        </Button>
      </div>
    </div>
  );
}

function Button({ children, asChild, className, ...props }: any) {
    return <button className={className} {...props}>{children}</button>;
}
