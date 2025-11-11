
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, ScanLine } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function InstallPage() {
  const [url, setUrl] = useState('');

  useEffect(() => {
    // Ensure this runs only on the client where window is available
    setUrl(window.location.origin);
  }, []);

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-200px)] items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
            <Smartphone className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-3xl font-headline">Install the App</CardTitle>
          <CardDescription>Scan the QR code with your phone's camera to get started.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center gap-6">
          <div className="p-4 bg-white rounded-lg border shadow-sm">
            {url ? (
              <QRCodeSVG value={url} size={256} includeMargin={true} />
            ) : (
              <Skeleton className="w-[288px] h-[288px]" />
            )}
          </div>
          <div className="text-center text-muted-foreground text-sm">
            <p>1. Open your camera app and point it at the code.</p>
            <p>2. Tap the link that appears on your screen.</p>
            <p>3. Follow the browser's prompt to "Add to Home Screen" or "Install".</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
