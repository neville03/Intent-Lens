
import React, { useState, useEffect, useCallback } from 'react';
import { ChatMessage, IntentInsight, EmailInsight, EmailMessage, UrgencyLevel } from './types';
import { analyzeConversation, analyzeEmail, transformRecommendationToMessage } from './services/geminiService';
import { getGmailProfile, fetchLatestEmails, sendGmailMessage, GmailProfile } from './services/gmailService';
import ConversationSimulator from './components/ConversationSimulator';
import LiquidGlassPanel from './components/LiquidGlassPanel';
import MobileEmailPanel from './components/MobileEmailPanel';
import LiveInterface from './components/LiveInterface';
import EmailConnectionModal from './components/EmailConnectionModal';

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [insights, setInsights] = useState<IntentInsight[]>([]);
  const [activeInsight, setActiveInsight] = useState<IntentInsight | null>(null);
  const [activeEmailInsight, setActiveEmailInsight] = useState<EmailInsight | null>(null);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [voiceHistory, setVoiceHistory] = useState<{text: string, isUser: boolean}[]>([]);

  // Real OAuth Connection State
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<GmailProfile | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Parse OAuth Token on Load
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
      if (token) {
        setAccessToken(token);
        sessionStorage.setItem('gmail_token', token);
        window.history.replaceState(null, "", window.location.pathname);
        loadRealProfile(token);
      }
    } else {
      const savedToken = sessionStorage.getItem('gmail_token');
      if (savedToken) {
        setAccessToken(savedToken);
        loadRealProfile(savedToken);
      }
    }
  }, []);

  const playInsightPing = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    const triggerAnalysis = async () => {
      if (messages.length === 0) return;
      const lastMsg = messages[messages.length - 1];
      
      // Proactively trigger whenever a customer speaks
      if (lastMsg.sender === 'Customer') {
        setActiveInsight(null); // Clear previous to ensure the NEW one always pops fresh
        setIsAnalyzing(true);
        
        const insight = await analyzeConversation(messages);
        if (insight) {
          setInsights(prev => [...prev, insight]);
          setActiveInsight(insight); 
          playInsightPing();
        }
        setIsAnalyzing(false);
      }
    };
    triggerAnalysis();
  }, [messages.length]);

  const loadRealProfile = async (token: string) => {
    try {
      const profile = await getGmailProfile(token);
      setUserProfile(profile);
      showNotification(`Securely linked to ${profile.email}`);
    } catch (e) {
      sessionStorage.removeItem('gmail_token');
      setAccessToken(null);
      setUserProfile(null);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('gmail_token');
    setAccessToken(null);
    setUserProfile(null);
    showNotification("Disconnected from Gmail.");
  };

  const handleRefreshInbox = async () => {
    if (!accessToken) {
      setIsConnectionModalOpen(true);
      return;
    }

    setIsSyncing(true);
    try {
      const emails = await fetchLatestEmails(accessToken);
      if (emails.length > 0) {
        const latest = emails[0];
        const emailMsg: EmailMessage = {
          id: latest.id,
          from: latest.from,
          subject: latest.subject,
          body: latest.body,
          timestamp: latest.timestamp
        };
        
        setActiveEmailInsight(null); // Clear to pop fresh
        setIsAnalyzing(true);
        const insight = await analyzeEmail(emailMsg);
        if (insight) {
          setActiveEmailInsight(insight);
          playInsightPing();
        }
        setIsAnalyzing(false);
        showNotification(`Detected intent in email from ${latest.from}`);
      } else {
        showNotification("Inbox synchronized. No unread intent signals.");
      }
    } catch (e) {
      showNotification("Session expired. Please reconnect.");
      setAccessToken(null);
      setUserProfile(null);
    }
    setIsSyncing(false);
  };

  const handleNewMessage = (msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
  };

  const handleDismissInsight = (id: string) => {
    if (activeInsight?.id === id) setActiveInsight(null);
    setInsights(prev => prev.filter(i => i.id !== id));
  };

  const handleDismissEmailInsight = (id: string) => {
    setActiveEmailInsight(null);
  };

  const showNotification = (msg: string) => {
    setNotifications(prev => [...prev, msg]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n !== msg));
    }, 6000);
  };

  const handleImplementEmailActions = async (insightId: string, recommendationIds: string[], notification: string) => {
    if (!activeEmailInsight || !accessToken) return;
    setIsSyncing(true);
    try {
      for (const recId of recommendationIds) {
        const rec = activeEmailInsight.recommendations.find(r => r.id === recId);
        if (rec) {
          const draftBody = await transformRecommendationToMessage(rec.description, activeEmailInsight.originalEmail);
          await sendGmailMessage(accessToken, activeEmailInsight.originalEmail.from, `Re: ${activeEmailInsight.originalEmail.subject}`, draftBody);
        }
      }
      showNotification(`Intent successfully implemented via Gmail.`);
    } catch (e) {
      showNotification("Email API Error.");
    }
    setIsSyncing(false);
    setActiveEmailInsight(null);
  };

  const handleImplementActions = async (insightId: string, recommendationIds: string[]) => {
    const targetInsight = insights.find(i => i.id === insightId);
    if (!targetInsight) return;

    for (const [index, recId] of recommendationIds.entries()) {
      const rec = targetInsight.recommendations.find(r => r.id === recId);
      if (rec) {
        const naturalMessage = await transformRecommendationToMessage(rec.description, messages);
        setTimeout(() => {
          handleNewMessage({
            id: `exec-${Date.now()}-${recId}`,
            sender: 'Agent',
            text: naturalMessage,
            timestamp: new Date()
          });
        }, index * 800);
      }
    }
    setTimeout(() => setActiveInsight(null), 2000);
  };

  const handleVoiceTranscription = (text: string, isUser: boolean) => {
    setVoiceHistory(prev => {
      const last = prev[prev.length - 1];
      if (last && last.isUser === isUser) {
        return [...prev.slice(0, -1), { text: last.text + ' ' + text, isUser }];
      }
      return [...prev, { text, isUser }];
    });
  };

  const handleVoiceCommandMessage = (text: string) => {
    handleNewMessage({ id: `voice-${Date.now()}`, sender: 'Agent', text, timestamp: new Date() });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col relative overflow-x-hidden">
      {/* Background Gradients */}
      <div className="fixed top-[-10%] left-[-5%] w-[40%] h-[40%] bg-blue-50/40 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="fixed bottom-[-10%] right-[-5%] w-[30%] h-[30%] bg-indigo-50/40 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* Notifications Toast */}
      <div className="fixed top-24 right-4 z-[500] space-y-3 pointer-events-none">
        {notifications.map((note, idx) => (
          <div key={idx} className="bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 max-w-[320px] animate-in slide-in-from-right-full fade-in pointer-events-auto">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Live Pulse</span>
            </div>
            <p className="text-[12px] font-bold leading-tight">{note}</p>
          </div>
        ))}
      </div>

      <nav className="h-20 border-b border-slate-100 flex items-center justify-between px-4 sm:px-8 bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          {userProfile ? (
            <div className="group relative">
              <img src={userProfile.picture} className="w-10 h-10 rounded-full border-2 border-slate-900 shadow-md group-hover:opacity-40 transition-opacity" alt="Profile" />
              <button 
                onClick={handleLogout}
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <span className="text-[8px] font-black uppercase bg-white/80 px-1 rounded text-slate-900">Out</span>
              </button>
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-400 border-2 border-white rounded-full shadow-sm" />
            </div>
          ) : (
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-inner cursor-pointer" onClick={() => setIsConnectionModalOpen(true)}>I</div>
          )}
          <div>
            <span className="font-outfit font-bold text-lg tracking-tight block leading-none">IntentLens</span>
            {userProfile && (
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mt-1">
                INBOX: {userProfile.email}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleRefreshInbox}
            className={`flex px-4 py-2 rounded-2xl border text-[11px] font-black uppercase tracking-widest transition-all items-center gap-2 ${accessToken ? 'border-emerald-100 bg-emerald-50/50 text-emerald-600 hover:bg-emerald-100' : 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-blue-400 animate-ping' : accessToken ? 'bg-emerald-400' : 'bg-blue-400'}`} />
            {accessToken ? (isSyncing ? 'Syncing...' : 'Sync Inbox') : 'Connect Gmail'}
          </button>
          <LiveInterface onTranscription={handleVoiceTranscription} onVoiceCommand={handleVoiceCommandMessage} />
        </div>
      </nav>

      <main className="flex-1 p-4 sm:p-8 grid grid-cols-12 gap-6 max-w-[1400px] mx-auto w-full">
        <section className="col-span-12 lg:col-span-8 flex flex-col gap-6">
          <div className="bg-white rounded-[40px] border border-slate-200 p-8 shadow-sm relative overflow-hidden">
            <header className="mb-6 flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-outfit font-bold text-slate-900">Active Intelligence Workspace</h1>
                <p className="text-[12px] text-slate-400 font-medium">Monitoring real-time conversational and email intent signals.</p>
              </div>
              {isAnalyzing && (
                <div className="flex items-center gap-2 text-[10px] font-black text-blue-500 uppercase bg-blue-50 px-3 py-1 rounded-full animate-pulse border border-blue-100">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                  Gemini Reasoning Active
                </div>
              )}
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 min-h-[500px]">
              <ConversationSimulator messages={messages} onNewMessage={handleNewMessage} />
              <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100 flex flex-col h-full backdrop-blur-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Live Signal Monitor</h3>
                  <div className="flex gap-1">
                    <div className="w-1 h-3 bg-slate-200 rounded-full" />
                    <div className="w-1 h-5 bg-slate-300 rounded-full" />
                    <div className="w-1 h-2 bg-slate-200 rounded-full" />
                  </div>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto max-h-[440px] pr-2 custom-scrollbar">
                  {voiceHistory.map((v, i) => (
                    <div key={i} className={`flex ${v.isUser ? 'justify-start' : 'justify-end'}`}>
                      <div className={`p-4 rounded-[24px] text-[12px] font-medium max-w-[90%] shadow-sm leading-relaxed ${v.isUser ? 'bg-white border border-slate-100 text-slate-600' : 'bg-slate-900 text-white shadow-slate-200'}`}>
                        {v.text}
                      </div>
                    </div>
                  ))}
                  {voiceHistory.length === 0 && (
                    <div className="h-full flex items-center justify-center opacity-20 flex-col gap-4 py-20">
                       <div className="w-16 h-16 rounded-full border-[3px] border-slate-200 border-dashed animate-[spin_10s_linear_infinite]" />
                       <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Waiting for Intent Signals</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="col-span-12 lg:col-span-4 flex flex-col gap-4">
          <div className="bg-white rounded-[40px] border border-slate-200 p-8 lg:sticky lg:top-28 shadow-sm h-fit">
            <div className="flex justify-between items-center mb-6">
               <h3 className="text-[12px] font-black text-slate-900 uppercase tracking-widest">Intelligence Log</h3>
               <div className="px-2 py-1 bg-slate-900 text-white rounded-md text-[9px] font-black uppercase">{insights.length} Signals</div>
            </div>
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {insights.length === 0 && (
                <div className="py-20 text-center">
                  <div className="text-4xl mb-4 opacity-20">🧠</div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">No history yet</p>
                </div>
              )}
              {insights.slice().reverse().map((insight) => (
                <button 
                  key={insight.id} 
                  onClick={() => setActiveInsight(insight)} 
                  className={`w-full text-left p-5 rounded-[28px] border transition-all active:scale-[0.98] ${activeInsight?.id === insight.id ? 'bg-slate-50 border-slate-900 shadow-xl shadow-slate-100 translate-x-1' : 'bg-white border-slate-100 hover:border-slate-300'}`}
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{new Date(insight.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                  </div>
                  <h4 className="text-[14px] font-bold text-slate-800 leading-tight mb-3">{insight.summary}</h4>
                  <div className="flex flex-wrap gap-2">
                    {insight.signals.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full bg-slate-100 text-[8px] font-black text-slate-500 uppercase tracking-tighter">{s}</span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Proactive Intelligence Panels */}
      {activeInsight && (
        <LiquidGlassPanel 
          key={activeInsight.id}
          insight={activeInsight} 
          onDecline={handleDismissInsight} 
          onImplement={handleImplementActions} 
        />
      )}

      {activeEmailInsight && (
        <MobileEmailPanel 
          key={activeEmailInsight.id}
          insight={activeEmailInsight} 
          onDecline={handleDismissEmailInsight} 
          onImplement={handleImplementEmailActions} 
        />
      )}

      <EmailConnectionModal isOpen={isConnectionModalOpen} onClose={() => setIsConnectionModalOpen(false)} />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #f1f5f9; border-radius: 20px; }
        .font-outfit { font-family: 'Outfit', sans-serif; }
      `}</style>
    </div>
  );
};

export default App;
