
import React, { useState, useEffect, useRef } from 'react';
import { EmailInsight, UrgencyLevel, Recommendation } from '../types';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { encode, decode, decodeAudioData, transformRecommendationToMessage } from '../services/geminiService';

interface MobileEmailPanelProps {
  insight: EmailInsight;
  onDecline: (id: string) => void;
  onImplement: (insightId: string, recommendationIds: string[], notification: string) => void;
}

const MobileEmailPanel: React.FC<MobileEmailPanelProps> = ({ insight, onDecline, onImplement }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleImplement = async () => {
    if (selectedIds.length === 0) return;
    
    const rec = insight.recommendations.find(r => selectedIds.includes(r.id));
    const summary = rec ? rec.description : "Action implemented";
    const notification = `Email sent to ${insight.originalEmail.from}. Action: ${summary}. Confidence: ${rec?.confidence || 0.85}. Urgency: ${insight.urgency}.`;
    
    onImplement(insight.id, selectedIds, notification);
  };

  const startVoice = async () => {
    if (isListening) return;
    setIsListening(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
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
            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text.toLowerCase();
              setVoiceTranscript(text);
              if (text.includes('implement first')) {
                setSelectedIds([insight.recommendations[0].id]);
                setTimeout(handleImplement, 1000);
              } else if (text.includes('implement') || text.includes('approve')) {
                handleImplement();
              } else if (text.includes('decline all') || text.includes('reject all')) {
                onDecline(insight.id);
              }
            }
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
          onclose: () => setIsListening(false),
          onerror: () => setIsListening(false)
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
          systemInstruction: 'You are IntentLens Mobile. Help the user manage email recommendations. Use "I". Commands: "implement first", "decline all", "summarize".',
          inputAudioTranscription: {},
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (e) {
      setIsListening(false);
    }
  };

  const stopVoice = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    setIsListening(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center pointer-events-none p-4 pb-12 sm:pb-8">
      {/* Magnifying Lens Blur Background */}
      <div className="absolute inset-0 bg-black/10 backdrop-blur-[80px] pointer-events-none" />
      
      {/* Prism Light Rays */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300%] h-[300%] bg-[conic-gradient(from_0deg,transparent,rgba(255,0,0,0.2),rgba(0,255,255,0.2),transparent,rgba(255,255,255,0.2),transparent)] animate-[spin_20s_linear_infinite] blur-[120px]" />
      </div>

      <div className="w-full max-w-[420px] bg-white/10 backdrop-blur-[60px] rounded-[48px] border border-white/30 shadow-[0_40px_160px_-30px_rgba(0,0,0,0.6)] prism-border p-7 pointer-events-auto relative overflow-hidden flex flex-col">
        {/* Subtle Surface Highlight */}
        <div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
        
        <header className="flex justify-between items-start mb-8 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)] ${insight.sentiment === 'positive' ? 'bg-emerald-400' : insight.sentiment === 'negative' ? 'bg-rose-400' : 'bg-slate-400'}`} />
              <h2 className="font-outfit font-black text-white text-[13px] tracking-[0.3em] uppercase opacity-90">EMAIL INTELLIGENCE</h2>
            </div>
            <p className="text-white/50 text-[12px] font-bold tracking-wide truncate max-w-[200px]">Sender: {insight.originalEmail.from}</p>
          </div>
          <button 
            onClick={isListening ? stopVoice : startVoice}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 ${isListening ? 'bg-rose-500 scale-110 shadow-[0_0_30px_rgba(244,63,94,0.6)]' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-20a3 3 0 00-3 3v8a3 3 0 006 0V5a3 3 0 00-3-3z" /></svg>
          </button>
        </header>

        <div className="mb-8 relative z-10">
          <h3 className="text-white text-[20px] font-bold leading-tight mb-3 pr-4">{insight.summary}</h3>
          <div className="flex gap-2.5">
             <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10 text-[11px] text-white font-black uppercase tracking-widest">{insight.intent}</span>
             <span className={`px-3 py-1 rounded-full text-[11px] text-white font-black uppercase tracking-widest ${insight.urgency === 'High' ? 'bg-rose-500/40' : 'bg-white/10'}`}>{insight.urgency} Priority</span>
          </div>
        </div>

        <div className="space-y-4 mb-8 flex-1 overflow-y-auto pr-1 custom-scrollbar relative z-10">
          {insight.recommendations.map((rec, idx) => (
            <div 
              key={rec.id}
              onClick={() => toggleSelection(rec.id)}
              className={`p-5 rounded-[32px] border transition-all active:scale-[0.97] ${selectedIds.includes(rec.id) ? 'bg-white border-white shadow-[0_10px_30px_rgba(255,255,255,0.2)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
            >
              <div className="flex justify-between items-center mb-2.5">
                <span className={`text-[10px] font-black uppercase tracking-wider ${selectedIds.includes(rec.id) ? 'text-slate-400' : 'text-white/30'}`}>Action Option 0{idx+1}</span>
                <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${selectedIds.includes(rec.id) ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white/60'}`}>{(rec.confidence*100).toFixed(0)}% Match</div>
              </div>
              <p className={`text-[15px] font-bold leading-snug ${selectedIds.includes(rec.id) ? 'text-slate-900' : 'text-white'}`}>{rec.description}</p>
            </div>
          ))}
        </div>

        {voiceTranscript && isListening && (
          <div className="mb-6 px-5 py-4 bg-white/5 rounded-3xl border border-white/10 border-dashed animate-pulse relative z-10">
            <p className="text-[12px] text-white/60 italic font-medium leading-tight">"{voiceTranscript}..."</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 relative z-10">
          <button 
            onClick={() => onDecline(insight.id)} 
            className="py-4 rounded-[28px] bg-white/5 border border-white/10 text-white/60 text-[13px] font-black uppercase tracking-widest hover:bg-white/10 active:scale-95 transition-all"
          >
            Discard
          </button>
          <button 
            disabled={selectedIds.length === 0} 
            onClick={handleImplement} 
            className={`py-4 rounded-[28px] text-[13px] font-black uppercase tracking-widest shadow-2xl transition-all active:scale-95 ${selectedIds.length > 0 ? 'bg-white text-slate-900 shadow-white/20' : 'bg-white/5 text-white/20 cursor-not-allowed'}`}
          >
            Implement {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
          </button>
        </div>
      </div>
      
      <style>{`
        .prism-border {
          position: relative;
        }
        .prism-border::after {
          content: '';
          position: absolute;
          inset: -1px;
          padding: 2px;
          border-radius: inherit;
          background: linear-gradient(135deg, rgba(255,255,255,0.4), rgba(255,255,255,0.05) 40%, rgba(255,255,255,0.05) 60%, rgba(255,255,255,0.4));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default MobileEmailPanel;
