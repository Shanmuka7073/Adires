
'use client';

import { Firestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { CachedRecipe, GetIngredientsOutput } from './types';

/**
 * Retrieves a cached recipe from Firestore.
 * @param db Firestore instance.
 * @param dishName The original name of the dish.
 * @param language The language of the recipe to retrieve.
 * @returns A promise that resolves to a GetIngredientsOutput object or null if not in cache.
 */
export async function getCachedRecipe(db: Firestore, dishName: string, language: 'en' | 'te'): Promise<GetIngredientsOutput | null> {
    const normalizedDishName = dishName.toLowerCase().replace(/\s+/g, '-');
    const docRef = doc(db, 'cachedRecipes', `${normalizedDishName}_${language}`);

    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data() as CachedRecipe;
            // Reconstruct the GetIngredientsOutput format from the cached data.
            return {
                isSuccess: true,
                title: data.dishName,
                ingredients: data.ingredients,
                instructions: data.instructions,
            };
        }
        return null;
    } catch (error) {
        console.error("Error fetching cached recipe:", error);
        return null;
    }
}

/**
 * Caches a new recipe in Firestore.
 * @param db Firestore instance.
 * @param dishName The original name of the dish.
 * @param language The language of the recipe being cached.
 * @param data The GetIngredientsOutput object from the AI.
 */
export async function cacheRecipe(db: Firestore, dishName: string, language: 'en' | 'te', data: GetIngredientsOutput): Promise<void> {
    const normalizedDishName = dishName.toLowerCase().replace(/\s+/g, '-');
    const docId = `${normalizedDishName}_${language}`;
    const docRef = doc(db, 'cachedRecipes', docId);

    const recipeData: CachedRecipe = {
        id: docId,
        dishName: data.title, // Use the official title from the AI
        ingredients: data.ingredients,
        instructions: data.instructions,
        createdAt: serverTimestamp(),
    };

    try {
        await setDoc(docRef, recipeData);
    } catch (error) {
        console.error("Error caching recipe:", error);
        // We don't throw here, as caching failure shouldn't break the user flow.
    }
}
