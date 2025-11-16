
'use server';

import { generate } from '@genkit-ai/ai';
import { flow } from '@genkit-ai/core';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';

const DebugReportSchema = z.object({
    report: z.string().describe('A concise, technical analysis of the root cause.'),
    fixInstructions: z.string().describe('Actionable markdown steps to resolve the issue, including file paths and code snippets if applicable.'),
});

type DebugReport = z.infer<typeof DebugReportSchema>;

/**
 * Genkit flow for the Atlas Debug Agent. 
 * It analyzes detailed error messages and provides a structured fix.
 */
export const atlasDebugFlow = flow(
    {
        name: 'atlasDebugFlow',
        inputSchema: z.object({ errorDetails: z.string(), failedFunction: z.string() }),
        outputSchema: DebugReportSchema,
    },
    async ({ errorDetails, failedFunction }) => {
        
        const systemInstruction = `You are Atlas, an expert AI Observability and Debugging Agent. Your sole purpose is to analyze system health and provide a structured, actionable report to the developer based on the current context of this application (Next.js, Genkit, Firebase Auth/Firestore).

        CRITICAL OUTPUT MANDATES:
        1. Always output a valid JSON object matching the requested schema {report: string, fixInstructions: string}.
        2. Analyze the user's query and generate a **comprehensive diagnostic report** assuming a high probability of: 
           - **Authentication Failure** (if user mentions tokens/auth): Token is expired, or the local JWT decode failed.
           - **Permission Failure** (if user mentions Firestore): Missing or incorrect Firebase Security Rules for /asha-conversations/{userId}/conversation.
           - **Genkit Failure** (if user mentions AI/model): Genkit dependencies or configuration is wrong, or the API key is invalid.
        3. The 'fixInstructions' must be detailed markdown, including file names and clear, step-by-step instructions. Use code blocks for file paths or code snippets.`;

        const userPrompt = `Perform a full system diagnostic. The last known failing action was '${failedFunction}'. The user input was: "${errorDetails}". 
        
        Provide a comprehensive health check focusing on the most likely points of failure in the authentication and AI setup.`;

        const response = await generate({
            model: googleAI('gemini-1.5-flash-preview'),
            prompt: userPrompt,
            config: {
                temperature: 0.1,
            },
            output: {
                format: 'json',
                schema: DebugReportSchema,
            }
        });

        const output = response.output();
        if (!output) {
            throw new Error("Failed to get a structured response from the AI model.");
        }
        return output;
    }
);
