
'use client';

import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
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


// This function now safely parses the markdown-like text into React elements
// to avoid the catastrophic backtracking issue caused by the previous regex.
function formatPitch(text: string) {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];

    lines.forEach((line, index) => {
        if (line.trim() === '---') {
            elements.push(<hr key={`hr-${index}`} className="my-6" />);
        } else if (line.startsWith('### ')) {
            elements.push(<h3 key={index} className="text-xl font-bold mt-4">{line.substring(4)}</h3>);
        } else if (line.startsWith('#### ')) {
            elements.push(<h4 key={index} className="text-lg font-semibold mt-2">{line.substring(5)}</h4>);
        } else if (line.startsWith('* ')) {
            const content = line.substring(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            elements.push(<li key={index} dangerouslySetInnerHTML={{ __html: content }} />);
        } else if (line.startsWith('> ')) {
             elements.push(<blockquote key={index} className="pl-4 border-l-4 italic my-2">{line.substring(2)}</blockquote>);
        }
        else {
             const content = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
             elements.push(<p key={index} dangerouslySetInnerHTML={{ __html: content }} />);
        }
    });

    return <>{elements}</>;
}

export function PitchDisplay({ pitchText }: { pitchText: string }) {

    const handleShare = () => {
        // Strip markdown for sharing plain text
        const textToShare = pitchText
            .replace(/### |#### |\* |> /g, '') 
            .replace(/---/g, '\n')
            .replace(/\*\*/g, '');

        const encodedText = encodeURIComponent(textToShare);
        const whatsappUrl = `https://wa.me/?text=${encodedText}`;

        window.open(whatsappUrl, '_blank');
        
        toast({
            title: "Sharing Pitch",
            description: "Opening WhatsApp in a new tab.",
        });
    };

    return (
        <div className="space-y-6">
            <Button onClick={handleShare} className="w-full md:w-auto">
                <WhatsAppIcon className="mr-2 h-4 w-4" />
                Share Pitch on WhatsApp
            </Button>
            <div className="prose prose-sm sm:prose-base lg:prose-lg xl:prose-xl max-w-none space-y-4">
               {formatPitch(pitchText)}
            </div>
        </div>
    );
}
