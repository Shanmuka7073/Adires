
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bot, Lightbulb, Zap, Users, ShoppingCart } from 'lucide-react';

const suggestions = [
    {
        icon: Lightbulb,
        title: "Hyper-Personalize the Homepage",
        description: "The current homepage is category-based. We can make it dynamic. For each user, analyze their order history (e.g., buys milk every 2 days, vegetables on weekends) and use AI to generate a personalized 'Your Weekly Basket' section right at the top. This would dramatically speed up routine shopping."
    },
    {
        icon: Zap,
        title: "Introduce 'Instant Recipe' Baskets",
        description: "When a user asks for a recipe, instead of just listing ingredients, offer a pre-packaged 'Recipe Basket' with one click. The AI can determine the smallest necessary variants (e.g., 100gm of ginger, not 1kg) and create a temporary bundle, showing the total price. This turns recipe discovery directly into a sale."
    },
    {
        icon: Users,
        title: "Gamify the Delivery Partner Experience",
        description: "The delivery dashboard is functional, but we can boost engagement. Introduce a points system: award points for fast deliveries, completing jobs during peak hours, or high customer ratings. A leaderboard could foster friendly competition and incentivize faster fulfillment."
    },
    {
        icon: ShoppingCart,
        title: "Automate Store Inventory Onboarding",
        description: "Store owners currently select items from a master list. We can simplify this further. Allow a new store owner to just speak or type a list of 20-30 items they sell (e.g., 'I have Amul milk, Aashirvaad atta, Colgate toothpaste...'). The AI would then match this against the master product catalog and pre-select those items for their inventory, making onboarding almost instantaneous."
    }
];

export default function SuggestionsPage() {

  return (
    <div className="container mx-auto py-12 px-4 md:px-6">
       <Card>
        <CardHeader>
            <div className="flex items-center gap-3">
                <Bot className="h-8 w-8 text-primary" />
                <div>
                    <CardTitle className="text-3xl font-headline">AI-Powered Suggestions</CardTitle>
                    <CardDescription>My strategic analysis and recommendations for improving the app.</CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent className="space-y-8">
            {suggestions.map((suggestion, index) => (
                <div key={index} className="flex items-start gap-6">
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        <suggestion.icon className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold">{suggestion.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{suggestion.description}</p>
                    </div>
                </div>
            ))}
        </CardContent>
       </Card>
    </div>
  );
}
