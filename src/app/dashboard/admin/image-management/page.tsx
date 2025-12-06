
'use client';

import { useState, useEffect, useTransition, useMemo, useRef, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Trash2, ImageIcon, Search, Link2, Sparkles, Save, Upload as UploadIcon, Copy, ExternalLink, FileJson } from 'lucide-react';
import { getPlaceholderImages, updatePlaceholderImages, uploadPwaIcon, getManifest } from '@/app/actions';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAppStore } from '@/lib/store';
import { useFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { generateProductImage } from '@/ai/flows/generate-product-image-flow';
import type { Product } from '@/lib/types';


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


    if (isLoadingData) {
        return <Skeleton className="h-96 w-full" />;
    }
    
    return (
         <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="flex justify-between items-center mb-4">
                 <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by ID or hint..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Button type="submit" disabled={isSaving} className="ml-4">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                </Button>
            </div>
            <div className="space-y-6">
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
            </div>
        </form>
    );
}

// --- Product Image Management ---

function ProductImageRow({ product: initialProduct }: { product: Product }) {
    const [product, setProduct] = useState(initialProduct);
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isSaving, startSaveTransition] = useTransition();
    const [isGenerating, startGenerateTransition] = useTransition();

    const handleGenerateImage = async () => {
        startGenerateTransition(async () => {
            try {
                const result = await generateProductImage({ productName: product.name });
                if (result.imageUrl) {
                    setProduct(prev => ({ ...prev, imageUrl: result.imageUrl }));
                    toast({ title: 'AI Image Generated!', description: 'URL has been updated. Click Save to apply.' });
                } else {
                    throw new Error("AI did not return an image URL.");
                }
            } catch (error) {
                console.error(error);
                toast({ variant: 'destructive', title: 'Generation Failed', description: (error as Error).message });
            }
        });
    };
    
    const handleSave = async () => {
        if (!firestore) return;
        startSaveTransition(async () => {
            const productRef = doc(firestore, 'stores', product.storeId, 'products', product.id);
            try {
                await updateDoc(productRef, { imageUrl: product.imageUrl });
                toast({ title: 'Product Image Saved!', description: `Image for ${product.name} has been updated.` });
            } catch (error) {
                 console.error(error);
                toast({ variant: 'destructive', title: 'Save Failed', description: (error as Error).message });
            }
        });
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-4 p-4 border rounded-lg">
            <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-md bg-muted overflow-hidden">
                     <Image 
                        src={product.imageUrl || 'https://placehold.co/64x64/E2E8F0/64748B?text=?'} 
                        alt={product.name} 
                        fill
                        className="object-cover"
                    />
                </div>
                <p className="font-semibold">{product.name}</p>
            </div>
             <div className="flex items-center gap-2">
                <div className="relative flex-grow">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                    <Input 
                        placeholder="Image URL"
                        value={product.imageUrl || ''}
                        onChange={(e) => setProduct(p => ({...p, imageUrl: e.target.value}))}
                        className="pl-9"
                    />
                </div>
                <Button variant="outline" size="icon" onClick={handleGenerateImage} disabled={isGenerating}>
                    {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    <span className="sr-only">Generate AI Image</span>
                </Button>
            </div>
            <div className="text-right">
                <Button onClick={handleSave} disabled={isSaving}>
                     {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save
                </Button>
            </div>
        </div>
    )
}

function ProductImageManager() {
    const { masterProducts, loading } = useAppStore();
    const [searchTerm, setSearchTerm] = useState('');
    
    const filteredProducts = useMemo(() => {
        if (!searchTerm) return masterProducts;
        return masterProducts.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [masterProducts, searchTerm]);

    if (loading) {
        return <Skeleton className="h-96 w-full" />;
    }

    return (
        <div className="space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                />
            </div>
             <div className="space-y-4">
                {filteredProducts.map(product => (
                    <ProductImageRow key={product.id} product={product} />
                ))}
             </div>
        </div>
    )
}

// --- NEW: PWA Icon Management ---
function PwaIconManager() {
    const { toast } = useToast();
    const [isUploading, startUploadTransition] = useTransition();
    const [isLoadingManifest, setIsLoadingManifest] = useState(true);
    const [preview, setPreview] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadedUrls, setUploadedUrls] = useState<{ icon192Url?: string; icon512Url?: string; } | null>(null);
    
    const fetchCurrentIcons = useCallback(async () => {
        setIsLoadingManifest(true);
        try {
            const manifest = await getManifest();
            if (manifest && manifest.icons) {
                const icon192 = manifest.icons.find((icon: any) => icon.sizes === '192x192');
                const icon512 = manifest.icons.find((icon: any) => icon.sizes === '512x512');
                setUploadedUrls({
                    icon192Url: icon192?.src,
                    icon512Url: icon512?.src
                });
            }
        } catch (error) {
             toast({ variant: 'destructive', title: 'Could not load manifest', description: (error as Error).message });
        } finally {
            setIsLoadingManifest(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchCurrentIcons();
    }, [fetchCurrentIcons]);


    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setUploadedUrls(null); // Clear previous URLs
            const reader = new FileReader();
            reader.onload = (e) => setPreview(e.target?.result as string);
            reader.readAsDataURL(selectedFile);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            toast({ variant: 'destructive', title: 'No file selected.' });
            return;
        }

        startUploadTransition(async () => {
            try {
                const formData = new FormData();
                formData.append('file', file);
                
                const result = await uploadPwaIcon(formData);
                if (result.success) {
                    toast({ title: 'PWA Icons Updated!', description: 'The manifest and icon files have been saved.' });
                    setUploadedUrls({ icon192Url: result.icon192Url, icon512Url: result.icon512Url });
                    setPreview(result.icon192Url || null); // Show the new icon as preview
                    await fetchCurrentIcons(); // Re-fetch to confirm
                } else {
                    throw new Error(result.error);
                }
            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
            }
        });
    };
    
    const fallbackCopy = (text: string) => {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed"; // Avoid scrolling to bottom
        textArea.style.top = "0";
        textArea.style.left = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                toast({ title: 'Link Copied!', description: 'The icon URL has been copied to your clipboard.' });
            } else {
                throw new Error('Fallback copy failed');
            }
        } catch (err) {
            toast({ variant: 'destructive', title: 'Copy Failed' });
        }
        document.body.removeChild(textArea);
    };

    const handleCopy = (url: string | undefined) => {
        if (!url) return;
        const fullUrl = `${window.location.origin}${url}`;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(fullUrl).then(() => {
                toast({ title: 'Link Copied!', description: 'The icon URL has been copied to your clipboard.' });
            }).catch(() => {
                // Fallback for when clipboard API fails (e.g. in non-secure contexts)
                fallbackCopy(fullUrl);
            });
        } else {
            fallbackCopy(fullUrl);
        }
    };

    return (
        <Card className="max-w-md mx-auto">
            <CardHeader>
                <CardTitle>Upload PWA Icon</CardTitle>
                <CardDescription>Upload a single icon file (PNG preferred). It will be resized and set as your app icon.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="w-32 h-32 mx-auto rounded-xl border-2 border-dashed flex items-center justify-center bg-muted">
                    {preview ? (
                        <Image src={preview} alt="Icon preview" width={128} height={128} className="rounded-lg object-cover" />
                    ) : (
                        <ImageIcon className="h-12 w-12 text-muted-foreground" />
                    )}
                </div>
                <Input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={isUploading}
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                />
                <Button className="w-full" onClick={handleUpload} disabled={isUploading || !file}>
                    {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadIcon className="mr-2 h-4 w-4" />}
                    Upload & Set as PWA Icon
                </Button>
                 {(uploadedUrls?.icon192Url || isLoadingManifest) && (
                    <div className="pt-4 border-t space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="font-semibold">Current PWA Icons</h4>
                             <a href="/manifest.json" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                                <FileJson className="h-3 w-3" />
                                View Manifest
                            </a>
                        </div>
                        {isLoadingManifest ? (
                             <div className="flex items-center justify-around">
                                <Skeleton className="h-24 w-24 rounded-lg" />
                                <Skeleton className="h-24 w-24 rounded-lg" />
                            </div>
                        ) : (
                             <div className="space-y-4">
                                {uploadedUrls.icon192Url && (
                                    <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <a href={uploadedUrls.icon192Url} target="_blank" rel="noopener noreferrer" className="block border-2 border-primary rounded-lg p-1 hover:border-accent transition-colors">
                                                <Image src={uploadedUrls.icon192Url} alt="192x192 icon" width={48} height={48} className="rounded-md" />
                                            </a>
                                            <p className="text-sm font-mono text-muted-foreground">192x192.png</p>
                                        </div>
                                        <Button size="sm" variant="outline" onClick={() => handleCopy(uploadedUrls.icon192Url)}>
                                            <Copy className="mr-2 h-4 w-4" /> Copy Link
                                        </Button>
                                    </div>
                                )}
                                 {uploadedUrls.icon512Url && (
                                     <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <a href={uploadedUrls.icon512Url} target="_blank" rel="noopener noreferrer" className="block border-2 border-primary rounded-lg p-1 hover:border-accent transition-colors">
                                                <Image src={uploadedUrls.icon512Url} alt="512x512 icon" width={48} height={48} className="rounded-md" />
                                            </a>
                                            <p className="text-sm font-mono text-muted-foreground">512x512.png</p>
                                        </div>
                                        <Button size="sm" variant="outline" onClick={() => handleCopy(uploadedUrls.icon512Url)}>
                                            <Copy className="mr-2 h-4 w-4" /> Copy Link
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground text-center">These are the icons currently saved in your app's public manifest file.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}


// --- Main Page Component ---

export default function ImageManagementPage() {
    const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isAdminLoading && !isAdmin) {
            router.replace('/dashboard');
        }
    }, [isAdminLoading, isAdmin, router]);

    if (isAdminLoading) {
        return <div className="container mx-auto py-12"><Skeleton className="h-96 w-full" /></div>;
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-6xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-3xl font-headline flex items-center gap-2">
                        <ImageIcon className="h-8 w-8 text-primary" />
                        Image Management
                    </CardTitle>
                    <CardDescription>
                        Manage placeholder images, category icons, and product images from one central place.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="placeholders">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="placeholders">Category & Placeholder Images</TabsTrigger>
                            <TabsTrigger value="products">Product Images</TabsTrigger>
                             <TabsTrigger value="pwa">PWA & App Icons</TabsTrigger>
                        </TabsList>
                        <TabsContent value="placeholders" className="mt-6">
                            <PlaceholderImageManager />
                        </TabsContent>
                        <TabsContent value="products" className="mt-6">
                            <ProductImageManager />
                        </TabsContent>
                         <TabsContent value="pwa" className="mt-6">
                            <PwaIconManager />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
