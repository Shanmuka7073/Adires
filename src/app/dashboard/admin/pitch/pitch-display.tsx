
'use client';

import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

function ShareIcon(props) {
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
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" x2="12" y1="2" y2="15" />
    </svg>
  )
}


function WhatsAppIcon(props) {
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


// A simple regex-based markdown to HTML converter for the pitch.
// This is not a full-featured markdown parser but is sufficient for this specific text.
function formatPitch(text: string) {
    let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br />')
        .replace(/### (.*?)<br \/>/g, '<h3>$1</h3>')
        .replace(/#### (.*?)<br \/>/g, '<h4>$1</h4>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\* (.*?)<br \/>/g, '<li>$1</li>')
        .replace(/<br \/>---<br \/>/g, '<hr />');

    return html;
}

export function PitchDisplay({ pitchText }: { pitchText: string }) {

    const handleShare = () => {
        const textToShare = pitchText.replace(/<\/?[^>]+(>|$)/g, ""); // Strip HTML for sharing
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
            <div 
                className="prose prose-sm sm:prose-base lg:prose-lg xl:prose-xl max-w-none space-y-4"
                dangerouslySetInnerHTML={{ __html: formatPitch(pitchText) }}
            />
        </div>
    );
}

