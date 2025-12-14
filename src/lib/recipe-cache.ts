
'use client';

import { Firestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { CachedRecipe, GetIngredientsOutput } from './types';

/**
 * Retrieves a cached recipe from Firestore.
 * It will also try to fetch the english version if the target language is not found.
 * @param db Firestore instance.
 * @param dishName The original name of the dish.
 * @param language The language of the recipe to retrieve.
 * @returns A promise that resolves to a GetIngredientsOutput object or null if not in cache.
 */
export async function getCachedRecipe(db: Firestore, dishName: string, language: 'en' | 'te'): Promise<GetIngredientsOutput | null> {
    const normalizedDishName = dishName.toLowerCase().replace(/\s+/g, '-');
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
        nutrition: data.nutrition,
        createdAt: serverTimestamp(),
    };

    // Return the promise from setDoc
    return setDoc(docRef, recipeData);
}
