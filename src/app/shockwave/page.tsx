
'use client';

import dynamic from 'next/dynamic';

// Dynamically import the VirtualSupermarket to ensure it's client-side only
const VirtualSupermarket = dynamic(() => import('@/components/VirtualSupermarket'), { ssr: false });

export default function AnimationDemoPage() {

  return (
    <div className="w-full h-screen bg-gray-100">
        <VirtualSupermarket />
    </div>
  );
}
