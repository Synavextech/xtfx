import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useTradeStore } from '../store/useTradeStore';
import { showToast } from '../App';
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

interface TransactionsProps {
  toggleTheme: () => void;
  theme: 'light' | 'dark';
}

export default function Transactions({ toggleTheme, theme }: TransactionsProps) {
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
  const [history, setHistory] = useState<any[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>('all'); // all, deposit, withdrawal, trade, p2p_sell

  const activeWallet = wallets.find((w) => w.type === activeWalletType);
  const activeBalance = activeWallet ? Number(activeWallet.balance) : 0.0;
  const leverage = 100;
  const floatingPnl = activeTrades ? activeTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) : 0;
  const totalMarginUsed = activeTrades ? activeTrades.reduce((sum, t) => sum + (t.quantity * t.entry_price) / leverage, 0) : 0;
  const equity = activeBalance + floatingPnl;
  const freeMargin = equity - totalMarginUsed;

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/wallet/history');
      setHistory(res.data || []);
      setFilteredHistory(res.data || []);
    } catch (err: any) {
      showToast('Failed to load transaction history', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    if (filterType === 'all') {
      setFilteredHistory(history);
    } else if (filterType === 'deposit') {
      setFilteredHistory(history.filter(item => item.type === 'deposit'));
    } else if (filterType === 'withdrawal') {
      setFilteredHistory(history.filter(item => item.type === 'withdrawal'));
    } else if (filterType === 'trade') {
      setFilteredHistory(history.filter(item => item.type === 'trade_profit' || item.type === 'trade_loss'));
    } else if (filterType === 'p2p_sell') {
      setFilteredHistory(history.filter(item => item.type === 'p2p_sell'));
    }
  }, [filterType, history]);

  const getTxTypeDetails = (type: string) => {
    switch (type) {
      case 'deposit':
        return {
          label: 'Deposit',
          color: 'text-[#089981] bg-[#089981]/10 border-[#089981]/25',
          icon: <ArrowDownLeft className="w-4 h-4 text-[#089981]" />
        };
      case 'withdrawal':
        return {
          label: 'Withdrawal',
          color: 'text-[#F23645] bg-[#F23645]/10 border-[#F23645]/25',
          icon: <ArrowUpRight className="w-4 h-4 text-[#F23645]" />
        };
      case 'trade_profit':
        return {
          label: 'Trade Win',
          color: 'text-[#089981] bg-[#089981]/15 border-[#089981]/30',
          icon: <TrendingUp className="w-4 h-4 text-[#089981]" />
        };
      case 'trade_loss':
        return {
          label: 'Trade Loss',
          color: 'text-[#F23645] bg-[#F23645]/15 border-[#F23645]/30',
          icon: <TrendingDown className="w-4 h-4 text-[#F23645]" />
        };
      case 'p2p_sell':
        return {
          label: 'P2P Sale',
          color: 'text-brand-gold bg-brand-gold/10 border-brand-gold/25',
          icon: <DollarSign className="w-4 h-4 text-brand-gold" />
        };
      default:
        return {
          label: 'Transaction',
          color: 'text-light-primary dark:text-[#D1D4DC] bg-light-panel dark:bg-[#1E222D] border-light-border dark:border-[#2A2E39]',
          icon: null
        };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
      case 'completed':
        return 'bg-[#089981]/10 text-[#089981]';
      case 'pending':
        return 'bg-[#F1A93B]/10 text-[#F1A93B]';
      case 'rejected':
      case 'cancelled':
        return 'bg-[#F23645]/10 text-[#F23645]';
      default:
        return 'bg-light-panel dark:bg-[#1E222D] text-light-secondary dark:text-dark-secondary';
    }
  };

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
                  className="py-2 px-3 hover:bg-light-panel dark:hover:bg-[#2A2E39] rounded-xl flex items-center gap-2 bg-[#2962FF]/10 text-[#2962FF]"
                >
                  📁 Transaction History
                </Link>
                <Link
                  to="/insights"
                  onClick={() => setShowMobileDrawer(false)}
                  className="py-2 px-3 hover:bg-light-panel dark:hover:bg-[#2A2E39] rounded-xl flex items-center gap-2"
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

      {/* Main Ledger Panel */}
      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 md:px-6 py-8 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Link to="/dashboard" className="p-1.5 hover:bg-light-panel dark:hover:bg-dark-panel rounded-lg text-light-secondary dark:text-dark-secondary hover:text-light-primary dark:hover:text-white transition-all">
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <h1 className="text-lg md:text-xl font-black text-light-primary dark:text-white tracking-tight">Ledger Account History</h1>
            </div>
            <p className="text-xs text-light-secondary dark:text-[#8A91A5] mt-1 pl-8">
              A comprehensive statement of deposits, withdrawals, trading results, and P2P transfers.
            </p>
          </div>

          {/* Filtering Tabs */}
          <div className="flex flex-wrap gap-1.5 p-1 bg-light-panel dark:bg-dark-panel border border-light-border dark:border-dark-border rounded-xl">
            {[
              { id: 'all', label: 'All Transactions' },
              { id: 'deposit', label: 'Deposits' },
              { id: 'withdrawal', label: 'Withdrawals' },
              { id: 'trade', label: 'Trading P&L' },
              { id: 'p2p_sell', label: 'P2P Sells' }
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setFilterType(btn.id)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                  filterType === btn.id
                    ? 'bg-[#2962FF] text-white shadow-sm'
                    : 'text-light-secondary dark:text-dark-secondary hover:text-light-primary dark:hover:text-white'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ledger Table Section */}
        <div className="bg-light-panel dark:bg-dark-panel border border-light-border dark:border-dark-border rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-light-border dark:border-dark-border text-[10px] font-extrabold uppercase text-[#8A91A5] bg-light-panel dark:bg-dark-bg/25">
                  <th className="px-6 py-4">Transaction ID</th>
                  <th className="px-6 py-4">Date & Time</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Method / Asset</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-light-border dark:divide-dark-border/40 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="inline-block w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                    </td>
                  </tr>
                ) : filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-light-secondary dark:text-dark-secondary">
                      No matching records found in your account ledger.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((item) => {
                    const typeDetails = getTxTypeDetails(item.type);
                    const isDebit = item.type === 'withdrawal' || item.type === 'trade_loss';
                    return (
                      <tr key={item.id} className="hover:bg-light-panel/40 dark:hover:bg-dark-bg/10 transition-colors">
                        <td className="px-6 py-4 font-mono text-[10px] text-light-secondary dark:text-dark-secondary select-all">
                          {item.id.slice(0, 8)}...{item.id.slice(-8)}
                        </td>
                        <td className="px-6 py-4 text-light-secondary dark:text-[#8A91A5]">
                          {new Date(item.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[10px] font-extrabold capitalize ${typeDetails.color}`}>
                            {typeDetails.icon}
                            {typeDetails.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-bold capitalize text-light-primary dark:text-[#D1D4DC]">
                          {item.payment_method || 'System Ledger'}
                        </td>
                        <td className={`px-6 py-4 font-mono font-bold text-right text-sm ${isDebit ? 'text-[#F23645]' : 'text-[#089981]'}`}>
                          {isDebit ? '-' : '+'}${Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-block px-2.5 py-0.75 rounded-full text-[9px] font-bold uppercase tracking-wider ${getStatusBadge(item.status)}`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
