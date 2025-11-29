'use client';

import dynamic from 'next/dynamic';

const VirtualSupermarket = dynamic(() => import('@/components/VirtualSupermarket'), { ssr: false });

export default function Page() {
  return <VirtualSupermarket />;
}
