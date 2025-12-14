
// This file is a placeholder to hold the raw text of the firestore.rules file
// so it can be easily displayed in a help page component.

export const rulesText = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }
    
    function isAdmin() {
        return isSignedIn() && (request.auth.token.email == 'admin@gmail.com' || request.auth.token.email == 'admin2@gmail.com');
    }

    function isChickenAdmin() {
        return isSignedIn() && request.auth.token.email == 'chickenadmin@gmail.com';
    }

    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    function isStoreOwner(storeId) {
        return isSignedIn() && get(/databases/$(database)/documents/stores/$(storeId)).data.ownerId == request.auth.uid;
    }

    match /users/{userId} {
      allow get, update, delete: if isOwner(userId);
      allow list: if isAdmin();
      allow create: if isOwner(userId) && request.resource.data.id == userId;
    }

    match /asha-conversations/{userId}/{document=**} {
        allow read, write: if isSignedIn();
    }
     
    match /asha-conversations/{userId}/atlas_reports/{reportId} {
      allow create, read: if isOwner(userId);
    }

    match /stores/{storeId} {
      allow get, list: if true;
      allow create: if isSignedIn() && request.resource.data.ownerId == request.auth.uid;
      allow update, delete: if isStoreOwner(storeId);
    }

    match /stores/{storeId}/products/{productId} {
      allow get, list: if true;
      allow create, update, delete: if isStoreOwner(storeId);
    }

    match /stores/{storeId}/menus/{menuId} {
      allow read: if true;
      allow write: if isStoreOwner(storeId);
    }

    match /stores/{storeId}/packages/{packageId} {
      allow get, list: if true;
      allow create, update, delete: if isStoreOwner(storeId);
    }

    match /orders/{orderId} {
      allow get, list: if true;

      allow create: if isSignedIn() && request.resource.data.userId == request.auth.uid;

      allow update: if isSignedIn() && (
        request.auth.uid == resource.data.userId ||
        (exists(/databases/$(database)/documents/stores/$(resource.data.storeId)) && get(/databases/$(database)/documents/stores/$(resource.data.storeId)).data.ownerId == request.auth.uid) ||
        request.auth.uid == resource.data.deliveryPartnerId ||
        isAdmin() ||
        (resource.data.deliveryPartnerId == null && request.resource.data.deliveryPartnerId == request.auth.uid)
      );

      allow delete: if false;
    }

    match /orders/{orderId}/orderItems/{orderItemId} {
      allow get, list: if true;
      allow create, update, delete: if false;
    }

    match /users/{userId}/productRecommendations/{productRecommendationId} {
      allow get, list: if isOwner(userId);
      allow create, update, delete: if false;
    }
    
    match /voice-orders/{voiceOrderId} {
      allow read, write: if isSignedIn();
    }

    match /cachedRecipes/{recipeId} {
      allow get, list: if true;
      allow create, update: if isSignedIn();
      allow delete: if false;
    }

    match /cachedAIResponses/{responseId} {
        allow get, list: if true;
        allow create: if true;
        allow update, delete: if false;
    }

    match /deliveryPartners/{partnerId} {
      allow get, update: if isOwner(partnerId);
      allow list: if isAdmin();
      allow create: if isOwner(partnerId) && request.resource.data.userId == partnerId;
      allow delete: if false;
    }

    match /deliveryPartners/{partnerId}/payouts/{payoutId} {
      allow get, list: if isOwner(partnerId);
      allow create: if isOwner(partnerId);
      allow update, delete: if false;
    }

    match /productPrices/{productName} {
      allow get, list: if true;
      allow write: if isAdmin() || (isChickenAdmin() && productName.matches('.*chicken.*'));
    }
    
    match /failedCommands/{commandId} {
      allow read, list: if isAdmin();
      allow create: if isSignedIn() && request.resource.data.userId == request.auth.uid;
      allow update, delete: if isAdmin();
    }

    match /voiceAliasGroups/{key} {
      allow read: if true;
      allow write: if isAdmin();
    }
    
    match /voiceCommands/{commandKey} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /siteConfig/{configId} {
        allow read: if true;
        allow write: if isAdmin();
    }
  }
}
`;
