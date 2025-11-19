
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, StopCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VoiceIdCommanderProps {
  isRecording: boolean;
  setIsRecording: (isRecording: boolean) => void;
  onRecordingComplete: (audioBlob: Blob) => void;
  disabled?: boolean;
}

export function VoiceIdCommander({
  isRecording,
  setIsRecording,
  onRecordingComplete,
  disabled = false
}: VoiceIdCommanderProps) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const handleStartRecording = useCallback(async () => {
    if (isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstart = () => {
        setIsRecording(true);
        audioChunksRef.current = [];
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        onRecordingComplete(audioBlob);
        setIsRecording(false);
        // Stop all tracks on the stream to turn off the mic indicator
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        toast({
          variant: 'destructive',
          title: 'Recording Error',
          description: 'Could not record audio. Please check microphone permissions.',
        });
        setIsRecording(false);
      };

      recorder.start();

    } catch (err) {
      console.error('Error accessing microphone:', err);
      toast({
        variant: 'destructive',
        title: 'Microphone Access Denied',
        description: 'Please enable microphone permissions in your browser settings.',
      });
    }
  }, [isRecording, setIsRecording, onRecordingComplete, toast]);

  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [isRecording]);

  // Cleanup effect to ensure resources are released
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <Button
        onClick={isRecording ? handleStopRecording : handleStartRecording}
        disabled={disabled}
        className={`w-24 h-24 rounded-full transition-all duration-300 ${
          isRecording ? 'bg-destructive hover:bg-destructive/90 animate-pulse' : 'bg-primary hover:bg-primary/90'
        }`}
      >
        {isRecording ? <StopCircle className="h-10 w-10" /> : <Mic className="h-10 w-10" />}
      </Button>
      <p className="text-sm font-medium text-muted-foreground">
        {isRecording ? 'Tap to Stop Recording' : 'Tap to Start Recording'}
      </p>
    </div>
  );
}
