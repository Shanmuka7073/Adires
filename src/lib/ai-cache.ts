'use client';
import { Firestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { CachedAIResponse } from './types';

/**
 * Creates a consistent, URL-friendly ID from a question string.
 * @param question The user's question.
 * @returns A normalized string to use as a document ID.
 */
function getQuestionId(question: string): string {
    return question.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').slice(0, 100);
}

/**
 * Retrieves a cached AI response from Firestore if it exists.
 * @param db The Firestore instance.
 * @param question The original question asked by the user.
 * @returns The cached answer as a string, or null if not found.
 */
export async function getCachedAIResponse(db: Firestore, question: string): Promise<string | null> {
    const responseId = getQuestionId(question);
    const docRef = doc(db, 'cachedAIResponses', responseId);
    
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            console.log("AI Cache HIT for:", question);
            const data = docSnap.data() as CachedAIResponse;
            // Optional: You could add logic here to check data.createdAt and re-fetch if it's too old.
            return data.answer;
        }
        console.log("AI Cache MISS for:", question);
        return null;
    } catch (error) {
        console.error("Error retrieving cached AI response:", error);
        // If there's an error reading from the cache, it's safer to proceed as if it's a cache miss.
        return null;
    }
}

/**
 * Saves a new AI response to the Firestore cache.
 * @param db The Firestore instance.
 * @param question The original question.
 * @param answer The AI-generated answer.
 */
export async function cacheAIResponse(db: Firestore, question: string, answer: string): Promise<void> {
    const responseId = getQuestionId(question);
    const docRef = doc(db, 'cachedAIResponses', responseId);
    
    const responseData: CachedAIResponse = {
        id: responseId,
        question: question,
        answer: answer,
        createdAt: serverTimestamp(),
    };

    try {
        // Use setDoc to create or overwrite the document with the new answer.
        console.log("Caching AI response for:", question);
        await setDoc(docRef, responseData);
    } catch (error) {
        // Log the error, but don't block the user's flow.
        // Failing to write to the cache is not a critical failure.
        console.error("Error caching AI response:", error);
    }
}
