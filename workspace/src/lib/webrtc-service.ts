
'use client';

import { 
    Firestore, 
    doc, 
    setDoc, 
    onSnapshot, 
    collection, 
    addDoc, 
    getDoc, 
    updateDoc, 
    serverTimestamp,
    query,
    getDocs
} from 'firebase/firestore';
import type { CallSession } from './types';

const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
        },
    ],
    iceCandidatePoolSize: 10,
};

export class WebRTCManager {
    pc: RTCPeerConnection;
    localStream: MediaStream | null = null;
    remoteStream: MediaStream | null = null;
    callId: string | null = null;
    db: Firestore;

    constructor(db: Firestore) {
        this.db = db;
        this.pc = new RTCPeerConnection(servers);
    }

    async initLocalStream() {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        this.remoteStream = new MediaStream();

        this.localStream.getTracks().forEach((track) => {
            if (this.localStream) this.pc.addTrack(track, this.localStream);
        });

        this.pc.ontrack = (event) => {
            event.streams[0].getTracks().forEach((track) => {
                if (this.remoteStream) this.remoteStream.addTrack(track);
            });
        };

        return { local: this.localStream, remote: this.remoteStream };
    }

    async createCall(callId: string) {
        this.callId = callId;
        const callDoc = doc(this.db, 'calls', callId);
        const callerCandidates = collection(callDoc, 'callerCandidates');
        const receiverCandidates = collection(callDoc, 'receiverCandidates');

        this.pc.onicecandidate = (event) => {
            if (event.candidate) {
                addDoc(callerCandidates, event.candidate.toJSON());
            }
        };

        const offerDescription = await this.pc.createOffer();
        await this.pc.setLocalDescription(offerDescription);

        const offer = {
            sdp: offerDescription.sdp,
            type: offerDescription.type,
        };

        await updateDoc(callDoc, { offer });

        // Listen for remote answer
        onSnapshot(callDoc, (snapshot) => {
            const data = snapshot.data();
            if (!this.pc.currentRemoteDescription && data?.answer) {
                const answerDescription = new RTCSessionDescription(data.answer);
                this.pc.setRemoteDescription(answerDescription);
            }
        });

        // Listen for receiver ICE candidates
        onSnapshot(receiverCandidates, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    this.pc.addIceCandidate(new RTCIceCandidate(data));
                }
            });
        });
    }

    async answerCall(callId: string) {
        this.callId = callId;
        const callDoc = doc(this.db, 'calls', callId);
        const callerCandidates = collection(callDoc, 'callerCandidates');
        const receiverCandidates = collection(callDoc, 'receiverCandidates');

        this.pc.onicecandidate = (event) => {
            if (event.candidate) {
                addDoc(receiverCandidates, event.candidate.toJSON());
            }
        };

        const callData = (await getDoc(callDoc)).data();
        if (!callData?.offer) return;

        const offerDescription = callData.offer;
        await this.pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

        const answerDescription = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answerDescription);

        const answer = {
            type: answerDescription.type,
            sdp: answerDescription.sdp,
        };

        await updateDoc(callDoc, { answer, status: 'active' });

        // Listen for caller ICE candidates
        onSnapshot(callerCandidates, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    this.pc.addIceCandidate(new RTCIceCandidate(data));
                }
            });
        });
    }

    hangup() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }
        this.pc.close();
        if (this.callId) {
            updateDoc(doc(this.db, 'calls', this.callId), { status: 'ended' });
        }
    }
}
