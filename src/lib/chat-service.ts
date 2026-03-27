'use client';

import { 
    collection, 
    doc, 
    query, 
    where, 
    getDocs, 
    setDoc, 
    addDoc, 
    serverTimestamp, 
    Firestore,
    updateDoc,
    increment,
    limit
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Chat, Message, Store, User } from './types';

/**
 * Ensures a chat exists between a customer and a store.
 * Updated to include customer contact details in the display name.
 */
export async function getOrCreateChat(
    db: Firestore, 
    store: Store, 
    customer: Partial<User> & { id: string }
): Promise<string> {
    if (!store.id || !customer.id || !store.ownerId) {
        throw new Error("Missing required IDs for chat initialization.");
    }

    const chatsRef = collection(db, 'chats');
    
    // Rule-compliant query: includes participant filter to satisfy index/security requirements
    const q = query(
        chatsRef, 
        where('participants', 'array-contains', customer.id),
        where('storeId', '==', store.id), 
        where('customerUid', '==', customer.id),
        limit(1)
    );

    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
        return snapshot.docs[0].id;
    }

    // ENRICH IDENTITY: Format name to include phone number for merchant convenience
    const firstName = customer.firstName || 'User';
    const lastName = customer.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    const displayName = customer.phoneNumber 
        ? `${fullName} (${customer.phoneNumber})` 
        : fullName;

    // Create new unique chat ID
    const newChatId = `${store.id}_${customer.id}`;
    const chatData: Omit<Chat, 'id'> = {
        participants: [store.ownerId, customer.id],
        customerUid: customer.id,
        customerName: displayName,
        customerImageUrl: customer.imageUrl || '',
        storeId: store.id,
        storeName: store.name,
        lastMessage: 'Chat started',
        lastSenderId: 'system',
        updatedAt: serverTimestamp(),
        unreadCount: {
            [store.ownerId]: 0,
            [customer.id]: 0
        }
    };

    const chatDocRef = doc(db, 'chats', newChatId);
    await setDoc(chatDocRef, chatData);
    
    return newChatId;
}

/**
 * Sends a text message.
 */
export async function sendTextMessage(
    db: Firestore, 
    chatId: string, 
    senderId: string, 
    text: string,
    otherParticipantId: string
) {
    const messagesRef = collection(db, `chats/${chatId}/messages`);
    const chatRef = doc(db, 'chats', chatId);

    const messageData: Omit<Message, 'id'> = {
        chatId,
        senderId,
        text,
        type: 'text',
        createdAt: serverTimestamp()
    };

    await Promise.all([
        addDoc(messagesRef, messageData),
        updateDoc(chatRef, {
            lastMessage: text,
            lastSenderId: senderId,
            updatedAt: serverTimestamp(),
            [`unreadCount.${otherParticipantId}`]: increment(1)
        })
    ]);
}

/**
 * Sends a voice message.
 */
export async function sendVoiceMessage(
    db: Firestore,
    chatId: string,
    senderId: string,
    audioBlob: Blob,
    otherParticipantId: string
) {
    const storage = getStorage();
    const fileName = `chats/${chatId}/voice_${Date.now()}.webm`;
    const storageRef = ref(storage, fileName);

    // 1. Upload to Storage
    const uploadResult = await uploadBytes(storageRef, audioBlob);
    const downloadUrl = await getDownloadURL(uploadResult.ref);

    // 2. Save to Firestore
    const messagesRef = collection(db, `chats/${chatId}/messages`);
    const chatRef = doc(db, 'chats', chatId);

    const messageData: Omit<Message, 'id'> = {
        chatId,
        senderId,
        text: '🎤 Voice message',
        type: 'voice',
        audioUrl: downloadUrl,
        createdAt: serverTimestamp()
    };

    await Promise.all([
        addDoc(messagesRef, messageData),
        updateDoc(chatRef, {
            lastMessage: '🎤 Voice message',
            lastSenderId: senderId,
            updatedAt: serverTimestamp(),
            [`unreadCount.${otherParticipantId}`]: increment(1)
        })
    ]);
}

/**
 * Resets unread count for a participant.
 */
export async function markChatAsRead(db: Firestore, chatId: string, userId: string) {
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
        [`unreadCount.${userId}`]: 0
    });
}