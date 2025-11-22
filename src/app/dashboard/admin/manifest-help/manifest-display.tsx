
'use client';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Copy, Share2 } from 'lucide-react';

function WhatsAppIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}

export function ManifestDisplay({ manifestText }: { manifestText: string }) {
    const { toast } = useToast();

    const handleCopy = () => {
        navigator.clipboard.writeText(manifestText).then(() => {
            toast({
                title: "Manifest Copied!",
                description: "The PWA manifest has been copied to your clipboard.",
            });
        }, (err) => {
            toast({
                variant: 'destructive',
                title: "Copy Failed",
                description: "Could not copy the manifest to your clipboard.",
            });
            console.error('Could not copy text: ', err);
        });
    };

    const handleShare = () => {
        const encodedText = encodeURIComponent(manifestText);
        const whatsappUrl = `https://wa.me/?text=${encodedText}`;
        window.open(whatsappUrl, '_blank');
        toast({
            title: "Sharing Manifest",
            description: "Opening WhatsApp in a new tab.",
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
                 <Button onClick={handleCopy}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Manifest
                </Button>
                <Button onClick={handleShare} variant="outline">
                    <WhatsAppIcon className="mr-2 h-4 w-4" />
                    Share on WhatsApp
                </Button>
            </div>
            <pre className="p-4 bg-muted text-muted-foreground rounded-md overflow-x-auto text-sm">
                <code>{manifestText}</code>
            </pre>
        </div>
    );
}

    