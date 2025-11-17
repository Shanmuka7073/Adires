
const { genkit } = require('genkit');
const { googleAI } = require('@genkit-ai/google-genai');

async function runSanityCheck() {
  try {
    const result = await genkit.sanityCheck();
    console.log(result);
  } catch (error) {
    console.error(error);
  }
}

runSanityCheck();
