'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Trash2, ImageIcon, Search } from 'lucide-react';
import { getPlaceholderImages, updatePlaceholderImages } from '@/app/actions';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';

const imageSchema = z.object({
  id: z.string().min(1, 'ID is required.'),
  imageUrl: z.string().url('Must be a valid URL.'),
  imageHint: z.string().optional(),
});

const imageListSchema = z.object({
  placeholderImages: z.array(imageSchema),
});

type ImageListFormValues = z.infer<typeof imageListSchema>;

export default function ImageManagementPage() {
    const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [isSaving, startSaveTransition] = useTransition();
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const form = useForm<ImageListFormValues>({
        resolver: zodResolver(imageListSchema),
        defaultValues: {
            placeholderImages: [],
        },
    });

    const { fields, append, remove, replace } = useFieldArray({
        control: form.control,
        name: "placeholderImages",
    });

    useEffect(() => {
        if (!isAdminLoading && !isAdmin) {
            router.replace('/dashboard');
        }
    }, [isAdminLoading, isAdmin, router]);

    useEffect(() => {
        async function loadImages() {
            setIsLoadingData(true);
            try {
                const imageData = await getPlaceholderImages();
                if (imageData && imageData.placeholderImages) {
                    replace(imageData.placeholderImages);
                }
            } catch (error) {
                toast({
                    variant: 'destructive',
                    title: 'Failed to load images',
                    description: (error as Error).message,
                });
            } finally {
                setIsLoadingData(false);
            }
        }
        loadImages();
    }, [replace, toast]);


    const onSubmit = (data: ImageListFormValues) => {
        startSaveTransition(async () => {
            try {
                // We submit the original unfiltered data from the form state.
                const result = await updatePlaceholderImages(form.getValues());
                if (result.success) {
                    toast({
                        title: 'Images Updated!',
                        description: 'Your placeholder image list has been saved.',
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

    const filteredFields = useMemo(() => {
        if (!searchTerm) return fields.map((field, index) => ({ ...field, originalIndex: index }));
        
        const lowerCaseSearch = searchTerm.toLowerCase();
        
        return fields
            .map((field, index) => ({ ...field, originalIndex: index }))
            .filter((field, index) => {
                const item = form.getValues(`placeholderImages.${index}`);
                return (
                    item.id.toLowerCase().includes(lowerCaseSearch) ||
                    (item.imageHint && item.imageHint.toLowerCase().includes(lowerCaseSearch))
                );
            });
    }, [fields, searchTerm, form]);


    if (isAdminLoading || isLoadingData) {
        return <div className="container mx-auto py-12"><Skeleton className="h-96 w-full" /></div>;
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <Card className="max-w-4xl mx-auto">
                    <CardHeader>
                        <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                            <div>
                                <CardTitle className="text-3xl font-headline flex items-center gap-2">
                                   <ImageIcon className="h-8 w-8 text-primary" />
                                    Placeholder Image Management
                                </CardTitle>
                                <CardDescription>
                                    Edit the URLs for all placeholder images used across the app, such as for categories and stores.
                                </CardDescription>
                            </div>
                             <Button type="submit" disabled={isSaving}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Save All Changes
                            </Button>
                        </div>
                        <div className="relative mt-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by ID or hint..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {filteredFields.map((field) => (
                            <div key={field.id} className="p-4 border rounded-lg space-y-4 relative">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                     <div className="space-y-2">
                                        <Label>Image Preview</Label>
                                        <div className="w-full aspect-video relative rounded-md overflow-hidden border bg-muted">
                                            <Image 
                                                src={form.watch(`placeholderImages.${field.originalIndex}.imageUrl`) || 'https://placehold.co/600x400/E2E8F0/64748B?text=?'} 
                                                alt={field.id} 
                                                fill
                                                className="object-cover"
                                            />
                                        </div>
                                     </div>
                                     <div className="space-y-4">
                                         <div className="space-y-1">
                                            <Label htmlFor={`id-${field.originalIndex}`}>Unique ID</Label>
                                            <Input id={`id-${field.originalIndex}`} {...form.register(`placeholderImages.${field.originalIndex}.id`)} placeholder="e.g., cat-vegetables" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor={`url-${field.originalIndex}`}>Image URL</Label>
                                            <Input id={`url-${field.originalIndex}`} {...form.register(`placeholderImages.${field.originalIndex}.imageUrl`)} placeholder="https://images.unsplash.com/..." />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor={`hint-${field.originalIndex}`}>AI Hint (for future use)</Label>
                                            <Input id={`hint-${field.originalIndex}`} {...form.register(`placeholderImages.${field.originalIndex}.imageHint`)} placeholder="e.g., fresh vegetables" />
                                        </div>
                                     </div>
                                </div>
                                <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2" onClick={() => remove(field.originalIndex)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                         <Button type="button" variant="outline" onClick={() => append({ id: `new-image-${fields.length}`, imageUrl: '', imageHint: '' })}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add New Image Entry
                        </Button>
                    </CardContent>
                </Card>
            </form>
        </div>
    );
}
