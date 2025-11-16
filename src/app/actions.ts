
'use server';

import { atlasDebugFlow } from '@/ai/flows/atlas-debug-flow'; 

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
    
    // In this simplified version, we skip the token check and go straight to the AI analysis.
    // If there is an error in the flow, Atlas reports on itself.
    
    try {
        // Pass arguments as a single object to match the flow's input schema
        const report = await atlasDebugFlow({ errorDetails: userQuery, failedFunction: failedFunction });
        return report;
    } catch (atlasError: any) {
        console.error("ATLAS Flow Execution FAILED:", atlasError);
        // Fallback if Genkit fails to run
        return {
            report: "Atlas execution failed.",
            fixInstructions: `The 'atlasDebugFlow' Genkit flow could not be reached. Check your Genkit environment setup and dependencies. Error: ${atlasError.message}`
        };
    }
}
