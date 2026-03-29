'use client';

/**
 * @fileOverview This file imports the actual root firestore.rules file.
 * This ensures the admin dashboard always shows the latest production rules.
 */
import rules from '../../../../../firestore.rules';

export const rulesText = rules;
