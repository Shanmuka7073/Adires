'use client';

import { Button } from '@/components/ui/button';
import { Wand2 } from 'lucide-react';
import { useAsha } from '@/components/layout/asha-context';
import { usePathname } from 'next/navigation';

/**
 * A specialized client-component button that triggers the Asha Strategic AI.
 * It pre-fills a message to analyze the current page's source code.
 */
export function DesignButton() {
    const { triggerAsha } = useAsha();
    const pathname = usePathname();

    const handleClick = () => {
        // Trigger Asha with a contextual instruction to audit the current page.
        triggerAsha(`Analyze the source code for ${pathname} and suggest a strategic refactor or UI improvement.`);
    };

    return (
        <Button 
            onClick={handleClick}
            variant="outline" 
            className="rounded-full h-12 px-6 border-2 font-black uppercase text-[10px] tracking-widest text-primary border-primary/20 bg-primary/5 hover:bg-primary/10"
        >
            <Wand2 className="mr-2 h-4 w-4" /> ✨ Design UI with Asha
        </Button>
    );
}
