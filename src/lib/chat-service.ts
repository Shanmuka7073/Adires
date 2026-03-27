
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
    orderBy, 
    limit, 
    Firestore,
    updateDoc,
    increment
} from 'firebase/firestore';
import type { Chat, Message, Store, User } from './types';

/**
 * Ensures a chat exists between a customer and a store.
 */
export async function getOrCreateChat(
    db: Firestore, 
    store: Store, 
    customer: User
): Promise<string> {
    const chatsRef = collection(db, 'chats');
    const q = query(
        chatsRef, 
        where('storeId', '==', store.id), 
        where('customerUid', '==', customer.id),
        limit(1)
    );

    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
        return snapshot.docs[0].id;
    }

    // Create new chat
    const newChatId = `${store.id}_${customer.id}`;
    const chatData: Omit<Chat, 'id'> = {
        participants: [store.ownerId, customer.id],
        customerUid: customer.id,
        customerName: `${customer.firstName} ${customer.lastName}`,
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

    await setDoc(doc(db, 'chats', newChatId), chatData);
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
 * Resets unread count for a participant.
 */
export async function markChatAsRead(db: Firestore, chatId: string, userId: string) {
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
        [`unreadCount.${userId}`]: 0
    });
}
