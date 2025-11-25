
'use client';

import React, { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileUp, Sparkles, AlertTriangle } from 'lucide-react';
import { processPdfAndExtractRules } from '@/app/actions';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useNLUDashboard } from './nlu-dashboard-context';

export function PDFUploadPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, startProcessing] = useTransition();
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const { toast } = useToast();
  const { refreshData } = useNLUDashboard();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleUploadAndProcess = async () => {
    if (!file) {
      toast({ variant: 'destructive', title: 'No file selected' });
      return;
    }

    startProcessing(async () => {
      try {
        setStatusMessage('Uploading PDF to server...');
        setProgress(10);
        const formData = new FormData();
        formData.append('pdf', file);

        const result = await processPdfAndExtractRules(formData);

        if (result.success) {
          setProgress(100);
          setStatusMessage(`Processing complete! Found ${result.sentenceCount} sentences.`);
          toast({
            title: 'Processing Complete!',
            description: `Extracted and analyzed ${result.sentenceCount} sentences from the PDF.`,
          });
          refreshData(); // Refresh the data in the context
        } else {
          throw new Error(result.error || 'An unknown error occurred.');
        }

      } catch (error: any) {
        console.error('PDF processing failed:', error);
        setStatusMessage(`Error: ${error.message}`);
        setProgress(0);
        toast({
          variant: 'destructive',
          title: 'Processing Failed',
          description: error.message,
        });
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 1: Upload and Process a PDF</CardTitle>
        <CardDescription>
          Upload a document (like a recipe book, manual, or article) containing text in various languages. The system will extract sentences and analyze them for new number patterns.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input type="file" accept="application/pdf" onChange={handleFileChange} disabled={isProcessing} />
        <Button onClick={handleUploadAndProcess} disabled={isProcessing || !file} className="w-full">
          {isProcessing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {isProcessing ? 'Processing...' : 'Upload & Extract Rules'}
        </Button>

        {isProcessing && (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-sm text-center text-muted-foreground">{statusMessage}</p>
          </div>
        )}
        
        {!isProcessing && statusMessage.startsWith('Error') && (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4"/>
                <AlertTitle>Processing Error</AlertTitle>
                <AlertDescription>{statusMessage}</AlertDescription>
            </Alert>
        )}
      </CardContent>
    </Card>
  );
}
