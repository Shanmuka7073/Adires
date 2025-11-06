
import { promises as fs } from 'fs';
import path from 'path';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type Category = {
    name: string;
    items: string[];
};

// This function will parse the markdown file into a structured array
async function parseProductList(): Promise<Category[]> {
    const filePath = path.join(process.cwd(), 'docs', 'product-list.md');
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const lines = fileContent.split('\n');

        const categories: Category[] = [];
        let currentCategory: Category | null = null;

        for (const line of lines) {
            if (line.startsWith('### ')) {
                // If there's a current category, push it before starting a new one
                if (currentCategory) {
                    categories.push(currentCategory);
                }
                currentCategory = { name: line.substring(4).trim(), items: [] };
            } else if (line.startsWith('*   ') && currentCategory) {
                currentCategory.items.push(line.substring(4).trim());
            }
        }
        // Push the last category
        if (currentCategory) {
            categories.push(currentCategory);
        }

        return categories;

    } catch (error) {
        console.error("Error reading product list file:", error);
        return [];
    }
}


export default async function ProductListPage() {
    const productCategories = await parseProductList();
    const totalProducts = productCategories.reduce((sum, cat) => sum + cat.items.length, 0);

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-3xl font-headline">Master Product List</CardTitle>
                    <CardDescription>
                        A complete inventory of all {totalProducts} products available on the platform, organized by category.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {productCategories.length > 0 ? (
                        <Accordion type="multiple" className="w-full">
                            {productCategories.map(category => (
                                <AccordionItem value={category.name} key={category.name}>
                                    <AccordionTrigger className="text-xl font-semibold">
                                        {category.name} ({category.items.length})
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <ul className="list-disc pl-5 grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2 text-muted-foreground">
                                            {category.items.map(item => (
                                                <li key={item}>{item}</li>
                                            ))}
                                        </ul>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    ) : (
                        <p className="text-muted-foreground">Could not load the product list. Please check the server logs.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
