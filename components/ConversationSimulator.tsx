
import React, { useState } from 'react';
import { ChatMessage } from '../types';

interface ConversationSimulatorProps {
  onNewMessage: (msg: ChatMessage) => void;
  messages: ChatMessage[];
}

const ConversationSimulator: React.FC<ConversationSimulatorProps> = ({ onNewMessage, messages }) => {
  const [inputText, setInputText] = useState('');
  const [sender, setSender] = useState<'Customer' | 'Agent'>('Customer');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    onNewMessage({
      id: Date.now().toString(),
      sender,
      text: inputText,
      timestamp: new Date(),
    });
    setInputText('');
  };

  const templates = [
    { label: "Price Query", text: "Can you tell me about the annual pricing plans? We have about 50 users.", sender: 'Customer' },
    { label: "Urgency", text: "We need a solution by end of this week. Can we expedite onboarding?", sender: 'Customer' },
    { label: "Hesitation", text: "I'm not sure if the budget is approved yet. We're looking at alternatives.", sender: 'Customer' },
    { label: "Agent Reply", text: "I understand. I can schedule a demo with our technical lead today.", sender: 'Agent' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full max-h-[600px]">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
        <h2 className="font-outfit font-semibold text-slate-700">Conversational Context</h2>
        <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
          <button 
            onClick={() => setSender('Customer')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${sender === 'Customer' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Customer
          </button>
          <button 
            onClick={() => setSender('Agent')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${sender === 'Agent' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Agent
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
            <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-300 mb-3 flex items-center justify-center">
              <span className="text-lg">💬</span>
            </div>
            <p className="text-sm">Start a conversation to begin monitoring intent.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.sender === 'Agent' ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-tighter px-2">{msg.sender}</span>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${msg.sender === 'Agent' ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 border border-slate-100'}`}>
                {msg.text}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 bg-white border-t border-slate-100">
        <div className="flex gap-2 mb-3 overflow-x-auto pb-2 scrollbar-hide">
          {templates.map((t, idx) => (
            <button 
              key={idx}
              onClick={() => { setSender(t.sender as any); setInputText(t.text); }}
              className="whitespace-nowrap px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              + {t.label}
            </button>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="relative">
          <input 
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            className="w-full pl-4 pr-12 py-3 rounded-xl bg-slate-900 text-white placeholder:text-slate-400 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all text-sm"
          />
          <button 
            type="submit"
            className="absolute right-2 top-2 p-1.5 bg-white text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ConversationSimulator;
