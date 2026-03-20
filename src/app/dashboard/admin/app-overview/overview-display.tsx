'use client';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import React from 'react';

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

function formatContent(text: string): React.ReactNode {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let listItems: string[] = [];

    const flushList = () => {
        if (listItems.length > 0) {
            elements.push(
                <ul key={`ul-${elements.length}`} className="list-disc pl-6 space-y-2">
                    {listItems.map((item, i) => {
                        const html = item.replace(/`([^`]+)`/g, '<code class="bg-muted text-muted-foreground font-mono text-sm px-1 py-0.5 rounded">$1</code>');
                        return <li key={i} dangerouslySetInnerHTML={{ __html: html }} />;
                    })}
                </ul>
            );
            listItems = [];
        }
    };

    lines.forEach((line, index) => {
        if (line.trim() === '---') {
            flushList();
            elements.push(<hr key={`hr-${index}`} className="my-8 border-dashed" />);
        } else if (line.startsWith('## ')) {
            flushList();
            elements.push(<h2 key={index} className="text-2xl font-bold mt-8 mb-4 font-headline text-primary">{line.substring(3)}</h2>);
        } else if (line.startsWith('### ')) {
            flushList();
            elements.push(<h3 key={index} className="text-xl font-semibold mt-6 mb-3">{line.substring(4)}</h3>);
        } else if (line.startsWith('* ')) {
            listItems.push(line.substring(2));
        } else if (line.trim() === '') {
            flushList();
        } else {
            flushList();
            const html = line.replace(/`([^`]+)`/g, '<code class="bg-muted text-muted-foreground font-mono text-sm px-1 py-0.5 rounded">$1</code>');
            elements.push(<p key={index} className="text-base leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />);
        }
    });

    flushList(); // Make sure any trailing list items are rendered
    return <>{elements}</>;
}


export function OverviewDisplay({ overviewText }: { overviewText: string }) {
    const { toast } = useToast();

    const handleShare = () => {
        // Strip markdown for sharing plain text
        const textToShare = overviewText
            .replace(/## |### |\* |> /g, '') 
            .replace(/---/g, '\n')
            .replace(/`/g, '');

        const encodedText = encodeURIComponent(textToShare);
        const whatsappUrl = `https://wa.me/?text=${encodedText}`;

        window.open(whatsappUrl, '_blank');
        
        toast({
            title: "Sharing Overview",
            description: "Opening WhatsApp in a new tab.",
        });
    };

    return (
        <div className="space-y-6">
            <Button onClick={handleShare} className="w-full md:w-auto">
                <WhatsAppIcon className="mr-2 h-4 w-4" />
                Share Overview on WhatsApp
            </Button>
            <div className="prose prose-sm sm:prose-base lg:prose-lg xl:prose-xl max-w-none space-y-4">
               {formatContent(overviewText)}
            </div>
        </div>
    );
}
