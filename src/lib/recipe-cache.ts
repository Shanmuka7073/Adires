
import { Firestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase-admin/firestore';
import type { CachedRecipe, GetIngredientsOutput } from './types';

/**
 * Creates a URL-friendly and Firestore-safe slug from a string.
 * Replaces spaces with hyphens and removes all non-alphanumeric characters except hyphens.
 * @param text The input string.
 * @returns A sanitized slug.
 */
const createSlug = (text: string): string => {
    if (!text) return '';
    return text
        .toLowerCase()
        .replace(/\s+/g, '-')        // Replace spaces with hyphens
        .replace(/[^\w-]+/g, '')     // Remove all non-word chars except hyphens
        .replace(/--+/g, '-')        // Replace multiple hyphens with a single one
        .replace(/^-+/, '')          // Trim hyphens from the start
        .replace(/-+$/, '');         // Trim hyphens from the end
};


/**
 * Retrieves a cached recipe from Firestore.
 * It will also try to fetch the english version if the target language is not found.
 * @param db Firestore admin instance.
 * @param dishName The original name of the dish.
 * @param language The language of the recipe to retrieve.
 * @returns A promise that resolves to a GetIngredientsOutput object or null if not in cache.
 */
export async function getCachedRecipe(db: Firestore, dishName: string, language: 'en' | 'te'): Promise<GetIngredientsOutput | null> {
    const normalizedDishName = createSlug(dishName);
    const targetDocId = `${normalizedDishName}_${language}`;
    const targetDocRef = doc(db, 'cachedRecipes', targetDocId);
    
    try {
        const docSnap = await getDoc(targetDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data() as CachedRecipe;
            return {
                isSuccess: true,
                title: data.dishName,
                ingredients: data.ingredients,
                instructions: data.instructions,
                nutrition: data.nutrition || { calories: 0, protein: 0 },
            };
        }
        
        // If target language not found, try fetching the English version as a base for translation
        if (language !== 'en') {
            const englishDocId = `${normalizedDishName}_en`;
            const englishDocRef = doc(db, 'cachedRecipes', englishDocId);
            const englishDocSnap = await getDoc(englishDocRef);
            if (englishDocSnap.exists()) {
                 const data = englishDocSnap.data() as CachedRecipe;
                 return {
                    isSuccess: true,
                    title: data.dishName,
                    ingredients: data.ingredients,
                    instructions: data.instructions,
                    nutrition: data.nutrition || { calories: 0, protein: 0 },
                };
            }
        }

        return null;
    } catch (error) {
        console.error("Error fetching cached recipe:", error);
        return null;
    }
}

/**
 * Caches a new recipe in Firestore.
 * @param db Firestore admin instance.
 * @param dishName The original name of the dish.
 * @param language The language of the recipe being cached.
 * @param data The GetIngredientsOutput object from the AI.
 */
export async function cacheRecipe(db: Firestore, dishName: string, language: 'en' | 'te', data: GetIngredientsOutput): Promise<void> {
    const normalizedDishName = createSlug(dishName);
    const docId = `${normalizedDishName}_${language}`;
    const docRef = doc(db, 'cachedRecipes', docId);

    const recipeData: CachedRecipe = {
        id: docId,
        dishName: data.title, // Use the official title from the AI
        ingredients: data.ingredients,
        instructions: data.instructions,
        nutrition: data.nutrition,
        createdAt: serverTimestamp(),
    };

    // Use a try-catch for server-side functions
    try {
        await setDoc(docRef, recipeData);
    } catch (error) {
        console.error("Firestore cache write failed:", error);
        // Re-throw the error to be caught by the calling function
        throw error;
    }
}
