
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
    limit,
    getDoc
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Chat, Message, Store, User } from './types';
import { sendChatNotification } from '@/app/actions';

/**
 * Ensures a chat exists between a customer and a store.
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
    
    const firstName = customer.firstName || 'User';
    const lastName = customer.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    const displayName = customer.phoneNumber 
        ? `${fullName} (${customer.phoneNumber})` 
        : fullName;

    const q = query(
        chatsRef, 
        where('participants', 'array-contains', customer.id),
        where('storeId', '==', store.id), 
        where('customerUid', '==', customer.id),
        limit(1)
    );

    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
        const existingChatId = snapshot.docs[0].id;
        const existingData = snapshot.docs[0].data();
        if (existingData.customerName !== displayName) {
            updateDoc(doc(db, 'chats', existingChatId), { customerName: displayName });
        }
        return existingChatId;
    }

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
 * Sends a text message and triggers a push notification.
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

    // 1. Get Sender Info for Notification
    const senderSnap = await getDoc(doc(db, 'users', senderId));
    const senderName = senderSnap.exists() ? `${senderSnap.data().firstName}` : 'New Message';

    // 2. Perform updates
    await Promise.all([
        addDoc(messagesRef, messageData),
        updateDoc(chatRef, {
            lastMessage: text,
            lastSenderId: senderId,
            updatedAt: serverTimestamp(),
            [`unreadCount.${otherParticipantId}`]: increment(1)
        }),
        // 3. Trigger Notification
        sendChatNotification(otherParticipantId, senderName, text)
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
    let downloadUrl = '';
    
    try {
        const storage = getStorage();
        const fileName = `chats/${chatId}/voice_${Date.now()}.webm`;
        const storageRef = ref(storage, fileName);
        const uploadResult = await uploadBytes(storageRef, audioBlob);
        downloadUrl = await getDownloadURL(uploadResult.ref);
    } catch (error) {
        console.warn("Storage upload failed - bucket might not be initialized:", error);
        // Fallback or error handled by caller
        throw new Error("Could not upload audio. Please ensure Cloud Storage is set up in your Firebase Console.");
    }

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

    const senderSnap = await getDoc(doc(db, 'users', senderId));
    const senderName = senderSnap.exists() ? `${senderSnap.data().firstName}` : 'New Message';

    await Promise.all([
        addDoc(messagesRef, messageData),
        updateDoc(chatRef, {
            lastMessage: '🎤 Voice message',
            lastSenderId: senderId,
            updatedAt: serverTimestamp(),
            [`unreadCount.${otherParticipantId}`]: increment(1)
        }),
        sendChatNotification(otherParticipantId, senderName, 'Sent you a voice message.')
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
