'use client';

import { Firestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { CachedRecipe } from './types';

/**
 * Retrieves a cached recipe from Firestore.
 * @param db Firestore instance.
 * @param dishName The normalized name of the dish.
 * @returns A promise that resolves to an array of ingredients or null if not in cache.
 */
export async function getCachedRecipe(db: Firestore, dishName: string): Promise<string[] | null> {
    const normalizedDishName = dishName.toLowerCase().replace(/\s+/g, '-');
    const docRef = doc(db, 'cachedRecipes', normalizedDishName);

    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data() as CachedRecipe;
            // Optional: Check TTL here if needed
            return data.ingredients;
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
 * @param ingredients The list of ingredients to cache.
 */
export async function cacheRecipe(db: Firestore, dishName: string, ingredients: string[]): Promise<void> {
    const normalizedDishName = dishName.toLowerCase().replace(/\s+/g, '-');
    const docRef = doc(db, 'cachedRecipes', normalizedDishName);

    const recipeData: CachedRecipe = {
        id: normalizedDishName,
        dishName: dishName,
        ingredients: ingredients,
        createdAt: serverTimestamp(),
    };

    try {
        await setDoc(docRef, recipeData);
    } catch (error) {
        console.error("Error caching recipe:", error);
        // We don't throw here, as caching failure shouldn't break the user flow.
    }
}
