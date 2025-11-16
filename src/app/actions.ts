'use server';

// We import the entire Genkit flow file here.
import { runAtlasDebugFlow } from '@/ai/flows/atlas-debug-flow'; 

type DebugReport = {
    report: string;
    fixInstructions: string;
};

/**
 * Atlas Debug Action: Analyzes a system error and generates a report.
 * @param {string} userQuery - The user's query (or error details).
 * @param {string} failedFunction - Context for the AI.
 * @returns {Promise<DebugReport>} A structured report and fix instructions from Atlas.
 */
export async function debugAtlasAction(userQuery: string, failedFunction: string): Promise<DebugReport> {
    
    try {
        // We use the imported Genkit flow function directly.
        // If the import is successful, this should work without the Webpack error.
        const report = await runAtlasDebugFlow({ errorDetails: userQuery, failedFunction: failedFunction });
        return report;
    } catch (atlasError: any) {
        console.error("ATLAS Flow Execution FAILED:", atlasError);
        // Fallback if Genkit fails to run
        return {
            report: "Atlas execution failed.",
            fixInstructions: `CRITICAL: The Genkit flow failed to execute. This is typically caused by:
1. Invalid or expired GEMINI API Key in your Genkit config.
2. A firewall preventing the server from connecting to Google's API.
3. A fundamental issue with the Genkit import/export in 'src/app/actions.ts'.
Error details: ${atlasError.message}`
        };
    }
}