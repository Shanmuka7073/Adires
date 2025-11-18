
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Users } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function AIGroceryPackGenerator() {
    const [familySize, setFamilySize] = useState('');
    const { toast } = useToast();

    const handleGenerate = () => {
        // Placeholder function
        toast({
            title: "Feature Not Implemented",
            description: "The AI Grocery Pack Generator is coming soon!",
        });
    }

    return (
        <Card className="bg-primary/5 border-primary/20 shadow-lg">
            <CardHeader>
                <div className="flex items-center gap-3">
                    <Sparkles className="h-8 w-8 text-primary" />
                    <div>
                        <CardTitle className="text-2xl font-headline">AI-Powered Grocery Packs</CardTitle>
                        <CardDescription>Let our AI create a weekly grocery list for your family.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-grow">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            type="number"
                            placeholder="Enter family size (e.g., 4)" 
                            className="pl-9"
                            value={familySize}
                            onChange={(e) => setFamilySize(e.target.value)}
                        />
                    </div>
                    <Button onClick={handleGenerate} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate Pack
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
