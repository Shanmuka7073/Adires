
export const checkoutLoopCodeText = `
// src/components/layout/voice-commander.tsx

// ... inside handleCommand function

    // --- CONTEXTUAL RESPONSES ---
    if (itemForPriceCheck.current) {
        // ... (price check logic)
    }
    
    if (isWaitingForAddressTypeRef.current) {
        isWaitingForAddressTypeRef.current = false; // Reset immediately to prevent re-entry

        const homeKeywords = getAllAliases('homeAddress')[spokenLang] || ['home'];
        const locationKeywords = getAllAliases('currentLocation')[spokenLang] || ['current', 'location'];
        
        const homeSimilarity = Math.max(...homeKeywords.map(kw => calculateSimilarity(commandText.toLowerCase(), kw)));
        const locationSimilarity = Math.max(...locationKeywords.map(kw => calculateSimilarity(commandText.toLowerCase(), kw)));

        if (homeSimilarity > 0.6 && homeSimilarity > locationSimilarity) {
            handleUseHomeAddress();
            speak(t('setting-delivery-to-home-speech', replyLang), langWithRegion, triggerVoicePrompt);
        } else if (locationSimilarity > 0.6) {
            handleUseCurrentLocation();
            speak(t('using-current-location-speech', replyLang), langWithRegion, triggerVoicePrompt);
        } else {
            // Re-set the flag if we didn't understand, so we can ask again.
            isWaitingForAddressTypeRef.current = true; 
            speak(t('did-not-understand-address-type-speech', replyLang), langWithRegion, triggerVoicePrompt);
            handleCommandFailure(commandText, spokenLang, \`Address type clarification failed. Similarities: Home=\${homeSimilarity.toFixed(2)}, Location=\${locationSimilarity.toFixed(2)}\`);
        }
        return; // Important: Exit after handling the contextual response
    }

    if (isWaitingForStoreNameRef.current) {
        // ... (store name logic)
    }

// ... rest of the function
`;
