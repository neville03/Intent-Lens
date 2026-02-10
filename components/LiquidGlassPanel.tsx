
import React, { useState, useEffect, useRef } from 'react';
import { IntentInsight, UrgencyLevel } from '../types';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { encode, decode, decodeAudioData } from '../services/geminiService';

interface LiquidGlassPanelProps {
  insight: IntentInsight;
  onDecline: (id: string) => void;
  onImplement: (insightId: string, recommendationIds: string[]) => void;
}

const LiquidGlassPanel: React.FC<LiquidGlassPanelProps> = ({ insight, onDecline, onImplement }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [lastActionMessage, setLastActionMessage] = useState<string | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => {
    setSelectedIds(insight.recommendations.map(r => r.id));
    setLastActionMessage(null);
  }, [insight.id]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleImplement = () => {
    if (selectedIds.length === 0) return;
    onImplement(insight.id, selectedIds);
    setLastActionMessage("Proactively implementing...");
    setTimeout(() => setLastActionMessage(null), 3000);
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
              if (text.includes('implement') || text.includes('approve') || text.includes('yes')) handleImplement();
              if (text.includes('decline') || text.includes('no')) onDecline(insight.id);
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
          systemInstruction: 'You assist with intent recommendations. Speak in FIRST PERSON "I".',
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

  const urgencyStyles = {
    [UrgencyLevel.LOW]: 'border-emerald-100 bg-emerald-50/20',
    [UrgencyLevel.MEDIUM]: 'border-amber-100 bg-amber-50/20',
    [UrgencyLevel.HIGH]: 'border-rose-100 bg-rose-50/20',
  };

  const urgencyBadge = {
    [UrgencyLevel.LOW]: 'bg-emerald-400',
    [UrgencyLevel.MEDIUM]: 'bg-amber-400',
    [UrgencyLevel.HIGH]: 'bg-rose-500',
  };

  return (
    <div className="fixed bottom-4 right-4 w-[280px] z-[500] animate-proactive">
      <div className="bg-white/95 backdrop-blur-xl rounded-[32px] p-4 border border-slate-200 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] ring-1 ring-black/5">
        <header className="flex justify-between items-center mb-3 px-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-slate-900 animate-pulse shadow-[0_0_8px_rgba(0,0,0,0.3)]" />
            <h2 className="font-outfit font-black text-slate-800 text-[11px] tracking-widest uppercase">INTENT SIGNAL</h2>
          </div>
          <button 
            onClick={isListening ? stopVoice : startVoice}
            className={`p-1.5 rounded-full transition-all ${isListening ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-20a3 3 0 00-3 3v8a3 3 0 006 0V5a3 3 0 00-3-3z" /></svg>
          </button>
        </header>

        <p className="text-[12px] text-slate-500 font-semibold mb-4 leading-tight px-1">{insight.summary}</p>

        {lastActionMessage && (
          <div className="mb-3 p-2 rounded-xl bg-slate-900 text-white text-[9px] font-black text-center animate-in zoom-in-95 tracking-widest uppercase">
            {lastActionMessage}
          </div>
        )}

        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-0.5 custom-scrollbar mb-4">
          {insight.recommendations.map((rec) => (
            <div 
              key={rec.id}
              onClick={() => toggleSelection(rec.id)}
              className={`cursor-pointer rounded-[20px] border p-3 transition-all active:scale-[0.98] ${selectedIds.includes(rec.id) ? urgencyStyles[rec.urgency] + ' border-slate-400' : 'border-slate-50 opacity-40 grayscale'}`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center transition-colors ${selectedIds.includes(rec.id) ? 'border-slate-800 bg-slate-800 shadow-sm' : 'border-slate-200 bg-white'}`}>
                  {selectedIds.includes(rec.id) && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-[7px] font-black text-white uppercase tracking-tighter ${urgencyBadge[rec.urgency]}`}>
                      {rec.urgency}
                    </span>
                    <span className="text-[9px] font-black text-slate-300">{(rec.confidence * 100).toFixed(0)}% MATCH</span>
                  </div>
                  <p className="text-[12px] font-bold text-slate-800 leading-snug truncate-2">{rec.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {voiceTranscript && isListening && (
          <div className="mb-4 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
            <p className="text-[10px] text-slate-400 italic font-medium leading-none">"{voiceTranscript}"</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => onDecline(insight.id)} className="py-3 rounded-2xl border border-slate-100 text-slate-400 text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors">Discard</button>
          <button 
            disabled={selectedIds.length === 0} 
            onClick={handleImplement} 
            className={`py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${selectedIds.length > 0 ? 'bg-slate-900 text-white shadow-xl shadow-slate-200 active:scale-95' : 'bg-slate-50 text-slate-300 cursor-not-allowed'}`}
          >
            Implement {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
          </button>
        </div>
      </div>
      <style>{`
        .truncate-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default LiquidGlassPanel;