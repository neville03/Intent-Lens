import React, { useState, useEffect } from 'react';

/**
 * GOOGLE_CLIENT_ID
 * Provided by user: 41596381112-9j8da5scc93nv1de4dbnqp1cl2n04792.apps.googleusercontent.com
 */
const GOOGLE_CLIENT_ID = "41596381112-9j8da5scc93nv1de4dbnqp1cl2n04792.apps.googleusercontent.com";

interface EmailConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EmailConnectionModal: React.FC<EmailConnectionModalProps> = ({ isOpen, onClose }) => {
  const [copiedType, setCopiedType] = useState<'origin' | 'redirect' | null>(null);
  
  // Rule: Origins must not contain a path or end with "/"
  const detectedOrigin = window.location.origin.replace(/\/$/, "");
  
  // Rule: Redirect URIs must be the exact destination
  // We ensure there's a trailing slash ONLY if it's the root to match exact browser behavior
  const detectedRedirectUri = (window.location.origin + window.location.pathname).replace(/\/$/, "") + (window.location.pathname === "/" ? "/" : "");

  if (!isOpen) return null;

  const handleGoogleConnect = () => {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ].join(' ');
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(detectedRedirectUri)}&response_type=token&scope=${encodeURIComponent(scopes)}&prompt=consent`;
    
    window.location.href = authUrl;
  };

  const copyToClipboard = (text: string, type: 'origin' | 'redirect') => {
    // Trim whitespace to avoid validation errors
    navigator.clipboard.writeText(text.trim());
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
      <div className="w-full max-w-[460px] bg-white rounded-[40px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="h-2 bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500" />
        
        <div className="p-8">
          <header className="mb-6 text-center">
            <div className="w-14 h-14 bg-slate-50 rounded-[20px] flex items-center justify-center mx-auto mb-4 border border-slate-100 shadow-sm">
              <span className="text-xl">⚡</span>
            </div>
            <h2 className="font-outfit font-bold text-2xl text-slate-900 mb-1">OAuth Setup Helper</h2>
            <p className="text-[12px] text-slate-400 leading-relaxed px-4">
              Fix "Invalid Redirect" errors by copying these sanitized values.
            </p>
          </header>

          <div className="space-y-4 mb-8">
            {/* Field 1: JavaScript Origins */}
            <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">1. Authorized JavaScript origin</h3>
                {copiedType === 'origin' && <span className="text-[9px] font-bold text-emerald-500 uppercase">Copied!</span>}
              </div>
              <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200">
                <code className="flex-1 text-[10px] text-slate-600 font-mono truncate">{detectedOrigin}</code>
                <button 
                  onClick={() => copyToClipboard(detectedOrigin, 'origin')}
                  className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase hover:bg-slate-800 transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Field 2: Redirect URIs */}
            <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">2. Authorized redirect URI</h3>
                {copiedType === 'redirect' && <span className="text-[9px] font-bold text-emerald-500 uppercase">Copied!</span>}
              </div>
              <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200">
                <code className="flex-1 text-[10px] text-indigo-600 font-mono truncate">{detectedRedirectUri}</code>
                <button 
                  onClick={() => copyToClipboard(detectedRedirectUri, 'redirect')}
                  className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase hover:bg-slate-800 transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Troubleshooting Note */}
            <div className="px-2">
               <p className="text-[10px] text-amber-600 font-medium leading-relaxed bg-amber-50/50 p-3 rounded-2xl border border-amber-100/50">
                 <b>Troubleshooting:</b> If you still get "must end with a public top-level domain", it means Google doesn't trust this preview domain. Try running the app on <code>localhost</code> or a <code>.com</code> domain.
               </p>
            </div>
          </div>

          <div className="space-y-3">
            <button 
              onClick={handleGoogleConnect}
              className="w-full py-5 px-6 rounded-3xl bg-slate-900 text-white flex items-center justify-center gap-4 hover:bg-slate-800 transition-all active:scale-[0.98] group shadow-xl shadow-slate-200"
            >
              <img src="https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg" className="w-5 h-5" alt="Gmail" />
              <p className="text-[14px] font-bold">Connect via Google OAuth</p>
            </button>
            
            <button 
              onClick={onClose} 
              className="w-full py-3 text-[11px] font-bold text-slate-300 hover:text-slate-400 transition-colors uppercase tracking-widest"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailConnectionModal;