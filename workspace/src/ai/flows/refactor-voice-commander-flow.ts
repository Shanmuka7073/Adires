'use server';
/**
 * @fileOverview An AI flow to analyze and refactor the VoiceCommander component.
 *
 * - refactorVoiceCommander - A function that analyzes code and suggests improvements.
 * - RefactorVoiceCommanderInput - The input type for the flow.
 * - RefactorVoiceCommanderOutput - The return type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const RefactorVoiceCommanderInputSchema = z.object({
  code: z.string().describe('The TypeScript/React source code of the VoiceCommander component.'),
});
export type RefactorVoiceCommanderInput = z.infer<typeof RefactorVoiceCommanderInputSchema>;

const RefactorVoiceCommanderOutputSchema = z.object({
  explanation: z
    .string()
    .describe(
      'A detailed, step-by-step explanation of the improvements made, focusing on modularity, clarity, and performance.'
    ),
  refactoredCode: z
    .string()
    .describe('The complete, refactored source code for the component.'),
});
export type RefactorVoiceCommanderOutput = z.infer<typeof RefactorVoiceCommanderOutputSchema>;

const refactorPrompt = ai.definePrompt({
  name: 'refactorVoiceCommanderPrompt',
  input: { schema: RefactorVoiceCommanderInputSchema },
  output: { schema: RefactorVoiceCommanderOutputSchema },
  model: 'googleai/gemini-2.5-flash',
  prompt: `You are an expert software architect specializing in building clean, modular, and high-performance React applications with TypeScript.

You will be given the source code for a "VoiceCommander" React component. Your task is to completely refactor this code to be more modular, readable, and efficient.

**Analysis & Refactoring Guidelines:**

1.  **Break Down Logic:** Identify large functions or effects and break them into smaller, single-responsibility helper functions. For example, intent recognition, entity parsing, and context handling should be separate, pure functions where possible.
2.  **State Management:** Analyze the use of \`useRef\` and \`useState\`. Suggest using a more structured state management pattern (like a reducer with \`useReducer\`) if the component's state becomes too complex and interconnected.
3.  **Hooks and Effects:** Review all \`useEffect\` hooks. Ensure their dependency arrays are correct and that they are not causing unnecessary re-renders or stale closures. Combine effects where logical.
4.  **Clarity and Readability:** Improve variable names and add comments where the logic is complex or non-obvious. The goal is to make the code self-documenting.
5.  **Performance:** Look for performance bottlenecks, such as expensive computations happening on every render. Suggest using \`useMemo\` or \`useCallback\` where appropriate to optimize.
6.  **Do Not Remove Features:** The final code must retain all original functionality. You are refactoring, not removing features.

**Input Code to Refactor:**
\`\`\`typescript
{{{code}}}
\`\`\`
`,
});

export async function refactorVoiceCommander(input: RefactorVoiceCommanderInput): Promise<RefactorVoiceCommanderOutput> {
  const { output } = await refactorPrompt(input);
  if (!output) {
    throw new Error('Refactoring failed to generate output.');
  }
  return output;
}
