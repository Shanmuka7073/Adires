
'use server';
/**
 * @fileOverview An AI flow to extract menu items, theme, and determine business vertical from a menu image.
 * Optimized for high-density grocery and restaurant menus with dietary detection.
 *
 * - extractMenuItems - A function that handles the menu item extraction and business categorization process.
 * - ExtractMenuItemsInput - The input type for the flow.
 * - ExtractMenuItemsOutput - The return type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ExtractMenuItemsInputSchema = z.object({
  menuImage: z
    .string()
    .describe(
      "An image of a restaurant menu or service price list, as a data URI. E.g., 'data:image/jpeg;base64,...'."
    ),
});
export type ExtractMenuItemsInput = z.infer<typeof ExtractMenuItemsInputSchema>;

const MenuItemSchema = z.object({
    name: z.string().describe("The name of the dish or service (e.g., 'Chicken Biryani', 'Basmati Rice')."),
    description: z.string().optional().describe("A brief description of the item, if available."),
    price: z.number().describe("The price as a number (e.g., 250)."),
    category: z.string().describe("The menu category (e.g., 'Main Course', 'Rice & Grains')."),
    dietary: z.enum(['veg', 'non-veg']).optional().describe("Whether the item is vegetarian or non-vegetarian. Leave empty for non-food items."),
});

const ThemeSchema = z.object({
    backgroundColor: z.string().describe("The dominant background color as a hex code."),
    primaryColor: z.string().describe("The main accent or heading color as a hex code."),
    textColor: z.string().describe("The primary text color as a hex code."),
});

const ExtractMenuItemsOutputSchema = z.object({
  items: z.array(MenuItemSchema).describe('A list of all items extracted from the image.'),
  theme: ThemeSchema.describe('The extracted color theme of the menu.'),
  businessType: z.enum(['restaurant', 'salon', 'grocery']).describe('The determined business vertical based on the items found.'),
});
export type ExtractMenuItemsOutput = z.infer<typeof ExtractMenuItemsOutputSchema>;


export async function extractMenuItems(input: ExtractMenuItemsInput): Promise<ExtractMenuItemsOutput> {
  return extractMenuItemsFlow(input);
}


const prompt = ai.definePrompt({
  name: 'extractMenuItemsPrompt',
  input: { schema: ExtractMenuItemsInputSchema },
  output: { schema: ExtractMenuItemsOutputSchema },
  model: 'googleai/gemini-2.5-flash',
  prompt: `You are an expert OCR and business analysis engine for the Indian marketplace.
Your task is to analyze the provided image of a menu, price list, or storefront board and extract every single item and the visual theme into a structured format.

Menu Image:
{{media url=menuImage}}

Instructions:
1.  **Analyze Every Column**: Indian menus often use multiple columns (e.g., Rice & Grains on the left, Flours on the right). Read the entire image from left to right, top to bottom.
2.  **Extract All Items**: For every single item listed, extract the name, the price (as a number), and the header category it falls under.
3.  **Detect Dietary Status**: 
    - For food items, determine if it is 'veg' or 'non-veg'. 
    - Look for indicators like green/red dots on the menu, or use common knowledge (e.g., Chicken, Mutton, Fish, Egg, Prawn are 'non-veg'; Paneer, Dal, Sabzi, Rice are 'veg').
    - If unsure or if it's a non-food item (like a haircut), leave 'dietary' empty.
4.  **Analyze Color Scheme**: Detect the dominant visual colors. Provide hex codes for background, primary (brand color), and text.
5.  **Determine Business Vertical**:
    - If the items are predominantly food dishes (Biryani, Curry, Tiffin), set 'businessType' to 'restaurant'.
    - If the items are raw ingredients (Rice, Dal, Oil, Soap, Biscuits), set 'businessType' to 'grocery'.
    - If the items are services (Haircut, Facial), set 'businessType' to 'salon'.
6.  **Clean Data**: Remove any currency symbols (₹) from the price. If a price range is given, use the starting price.
7.  **Final Output**: Return a valid JSON object matching the schema.
`,
});

const extractMenuItemsFlow = ai.defineFlow(
  {
    name: 'extractMenuItemsFlow',
    inputSchema: ExtractMenuItemsInputSchema,
    outputSchema: ExtractMenuItemsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (output) return output;
    
    return { 
        items: [], 
        theme: { backgroundColor: '#FFFFFF', primaryColor: '#000000', textColor: '#333333' },
        businessType: 'restaurant' as const
    };
  }
);
