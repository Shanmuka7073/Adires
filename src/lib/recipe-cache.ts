'use client';
import { Firestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { CachedRecipe } from './types';

export async function getCachedRecipe(db: Firestore, dishName: string): Promise<string[] | null> {
    const recipeId = dishName.toLowerCase().replace(/\s+/g, '-');
    const docRef = doc(db, 'cachedRecipes', recipeId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const data = docSnap.data() as CachedRecipe;
        return data.ingredients;
    }
    return null;
}

export async function cacheRecipe(db: Firestore, dishName: string, ingredients: string[]): Promise<void> {
    const recipeId = dishName.toLowerCase().replace(/\s+/g, '-');
    const docRef = doc(db, 'cachedRecipes', recipeId);
    
    const recipeData: CachedRecipe = {
        id: recipeId,
        dishName: dishName,
        ingredients: ingredients,
        createdAt: serverTimestamp(),
    };

    await setDoc(docRef, recipeData);
}
