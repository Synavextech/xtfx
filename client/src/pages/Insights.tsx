import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useTradeStore } from '../store/useTradeStore';
import { showToast } from '../App';
import { MessageSquare, Trash2, ArrowLeft, Send } from 'lucide-react';

interface InsightsProps {
  toggleTheme: () => void;
  theme: 'light' | 'dark';
}

export default function Insights({ toggleTheme, theme }: InsightsProps) {
  const {
    user,
    wallets,
    activeWalletType,
    setActiveWalletType,
    activeTrades,
    logout
  } = useTradeStore();

  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [insights, setInsights] = useState<any[]>([]);
  const [selectedInsight, setSelectedInsight] = useState<any | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);

  const activeWallet = wallets.find((w) => w.type === activeWalletType);
  const activeBalance = activeWallet ? Number(activeWallet.balance) : 0.0;
  const leverage = 100;
  const floatingPnl = activeTrades ? activeTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) : 0;
  const totalMarginUsed = activeTrades ? activeTrades.reduce((sum, t) => sum + (t.quantity * t.entry_price) / leverage, 0) : 0;
  const equity = activeBalance + floatingPnl;
  const freeMargin = equity - totalMarginUsed;

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/insights');
      setInsights(res.data || []);
      if (res.data && res.data.length > 0) {
        handleSelectInsight(res.data[0].id);
      }
    } catch (err: any) {
      showToast('Failed to load insights', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectInsight = async (id: string) => {
    setLoadingComments(true);
    try {
      const res = await axios.get(`/api/insights/${id}`);
      setSelectedInsight(res.data.insight);
      setComments(res.data.comments || []);
    } catch (err: any) {
      showToast('Failed to load details', 'error');
    } finally {
      setLoadingComments(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInsight) return;
    if (!newComment.trim()) return;

    try {
      const res = await axios.post(`/api/insights/${selectedInsight.id}/comments`, {
        content: newComment
      });
      setComments((prev) => [...prev, res.data]);
      setNewComment('');
      showToast('Comment posted successfully', 'success');
    } catch (err: any) {
      showToast('Failed to post comment', 'error');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;

    try {
      await axios.delete(`/api/insights/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      showToast('Comment deleted successfully', 'success');
    } catch (err: any) {
      showToast('Failed to delete comment', 'error');
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  return (
    <div className="min-h-screen bg-light-bg dark:bg-[#0c0d10] text-light-primary dark:text-[#D1D4DC] flex flex-col font-sans">
      
      {/* Mobile Navigation Drawer */}
      {showMobileDrawer && (
        <div className="fixed inset-0 z-[100] flex md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowMobileDrawer(false)}></div>
          <div className="relative w-72 max-w-xs bg-white dark:bg-dark-panel p-6 flex flex-col justify-between shadow-2xl animate-slide-in-left border-r border-light-border dark:border-[#2A2E39]">
            <div>
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-light-border dark:border-[#2A2E39]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center font-black text-white text-sm">E</div>
                  <span className="font-extrabold text-base tracking-wider dark:text-white">ExtFx</span>
                </div>
                <button onClick={() => setShowMobileDrawer(false)} className="text-[#8A91A5] hover:text-white">
                  ✕
                </button>
              </div>

              {/* Sidebar Account Stats */}
              <div className="mb-6 p-4 bg-light-panel dark:bg-dark-bg/40 border border-light-border dark:border-[#2A2E39] rounded-2xl flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8A91A5]">Equity</span>
                  <span className={`font-mono font-bold ${floatingPnl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                    ${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8A91A5]">Free Margin</span>
                  <span className="font-mono font-bold text-light-primary dark:text-[#D1D4DC]">
                    ${freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Navigation Links */}
              <div className="flex flex-col gap-2.5 text-xs font-semibold text-light-primary dark:text-[#D1D4DC]">
                <Link
                  to="/transactions"
                  onClick={() => setShowMobileDrawer(false)}
                  className="text-left py-2 px-3 hover:bg-light-panel dark:hover:bg-[#2A2E39] rounded-xl flex items-center gap-2"
                >
                  📁 Transaction History
                </Link>
                <Link
                  to="/insights"
                  onClick={() => setShowMobileDrawer(false)}
                  className="py-2 px-3 hover:bg-light-panel dark:hover:bg-[#2A2E39] rounded-xl flex items-center gap-2 bg-[#2962FF]/10 text-[#2962FF]"
                >
                  💡 Market Insights
                </Link>
                <Link
                  to="/p2p"
                  onClick={() => setShowMobileDrawer(false)}
                  className="py-2 px-3 hover:bg-light-panel dark:hover:bg-[#2A2E39] rounded-xl flex items-center gap-2"
                >
                  🤝 P2P Escrow
                </Link>
                {user?.role === 'admin' && (
                  <Link
                    to="/admin"
                    onClick={() => setShowMobileDrawer(false)}
                    className="py-2 px-3 text-[#2962FF] hover:bg-[#2962FF]/10 rounded-xl flex items-center gap-2"
                  >
                    ⚙️ Admin Panel
                  </Link>
                )}
                <Link
                  to="/profile"
                  onClick={() => setShowMobileDrawer(false)}
                  className="py-2 px-3 hover:bg-light-panel dark:hover:bg-[#2A2E39] rounded-xl flex items-center gap-2"
                >
                  👤 My Profile
                </Link>
                <Link
                  to="/terms"
                  onClick={() => setShowMobileDrawer(false)}
                  className="py-2 px-3 hover:bg-light-panel dark:hover:bg-[#2A2E39] rounded-xl flex items-center gap-2"
                >
                  📄 Terms & Services
                </Link>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-light-border dark:border-[#2A2E39] pt-4 mt-6">
              <button
                onClick={() => {
                  toggleTheme();
                  setShowMobileDrawer(false);
                }}
                className="text-xs font-semibold text-[#8A91A5]"
              >
                {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
              </button>
              <button
                onClick={() => {
                  logout();
                  setShowMobileDrawer(false);
                }}
                className="text-xs font-bold text-[#F23645]"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Top Header */}
      <header className="sticky top-0 z-[50] flex items-center justify-between px-4 md:px-6 py-4 bg-white dark:bg-dark-panel border-b border-light-border dark:border-dark-border/40 shadow-sm flex-shrink-0">
        
        {/* Left Side */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowMobileDrawer(true)}
            className="md:hidden p-1.5 text-light-secondary dark:text-[#8A91A5] hover:text-light-primary dark:hover:text-white rounded-lg hover:bg-light-panel dark:hover:bg-[#2A2E39]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center font-black text-white text-base">E</div>
            <span className="font-extrabold text-lg tracking-wider hidden sm:block dark:text-white">ExtFx</span>
          </Link>

          {/* Desktop-only Real vs Demo operational dropdown */}
          <div className="hidden md:flex items-center gap-4">
            <div className="relative">
              <select
                value={activeWalletType}
                onChange={(e) => setActiveWalletType(e.target.value as any)}
                className="appearance-none pl-4 pr-10 py-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-[#2A2E39] rounded-xl text-xs font-bold focus:outline-none cursor-pointer text-light-primary dark:text-[#D1D4DC]"
              >
                <option value="demo">Demo Account</option>
                <option value="real">Real Account</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-light-secondary dark:text-dark-secondary text-[8px]">
                ▼
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/dashboard?modal=deposit"
                className="px-4 py-2 bg-[#089981] text-white font-bold rounded-xl text-xs shadow-md shadow-[#089981]/10 hover:opacity-95 text-center flex items-center justify-center"
              >
                Deposit
              </Link>
              <Link
                to="/dashboard?modal=withdraw"
                className="px-4 py-2 bg-light-panel dark:bg-dark-bg border border-light-border dark:border-[#2A2E39] text-light-primary dark:text-[#D1D4DC] font-bold rounded-xl text-xs hover:opacity-95 text-center flex items-center justify-center"
              >
                Withdraw
              </Link>
            </div>
          </div>
        </div>

        {/* Live performance dashboard */}
        <div className="hidden md:flex items-center gap-8 font-semibold">
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-[#8A91A5] uppercase">Balance</span>
            <span className="font-mono font-extrabold text-sm text-light-primary dark:text-[#D1D4DC]">
              ${activeBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-[#8A91A5] uppercase">Equity</span>
            <span className={`font-mono font-extrabold text-sm ${floatingPnl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
              ${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-[#8A91A5] uppercase">Free Margin</span>
            <span className="font-mono font-extrabold text-sm text-light-primary dark:text-[#D1D4DC]">
              ${freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Right Header Navigation Panel */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 bg-light-panel dark:bg-[#1E222D] hover:bg-opacity-95 rounded-xl border border-light-border dark:border-[#2A2E39] text-light-secondary dark:text-dark-secondary"
            title="Toggle Visual Mode"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          <div className="relative">
            <button
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              className="px-3.5 py-2 bg-light-panel dark:bg-[#1E222D] hover:bg-opacity-95 rounded-xl border border-light-border dark:border-[#2A2E39] text-xs font-bold flex items-center gap-2 dark:text-[#D1D4DC]"
            >
              <span>👤 {user?.username}</span>
              <span className="text-[8px] text-light-secondary dark:text-dark-secondary">▼</span>
            </button>

            {showProfileDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1E222D] border border-light-border dark:border-[#2A2E39] rounded-2xl shadow-xl z-[99] py-2 animate-slide-in">
                <div className="px-4 py-2 border-b border-light-border dark:border-[#2A2E39] mb-1">
                  <p className="text-xs font-black dark:text-white">{user?.username}</p>
                  <p className="text-[9px] text-light-secondary dark:text-dark-secondary uppercase font-bold mt-0.5 tracking-wider">{user?.role}</p>
                </div>
                <Link
                  to="/profile"
                  onClick={() => setShowProfileDropdown(false)}
                  className="block w-full text-left px-4 py-2.5 text-xs hover:bg-light-panel dark:hover:bg-[#2A2E39] dark:text-[#D1D4DC] font-semibold"
                >
                  👤 View Profile
                </Link>
                <Link
                  to="/transactions"
                  onClick={() => setShowProfileDropdown(false)}
                  className="block w-full text-left px-4 py-2.5 text-xs hover:bg-light-panel dark:hover:bg-[#2A2E39] dark:text-[#D1D4DC] font-semibold"
                >
                  📁 Ledger History
                </Link>
                <Link
                  to="/insights"
                  onClick={() => setShowProfileDropdown(false)}
                  className="block w-full text-left px-4 py-2.5 text-xs hover:bg-light-panel dark:hover:bg-[#2A2E39] dark:text-[#D1D4DC] font-semibold"
                >
                  💡 Analyst Insights
                </Link>
                <Link
                  to="/p2p"
                  onClick={() => setShowProfileDropdown(false)}
                  className="block w-full text-left px-4 py-2.5 text-xs hover:bg-light-panel dark:hover:bg-[#2A2E39] dark:text-[#D1D4DC] font-semibold"
                >
                  🤝 P2P Escrow
                </Link>
                <button
                  onClick={() => {
                    setShowProfileDropdown(false);
                    logout();
                  }}
                  className="block w-full text-left px-4 py-2.5 text-xs text-[#F23645] hover:bg-[#F23645]/10 font-bold border-t border-light-border dark:border-[#2A2E39] mt-1"
                >
                  🚪 Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Insights Panel */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 md:px-6 py-6 flex flex-col md:flex-row gap-6 overflow-hidden">
        {/* Left Side: Insights Directory List */}
        <div className="w-full md:w-[350px] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-light-primary dark:text-white">Analyst Insights</h2>
            <Link to="/dashboard" className="text-xs text-[#2962FF] hover:underline flex items-center gap-1 font-bold">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[250px] md:max-h-[calc(100vh-180px)]">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : insights.length === 0 ? (
              <div className="p-4 bg-light-panel dark:bg-dark-panel rounded-2xl text-center text-xs text-light-secondary dark:text-dark-secondary">
                No analyst insights available at the moment.
              </div>
            ) : (
              insights.map((insight) => {
                const isSelected = selectedInsight && selectedInsight.id === insight.id;
                return (
                  <div
                    key={insight.id}
                    onClick={() => handleSelectInsight(insight.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-light-panel dark:bg-[#1E222D] border-[#2962FF] dark:border-[#2962FF]/50 shadow-md'
                        : 'bg-light-panel dark:bg-dark-panel border-light-border dark:border-dark-border hover:border-light-border dark:hover:border-[#2A2E39]'
                    }`}
                  >
                    <h3 className="text-xs font-bold text-light-primary dark:text-white mb-2 leading-snug">
                      {insight.title}
                    </h3>
                    <p className="text-[10px] text-light-secondary dark:text-[#8A91A5] line-clamp-3 leading-relaxed mb-3">
                      {insight.content}
                    </p>
                    <div className="flex justify-between items-center text-[9px] text-light-secondary dark:text-dark-secondary">
                      <span>{new Date(insight.created_at).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> Discuss
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Selected Insight Details & Discussion Thread */}
        <div className="flex-1 flex flex-col bg-light-panel dark:bg-dark-panel border border-light-border dark:border-dark-border rounded-3xl overflow-hidden min-h-[400px]">
          {selectedInsight ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Insight Content */}
              <div className="p-6 md:p-8 border-b border-light-border dark:border-dark-border overflow-y-auto max-h-[350px]">
                <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-[#2962FF]/10 text-[#2962FF]">
                  Official Analyst Publication
                </span>
                <h1 className="text-lg md:text-xl font-black text-light-primary dark:text-white mt-3 mb-2 leading-tight">
                  {selectedInsight.title}
                </h1>
                <p className="text-[10px] text-light-secondary dark:text-dark-secondary mb-6 font-semibold">
                  Published: {new Date(selectedInsight.created_at).toLocaleString()}
                </p>
                <div className="text-xs md:text-sm text-light-primary dark:text-[#D1D4DC] whitespace-pre-wrap leading-relaxed">
                  {selectedInsight.content}
                </div>
              </div>

              {/* Discussion / Comments Section */}
              <div className="flex-1 flex flex-col min-h-[300px] overflow-hidden bg-light-bg/40 dark:bg-[#111112]/30">
                <div className="px-6 py-4 border-b border-light-border dark:border-dark-border flex justify-between items-center">
                  <h4 className="text-xs font-extrabold uppercase tracking-wide text-light-primary dark:text-white flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#2962FF]" /> Discussion Thread ({comments.length})
                  </h4>
                </div>

                {/* Comment Thread List */}
                <div className="flex-1 p-6 overflow-y-auto space-y-4 max-h-[300px]">
                  {loadingComments ? (
                    <div className="flex justify-center items-center py-8">
                      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : comments.length === 0 ? (
                    <p className="text-xs text-light-secondary dark:text-dark-secondary text-center py-6">
                      No discussions yet on this report. Share your view!
                    </p>
                  ) : (
                    comments.map((comment) => {
                      const isOwn = comment.user_id === user?.id;
                      const isAdmin = user?.role === 'admin';
                      return (
                        <div key={comment.id} className="flex flex-col gap-1 p-3 bg-light-panel dark:bg-dark-panel border border-light-border dark:border-dark-border/60 rounded-2xl">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="font-extrabold text-[#2962FF]">
                              👤 {comment.profile?.username || 'Trader'}
                            </span>
                            <div className="flex items-center gap-2.5">
                              <span className="text-light-secondary dark:text-dark-secondary">
                                {new Date(comment.created_at).toLocaleString()}
                              </span>
                              {(isOwn || isAdmin) && (
                                <button
                                  onClick={() => handleDeleteComment(comment.id)}
                                  className="text-light-secondary dark:text-dark-secondary hover:text-[#F23645]"
                                  title="Delete comment"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-light-primary dark:text-[#D1D4DC] mt-1 whitespace-pre-wrap leading-relaxed">
                            {comment.content}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Post New Comment Input */}
                <form onSubmit={handlePostComment} className="p-4 border-t border-light-border dark:border-dark-border bg-light-panel dark:bg-[#131722] flex gap-3">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Contribute to conversation..."
                    className="flex-1 px-4 py-2.5 bg-light-bg dark:bg-[#1e222d] border border-light-border dark:border-[#2A2E39] rounded-xl text-xs focus:outline-none focus:border-[#2962FF] text-light-primary dark:text-[#D1D4DC]"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#2962FF] text-white rounded-xl text-xs font-bold hover:opacity-95 active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" /> Post
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center p-8 text-center">
              <MessageSquare className="w-12 h-12 text-[#2962FF]/20 mb-3" />
              <p className="text-xs text-light-secondary dark:text-dark-secondary">
                Select an analyst report on the left to view details and discussion.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
