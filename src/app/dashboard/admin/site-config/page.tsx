
'use client';

import { useState, useEffect, useTransition } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import type { SiteConfig } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Wand2, BookOpen, BrainCircuit } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const ADMIN_EMAIL = 'admin@gmail.com';

export default function SiteConfigPage() {
    const { firestore, user } = useFirebase();
    const { toast } = useToast();
    const [isSaving, startSave] = useTransition();

    const configDocRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'siteConfig', 'aiFeatures');
    }, [firestore]);

    const { data: config, isLoading } = useDoc<SiteConfig>(configDocRef);

    const [features, setFeatures] = useState<SiteConfig>({
        isPackGeneratorEnabled: false,
        isRecipeApiEnabled: false,
        isGeneralQuestionApiEnabled: false,
        isAliasSuggesterEnabled: false,
    });

    useEffect(() => {
        if (config) {
            setFeatures({
                isPackGeneratorEnabled: config.isPackGeneratorEnabled ?? false,
                isRecipeApiEnabled: config.isRecipeApiEnabled ?? false,
                isGeneralQuestionApiEnabled: config.isGeneralQuestionApiEnabled ?? false,
                isAliasSuggesterEnabled: config.isAliasSuggesterEnabled ?? false,
            });
        }
    }, [config]);

    const handleToggle = (feature: keyof SiteConfig) => {
        setFeatures(prev => ({ ...prev, [feature]: !prev[feature] }));
    };

    const handleSaveChanges = () => {
        if (!configDocRef) return;
        startSave(async () => {
            try {
                await setDoc(configDocRef, features, { merge: true });
                toast({ title: 'Success', description: 'AI feature settings have been updated.' });
            } catch (error) {
                console.error('Failed to save site config:', error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not save settings.' });
            }
        });
    };

    const featureList = [
        { id: 'isPackGeneratorEnabled', label: 'AI Grocery Pack Generator', description: 'Allows admins to generate monthly/weekly grocery packs using AI.', icon: Wand2 },
        { id: 'isRecipeApiEnabled', label: 'AI Recipe Ingredient Finder', description: 'Allows users to ask the voice assistant for recipe ingredients.', icon: BookOpen },
        { id: 'isGeneralQuestionApiEnabled', label: 'General Knowledge AI', description: 'Allows the voice assistant to answer general questions.', icon: Sparkles },
        { id: 'isAliasSuggesterEnabled', label: 'AI Command Suggester', description: 'Enables the AI to suggest fixes for failed voice commands in the admin panel.', icon: BrainCircuit },
    ] as const;


    if (isLoading) {
        return (
            <div className="container mx-auto py-12 px-4 md:px-6">
                <Card className="max-w-2xl mx-auto">
                    <CardHeader>
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-4 w-full mt-2" />
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (user?.email !== ADMIN_EMAIL) {
        return <p>You do not have permission to view this page.</p>;
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-2xl font-headline">AI Feature Controls</CardTitle>
                    <CardDescription>
                        Enable or disable AI-powered features across the application. Changes will take effect immediately.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {featureList.map(feature => {
                        const Icon = feature.icon;
                        return (
                            <div key={feature.id} className="flex items-start justify-between rounded-lg border p-4">
                                <div className="space-y-1.5 pr-4">
                                    <Label htmlFor={feature.id} className="text-base font-semibold flex items-center gap-2">
                                        <Icon className="h-5 w-5 text-primary" />
                                        {feature.label}
                                    </Label>
                                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                                </div>
                                <Switch
                                    id={feature.id}
                                    checked={features[feature.id]}
                                    onCheckedChange={() => handleToggle(feature.id)}
                                    aria-label={`Toggle ${feature.label}`}
                                />
                            </div>
                        )
                    })}
                    <Button onClick={handleSaveChanges} disabled={isSaving} className="w-full">
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
