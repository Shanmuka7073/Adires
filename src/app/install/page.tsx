
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useInstall } from '@/components/install-provider';
import { Download, Smartphone } from 'lucide-react';
import QRCode from 'qrcode.react';

export default function InstallPage() {
  const { canInstall, triggerInstall } = useInstall();
  const [pageUrl, setPageUrl] = useState('');

  useEffect(() => {
    // This runs on the client, so window is available.
    setPageUrl(window.location.origin);
  }, []);

  return (
    <div className="container mx-auto flex items-center justify-center min-h-[80vh] py-12">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-headline">Install LocalBasket</CardTitle>
          <CardDescription>Get the best experience by installing the app on your device.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {canInstall && (
            <Button onClick={triggerInstall} className="w-full" size="lg">
              <Download className="mr-2 h-5 w-5" />
              Install on This Device
            </Button>
          )}
          
          <div className="text-center space-y-4 p-4 border rounded-lg bg-muted/50">
            <h4 className="font-semibold flex items-center justify-center gap-2">
                <Smartphone className="h-5 w-5" />
                Install on Your Phone
            </h4>
            <p className="text-sm text-muted-foreground">
              Scan the QR code with your phone's camera to open this app on your mobile device and install it from there.
            </p>
            {pageUrl ? (
                <div className="p-4 bg-white rounded-lg inline-block">
                    <QRCode value={pageUrl} size={160} />
                </div>
            ) : (
                <div className="w-40 h-40 bg-gray-200 animate-pulse rounded-lg mx-auto"></div>
            )}
          </div>
          
          {!canInstall && (
            <p className="text-center text-sm text-muted-foreground">
              Your browser does not support direct installation, or the app is already installed. Use the QR code for mobile installation.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
