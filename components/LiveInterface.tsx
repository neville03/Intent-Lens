
import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import { encode, decode, decodeAudioData } from '../services/geminiService';

interface LiveInterfaceProps {
  onTranscription: (text: string, isUser: boolean) => void;
  onVoiceCommand: (message: string) => void;
}

const LiveInterface: React.FC<LiveInterfaceProps> = ({ onTranscription, onVoiceCommand }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const stopSession = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const startSession = async () => {
    setIsConnecting(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
            const source = audioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              const pcmBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'send_chat_message') {
                  onVoiceCommand(fc.args.message as string);
                  sessionPromise.then(s => s.sendToolResponse({
                    functionResponses: { id: fc.id, name: fc.name, response: { result: "I have sent that message to the chat." } }
                  }));
                }
              }
            }
            if (message.serverContent?.outputTranscription) onTranscription(message.serverContent.outputTranscription.text, false);
            if (message.serverContent?.inputTranscription) onTranscription(message.serverContent.inputTranscription.text, true);

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }
          },
          onclose: () => stopSession(),
          onerror: () => stopSession()
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
          systemInstruction: 'You are IntentLens, an elite customer agent. You MUST use "I" and "me" instead of "we" or "us". You are a solo professional assisting the user. You can send messages to the chat using the send_chat_message tool. If a user asks you to reply, draft a natural FIRST PERSON response and send it.',
          tools: [{
            functionDeclarations: [{
              name: 'send_chat_message',
              description: 'Sends a natural FIRST PERSON message into the chat. Use "I".',
              parameters: {
                type: Type.OBJECT,
                properties: { message: { type: Type.STRING, description: 'The natural message to send. Use "I".' } },
                required: ['message']
              }
            }]
          }],
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) {
      setIsConnecting(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {isConnecting ? (
        <button disabled className="px-3 py-1.5 bg-slate-50 text-slate-400 rounded-xl text-[10px] font-bold flex items-center gap-2 border border-slate-100">
          <div className="w-2.5 h-2.5 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin" />
          Initializing...
        </button>
      ) : isConnected ? (
        <button onClick={stopSession} className="px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl text-[10px] font-bold flex items-center gap-2 hover:bg-rose-100 transition-colors">
          <div className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
          End Voice
        </button>
      ) : (
        <button onClick={startSession} className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-[10px] font-bold flex items-center gap-2 shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95">
          <span>🎙️</span>
          Talk to Agent
        </button>
      )}
    </div>
  );
};

export default LiveInterface;
