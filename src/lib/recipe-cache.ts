
'use server';

import { Firestore, FieldValue } from 'firebase-admin/firestore';
import type { CachedRecipe, GetIngredientsOutput } from './types';

/**
 * Sanitize dish name for Firestore document ID.
 */
const createSlug = (text: string): string => {
    if (!text) return '';
    return text
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
};

/**
 * Retrieves a cached result from Firestore.
 */
export async function getCachedRecipe(db: Firestore, dishName: string, language: 'en' | 'te'): Promise<GetIngredientsOutput | null> {
    const normalizedDishName = createSlug(dishName);
    const targetDocId = `${normalizedDishName}_${language}`;
    const targetDocRef = db.collection('cachedRecipes').doc(targetDocId);
    
    try {
        const docSnap = await targetDocRef.get();
        if (docSnap.exists) {
            const data = docSnap.data() as CachedRecipe;
            return {
                isSuccess: true,
                itemType: data.itemType || 'food',
                title: data.dishName,
                components: data.components || [],
                steps: data.steps || [],
                nutrition: data.nutrition || { calories: 0, protein: 0 },
            };
        }
        
        if (language !== 'en') {
            const englishDocId = `${normalizedDishName}_en`;
            const englishDocRef = db.collection('cachedRecipes').doc(englishDocId);
            const englishDocSnap = await englishDocRef.get();
            if (englishDocSnap.exists()) {
                 const data = englishDocSnap.data() as CachedRecipe;
                 return {
                    isSuccess: true,
                    itemType: data.itemType || 'food',
                    title: data.dishName,
                    components: data.components || [],
                    steps: data.steps || [],
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
 * Caches a new result in Firestore.
 */
export async function cacheRecipe(db: Firestore, dishName: string, language: 'en' | 'te', data: GetIngredientsOutput): Promise<void> {
    const normalizedDishName = createSlug(dishName);
    const docId = `${normalizedDishName}_${language}`;
    const docRef = db.collection('cachedRecipes').doc(docId);

    // FIX: Map correctly to components and steps to avoid 'undefined' crash.
    const recipeData: CachedRecipe = {
        id: docId,
        dishName: data.title || dishName,
        itemType: data.itemType || 'food',
        components: data.components || [],
        steps: data.steps || [],
        nutrition: data.nutrition || { calories: 0, protein: 0 },
        createdAt: FieldValue.serverTimestamp(),
    };

    try {
        await docRef.set(recipeData);
    } catch (error) {
        console.error("Firestore cache write failed:", error);
        throw error;
    }
}
