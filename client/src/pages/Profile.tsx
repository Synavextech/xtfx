import React, { useState, useEffect } from 'react';
import { useTradeStore } from '../store/useTradeStore';
import { User, Phone, Mail, Globe, Shield, Key, Copy, Check, Users, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { showToast } from '../App';

interface ProfileProps {
  toggleTheme: () => void;
  theme: 'light' | 'dark';
}

export default function Profile({ toggleTheme, theme }: ProfileProps) {
  const {
    user,
    fetchUser,
    wallets,
    activeWalletType,
    setActiveWalletType,
    activeTrades,
    logout
  } = useTradeStore();

  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  const activeWallet = wallets.find((w) => w.type === activeWalletType);
  const activeBalance = activeWallet ? Number(activeWallet.balance) : 0.0;
  const leverage = 100;
  const floatingPnl = activeTrades ? activeTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) : 0;
  const totalMarginUsed = activeTrades ? activeTrades.reduce((sum, t) => sum + (t.quantity * t.entry_price) / leverage, 0) : 0;
  const equity = activeBalance + floatingPnl;
  const freeMargin = equity - totalMarginUsed;
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referrals, setReferrals] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  useEffect(() => {
    const fetchReferrals = async () => {
      try {
        const res = await axios.get('/api/auth/referrals');
        setReferrals(res.data || []);
      } catch (err) {
        console.error("Failed to load referrals list", err);
      }
    };
    fetchReferrals();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) {
      showToast('Username is required', 'error');
      return;
    }
    setIsUpdating(true);
    try {
      const res = await axios.post('/api/auth/profile/update', { username });
      if (res.data.success) {
        showToast('Profile updated successfully', 'success');
        await fetchUser();
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error || 'Profile update failed';
      showToast(errMsg, 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      showToast('Password must be at least 8 characters long', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }
    setIsChangingPass(true);
    try {
      const res = await axios.post('/api/auth/password/change', { newPassword });
      if (res.data.success) {
        showToast('Password updated successfully', 'success');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error || 'Password update failed';
      showToast(errMsg, 'error');
    } finally {
      setIsChangingPass(false);
    }
  };

  const copyReferralLink = () => {
    if (!user?.referral_code) return;
    const link = `${window.location.origin}/auth?ref=${user.referral_code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    showToast('Referral link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-light-bg dark:bg-dark-bg flex items-center justify-center text-light-secondary dark:text-dark-secondary">
        Loading Profile...
      </div>
    );
  }

  const referralLink = `${window.location.origin}/auth?ref=${user.referral_code}`;

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg text-light-primary dark:text-dark-primary flex flex-col font-sans transition-colors duration-200">
      
      {/* Left side Hamburger Mobile Drawer */}
      {showMobileDrawer && (
        <div className="fixed inset-0 z-[100] flex md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-[#111112]/80 backdrop-blur-sm"
            onClick={() => setShowMobileDrawer(false)}
          />
          {/* Drawer Content */}
          <div className="relative w-72 max-w-[80vw] h-full bg-white dark:bg-dark-panel border-r border-light-border dark:border-dark-border p-5 flex flex-col justify-between shadow-2xl animate-slide-right overflow-y-auto">
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-sm tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#2962FF] to-[#089981]">
                  ExtFx - ExtremeFxTrader
                </span>
                <button
                  onClick={() => setShowMobileDrawer(false)}
                  className="p-1.5 rounded-lg bg-light-panel dark:bg-[#2A2E39] text-[#8A91A5]"
                >
                  ✕
                </button>
              </div>

              {/* Account Mode */}
              <div className="flex flex-col gap-2">
                <span className="text-[9px] font-bold text-[#8A91A5] uppercase tracking-wider">Account Mode</span>
                <select
                  value={activeWalletType}
                  onChange={(e) => {
                    setActiveWalletType(e.target.value as any);
                    setShowMobileDrawer(false);
                  }}
                  className="w-full pl-3 pr-8 py-2 bg-light-panel dark:bg-[#111112] border border-light-border dark:border-dark-border rounded-xl text-xs font-bold text-light-primary dark:text-dark-primary"
                >
                  <option value="demo">Demo Account</option>
                  <option value="real">Real Account</option>
                </select>
              </div>

              {/* Deposit/Withdraw Actions */}
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/dashboard?modal=deposit"
                  onClick={() => setShowMobileDrawer(false)}
                  className="py-2.5 bg-[#089981] hover:bg-opacity-95 text-white font-bold rounded-xl text-xs text-center flex items-center justify-center"
                >
                  Deposit
                </Link>
                <Link
                  to="/dashboard?modal=withdraw"
                  onClick={() => setShowMobileDrawer(false)}
                  className="py-2.5 bg-light-panel dark:bg-dark-bg border border-light-border dark:border-dark-border text-light-primary dark:text-[#D1D4DC] font-bold rounded-xl text-xs text-center flex items-center justify-center"
                >
                  Withdraw
                </Link>
              </div>

              {/* Performance Stats */}
              <div className="flex flex-col gap-3 p-3 bg-light-panel dark:bg-[#111112] rounded-xl border border-light-border dark:border-dark-border">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8A91A5]">Balance</span>
                  <span className="font-mono font-bold text-light-primary dark:text-[#D1D4DC]">
                    ${activeBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8A91A5]">Equity</span>
                  <span className={`font-mono font-bold ${floatingPnl >= 0 ? 'text-[#089981]' : 'text-[#F23645]'}`}>
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
                  to="/dashboard?modal=history"
                  onClick={() => setShowMobileDrawer(false)}
                  className="text-left py-2 px-3 hover:bg-light-panel dark:hover:bg-[#2A2E39] rounded-xl flex items-center gap-2"
                >
                  📁 Transaction History
                </Link>
                <Link
                  to="/dashboard?modal=insights"
                  onClick={() => setShowMobileDrawer(false)}
                  className="text-left py-2 px-3 hover:bg-light-panel dark:hover:bg-[#2A2E39] rounded-xl flex items-center gap-2"
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
                  className="py-2 px-3 hover:bg-light-panel dark:hover:bg-[#2A2E39] rounded-xl flex items-center gap-2 bg-[#2962FF]/10 text-[#2962FF]"
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

            <div className="flex items-center justify-between border-t border-light-border dark:border-dark-border pt-4 mt-6">
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
        
        {/* Left Side: Mobile Hamburger or Desktop Logo */}
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
            <span className="font-extrabold text-lg tracking-wider hidden sm:block">ExtFx</span>
          </Link>

          {/* Desktop-only Real vs Demo operational dropdown */}
          <div className="hidden md:flex items-center gap-4">
            <div className="relative">
              <select
                value={activeWalletType}
                onChange={(e) => setActiveWalletType(e.target.value as any)}
                className="appearance-none pl-4 pr-10 py-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-xs font-bold focus:outline-none cursor-pointer text-light-primary dark:text-[#D1D4DC]"
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
                className="px-4 py-2 bg-light-panel dark:bg-dark-bg border border-light-border dark:border-dark-border text-light-primary dark:text-[#D1D4DC] font-bold rounded-xl text-xs hover:opacity-95 text-center flex items-center justify-center"
              >
                Withdraw
              </Link>
            </div>
          </div>
        </div>

        {/* Live performance dashboard (Desktop only) */}
        <div className="hidden md:flex items-center gap-8">
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-light-secondary dark:text-dark-secondary font-bold uppercase">Balance</span>
            <span className="font-mono font-extrabold text-sm text-light-primary dark:text-[#D1D4DC]">
              ${activeBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-light-secondary dark:text-dark-secondary font-bold uppercase">Equity</span>
            <span className={`font-mono font-extrabold text-sm ${floatingPnl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
              ${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-light-secondary dark:text-dark-secondary font-bold uppercase">Free Margin</span>
            <span className="font-mono font-extrabold text-sm text-light-primary dark:text-[#D1D4DC]">
              ${freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Action Panel: Deposit, Withdraw, Profile */}
        <div className="flex items-center gap-3">
          
          {/* Theme Toggle Button (Desktop only) */}
          <button
            onClick={toggleTheme}
            className="hidden md:block p-2 text-light-secondary dark:text-[#8A91A5] hover:text-light-primary dark:hover:text-white transition-colors text-sm"
            title="Toggle Theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {/* History & Insights shortcuts */}
          <Link
            to="/dashboard?modal=history"
            className="hidden md:block px-3 py-2 bg-light-panel dark:bg-dark-bg border border-light-border dark:border-dark-border text-light-primary dark:text-[#D1D4DC] font-bold rounded-xl text-xs hover:opacity-90 text-center"
          >
            History
          </Link>

          <Link
            to="/dashboard?modal=insights"
            className="hidden md:block px-3 py-2 bg-light-panel dark:bg-dark-bg border border-light-border dark:border-dark-border text-light-primary dark:text-[#D1D4DC] font-bold rounded-xl text-xs hover:opacity-90 animate-pulse text-center"
          >
            Insights
          </Link>

          {user?.role === 'admin' && (
            <Link
              to="/admin"
              className="px-3 py-2 bg-[#2962FF]/15 text-[#2962FF] font-bold rounded-xl text-xs hover:opacity-90"
            >
              Admin
            </Link>
          )}

          <Link
            to="/p2p"
            className="px-3 py-2 bg-[#2962FF] text-white font-bold rounded-xl text-xs hover:opacity-90 shadow-md shadow-[#2962FF]/20"
          >
            P2P
          </Link>

          {/* Profile Dropdown Container */}
          <div className="relative border-l border-light-border dark:border-dark-border pl-3">
            <button
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-tr from-[#2962FF] to-[#089981] hover:opacity-90 border border-light-border dark:border-dark-border text-white text-xs font-black transition-all shadow-sm"
              title="Profile Settings"
            >
              {user?.username ? user.username[0].toUpperCase() : 'U'}
            </button>

            {showProfileDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-dark-panel border border-light-border dark:border-dark-border rounded-2xl shadow-2xl z-[100] p-3.5 flex flex-col gap-2.5 animate-slide-in">
                {/* Details */}
                <div className="border-b border-light-border dark:border-dark-border/60 pb-2.5 text-xs flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#2962FF] to-[#089981] flex items-center justify-center font-bold text-white shadow-md">
                    {user?.username ? user.username[0].toUpperCase() : 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-light-primary dark:text-dark-primary flex items-center gap-1.5 mb-0.5">
                      <span className="truncate">{user?.username}</span>
                      {user?.verified && (
                        <span className="px-1 bg-[#2962FF]/10 text-[#2962FF] text-[8px] rounded font-bold">✓</span>
                      )}
                    </div>
                    <div className="text-[10px] text-light-secondary dark:text-dark-secondary truncate">{user?.email}</div>
                  </div>
                </div>

                <Link
                  to="/profile"
                  onClick={() => setShowProfileDropdown(false)}
                  className="w-full text-left py-2 px-3 hover:bg-light-panel dark:hover:bg-dark-panel rounded-xl text-xs font-bold text-light-primary dark:text-dark-primary flex items-center gap-2"
                >
                  My Profile Settings
                </Link>

                <Link
                  to="/terms"
                  onClick={() => setShowProfileDropdown(false)}
                  className="w-full text-left py-2 px-3 hover:bg-light-panel dark:hover:bg-dark-panel rounded-xl text-xs font-bold text-light-primary dark:text-dark-primary flex items-center gap-2"
                >
                  Terms & Services
                </Link>

                <Link
                  to="/dashboard?modal=history"
                  onClick={() => setShowProfileDropdown(false)}
                  className="w-full text-left py-2 px-3 hover:bg-light-panel dark:hover:bg-dark-panel rounded-xl text-xs font-bold text-light-primary dark:text-dark-primary flex items-center gap-2 text-center"
                >
                  Transaction History
                </Link>

                <button
                  onClick={() => {
                    logout();
                    setShowProfileDropdown(false);
                  }}
                  className="w-full text-left py-2.5 px-3 bg-[#F23645]/10 hover:bg-[#F23645]/20 text-[#F23645] rounded-xl text-xs font-bold transition-all"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>

      </header>

      {/* Content */}
      <main className="flex-1 max-w-4xl mx-auto py-10 px-6 w-full flex flex-col md:flex-row gap-8">
        {/* Left pane: Profile Info & Password */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Profile card */}
          <div className="bg-white dark:bg-dark-panel border border-light-border dark:border-dark-border rounded-2xl p-6 flex flex-col gap-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#2962FF] to-[#089981] flex items-center justify-center font-black text-xl text-white shadow-lg">
                {user.username ? user.username[0].toUpperCase() : 'U'}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-lg font-bold text-light-primary dark:text-dark-primary">{user.username}</h2>
                  {user.role === 'admin' ? (
                    <span className="bg-[#2962FF]/10 text-[#2962FF] border border-[#2962FF]/20 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                      Admin
                    </span>
                  ) : user.role === 'broker' ? (
                    <span className="bg-[#089981]/10 text-[#089981] border border-[#089981]/20 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                      Broker
                    </span>
                  ) : user.role === 'trader' ? (
                    <span className="bg-[#2962FF]/10 text-[#2962FF] border border-[#2962FF]/20 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                      Trader
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-light-secondary dark:text-dark-secondary">{user.email}</p>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-light-secondary dark:text-dark-secondary uppercase tracking-wider">Username</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-light-secondary dark:text-dark-secondary" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-light-panel dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl py-3 pl-10 pr-4 text-xs text-light-primary dark:text-dark-primary focus:outline-none focus:border-[#2962FF] transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-light-secondary dark:text-dark-secondary uppercase tracking-wider">Phone number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-light-secondary dark:text-dark-secondary" />
                  <input
                    type="text"
                    value={phone}
                    readOnly
                    className="w-full bg-light-panel/50 dark:bg-dark-bg/50 border border-light-border dark:border-dark-border rounded-xl py-3 pl-10 pr-4 text-xs text-light-secondary/70 dark:text-dark-secondary/70 cursor-not-allowed focus:outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isUpdating}
                className="w-full py-3 bg-[#2962FF] hover:bg-[#2962FF]/90 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-[0.98]"
              >
                {isUpdating ? 'Saving...' : 'Update Details'}
              </button>
            </form>
          </div>

          {/* Wallet Balance Summary Card */}
          <div className="bg-white dark:bg-dark-panel border border-light-border dark:border-dark-border rounded-2xl p-6 flex flex-col gap-4 shadow-xl">
            <h3 className="text-sm font-bold text-light-primary dark:text-dark-primary flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#089981]" /> Wallet Balances
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: "Real Wallet",
                  wallet: wallets.find(w => w.type === 'real'),
                  color: "from-emerald-500/10 to-teal-500/10 border-emerald-500/20 text-emerald-400"
                },
                {
                  label: "P2P Wallet",
                  wallet: wallets.find(w => w.type === 'p2p'),
                  color: "from-blue-500/10 to-indigo-500/10 border-blue-500/20 text-blue-400"
                },
                {
                  label: "Demo Wallet",
                  wallet: wallets.find(w => w.type === 'demo'),
                  color: "from-amber-500/10 to-orange-500/10 border-amber-500/20 text-amber-400"
                }
              ].map((item, idx) => (
                <div key={idx} className={`bg-gradient-to-br ${item.color} border rounded-xl p-3 flex flex-col justify-between h-20 shadow-inner`}>
                  <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">{item.label}</span>
                  <span className="text-xs font-black mt-2">
                    ${item.wallet ? Number(item.wallet.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Change Password Card */}
          <div className="bg-white dark:bg-dark-panel border border-light-border dark:border-dark-border rounded-2xl p-6 flex flex-col gap-4 shadow-xl">
            <h3 className="text-sm font-bold text-light-primary dark:text-dark-primary flex items-center gap-2">
              <Key className="w-4 h-4 text-[#2962FF]" /> Change Password
            </h3>

            <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-light-secondary dark:text-dark-secondary uppercase tracking-wider">New Password</label>
                <input
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-light-panel dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl py-3 px-4 text-xs text-light-primary dark:text-dark-primary focus:outline-none focus:border-[#2962FF] transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-light-secondary dark:text-dark-secondary uppercase tracking-wider">Confirm New Password</label>
                <input
                  type="password"
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-light-panel dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl py-3 px-4 text-xs text-light-primary dark:text-dark-primary focus:outline-none focus:border-[#2962FF] transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isChangingPass}
                className="w-full py-3 bg-light-panel dark:bg-dark-border hover:opacity-90 disabled:opacity-50 text-light-primary dark:text-dark-primary rounded-xl text-xs font-bold transition-all shadow-md active:scale-[0.98] border border-light-border dark:border-dark-border"
              >
                {isChangingPass ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>

        {/* Right pane: Referral Program details */}
        <div className="w-full md:w-80 flex flex-col gap-6">
          {/* Referral Code card */}
          <div className="bg-white dark:bg-dark-panel border border-light-border dark:border-dark-border rounded-2xl p-6 flex flex-col gap-5 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#089981]/5 rounded-full blur-2xl" />
            
            <h3 className="text-sm font-bold text-light-primary dark:text-dark-primary flex items-center gap-2">
              <Users className="w-4 h-4 text-[#089981]" /> Referral Program
            </h3>
            
            <p className="text-[11px] text-light-secondary dark:text-dark-secondary leading-relaxed">
              Invite friends to ExtFx - ExtremeFxTrader. Earn up to <span className="text-[#089981] font-bold">12.5%</span> bonus commission on their very first approved deposit!
            </p>

            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold text-light-secondary dark:text-dark-secondary uppercase tracking-wider">Your Referral Link</span>
              <div className="flex items-center gap-2 bg-light-panel dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl p-2 pl-3">
                <span className="text-[10px] text-light-secondary dark:text-dark-secondary truncate flex-1">{referralLink}</span>
                <button
                  onClick={copyReferralLink}
                  className="p-2 rounded-lg bg-light-panel dark:bg-dark-border hover:bg-accent text-light-primary dark:text-dark-primary transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#089981]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-light-border dark:border-dark-border">
              <span className="text-light-secondary dark:text-dark-secondary">Referral Code</span>
              <span className="font-mono font-bold text-light-primary dark:text-dark-primary bg-light-panel dark:bg-dark-bg px-2.5 py-1 rounded border border-light-border dark:border-dark-border">
                {user.referral_code}
              </span>
            </div>
          </div>

          {/* Referred List Card */}
          <div className="bg-white dark:bg-dark-panel border border-light-border dark:border-dark-border rounded-2xl p-6 flex flex-col gap-4 shadow-xl flex-1 max-h-[360px] overflow-hidden">
            <h3 className="text-sm font-bold text-light-primary dark:text-dark-primary flex items-center justify-between">
              <span>My Network</span>
              <span className="text-xs text-light-secondary dark:text-dark-secondary font-normal">{referrals.length} referred</span>
            </h3>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2">
              {referrals.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-10">
                  <p className="text-xs text-light-secondary dark:text-dark-secondary">No invitees yet.</p>
                  <p className="text-[10px] text-light-secondary/60 dark:text-dark-secondary/60 mt-1">Share your link to begin earning.</p>
                </div>
              ) : (
                referrals.map((ref) => (
                  <div key={ref.id} className="flex items-center justify-between p-2.5 bg-light-panel dark:bg-dark-bg rounded-xl border border-light-border dark:border-dark-border">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-light-primary dark:text-dark-primary">{ref.username}</span>
                      <span className="text-[9px] text-light-secondary dark:text-dark-secondary">{new Date(ref.created_at).toLocaleDateString()}</span>
                    </div>
                    {ref.verified ? (
                      <span className="text-[9px] bg-[#089981]/15 text-[#089981] border border-[#089981]/25 px-1.5 py-0.5 rounded-full font-bold">
                        Verified
                      </span>
                    ) : (
                      <span className="text-[9px] bg-light-panel/80 dark:bg-dark-border/80 text-light-secondary dark:text-dark-secondary px-1.5 py-0.5 rounded-full">
                        Pending
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
