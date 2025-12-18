
'use server';
/**
 * @fileOverview An AI flow to extract menu items and theme from a restaurant menu image.
 *
 * - extractMenuItems - A function that handles the menu item extraction process.
 * - ExtractMenuItemsInput - The input type for the flow.
 * - ExtractMenuItemsOutput - The return type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';

const ExtractMenuItemsInputSchema = z.object({
  menuImage: z
    .string()
    .describe(
      "An image of a restaurant menu, as a data URI. E.g., 'data:image/jpeg;base64,...'."
    ),
});
export type ExtractMenuItemsInput = z.infer<typeof ExtractMenuItemsInputSchema>;

const MenuItemSchema = z.object({
    name: z.string().describe("The name of the dish (e.g., 'Chicken Biryani', 'Paneer Butter Masala')."),
    description: z.string().optional().describe("A brief description of the dish, if available on the menu."),
    price: z.number().describe("The price of the dish as a number (e.g., 250, 18.50)."),
    category: z.string().describe("The menu category this dish belongs to (e.g., 'Starters', 'Main Course', 'Desserts')."),
});

const ThemeSchema = z.object({
    backgroundColor: z.string().describe("The dominant background color of the menu as a hex code (e.g., '#FFFFFF')."),
    primaryColor: z.string().describe("The main accent or heading color as a hex code (e.g., '#8B4513')."),
    textColor: z.string().describe("The primary text color for items as a hex code (e.g., '#333333')."),
});

const ExtractMenuItemsOutputSchema = z.object({
  items: z.array(MenuItemSchema).describe('A list of all menu items extracted from the image.'),
  theme: ThemeSchema.describe('The extracted color theme of the menu.'),
});
export type ExtractMenuItemsOutput = z.infer<typeof ExtractMenuItemsOutputSchema>;


export async function extractMenuItems(input: ExtractMenuItemsInput): Promise<ExtractMenuItemsOutput> {
  return extractMenuItemsFlow(input);
}


const prompt = ai.definePrompt({
  name: 'extractMenuItemsPrompt',
  input: { schema: ExtractMenuItemsInputSchema },
  output: { schema: ExtractMenuItemsOutputSchema },
  model: googleAI.model('gemini-2.5-flash'),
  prompt: `You are an expert OCR and data extraction engine for restaurant menus.
Your task is to analyze the provided image of a menu and extract every single dish and the menu's color scheme into a structured format.

Menu Image:
{{media url=menuImage}}

Instructions:
1.  **Analyze Color Scheme**: First, analyze the visual design of the menu. Determine the dominant background color, the primary color (used for headings or accents), and the main text color. Provide these as hex codes.
2.  **Identify Categories**: Second, identify the sections of the menu (e.g., "Starters", "Biryanis", "Main Course", "Breads", "Desserts").
3.  **Extract Each Item**: For every single item on the menu, extract the following details:
    *   \`name\`: The exact name of the dish.
    *   \`description\`: If there's a description below the name, capture it. If not, leave it empty.
    *   \`price\`: The price of the item. Convert it to a number (e.g., "₹250" becomes 250).
    *   \`category\`: The category you identified in step 2 that this item belongs to.
4.  **Handle Complex Layouts**: Menus can have multiple columns, different currencies, and varied formatting. Be robust and extract everything.
5.  **Final Output**: Return a single JSON object containing a list of all the extracted item objects and the extracted theme object. If no items are found, return an empty 'items' array.
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
    return output || { items: [], theme: { backgroundColor: '#FFFFFF', primaryColor: '#000000', textColor: '#333333' } };
  }
);
