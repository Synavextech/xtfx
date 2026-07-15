import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useTradeStore } from './store/useTradeStore';
import axios from 'axios';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Admindashboard from './pages/Admindashboard';
import P2p from './pages/P2p';
import Profile from './pages/Profile';
import Terms from './pages/Terms';
import Insights from './pages/Insights';
import Transactions from './pages/Transactions';

// Toast system declaration
type ToastType = 'success' | 'error' | 'info';
interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

let toastListener: ((message: string, type: ToastType) => void) | null = null;
export function showToast(message: string, type: ToastType = 'info') {
  if (toastListener) {
    toastListener(message, type);
  } else {
    console.log(`[Toast ${type}]: ${message}`);
  }
}

export default function App() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  
  const { fetchUser, connectWebSocket, user, wsState } = useTradeStore();

  // Toast listener hook
  useEffect(() => {
    toastListener = (message, type) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    };
    return () => {
      toastListener = null;
    };
  }, []);

  // Theme detection
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    const activeTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
    setTheme(activeTheme);
    
    if (activeTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // PWA Install prompt listener
  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const installPWA = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the PWA install prompt');
        }
        setDeferredPrompt(null);
      });
    }
  };

  // Initial user loading and WebSocket trigger
  useEffect(() => {
    fetchUser().then((u) => {
      if (u) {
        connectWebSocket();
      }
    });
  }, [fetchUser, connectWebSocket]);

  // Handle active user connection when logged in
  useEffect(() => {
    if (user && wsState === 'disconnected') {
      connectWebSocket();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, connectWebSocket]);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-light-bg dark:bg-dark-bg text-light-primary dark:text-dark-primary transition-colors duration-200">
        
        {/* Connection Drop Masking */}
        {wsState === 'reconnecting' && user && (
          <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-dark-bg/75 backdrop-blur-md">
            <div className="flex flex-col items-center p-8 bg-dark-panel border border-dark-border rounded-2xl shadow-2xl">
              <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4"></div>
              <h2 className="text-xl font-bold text-dark-primary mb-2">Reconnecting to server...</h2>
              <p className="text-sm text-dark-secondary">Please wait while we re-establish a secure price stream.</p>
            </div>
          </div>
        )}

        {/* Global Toast Notifications Container */}
        <div className="fixed top-4 right-4 z-[99999] flex flex-col gap-2 pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium animate-slide-in pointer-events-auto max-w-sm ${
                toast.type === 'success'
                  ? 'bg-bullish/10 border-bullish/30 text-bullish'
                  : toast.type === 'error'
                  ? 'bg-bearish/10 border-bearish/30 text-bearish'
                  : 'bg-accent/10 border-accent/30 text-accent'
              }`}
            >
              <span>{toast.message}</span>
            </div>
          ))}
        </div>

        {/* PWA Install Banner */}
        {deferredPrompt && (
          <div className="fixed bottom-16 md:bottom-4 left-4 z-[9999] flex items-center justify-between gap-4 px-4 py-3 bg-accent text-white rounded-xl shadow-xl animate-bounce">
            <span className="text-xs font-semibold">Install ExtFx - ExtremeFxTrader app!</span>
            <div className="flex gap-2">
              <button onClick={installPWA} className="px-3 py-1 bg-white text-accent text-xs font-bold rounded-lg hover:bg-opacity-90">
                Install
              </button>
              <button onClick={() => setDeferredPrompt(null)} className="text-xs text-white opacity-85 hover:opacity-100">
                Dismiss
              </button>
            </div>
          </div>
        )}

        <Routes>
          <Route path="/" element={<Landing toggleTheme={toggleTheme} theme={theme} />} />
          <Route path="/auth" element={user ? <Navigate to="/dashboard" /> : <Auth />} />
          <Route path="/dashboard" element={user ? <Dashboard toggleTheme={toggleTheme} theme={theme} /> : <Navigate to="/auth" />} />
          <Route path="/admin" element={user && user.role === 'admin' ? <Admindashboard toggleTheme={toggleTheme} theme={theme} /> : <Navigate to="/" />} />
          <Route path="/p2p" element={user ? <P2p toggleTheme={toggleTheme} theme={theme} /> : <Navigate to="/auth" />} />
          <Route path="/profile" element={user ? <Profile toggleTheme={toggleTheme} theme={theme} /> : <Navigate to="/auth" />} />
          <Route path="/insights" element={user ? <Insights toggleTheme={toggleTheme} theme={theme} /> : <Navigate to="/auth" />} />
          <Route path="/transactions" element={user ? <Transactions toggleTheme={toggleTheme} theme={theme} /> : <Navigate to="/auth" />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>

        {/* Support Chat Access Widget */}
        {user && <ChatWidget />}
      </div>
    </BrowserRouter>
  );
}

// Persistent Chat Widget Component at Bottom Right
function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [contacts, setContacts] = useState<{ id: string; username: string; role?: string }[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  
  const { chats, fetchChats, user, unreadCount, fetchUnreadCount, markMessagesRead } = useTradeStore();
  const location = useLocation();

  // Periodically fetch unread counts
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 5000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Fetch contacts or support chats when opened
  useEffect(() => {
    if (isOpen) {
      const fetchContacts = async () => {
        try {
          const res = await axios.get('/api/chats/contacts');
          setContacts(res.data);
        } catch (err) {
          console.error('Failed to fetch contacts', err);
        }
      };
      
      fetchContacts();
      fetchChats();
      
      if (user?.role !== 'admin') {
        markMessagesRead(selectedContactId || undefined);
      }
      
      const interval = setInterval(() => {
        fetchContacts();
        fetchChats();
      }, 4000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [isOpen, fetchChats, user, markMessagesRead, selectedContactId]);

  // Mark read when a contact/channel is selected
  useEffect(() => {
    if (isOpen && selectedContactId) {
      if (user?.role === 'admin') {
        markMessagesRead(selectedContactId);
      } else {
        markMessagesRead(selectedContactId === 'general' ? undefined : selectedContactId);
      }
    }
  }, [isOpen, selectedContactId, user, markMessagesRead]);

  // Hide chat widget only on auth page to prevent clutter
  if (location.pathname === '/auth') {
    return null;
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    try {
      if (user?.role === 'admin') {
        if (!selectedContactId) {
          showToast('Please select a contact first', 'info');
          return;
        }
        await axios.post('/api/chats', { message, recipientId: selectedContactId });
      } else {
        if (selectedContactId === 'general') {
          await axios.post('/api/chats', { message });
        } else if (selectedContactId) {
          await axios.post('/api/chats', { message, recipientId: selectedContactId });
        } else {
          showToast('Please select a support channel first', 'info');
          return;
        }
      }
      setMessage('');
      fetchChats();
    } catch (err) {
      showToast('Failed to send message', 'error');
    }
  };

  // Filter messages for current user/admin selection
  const filteredChats = chats.filter(c => {
    if (user?.role === 'admin') {
      return (c.sender_id === selectedContactId && c.recipient_id === null) ||
             (c.sender_id === user.id && c.recipient_id === selectedContactId);
    }
    // For standard users:
    if (selectedContactId === 'general') {
      return (c.sender_id === user?.id && c.recipient_id === null) ||
             (c.recipient_id === user?.id && c.sender?.role === 'admin' && c.recipient_id !== c.sender_id);
    } else if (selectedContactId) {
      return (c.sender_id === user?.id && c.recipient_id === selectedContactId) ||
             (c.sender_id === selectedContactId && c.recipient_id === user?.id);
    }
    return false;
  });

  return (
    <div className="fixed bottom-4 right-4 z-[999]">
      {/* Floating Toggle Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && user?.role !== 'admin') {
            markMessagesRead();
          }
        }}
        className="relative flex items-center justify-center w-14 h-14 bg-[#2962FF] text-white rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all duration-150"
        title="Open Support Chat"
      >
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#F23645] text-[10px] font-bold text-white ring-2 ring-white dark:ring-dark-panel">
                {unreadCount}
              </span>
            )}
          </>
        )}
      </button>

      {/* Chat Inbox Panel */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-80 md:w-96 h-[480px] bg-white dark:bg-[#1E222D] border border-light-border dark:border-[#2A2E39] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-in">
          {/* Header */}
          <div className="px-4 py-3 bg-[#2962FF] text-white flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm">
                {selectedContactId === 'general'
                  ? 'General Support Desk'
                  : selectedContactId
                  ? `${contacts.find(c => c.id === selectedContactId)?.username || 'Chat'}`
                  : 'Xfx Support Directory'}
              </h3>
              <p className="text-[10px] text-white/80">Typically replies instantly</p>
            </div>
            {selectedContactId && (
              <button 
                onClick={() => setSelectedContactId(null)}
                className="text-xs px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-xl text-white mr-4 transition-all"
              >
                Back to Contacts
              </button>
            )}
            <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Contacts Selection List */}
          {!selectedContactId ? (
            <div className="flex-1 overflow-y-auto bg-light-panel dark:bg-[#111112] p-3 space-y-2">
              <h4 className="text-xs font-semibold px-2 py-1 text-light-secondary dark:text-dark-secondary border-b border-light-border dark:border-[#2A2E39] mb-2">
                {user?.role === 'admin' ? 'Active User Chats' : 'Select Support Channel / Broker'}
              </h4>
              
              {user?.role !== 'admin' && (
                <button
                  onClick={() => setSelectedContactId('general')}
                  className="w-full text-left px-4 py-3 bg-white dark:bg-[#1E222D] hover:bg-light-panel dark:hover:bg-[#2A2E39] border border-[#2962FF]/20 dark:border-[#2962FF]/10 rounded-2xl text-xs flex items-center justify-between text-light-primary dark:text-[#D1D4DC] transition-all shadow-sm"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-[#2962FF]">💬 General Support Desk</span>
                    <span className="text-[9px] text-light-secondary dark:text-[#8A91A5]">Open ticket to all active support agents</span>
                  </div>
                  <span className="text-[10px] px-2.5 py-1 bg-[#2962FF]/10 text-[#2962FF] rounded-xl font-bold">Open</span>
                </button>
              )}

              {user?.role === 'admin' && contacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center p-4">
                  <p className="text-xs text-light-secondary dark:text-dark-secondary">No active support sessions.</p>
                </div>
              ) : user?.role !== 'admin' && contacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center p-4">
                  <p className="text-xs text-light-secondary dark:text-dark-secondary">Loading agents directory...</p>
                </div>
              ) : (
                contacts.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedContactId(c.id)}
                    className="w-full text-left px-4 py-3 bg-white dark:bg-[#1E222D] hover:bg-light-panel dark:hover:bg-[#2A2E39] border border-light-border dark:border-[#2A2E39] rounded-2xl text-xs flex items-center justify-between text-light-primary dark:text-[#D1D4DC] transition-all shadow-sm"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold">{c.username}</span>
                      <span className="text-[9px] text-light-secondary dark:text-[#8A91A5] uppercase font-mono tracking-wider">{c.role}</span>
                    </div>
                    <span className="text-[10px] px-2.5 py-1 bg-[#089981]/10 text-[#089981] rounded-xl font-bold">Chat</span>
                  </button>
                ))
              )}
            </div>
          ) : (
            <>
              {/* Messages Panel */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-light-panel dark:bg-[#111112]">
                {filteredChats.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <p className="text-xs text-light-secondary dark:text-dark-secondary">
                      {user?.role === 'admin' 
                        ? 'No messages in this chat. Send a message to start conversation.' 
                        : 'No messages yet. Send a message to start chatting.'}
                    </p>
                  </div>
                ) : (
                  filteredChats.map((c) => {
                    const isOwn = c.sender_id === user?.id;
                    return (
                      <div key={c.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                        <span className="text-[10px] text-light-secondary dark:text-dark-secondary mb-1">
                          {isOwn ? 'You' : c.sender?.username || 'User'}
                        </span>
                        <div
                          className={`max-w-[75%] px-3 py-2 rounded-2xl text-xs ${
                            isOwn
                              ? 'bg-[#2962FF] text-white rounded-tr-none'
                              : 'bg-white dark:bg-[#1E222D] border border-light-border dark:border-[#2A2E39] text-light-primary dark:text-[#D1D4DC] rounded-tl-none'
                          }`}
                        >
                          {c.message}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Form */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-light-border dark:border-[#2A2E39] bg-white dark:bg-[#1E222D] flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 px-3 py-2 bg-light-panel dark:bg-[#111112] border border-light-border dark:border-[#2A2E39] rounded-xl text-xs focus:outline-none focus:border-[#2962FF] text-light-primary dark:text-[#D1D4DC]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2962FF] text-white rounded-xl text-xs font-bold hover:bg-opacity-95 active:scale-95 transition-all"
                >
                  Send
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
