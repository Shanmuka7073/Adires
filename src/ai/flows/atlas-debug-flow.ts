
'use server';
/**
 * @fileOverview A diagnostic AI agent for system health.
 *
 * - runAtlasDebugFlow - A function that handles the diagnostic process.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const DebugReportSchema = z.object({
    report: z.string().describe('A concise, technical analysis of the root cause.'),
    fixInstructions: z.string().describe('Actionable markdown steps to resolve the issue, including file paths and code snippets if applicable.'),
});

/**
 * Genkit flow for the Atlas Debug Agent. 
 * It analyzes detailed error messages and provides a structured fix.
 */
export const runAtlasDebugFlow = ai.defineFlow( 
    {
        name: 'atlasDebugFlow',
        inputSchema: z.object({ errorDetails: z.string(), failedFunction: z.string() }),
        outputSchema: DebugReportSchema,
    },
    async ({ errorDetails, failedFunction }) => {
        
        const systemPrompt = `You are Atlas, an expert AI Observability and Debugging Agent. Your sole purpose is to analyze system health and provide a structured, actionable report to the developer based on the current context of this application (Next.js, Genkit, Firebase Auth/Firestore).

        CRITICAL OUTPUT MANDATES:
        1. Always output a valid JSON object matching the requested schema {report: string, fixInstructions: string}.
        2. Analyze the context: The last known failing action was '${failedFunction}'. The user's query or error details are: "${errorDetails}".
        3. Generate a comprehensive diagnostic report focusing on the most likely points of failure: Gemini API key validation, Firestore Rules, and Auth token decoding.
        4. The 'fixInstructions' must be detailed markdown, including file names and clear, step-by-step instructions. Use code blocks for file paths or code snippets.`;

        const { output } = await ai.generate({
            model: 'gemini-1.5-flash',
            prompt: `Perform a full system diagnostic based on the provided context.`,
            config: {
                temperature: 0.1,
            },
            output: {
                format: 'json',
                schema: DebugReportSchema,
            },
            system: systemPrompt,
        });

        if (!output) {
            throw new Error("Failed to get a structured response from the AI model.");
        }
        return output;
    }
);





