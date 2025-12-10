
'use client';

import { useState, useTransition, useEffect } from 'react';
import { useFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Link, Save, Upload, Video } from 'lucide-react';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import type { SiteConfig } from '@/lib/types';
import { getSiteConfig, updateSiteConfig } from '@/app/actions';
import { Progress } from '@/components/ui/progress';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';


export default function SiteConfigPage() {
  const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, startSaveTransition] = useTransition();
  const [isUploading, startUploadTransition] = useTransition();
  const [config, setConfig] = useState<Partial<SiteConfig>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  useEffect(() => {
    if (!isAdminLoading && !isAdmin) {
      router.replace('/dashboard');
    }
  }, [isAdmin, isAdminLoading, router]);

  useEffect(() => {
    async function loadConfig() {
      setIsLoading(true);
      const siteConfig = await getSiteConfig('live-order');
      if (siteConfig) {
        setConfig(siteConfig);
      }
      setIsLoading(false);
    }
    loadConfig();
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setVideoFile(event.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (!videoFile) {
        toast({ variant: 'destructive', title: 'No file selected.' });
        return;
    }
    
    startUploadTransition(() => {
        const storage = getStorage();
        const fileName = `live-order-videos/${Date.now()}-${videoFile.name}`;
        const storageRef = ref(storage, fileName);
        const uploadTask = uploadBytesResumable(storageRef, videoFile);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(progress);
            },
            (error) => {
                console.error("Video upload failed:", error);
                toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
                setUploadProgress(0);
            },
            () => {
                getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                    setConfig(prev => ({...prev, liveVideoUrl: downloadURL}));
                    toast({ title: 'Upload Successful!', description: 'URL has been updated. Click save to apply.'});
                    setVideoFile(null);
                });
            }
        );
    });
  }

  const handleSave = () => {
    startSaveTransition(async () => {
      try {
        const result = await updateSiteConfig('live-order', config);
        if (result.success) {
          toast({ title: 'Settings Saved', description: 'Your live order settings have been updated.' });
        } else {
          throw new Error(result.error || 'An unknown server error occurred.');
        }
      } catch (error) {
        toast({ variant: 'destructive', title: 'Save Failed', description: (error as Error).message });
      }
    });
  };

  if (isLoading || isAdminLoading) {
    return <div className="container mx-auto py-12">Loading settings...</div>;
  }

  return (
    <div className="container mx-auto py-12 px-4 md:px-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-6 w-6 text-primary" />
            Live Order Video Configuration
          </CardTitle>
          <CardDescription>
            Set up the video stream that customers will see after placing an order. This builds trust by showing them their order being prepared.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
            <Card>
                 <CardHeader>
                    <CardTitle className="text-lg">Option 1: Paste a Video URL</CardTitle>
                    <CardDescription>Paste a link from YouTube Live, Facebook Live, or a direct video file URL (.mp4, .webm).</CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="space-y-2">
                        <Label htmlFor="live-video-url">Live Stream or Video URL</Label>
                        <div className="flex items-center gap-2">
                            <Link className="h-9 w-9 text-muted-foreground" />
                            <Input
                            id="live-video-url"
                            placeholder="https://www.youtube.com/watch?v=..."
                            value={config.liveVideoUrl || ''}
                            onChange={(e) => setConfig({ ...config, liveVideoUrl: e.target.value })}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
            </div>

            <Card>
                 <CardHeader>
                    <CardTitle className="text-lg">Option 2: Upload a Video File</CardTitle>
                    <CardDescription>Upload a video file directly. This is useful for short, looping clips.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="space-y-2">
                        <Label htmlFor="video-file">Video File (mp4, webm)</Label>
                        <Input id="video-file" type="file" accept="video/mp4,video/webm" onChange={handleFileChange} disabled={isUploading}/>
                    </div>
                    {isUploading && <Progress value={uploadProgress} />}
                    <Button onClick={handleUpload} disabled={isUploading || !videoFile} className="w-full">
                        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4" />}
                        {isUploading ? `Uploading... ${Math.round(uploadProgress)}%` : 'Upload Video'}
                    </Button>
                </CardContent>
            </Card>

        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Settings
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
