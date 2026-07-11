import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import { useTradeStore } from '../store/useTradeStore';
import { showToast } from '../App';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form fields
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('Kenya');
  const [referralCode, setReferralCode] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [totalTrades, setTotalTrades] = useState(84930182);
  const [mockTrades] = useState<any[]>([
    { username: 'AlphaTrader', asset: 'EUR/USD', type: 'buy', amount: 250, profit: 47.50 },
    { username: 'WhaleFx', asset: 'BTC/USD', type: 'buy', amount: 1500, profit: 285.00 },
    { username: 'SyntheticsGod', asset: '1HZ100V', type: 'sell', amount: 500, profit: 840.00 },
    { username: 'BullRun', asset: 'Gold', type: 'buy', amount: 100, profit: -35.00 },
    { username: 'ShadowBroker', asset: 'GBP/USD', type: 'sell', amount: 1200, profit: 144.00 },
    { username: 'MesaMaster', asset: 'USD/JPY', type: 'buy', amount: 800, profit: -96.00 }
  ]);
  const [currentMockIndex, setCurrentMockIndex] = useState(0);
  const [flashTrade, setFlashTrade] = useState<'up' | 'down' | ''>('');

  useEffect(() => {
    const tradeInterval = setInterval(() => {
      setTotalTrades(prev => prev + Math.floor(Math.random() * 4) + 1);
    }, 1500);

    const mockInterval = setInterval(() => {
      setCurrentMockIndex(prev => {
        const nextIndex = (prev + 1) % mockTrades.length;
        const nextTrade = mockTrades[nextIndex];
        setFlashTrade(nextTrade.profit >= 0 ? 'up' : 'down');
        setTimeout(() => setFlashTrade(''), 800);
        return nextIndex;
      });
    }, 3000);

    return () => {
      clearInterval(tradeInterval);
      clearInterval(mockInterval);
    };
  }, [mockTrades]);

  const { fetchUser, connectWebSocket } = useTradeStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Extract referral code from URL search param
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ref = params.get('ref');
    if (ref) {
      setReferralCode(ref);
      setIsLogin(false); // Redirect user directly to Register tab
    }
  }, [location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isLogin && !acceptTerms) {
      showToast('You must accept the Terms & Services to register', 'error');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        // Login
        const res = await axios.post('/api/auth/login', {
          usernameOrEmail: email || username,
          password
        });
        showToast(`Welcome back, ${res.data.user.username}!`, 'success');
      } else {
        // Register
        const res = await axios.post('/api/auth/register', {
          username,
          email,
          password,
          fullName,
          phone,
          country,
          referredByCode: referralCode || null
        });
        showToast(`Welcome to ExtFx - ExtremeFxTrader, ${res.data.user.username}! Account created.`, 'success');
      }

      // Load user profile and connect sockets
      await fetchUser();
      connectWebSocket();
      navigate('/dashboard');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Authentication failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const countries = [
    'Kenya', 'Nigeria', 'South Africa', 'United States', 'United Kingdom',
    'Germany', 'Australia', 'Canada', 'India', 'Singapore', 'Japan'
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-dark-bg text-dark-primary">
      {/* Left side: Premium gamified trading brand pitch */}
      <div className="md:w-1/2 flex flex-col justify-between p-8 md:p-16 bg-gradient-to-br from-dark-panel via-[#131722] to-accent/15 border-r border-dark-border/40">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center font-black text-white text-xl shadow-lg shadow-accent/40">E</div>
          <span className="font-extrabold text-2xl tracking-wider text-white">ExtFx <span className="text-accent">TRADER</span></span>
        </div>

        <div className="my-12 md:my-0 space-y-6">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
            For Bold Ventures <br />
            Willing to Go to the <br />
            <span className="text-accent underline decoration-wavy">Extreme Ends</span>
          </h1>
          <p className="text-dark-secondary max-w-md text-sm leading-relaxed">
            Make every investment count. Make every investment produce extreme profits for we are the extreme traders, with extreme ambition.
          </p>

          <div className="space-y-4 pt-4">
            {/* Stats Countdown/Counter */}
            <div className="p-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl flex flex-col gap-1 max-w-sm">
              <span className="text-[10px] text-dark-secondary uppercase font-bold tracking-wider">Total Live Platform Trades</span>
              <span className="text-xl font-extrabold font-mono text-white tracking-widest">{totalTrades.toLocaleString()}</span>
            </div>

            {/* Mock Trade Box */}
            <div className="p-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl max-w-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-dark-secondary uppercase font-bold tracking-wider">Live Trading Feed</span>
                <span className="w-2 h-2 rounded-full bg-[#089981] animate-ping"></span>
              </div>
              
              <div className={`transition-all duration-300 p-3 rounded-xl border border-white/[0.05] flex items-center justify-between ${
                flashTrade === 'up' 
                  ? 'bg-[#089981]/10 border-[#089981]/30' 
                  : flashTrade === 'down' 
                    ? 'bg-[#F23645]/10 border-[#F23645]/30' 
                    : ''
              }`}>
                <div>
                  <span className="text-xs font-bold text-white block">{mockTrades[currentMockIndex].username}</span>
                  <span className="text-[10px] text-dark-secondary">{mockTrades[currentMockIndex].asset} • {mockTrades[currentMockIndex].type.toUpperCase()}</span>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-extrabold font-mono ${mockTrades[currentMockIndex].profit >= 0 ? 'text-[#089981]' : 'text-[#F23645]'}`}>
                    {mockTrades[currentMockIndex].profit >= 0 ? '+' : ''}${mockTrades[currentMockIndex].profit.toFixed(2)}
                  </span>
                  <span className="text-[9px] text-dark-secondary block">Size: ${mockTrades[currentMockIndex].amount}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side: Login / Signup interactive Form */}
      <div className="md:w-1/2 flex items-center justify-center p-6 md:p-12 bg-[#111112]">
        <div className="w-full max-w-md p-8 bg-dark-panel border border-dark-border/50 rounded-3xl shadow-2xl relative overflow-hidden">

          {/* Accent decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-3xl"></div>

          {/* Header tabs */}
          <div className="flex justify-center border-b border-dark-border/40 pb-4 mb-6">
            <button
              onClick={() => { setIsLogin(true); setEmail(''); setUsername(''); }}
              className={`flex-1 text-center py-2 text-sm font-bold transition-all duration-200 ${isLogin ? 'text-accent border-b-2 border-accent' : 'text-dark-secondary hover:text-white'
                }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 text-center py-2 text-sm font-bold transition-all duration-200 ${!isLogin ? 'text-accent border-b-2 border-accent' : 'text-dark-secondary hover:text-white'
                }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Common field: Email / Username */}
            {isLogin ? (
              <div>
                <label className="block text-xs font-bold text-dark-secondary uppercase tracking-wider mb-2">Username or Email</label>
                <input
                  type="text"
                  required
                  value={email || username}
                  onChange={(e) => { setEmail(e.target.value); setUsername(e.target.value); }}
                  placeholder="admin@xfx.com or admin"
                  className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-xl text-sm focus:outline-none focus:border-accent text-white"
                />
              </div>
            ) : (
              <>
                {/* Registration Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-dark-secondary uppercase tracking-wider mb-2">Username</label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="extreme_trader"
                      className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-xl text-sm focus:outline-none focus:border-accent text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-dark-secondary uppercase tracking-wider mb-2">Full Name</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="John Doe"
                      className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-xl text-sm focus:outline-none focus:border-accent text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-dark-secondary uppercase tracking-wider mb-2">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="trader@xfx.com"
                    className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-xl text-sm focus:outline-none focus:border-accent text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-dark-secondary uppercase tracking-wider mb-2">Country</label>
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-xl text-sm focus:outline-none focus:border-accent text-white"
                    >
                      {countries.map((c) => (
                        <option key={c} value={c} className="bg-dark-panel">
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-dark-secondary uppercase tracking-wider mb-2">Phone Number</label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+254712345678"
                      className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-xl text-sm focus:outline-none focus:border-accent text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-dark-secondary uppercase tracking-wider mb-2">Referral Code (Optional)</label>
                  <input
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value)}
                    placeholder="Enter referral code"
                    className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-xl text-sm focus:outline-none focus:border-accent text-white font-mono"
                  />
                </div>
              </>
            )}

            {/* Password input with toggle show/hide */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-dark-secondary uppercase tracking-wider">Password</label>
                {isLogin && (
                  <span className="text-[10px] text-accent hover:underline cursor-pointer">Forgot?</span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-xl text-sm focus:outline-none focus:border-accent text-white pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-dark-secondary hover:text-white"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Terms and Services Checkbox */}
            {!isLogin && (
              <div className="flex items-center gap-2.5 mt-2.5">
                <input
                  type="checkbox"
                  id="acceptTerms"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="w-4 h-4 rounded border-dark-border bg-dark-bg text-accent focus:ring-accent"
                />
                <label htmlFor="acceptTerms" className="text-xs text-dark-secondary select-none">
                  I accept the{' '}
                  <Link to="/terms" className="text-accent hover:underline font-bold">
                    Terms & Services
                  </Link>
                </label>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 bg-accent hover:bg-accent/90 disabled:bg-accent/50 text-white rounded-xl text-sm font-bold shadow-lg shadow-accent/20 transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                isLogin ? 'Sign In' : 'Create Account'
              )}
            </button>

          </form>

          {/* Social elements / Admin Hint */}
          <div className="mt-6 border-t border-dark-border/30 pt-4 flex flex-col items-center">
            <span className="text-[10px] text-dark-secondary">
              Create ypur account, Login and <span className="text-white font-mono">Start practicing on Demo wallet Simmulating Real life trades</span>
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}
