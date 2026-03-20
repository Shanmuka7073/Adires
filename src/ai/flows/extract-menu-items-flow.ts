'use server';
/**
 * @fileOverview An AI flow to extract menu items, theme, and determine business vertical from a menu image.
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
    name: z.string().describe("The name of the dish or service (e.g., 'Chicken Biryani', 'Hair Cut')."),
    description: z.string().optional().describe("A brief description of the item, if available."),
    price: z.number().describe("The price as a number (e.g., 250)."),
    category: z.string().describe("The menu category (e.g., 'Main Course', 'Hair Services')."),
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
  prompt: `You are an expert OCR and business analysis engine.
Your task is to analyze the provided image of a menu or price list and extract every single item and the menu's color scheme into a structured format.

Menu Image:
{{media url=menuImage}}

Instructions:
1.  **Analyze Color Scheme**: Analyze the visual design. Provide hex codes for background, primary, and text colors.
2.  **Determine Business Type**:
    - If the items are food dishes (Biryani, Burger, Pizza, Curry, etc.), set 'businessType' to 'restaurant'.
    - If the items are beauty or grooming services (Haircut, Facial, Waxing, Spa, etc.), set 'businessType' to 'salon'.
    - If the items look like standardized retail goods with prices, set 'businessType' to 'grocery'.
3.  **Identify Categories**: Group items logically (e.g., "Starters", "Men's Cuts", "Dairy").
4.  **Extract Each Item**: For every single item, extract name, price (as a number), and category.
5.  **Final Output**: Return a JSON object with 'items', 'theme', and 'businessType'.
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
    
    // Explicit return with correct literal types to satisfy TypeScript
    return { 
        items: [], 
        theme: { backgroundColor: '#FFFFFF', primaryColor: '#000000', textColor: '#333333' },
        businessType: 'restaurant' as const
    };
  }
);
