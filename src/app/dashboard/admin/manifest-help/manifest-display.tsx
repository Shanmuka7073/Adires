
'use client';

import { useState, useTransition, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Copy, Save } from 'lucide-react';
import { getManifest, updateManifest } from '@/app/actions';
import { Loader2 } from 'lucide-react';

export function ManifestDisplay({ initialManifest }: { initialManifest: any }) {
    const { toast } = useToast();
    const [manifestContent, setManifestContent] = useState(JSON.stringify(initialManifest, null, 2));
    const [isSaving, startSaveTransition] = useTransition();

    const handleCopy = () => {
        navigator.clipboard.writeText(manifestContent).then(() => {
            toast({
                title: "Manifest Copied!",
                description: "The manifest content has been copied to your clipboard.",
            });
        }).catch(err => {
            toast({
                variant: 'destructive',
                title: "Copy Failed",
            });
        });
    };

    const handleSave = () => {
        startSaveTransition(async () => {
            try {
                const parsedManifest = JSON.parse(manifestContent);
                const result = await updateManifest(parsedManifest);
                if (result.success) {
                    toast({
                        title: "Manifest Saved!",
                        description: "Your manifest.json file has been updated.",
                    });
                } else {
                    throw new Error(result.error || "An unknown error occurred.");
                }
            } catch (error: any) {
                toast({
                    variant: 'destructive',
                    title: 'Save Failed',
                    description: error.message || 'The content is not valid JSON.',
                });
            }
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-4">
                <Button onClick={handleCopy} variant="outline">
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Manifest
                </Button>
                 <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                </Button>
            </div>
            <textarea
                value={manifestContent}
                onChange={(e) => setManifestContent(e.target.value)}
                className="w-full h-96 p-4 bg-muted text-muted-foreground rounded-md font-mono text-sm border"
                placeholder="Enter valid JSON for manifest.json..."
            />
        </div>
    );
}
