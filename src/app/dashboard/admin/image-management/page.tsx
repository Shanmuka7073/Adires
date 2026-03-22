
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
import { Loader2, PlusCircle, Trash2, ImageIcon, Search, Save } from 'lucide-react';
import { getPlaceholderImages, updatePlaceholderImages } from '@/app/actions';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// --- Placeholder/Category Image Management ---
const imageSchema = z.object({
  id: z.string().min(1, 'ID is required.'),
  imageUrl: z.string().url('Must be a valid URL.'),
  imageHint: z.string().optional(),
});

const imageListSchema = z.object({
  placeholderImages: z.array(imageSchema),
});

type ImageListFormValues = z.infer<typeof imageListSchema>;

function PlaceholderImageManager() {
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
        async function loadImages() {
            setIsLoadingData(true);
            try {
                const result = await getPlaceholderImages();
                if (result.success && result.placeholderImages) {
                    replace(result.placeholderImages);
                } else if (result.error) {
                    throw new Error(result.error);
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
                const result = await updatePlaceholderImages(data);
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
        const allFields = fields.map((field, index) => ({ ...field, originalIndex: index }));
        if (!searchTerm) return allFields;
        
        const lowerCaseSearch = searchTerm.toLowerCase();
        return allFields.filter((field) => {
            const item = form.getValues(`placeholderImages.${field.originalIndex}`);
            return (
                item.id.toLowerCase().includes(lowerCaseSearch) ||
                (item.imageHint && item.imageHint.toLowerCase().includes(lowerCaseSearch))
            );
        });
    }, [fields, searchTerm, form]);


    if (isLoadingData) {
        return <Skeleton className="h-96 w-full rounded-2xl" />;
    }
    
    return (
         <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="flex justify-between items-center mb-6 gap-4">
                 <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                    <Input
                        placeholder="Search by ID or hint..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-11 rounded-xl border-2"
                    />
                </div>
                <Button type="submit" disabled={isSaving} className="h-11 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg px-6">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredFields.map((field) => (
                    <Card key={field.id} className="rounded-3xl border-0 shadow-lg overflow-hidden group">
                        <div className="relative aspect-video bg-muted border-b">
                            <Image 
                                src={form.watch(`placeholderImages.${field.originalIndex}.imageUrl`) || 'https://placehold.co/600x400/E2E8F0/64748B?text=?'} 
                                alt={field.id} 
                                fill
                                className="object-cover"
                            />
                            <Button 
                                type="button" 
                                variant="destructive" 
                                size="icon" 
                                className="absolute top-3 right-3 h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" 
                                onClick={() => remove(field.originalIndex)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                        <CardContent className="p-6 space-y-4">
                            <div className="space-y-1">
                                <Label className="text-[8px] font-black uppercase tracking-widest opacity-40">Unique Asset ID</Label>
                                <Input {...form.register(`placeholderImages.${field.originalIndex}.id`)} placeholder="e.g., cat-vegetables" className="h-9 rounded-lg text-xs" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[8px] font-black uppercase tracking-widest opacity-40">Direct Image URL</Label>
                                <Input {...form.register(`placeholderImages.${field.originalIndex}.imageUrl`)} placeholder="https://images.unsplash.com/..." className="h-9 rounded-lg text-xs" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[8px] font-black uppercase tracking-widest opacity-40">Metadata Hint</Label>
                                <Input {...form.register(`placeholderImages.${field.originalIndex}.imageHint`)} placeholder="e.g., fresh vegetables" className="h-9 rounded-lg text-xs" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
                <button 
                    type="button" 
                    onClick={() => append({ id: `new-image-${fields.length}`, imageUrl: '', imageHint: '' })}
                    className="flex flex-col items-center justify-center gap-3 p-12 rounded-[2.5rem] border-4 border-dashed border-black/5 hover:border-primary/20 hover:bg-primary/5 transition-all group"
                >
                    <div className="h-12 w-12 rounded-2xl bg-black/5 flex items-center justify-center text-gray-400 group-hover:bg-primary group-hover:text-white transition-colors">
                        <PlusCircle className="h-6 w-6" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40 group-hover:opacity-100">Add New Entry</span>
                </button>
            </div>
        </form>
    );
}

export default function ImageManagementPage() {
    const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isAdminLoading && !isAdmin) {
            router.replace('/dashboard');
        }
    }, [isAdminLoading, isAdmin, router]);

    if (isAdminLoading || !isAdmin) {
        return <div className="p-12 text-center flex flex-col items-center justify-center h-[60vh] gap-4">
            <Loader2 className="animate-spin h-10 w-10 text-primary opacity-20" />
            <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Verifying Authority...</p>
        </div>;
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 space-y-12 pb-32">
            <div className="flex justify-between items-end border-b pb-10 border-black/5">
                <div>
                    <h1 className="text-6xl font-black font-headline tracking-tighter uppercase italic leading-none">Asset Hub</h1>
                    <p className="font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">Marketplace Identity & Imagery</p>
                </div>
            </div>

            <Tabs defaultValue="placeholders">
                <TabsList className="bg-black/5 p-1 rounded-2xl border mb-8 h-12">
                    <TabsTrigger value="placeholders" className="rounded-xl font-black text-[10px] uppercase h-10 px-8">Category & Placeholder Icons</TabsTrigger>
                </TabsList>
                <TabsContent value="placeholders" className="mt-0">
                    <PlaceholderImageManager />
                </TabsContent>
            </Tabs>
        </div>
    );
}
