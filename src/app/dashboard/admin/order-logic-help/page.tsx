'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function DecommissionedPage() {
    const router = useRouter();
    useEffect(() => { router.replace('/dashboard/admin'); }, [router]);
    return <div className="p-12 text-center opacity-20"><Loader2 className="animate-spin mx-auto h-8 w-8 text-primary" /></div>;
}
