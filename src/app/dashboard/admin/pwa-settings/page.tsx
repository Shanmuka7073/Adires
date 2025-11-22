
'use client';

import { useState, useEffect, useTransition } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Trash2, BookCopy } from 'lucide-react';
import { updateManifest, getManifest } from '@/app/actions';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';

const shortcutSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  url: z.string().min(1, 'URL is required.'),
  icons: z.array(z.object({
    src: z.string().min(1, 'Icon source is required.'),
    sizes: z.string().min(1, 'Sizes are required.'),
  })),
});

const screenshotSchema = z.object({
  src: z.string().min(1, 'Source URL is required.'),
  sizes: z.string().min(1, 'Sizes are required.'),
  type: z.string().min(1, 'Type is required.'),
  form_factor: z.string().optional(),
  label: z.string().optional(),
});

const manifestSchema = z.object({
  screenshots: z.array(screenshotSchema),
  shortcuts: z.array(shortcutSchema),
});

type ManifestFormValues = z.infer<typeof manifestSchema>;

export default function PwaSettingsPage() {
    const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [isSaving, startSaveTransition] = useTransition();
    const [isLoadingManifest, setIsLoadingManifest] = useState(true);

    const form = useForm<ManifestFormValues>({
        resolver: zodResolver(manifestSchema),
        defaultValues: {
            screenshots: [],
            shortcuts: [],
        },
    });

    const { fields: screenshotFields, append: appendScreenshot, remove: removeScreenshot } = useFieldArray({
        control: form.control,
        name: "screenshots",
    });

    const { fields: shortcutFields, append: appendShortcut, remove: removeShortcut } = useFieldArray({
        control: form.control,
        name: "shortcuts",
    });

    useEffect(() => {
        if (!isAdminLoading && !isAdmin) {
            router.replace('/dashboard');
        }
    }, [isAdminLoading, isAdmin, router]);

    useEffect(() => {
        async function loadManifest() {
            setIsLoadingManifest(true);
            try {
                const manifestData = await getManifest();
                if (manifestData) {
                    form.reset({
                        screenshots: manifestData.screenshots || [],
                        shortcuts: manifestData.shortcuts || [],
                    });
                }
            } catch (error) {
                toast({
                    variant: 'destructive',
                    title: 'Failed to load manifest',
                    description: (error as Error).message,
                });
            } finally {
                setIsLoadingManifest(false);
            }
        }
        loadManifest();
    }, [form, toast]);


    const onSubmit = (data: ManifestFormValues) => {
        startSaveTransition(async () => {
            try {
                const result = await updateManifest(data);
                if (result.success) {
                    toast({
                        title: 'Manifest Updated!',
                        description: 'Your PWA settings have been saved successfully.',
                    });
                } else {
                    throw new Error(result.error || 'An unknown error occurred.');
                }
            } catch (error) {
                 toast({
                    variant: 'destructive',
                    title: 'Update Failed',
                    description: (error as Error).message,
                });
            }
        });
    };

    if (isAdminLoading || isLoadingManifest) {
        return <p className="container mx-auto py-12">Loading PWA Settings...</p>;
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-3xl font-headline flex items-center gap-2">
                       <BookCopy className="h-8 w-8 text-primary" />
                        PWA Manifest Settings
                    </CardTitle>
                    <CardDescription>
                        Manage your Progressive Web App's screenshots and shortcuts here. Changes will update the `public/manifest.json` file.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        {/* Screenshots Section */}
                        <div className="space-y-4">
                            <h3 className="text-xl font-semibold">App Screenshots</h3>
                            {screenshotFields.map((field, index) => (
                                <div key={field.id} className="p-4 border rounded-lg space-y-3 relative">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <Label>Screenshot URL</Label>
                                            <Input {...form.register(`screenshots.${index}.src`)} placeholder="e.g., /screenshot-mobile-1.png" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label>Sizes (widthxheight)</Label>
                                            <Input {...form.register(`screenshots.${index}.sizes`)} placeholder="e.g., 360x740" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label>Type</Label>
                                            <Input {...form.register(`screenshots.${index}.type`)} defaultValue="image/png" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label>Form Factor (optional)</Label>
                                            <Input {...form.register(`screenshots.${index}.form_factor`)} placeholder="narrow or wide" />
                                        </div>
                                    </div>
                                    <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2" onClick={() => removeScreenshot(index)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                            <Button type="button" variant="outline" onClick={() => appendScreenshot({ src: '', sizes: '', type: 'image/png', form_factor: '', label: '' })}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Add Screenshot
                            </Button>
                        </div>
                        
                        {/* Shortcuts Section */}
                        <div className="space-y-4">
                            <h3 className="text-xl font-semibold">App Shortcuts</h3>
                            {shortcutFields.map((field, index) => (
                                <div key={field.id} className="p-4 border rounded-lg space-y-3 relative">
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <Label>Name</Label>
                                            <Input {...form.register(`shortcuts.${index}.name`)} placeholder="e.g., View Cart" />
                                        </div>
                                         <div className="space-y-1">
                                            <Label>URL</Label>
                                            <Input {...form.register(`shortcuts.${index}.url`)} placeholder="e.g., /cart" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label>Icon URL</Label>
                                            <Input {...form.register(`shortcuts.${index}.icons.0.src`)} placeholder="e.g., /icon-cart-96x96.png" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label>Icon Sizes</Label>
                                            <Input {...form.register(`shortcuts.${index}.icons.0.sizes`)} defaultValue="96x96" />
                                        </div>
                                    </div>
                                    <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2" onClick={() => removeShortcut(index)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                            <Button type="button" variant="outline" onClick={() => appendShortcut({ name: '', url: '', icons: [{ src: '', sizes: '96x96' }] })}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Add Shortcut
                            </Button>
                        </div>

                        <Button type="submit" disabled={isSaving} className="w-full" size="lg">
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save Manifest Changes
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

