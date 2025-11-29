
'use client';

import dynamic from 'next/dynamic';

const VirtualMarket = dynamic(() => import('@/components/VirtualMarket'), { ssr: false });

export default function Page() {
  return <VirtualMarket />;
}
