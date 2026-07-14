import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useTradeStore, getDecimals } from '../store/useTradeStore';
import Chart from './Chart';
import Quotes, { ASSETS_LIST } from './Quotes';
import { showToast } from '../App';
import { ArrowLeftRight, CandlestickChart, TrendingUp, History, Lightbulb, User } from 'lucide-react';

interface DashboardProps {
  toggleTheme: () => void;
  theme: 'dark' | 'light';
}

export default function Dashboard({ toggleTheme, theme }: DashboardProps) {
  const navigate = useNavigate();
  const {
    user,
    wallets,
    activeWalletType,
    setActiveWalletType,
    activeAsset,
    setActiveAsset,
    activeMobileTab,
    setActiveMobileTab,
    priceFeed,
    wsState,
    activeTrades,
    tradeHistory,
    fetchActiveTrades,
    fetchTradeHistory,
    openPosition,
    closePosition,
    closeAllPositions,
    logout,
    fetchUser,
    insights,
    fetchInsights,
    p2pOffers,
    fetchP2pOffers
  } = useTradeStore();

  // Modals state
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('50');
  const [withdrawAmount, setWithdrawAmount] = useState('20');
  const [selectedBuyOfferId, setSelectedBuyOfferId] = useState('');

  // Custom States
  const [leftTab, setLeftTab] = useState<'active' | 'closed'>('active');
  const [showQuotesModal, setShowQuotesModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);

  const [editUsername, setEditUsername] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [walletHistory, setWalletHistory] = useState<any[]>([]);

  const fetchWalletHistory = async () => {
    try {
      const res = await axios.get('/api/wallet/history');
      setWalletHistory(res.data);
    } catch (err) {
      console.error('Failed to fetch wallet history', err);
    }
  };

  useEffect(() => {
    if (user) {
      setEditUsername(user.username || '');
      setEditPhone(user.phone || '');
    }
  }, [user]);

  useEffect(() => {
    if (showWithdrawModal) {
      fetchP2pOffers();
    }
  }, [showWithdrawModal]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    try {
      const res = await axios.post('/api/auth/profile/update', { username: editUsername, phone: editPhone });
      if (res.data.success) {
        showToast('Profile updated successfully!', 'success');
        fetchUser();
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update profile', 'error');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      showToast('Password must be at least 8 characters long', 'error');
      return;
    }
    setIsChangingPassword(true);
    try {
      const res = await axios.post('/api/auth/password/change', { newPassword });
      if (res.data.success) {
        showToast('Password changed successfully!', 'success');
        setNewPassword('');
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to change password', 'error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Deposit gateway states
  const [depositMethod, setDepositMethod] = useState<'mpesa' | 'paypal' | 'stripe' | 'crypto'>('mpesa');
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [cryptoTx, setCryptoTx] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('bank');
  const [withdrawDetails, setWithdrawDetails] = useState('');

  // Crypto deposit addresses state
  const [cryptoAddresses, setCryptoAddresses] = useState<{ btc: string; usdt: string; ltc: string }>({
    btc: '',
    usdt: '',
    ltc: ''
  });

  const fetchCryptoAddresses = async () => {
    try {
      const res = await axios.get('/api/wallet/crypto-addresses');
      setCryptoAddresses(res.data);
    } catch (err) {
      console.error('Failed to fetch crypto deposit addresses', err);
    }
  };

  // Stripe & PayPal SDK dynamic loads
  const [stripeCard, setStripeCard] = useState<any>(null);
  const [stripeProcessing, setStripeProcessing] = useState(false);

  // Load Stripe & PayPal scripts dynamically when deposit modal opens
  useEffect(() => {
    if (!showDepositModal) return;

    if (!(window as any).Stripe && !document.getElementById('stripe-js')) {
      const script = document.createElement('script');
      script.id = 'stripe-js';
      script.src = 'https://js.stripe.com/v3/';
      script.async = true;
      document.body.appendChild(script);
    }

    if (!(window as any).paypal && !document.getElementById('paypal-js')) {
      const script = document.createElement('script');
      script.id = 'paypal-js';
      script.src = `https://www.paypal.com/sdk/js?client-id=${import.meta.env.VITE_PAYPAL_CLIENT_ID || 'sb'}&currency=USD`;
      script.async = true;
      document.body.appendChild(script);
    }
  }, [showDepositModal]);

  // Init Stripe elements
  useEffect(() => {
    if (depositMethod !== 'stripe' || !showDepositModal) {
      if (stripeCard) {
        stripeCard.destroy();
        setStripeCard(null);
      }
      return;
    }

    const initStripe = () => {
      if (!(window as any).Stripe) {
        setTimeout(initStripe, 100);
        return;
      }
      try {
        const stripeObj = (window as any).Stripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');
        const elements = stripeObj.elements();
        const card = elements.create('card', {
          style: {
            base: {
              color: theme === 'dark' ? '#D1D4DC' : '#131722',
              fontFamily: 'Inter, sans-serif',
              fontSmoothing: 'antialiased',
              fontSize: '14px',
              '::placeholder': {
                color: '#787B86'
              }
            },
            invalid: {
              color: '#F23645',
              iconColor: '#F23645'
            }
          }
        });
        card.mount('#stripe-card-element');
        setStripeCard(card);
      } catch (err) {
        console.error('Stripe initialization failed:', err);
      }
    };

    initStripe();

    return () => {
      if (stripeCard) {
        stripeCard.destroy();
      }
    };
  }, [depositMethod, showDepositModal]);

  // Init PayPal buttons
  useEffect(() => {
    if (depositMethod !== 'paypal' || !showDepositModal) return;

    const initPaypal = () => {
      if (!(window as any).paypal) {
        setTimeout(initPaypal, 100);
        return;
      }

      const container = document.getElementById('paypal-button-container');
      if (!container) return;
      container.innerHTML = '';

      try {
        (window as any).paypal.Buttons({
          createOrder: (data: any, actions: any) => {
            return actions.order.create({
              purchase_units: [
                {
                  amount: {
                    value: depositAmount
                  }
                }
              ]
            });
          },
          onApprove: async (data: any, actions: any) => {
            try {
              const res = await axios.post('/api/wallet/deposit/paypal', { orderID: data.orderID });
              if (res.data.success) {
                showToast('PayPal deposit capture successful!', 'success');
                fetchUser();
                setShowDepositModal(false);
              }
            } catch (err: any) {
              showToast(err.response?.data?.error || 'PayPal capture failed', 'error');
            }
          },
          onError: (err: any) => {
            showToast('PayPal Checkout error occurred', 'error');
            console.error('PayPal Error:', err);
          }
        }).render('#paypal-button-container');
      } catch (err) {
        console.error('PayPal Button render failed:', err);
      }
    };

    initPaypal();
  }, [depositMethod, showDepositModal, depositAmount]);

  // Ticket inputs
  const [quantity, setQuantity] = useState('1');
  const [duration, setDuration] = useState('60'); // default 60s duration
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');

  const isSynthetic = activeAsset.startsWith('1HZ');

  useEffect(() => {
    if (isSynthetic) {
      setDuration('60');
    } else {
      setDuration('24');
    }
  }, [activeAsset]);

  // Floating PnL cache for flash tracking
  const prevPnlRef = useRef<Record<string, number>>({});
  const [flashStates, setFlashStates] = useState<Record<string, 'up' | 'down' | ''>>({});

  useEffect(() => {
    fetchActiveTrades();
    fetchTradeHistory();
    fetchInsights();
    fetchCryptoAddresses();

    const params = new URLSearchParams(window.location.search);
    const modal = params.get('modal');
    if (modal) {
      if (modal === 'deposit') setShowDepositModal(true);
      else if (modal === 'withdraw') setShowWithdrawModal(true);
      else if (modal === 'history') {
        fetchWalletHistory();
        setShowHistoryModal(true);
      }
      else if (modal === 'insights') {
        fetchInsights();
        setShowInsightsModal(true);
      }
      navigate('/dashboard', { replace: true });
    }

    const interval = setInterval(() => {
      fetchActiveTrades();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchActiveTrades, fetchTradeHistory, fetchInsights, navigate]);

  // Track tick flashing
  useEffect(() => {
    const nextFlashes: Record<string, 'up' | 'down' | ''> = {};
    let changed = false;

    activeTrades.forEach((t) => {
      const prevVal = prevPnlRef.current[t.id];
      const currentVal = t.pnl || 0;

      if (prevVal !== undefined && prevVal !== currentVal) {
        nextFlashes[t.id] = currentVal > prevVal ? 'up' : 'down';
        changed = true;

        // Reset flash state after 800ms
        setTimeout(() => {
          setFlashStates((prev) => ({ ...prev, [t.id]: '' }));
        }, 800);
      }
      prevPnlRef.current[t.id] = currentVal;
    });

    if (changed) {
      setFlashStates((prev) => ({ ...prev, ...nextFlashes }));
    }
  }, [activeTrades]);

  const activeWallet = wallets.find((w) => w.type === activeWalletType);
  const activeBalance = activeWallet ? Number(activeWallet.balance) : 0.0;

  // Real-time margin updates
  const leverage = 100;
  const floatingPnl = activeTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const equity = activeBalance + floatingPnl;
  const totalMarginUsed = activeTrades.reduce((sum, t) => sum + (t.quantity * t.entry_price) / leverage, 0);
  const freeMargin = equity - totalMarginUsed;

  const handleOpenTrade = async (type: 'buy' | 'sell') => {
    if (!activeWallet) return;

    const currentPrice = priceFeed[activeAsset]?.price || 1.0;
    const investmentAmount = parseFloat(quantity) || 10.0;
    const calculatedQty = (investmentAmount * leverage) / currentPrice;

    // Validate Stop Loss and Take Profit inputs relative to current price
    if (stopLoss) {
      const slVal = parseFloat(stopLoss);
      if (slVal <= 0 || isNaN(slVal)) {
        showToast("Stop Loss must be a positive number", "error");
        return;
      }
      if (type === 'buy' && slVal >= currentPrice) {
        showToast("Stop Loss must be below the entry price", "error");
        return;
      }
      if (type === 'sell' && slVal <= currentPrice) {
        showToast("Stop Loss must be above the entry price", "error");
        return;
      }
    }

    if (takeProfit) {
      const tpVal = parseFloat(takeProfit);
      if (tpVal <= 0 || isNaN(tpVal)) {
        showToast("Take Profit must be a positive number", "error");
        return;
      }
      if (type === 'buy' && tpVal <= currentPrice) {
        showToast("Take Profit must be above the entry price", "error");
        return;
      }
      if (type === 'sell' && tpVal >= currentPrice) {
        showToast("Take Profit must be below the entry price", "error");
        return;
      }
    }

    let durationSeconds = duration ? parseInt(duration) : null;
    if (durationSeconds && !isSynthetic) {
      durationSeconds = durationSeconds * 3600;
    }

    const params = {
      walletType: activeWalletType,
      asset: activeAsset,
      type,
      quantity: calculatedQty,
      duration: durationSeconds,
      stopLoss: stopLoss ? parseFloat(stopLoss) : null,
      takeProfit: takeProfit ? parseFloat(takeProfit) : null
    };

    const success = await openPosition(params);
    if (success) {
      setStopLoss('');
      setTakeProfit('');
      fetchUser();
    }
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(depositAmount);
    if (!amountNum || amountNum <= 0) return;

    try {
      if (depositMethod === 'mpesa') {
        if (!mpesaPhone) return showToast('Please enter your phone number', 'error');
        await axios.post('/api/wallet/deposit/mpesa-stk', { amount: amountNum, phone: mpesaPhone });
        showToast('M-Pesa STK Push initiated. Check your phone!', 'success');
        setShowDepositModal(false);
      } else if (depositMethod === 'crypto') {
        if (!cryptoTx) return showToast('Please enter transaction hash', 'error');
        await axios.post('/api/wallet/deposit/crypto', { amount: amountNum, txHash: cryptoTx });
        showToast('Crypto deposit notification submitted for manual review!', 'info');
        setShowDepositModal(false);
      } else if (depositMethod === 'stripe') {
        if (!(window as any).Stripe || !stripeCard) {
          return showToast('Stripe is still loading...', 'error');
        }
        setStripeProcessing(true);
        // Create payment intent
        const intentRes = await axios.post('/api/wallet/deposit/stripe-intent', { amount: amountNum });
        const { clientSecret } = intentRes.data;

        const stripeObj = (window as any).Stripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');
        const result = await stripeObj.confirmCardPayment(clientSecret, {
          payment_method: {
            card: stripeCard,
            billing_details: {
              name: user?.username || 'Trader'
            }
          }
        });

        if (result.error) {
          showToast(result.error.message || 'Payment confirmation failed', 'error');
        } else if (result.paymentIntent?.status === 'succeeded') {
          // Confirm with backend to credit wallet
          const confirmRes = await axios.post('/api/wallet/deposit/stripe-confirm', {
            paymentIntentId: result.paymentIntent.id
          });
          if (confirmRes.data.success) {
            showToast('Stripe card deposit successful!', 'success');
            setShowDepositModal(false);
          }
        }
        setStripeProcessing(false);
      }

      fetchUser();
    } catch (err: any) {
      setStripeProcessing(false);
      showToast(err.response?.data?.error || 'Deposit failed', 'error');
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(withdrawAmount);
    if (!amountNum || amountNum <= 0) return;

    if (withdrawMethod === 'p2p') {
      if (!selectedBuyOfferId) {
        showToast('Please select a broker buy offer first', 'error');
        return;
      }
      const offer = p2pOffers.find(o => o.id === selectedBuyOfferId);
      if (offer && (amountNum < offer.min_limit || amountNum > offer.max_limit)) {
        showToast(`Amount must be between $${offer.min_limit} and $${offer.max_limit}`, 'error');
        return;
      }
      try {
        await axios.post('/api/p2p/trades/initiate', {
          offerId: selectedBuyOfferId,
          amount: amountNum
        });
        showToast('P2P Sell initiated! Balance locked in escrow.', 'success');
        setShowWithdrawModal(false);
        fetchUser();
      } catch (err: any) {
        showToast(err.response?.data?.error || 'Failed to initiate P2P sell', 'error');
      }
      return;
    }

    try {
      await axios.post('/api/wallet/withdraw', {
        amount: amountNum,
        method: withdrawMethod,
        details: withdrawDetails
      });
      showToast('Withdrawal request submitted successfully!', 'success');
      setShowWithdrawModal(false);
      fetchUser();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Withdrawal failed', 'error');
    }
  };

  const handleResetDemo = async () => {
    try {
      await axios.post('/api/wallet/demo/reset');
      showToast('Demo balance reset to $10,000.00', 'success');
      fetchUser();
    } catch (err) {
      showToast('Reset failed', 'error');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-light-bg dark:bg-dark-bg transition-colors duration-200 overflow-hidden">

      {/* Left side Hamburger Mobile Drawer */}
      {showMobileDrawer && (
        <div className="fixed inset-0 z-[100] flex md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-[#111112]/80 backdrop-blur-sm"
            onClick={() => setShowMobileDrawer(false)}
          />
          {/* Drawer Content */}
          <div className="relative w-72 max-w-[80vw] h-full bg-white dark:bg-[#1E222D] border-r border-light-border dark:border-[#2A2E39] p-5 flex flex-col justify-between shadow-2xl animate-slide-right overflow-y-auto">
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
                  className="w-full pl-3 pr-8 py-2 bg-light-panel dark:bg-[#111112] border border-light-border dark:border-[#2A2E39] rounded-xl text-xs font-bold text-light-primary dark:text-[#D1D4DC]"
                >
                  <option value="demo">Demo Account</option>
                  <option value="real">Real Account</option>
                </select>
                {activeWalletType === 'demo' && (
                  <button
                    onClick={() => {
                      handleResetDemo();
                      setShowMobileDrawer(false);
                    }}
                    className="text-left text-xs font-bold text-[#2962FF] hover:underline mt-1"
                  >
                    Reset Demo Balance
                  </button>
                )}
              </div>

              {/* Deposit/Withdraw Actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setShowDepositModal(true);
                    setShowMobileDrawer(false);
                  }}
                  className="py-2.5 bg-[#089981] hover:bg-opacity-95 text-white font-bold rounded-xl text-xs text-center"
                >
                  Deposit
                </button>
                <button
                  onClick={() => {
                    setShowWithdrawModal(true);
                    setShowMobileDrawer(false);
                  }}
                  className="py-2.5 bg-light-panel dark:bg-dark-bg border border-light-border dark:border-[#2A2E39] text-light-primary dark:text-[#D1D4DC] font-bold rounded-xl text-xs text-center"
                >
                  Withdraw
                </button>
              </div>

              {/* Performance Stats */}
              <div className="flex flex-col gap-3 p-3 bg-light-panel dark:bg-[#111112] rounded-xl border border-light-border dark:border-[#2A2E39]">
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
                <button
                  onClick={() => {
                    fetchWalletHistory();
                    setShowHistoryModal(true);
                    setShowMobileDrawer(false);
                  }}
                  className="text-left py-2 px-3 hover:bg-light-panel dark:hover:bg-[#2A2E39] rounded-xl flex items-center gap-2"
                >
                  📁 Transaction History
                </button>
                <button
                  onClick={() => {
                    fetchInsights();
                    setShowInsightsModal(true);
                    setShowMobileDrawer(false);
                  }}
                  className="text-left py-2 px-3 hover:bg-light-panel dark:hover:bg-[#2A2E39] rounded-xl flex items-center gap-2"
                >
                  💡 Market Insights
                </button>
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

      {/* 1. Header (Unified operational info bar) */}
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
                className="appearance-none pl-4 pr-10 py-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-xs font-bold focus:outline-none cursor-pointer text-light-primary dark:text-dark-primary"
              >
                <option value="demo">Demo Account</option>
                <option value="real">Real Account</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-light-secondary dark:text-dark-secondary">
                ▼
              </div>
            </div>

            {activeWalletType === 'demo' && (
              <button
                onClick={handleResetDemo}
                className="text-[10px] font-bold text-accent hover:underline flex items-center gap-1"
              >
                Reset Balance
              </button>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDepositModal(true)}
                className="px-4 py-2 bg-[#089981] text-white font-bold rounded-xl text-xs shadow-md shadow-[#089981]/10 hover:opacity-95"
              >
                Deposit
              </button>
              <button
                onClick={() => setShowWithdrawModal(true)}
                className="px-4 py-2 bg-light-panel dark:bg-dark-bg border border-light-border dark:border-dark-border text-light-primary dark:text-[#D1D4DC] font-bold rounded-xl text-xs hover:opacity-95"
              >
                Withdraw
              </button>
            </div>
          </div>
        </div>

        {/* Live performance dashboard (Desktop only) */}
        <div className="hidden md:flex items-center gap-8">
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-light-secondary dark:text-dark-secondary font-bold uppercase">Balance</span>
            <span className="font-mono font-extrabold text-sm text-light-primary dark:text-dark-primary">
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
            <span className="font-mono font-extrabold text-sm text-light-primary dark:text-dark-primary">
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

          {/* History & Insights shortcut buttons (Desktop only) */}
          <button
            onClick={() => {
              fetchWalletHistory();
              setShowHistoryModal(true);
            }}
            className="hidden md:block px-3 py-2 bg-light-panel dark:bg-dark-bg border border-light-border dark:border-dark-border text-light-primary dark:text-[#D1D4DC] font-bold rounded-xl text-xs hover:opacity-90"
          >
            History
          </button>

          <button
            onClick={() => {
              fetchInsights();
              setShowInsightsModal(true);
            }}
            className="hidden md:block px-3 py-2 bg-light-panel dark:bg-dark-bg border border-light-border dark:border-dark-border text-light-primary dark:text-[#D1D4DC] font-bold rounded-xl text-xs hover:opacity-90 animate-pulse"
          >
            Insights
          </button>

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
            className="px-3 py-2 bg-brand-gold/10 text-brand-gold font-bold rounded-xl text-xs border border-brand-gold/30 hover:opacity-90"
          >
            P2P
          </Link>

          {/* Profile Dropdown Container */}
          <div className="relative border-l border-light-border dark:border-[#2A2E39] pl-3">
            <button
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-tr from-[#2962FF] to-[#089981] hover:opacity-90 border border-light-border dark:border-[#2A2E39] text-white text-xs font-black transition-all shadow-sm"
              title="Profile Settings"
            >
              {user?.username ? user.username[0].toUpperCase() : 'U'}
            </button>

            {showProfileDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#1E222D] border border-light-border dark:border-[#2A2E39] rounded-2xl shadow-2xl z-[100] p-3.5 flex flex-col gap-2.5 animate-slide-in">
                {/* Details */}
                <div className="border-b border-light-border dark:border-[#2A2E39]/60 pb-2.5 text-xs flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#2962FF] to-[#089981] flex items-center justify-center font-bold text-white shadow-md">
                    {user?.username ? user.username[0].toUpperCase() : 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-light-primary dark:text-[#D1D4DC] flex items-center gap-1.5 mb-0.5">
                      <span className="truncate">{user?.username}</span>
                      {user?.verified && (
                        <span className="px-1 bg-[#2962FF]/10 text-[#2962FF] text-[8px] rounded font-bold">✓</span>
                      )}
                    </div>
                    <div className="text-[10px] text-light-secondary dark:text-[#8A91A5] truncate">{user?.email}</div>
                  </div>
                </div>

                {/* Simplified Menu Options */}
                <Link
                  to="/profile"
                  onClick={() => setShowProfileDropdown(false)}
                  className="w-full text-left py-2 px-3 hover:bg-light-panel dark:hover:bg-[#2A2E39] rounded-xl text-xs font-bold text-light-primary dark:text-[#D1D4DC] flex items-center gap-2"
                >
                  My Profile Settings
                </Link>

                <Link
                  to="/terms"
                  onClick={() => setShowProfileDropdown(false)}
                  className="w-full text-left py-2 px-3 hover:bg-light-panel dark:hover:bg-[#2A2E39] rounded-xl text-xs font-bold text-light-primary dark:text-[#D1D4DC] flex items-center gap-2"
                >
                  Terms & Services
                </Link>

                <button
                  onClick={() => {
                    fetchWalletHistory();
                    setShowHistoryModal(true);
                    setShowProfileDropdown(false);
                  }}
                  className="w-full text-left py-2 px-3 hover:bg-light-panel dark:hover:bg-[#2A2E39] rounded-xl text-xs font-bold text-light-primary dark:text-[#D1D4DC] flex items-center gap-2"
                >
                  Transaction History
                </button>

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

      {/* 2. Main WorkSpace Grid Layout */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">

        {/* Desktop View: 3-Pane Fluid Layout */}
        <div className="hidden md:flex flex-1 overflow-hidden">

          {/* Left Pane: Trading History View (Active + Closed) */}
          <section className="w-80 border-r border-light-border dark:border-[#2A2E39] flex flex-col h-full bg-light-panel dark:bg-[#1E222D]">
            {/* Header */}
            <div className="px-4 py-3 border-b border-light-border dark:border-[#2A2E39] flex justify-between items-center">
              <h3 className="font-extrabold text-xs text-light-primary dark:text-[#D1D4DC] uppercase tracking-wider">Trading History</h3>
            </div>

            {/* Tabs: Active / Closed */}
            <div className="flex border-b border-[#2A2E39] text-xs">
              <button
                onClick={() => setLeftTab('active')}
                className={`flex-1 py-2.5 font-bold text-center border-b-2 transition-all ${leftTab === 'active'
                  ? 'border-[#2962FF] text-[#2962FF]'
                  : 'border-transparent text-light-secondary dark:text-[#8A91A5] hover:text-[#D1D4DC]'
                  }`}
              >
                Active ({activeTrades.length})
              </button>
              <button
                onClick={() => setLeftTab('closed')}
                className={`flex-1 py-2.5 font-bold text-center border-b-2 transition-all ${leftTab === 'closed'
                  ? 'border-[#2962FF] text-[#2962FF]'
                  : 'border-transparent text-light-secondary dark:text-[#8A91A5] hover:text-[#D1D4DC]'
                  }`}
              >
                Closed ({tradeHistory.length})
              </button>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {leftTab === 'active' ? (
                activeTrades.length === 0 ? (
                  <p className="text-[11px] text-center text-light-secondary dark:text-[#8A91A5] mt-8">No active positions.</p>
                ) : (
                  activeTrades.map(t => {
                    const flash = flashStates[t.id] || '';
                    return (
                      <div key={t.id} className="p-3 bg-white dark:bg-[#1E222D] border border-[#2A2E39] rounded-xl flex flex-col gap-1 transition-all">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-xs text-light-primary dark:text-[#D1D4DC]">{t.asset}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${t.type === 'buy' ? 'bg-[#089981]/15 text-[#089981]' : 'bg-[#F23645]/15 text-[#F23645]'}`}>
                            {t.type}
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px] text-light-secondary dark:text-[#8A91A5]">
                          <span>Vol: {t.quantity}</span>
                          <span>Entry: {t.entry_price.toFixed(getDecimals(t.asset))}</span>
                        </div>
                        <div className="flex justify-between items-center mt-1 border-t border-light-border/45 dark:border-[#2A2E39]/45 pt-1.5">
                          <span className={`font-mono font-bold text-xs transition-all duration-300 ${flash === 'up' ? 'animate-flash-profit' : flash === 'down' ? 'animate-flash-loss' : ''
                            } ${(t.pnl ?? 0) >= 0 ? 'text-[#089981]' : 'text-[#F23645]'}`}>
                            ${(t.pnl || 0).toFixed(2)}
                          </span>
                          <button
                            onClick={() => closePosition(t.id)}
                            className="px-2 py-0.75 bg-[#F23645] hover:bg-opacity-90 text-white font-bold rounded-md text-[9px] transition-all"
                          >
                            Stop
                          </button>
                        </div>
                      </div>
                    );
                  })
                )
              ) : (
                tradeHistory.length === 0 ? (
                  <p className="text-[11px] text-center text-light-secondary dark:text-[#8A91A5] mt-8">No closed trades.</p>
                ) : (
                  tradeHistory.map(t => (
                    <div key={t.id} className="p-3 bg-white dark:bg-[#1E222D] border border-[#2A2E39] rounded-xl flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-xs text-light-primary dark:text-[#D1D4DC]">{t.asset}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${t.type === 'buy' ? 'bg-[#089981]/15 text-[#089981]' : 'bg-[#F23645]/15 text-[#F23645]'}`}>
                          {t.type}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] text-light-secondary dark:text-[#8A91A5]">
                        <span>Profit/Loss:</span>
                        <span className={`font-bold font-mono ${t.profit_loss >= 0 ? 'text-[#089981]' : 'text-[#F23645]'}`}>
                          {t.profit_loss >= 0 ? '+' : ''}${t.profit_loss.toFixed(2)}
                        </span>
                      </div>
                      <span className="text-[8px] text-light-secondary dark:text-[#8A91A5] self-end">{new Date(t.created_at).toLocaleString()}</span>
                    </div>
                  ))
                )
              )}
            </div>
          </section>

          {/* Middle Pane: Chart Visualizer */}
          <section className="flex-1 flex flex-col h-full bg-light-bg dark:bg-dark-bg">
            <div className="px-6 py-3 border-b border-light-border dark:border-[#2A2E39] flex items-center justify-between bg-white dark:bg-[#1E222D]">
              <div className="flex items-center gap-3">
                <span className="font-extrabold text-base text-light-primary dark:text-[#D1D4DC]">
                  Chart: {activeAsset}
                </span>
                <div className="relative">
                  <select
                    value={activeAsset}
                    onChange={(e) => setActiveAsset(e.target.value)}
                    className="appearance-none pl-3 pr-8 py-1.5 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-[#2A2E39] rounded-xl text-xs font-extrabold focus:outline-none cursor-pointer text-light-primary dark:text-dark-primary shadow-sm hover:border-[#2962FF] transition-all"
                  >
                    {ASSETS_LIST.map((asset) => (
                      <option key={asset.symbol} value={asset.symbol}>
                        {asset.symbol} ({asset.name})
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-light-secondary dark:text-dark-secondary text-[8px]">
                    ▼
                  </div>
                </div>
                <span className="text-xs text-[#089981] bg-[#089981]/10 px-2.5 py-0.5 rounded-full font-bold">Live Ticking</span>
              </div>
            </div>
            <div className="flex-1">
              <Chart symbol={activeAsset} theme={theme} />
            </div>
          </section>

          {/* Right Pane: Order Ticket */}
          <section className="w-80 border-l border-light-border dark:border-dark-border/40 p-6 flex flex-col gap-6 bg-light-panel dark:bg-[#151924]">

            <h3 className="font-extrabold text-sm text-light-primary dark:text-dark-primary uppercase tracking-wider">New Execution</h3>

            <div className="flex flex-col gap-4">

              {/* Investment Stake */}
              <div>
                <label className="block text-[10px] font-bold text-light-secondary dark:text-dark-secondary uppercase mb-2">Investment Amount ($)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-sm focus:outline-none focus:border-accent text-light-primary dark:text-dark-primary font-mono"
                />
                <span className="block mt-1.5 text-[10px] text-light-secondary dark:text-dark-secondary">
                  Margin: <strong className="text-light-primary dark:text-dark-primary font-mono">${parseFloat(quantity) ? parseFloat(quantity).toFixed(2) : '0.00'}</strong> (Leverage 1:100)
                </span>
              </div>

              {/* Expiry Duration preset (Gamified indices / Hours for non-synthetics) */}
              <div>
                <label className="block text-[10px] font-bold text-light-secondary dark:text-dark-secondary uppercase mb-2">
                  Duration ({isSynthetic ? 'Seconds' : 'Hours'})
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {(isSynthetic ? ['30', '60', '300', '900'] : ['24', '48', '72', '168']).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(d)}
                      className={`py-1.5 rounded-lg text-xs font-bold border transition-all ${duration === d
                        ? 'bg-accent border-accent text-white'
                        : 'bg-white dark:bg-dark-bg border-light-border dark:border-dark-border text-light-secondary dark:text-dark-secondary'
                        }`}
                    >
                      {d}{isSynthetic ? 's' : 'h'}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  placeholder={isSynthetic ? "Custom seconds" : "Custom hours"}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-xs focus:outline-none focus:border-accent text-light-primary dark:text-dark-primary font-mono"
                />
              </div>

              {/* Stop Loss & Take Profit */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-light-secondary dark:text-dark-secondary uppercase mb-2">Stop Loss</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="SL Price"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-xs focus:outline-none focus:border-accent text-light-primary dark:text-dark-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-light-secondary dark:text-dark-secondary uppercase mb-2">Take Profit</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="TP Price"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-xs focus:outline-none focus:border-accent text-light-primary dark:text-dark-primary font-mono"
                  />
                </div>
              </div>

              {/* Execution Action buttons */}
              <div className="flex flex-col gap-3 mt-4">
                <button
                  onClick={() => handleOpenTrade('buy')}
                  disabled={wsState !== 'connected'}
                  className={`w-full py-3.5 bg-bullish text-white font-bold rounded-xl shadow-lg shadow-bullish/25 hover:bg-opacity-95 active:scale-95 transition-all text-sm uppercase tracking-wider ${wsState !== 'connected' ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                >
                  {wsState !== 'connected' ? 'Offline - Reconnecting...' : 'Buy'}
                </button>
                <button
                  onClick={() => handleOpenTrade('sell')}
                  disabled={wsState !== 'connected'}
                  className={`w-full py-3.5 bg-bearish text-white font-bold rounded-xl shadow-lg shadow-bearish/25 hover:bg-opacity-95 active:scale-95 transition-all text-sm uppercase tracking-wider ${wsState !== 'connected' ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                >
                  {wsState !== 'connected' ? 'Offline - Reconnecting...' : 'Sell'}
                </button>
              </div>

            </div>

          </section>

        </div>

        {/* Mobile View: Collapsed Adaptive tabs with Bottom Nav */}
        <div className="flex md:hidden flex-1 flex-col overflow-hidden relative">

          {/* View Tab Switching */}
          <div className="flex-1 overflow-hidden">
            {activeMobileTab === 'quotes' && (
              <Quotes onSelectAsset={(sym) => { setActiveAsset(sym); setActiveMobileTab('chart'); }} />
            )}

            {activeMobileTab === 'chart' && (
              <div className="flex flex-col h-full bg-light-bg dark:bg-dark-bg">
                {/* Mobile Chart Header */}
                <div className="px-4 py-2 border-b border-light-border dark:border-dark-border/40 flex items-center justify-between bg-white dark:bg-[#1E222D]">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-xs text-light-primary dark:text-[#D1D4DC]">
                      Chart: {activeAsset}
                    </span>
                    <div className="relative">
                      <select
                        value={activeAsset}
                        onChange={(e) => setActiveAsset(e.target.value)}
                        className="appearance-none pl-2 pr-6 py-1 bg-light-bg dark:bg-[#111112] border border-light-border dark:border-[#2A2E39] rounded-lg text-[10px] font-bold focus:outline-none cursor-pointer text-light-primary dark:text-dark-primary"
                      >
                        {ASSETS_LIST.map((asset) => (
                          <option key={asset.symbol} value={asset.symbol}>
                            {asset.symbol}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-light-secondary dark:text-dark-secondary text-[7px]">
                        ▼
                      </div>
                    </div>
                  </div>
                  <span className="text-[9px] text-[#089981] bg-[#089981]/10 px-2 py-0.5 rounded-full font-bold">Live Ticking</span>
                </div>

                {/* 60% Top: Chart */}
                <div className="h-[50%] border-b border-light-border dark:border-dark-border/40 relative">
                  <Chart symbol={activeAsset} theme={theme} />
                </div>

                {/* 40% Bottom: Complete Exec Ticket */}
                <div className="flex-1 p-4 overflow-y-auto bg-light-panel dark:bg-[#151924] flex flex-col gap-4">
                  {/* Investment Stake */}
                  <div>
                    <label className="block text-[10px] font-bold text-light-secondary dark:text-dark-secondary uppercase mb-1.5">Investment Amount ($)</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-dark-bg border border-light-border dark:border-[#2A2E39] rounded-xl text-xs focus:outline-none focus:border-accent text-light-primary dark:text-dark-primary font-mono"
                    />
                    <span className="block mt-1 text-[9px] text-light-secondary dark:text-dark-secondary">
                      Margin: <strong className="text-light-primary dark:text-dark-primary font-mono">${parseFloat(quantity) ? parseFloat(quantity).toFixed(2) : '0.00'}</strong> (Leverage 1:100)
                    </span>
                  </div>

                  {/* Expiry Duration preset (Gamified indices / Hours for non-synthetics) */}
                  <div>
                    <label className="block text-[10px] font-bold text-light-secondary dark:text-dark-secondary uppercase mb-1.5">
                      Duration ({isSynthetic ? 'Seconds' : 'Hours'})
                    </label>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {(isSynthetic ? ['30', '60', '300', '900'] : ['24', '48', '72', '168']).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDuration(d)}
                          className={`py-1 rounded-lg text-[10px] font-bold border transition-all ${duration === d
                            ? 'bg-accent border-accent text-white'
                            : 'bg-white dark:bg-dark-bg border-light-border dark:border-dark-border text-light-secondary dark:text-dark-secondary'
                            }`}
                        >
                          {d}{isSynthetic ? 's' : 'h'}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      placeholder={isSynthetic ? "Custom seconds" : "Custom hours"}
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-xs focus:outline-none focus:border-accent text-light-primary dark:text-dark-primary font-mono"
                    />
                  </div>

                  {/* Stop Loss & Take Profit */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-light-secondary dark:text-dark-secondary uppercase mb-1.5">Stop Loss</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="SL Price"
                        value={stopLoss}
                        onChange={(e) => setStopLoss(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-xs focus:outline-none focus:border-accent text-light-primary dark:text-dark-primary font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-light-secondary dark:text-dark-secondary uppercase mb-1.5">Take Profit</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="TP Price"
                        value={takeProfit}
                        onChange={(e) => setTakeProfit(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-xs focus:outline-none focus:border-accent text-light-primary dark:text-dark-primary font-mono"
                      />
                    </div>
                  </div>

                  {/* Execution Action buttons */}
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <button
                      onClick={() => handleOpenTrade('buy')}
                      disabled={wsState !== 'connected'}
                      className={`py-3 bg-bullish text-white font-bold rounded-xl shadow-md shadow-bullish/25 hover:bg-opacity-95 active:scale-95 transition-all text-xs uppercase tracking-wider ${wsState !== 'connected' ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                    >
                      {wsState !== 'connected' ? 'Offline' : 'Buy'}
                    </button>
                    <button
                      onClick={() => handleOpenTrade('sell')}
                      disabled={wsState !== 'connected'}
                      className={`py-3 bg-bearish text-white font-bold rounded-xl shadow-md shadow-bearish/25 hover:bg-opacity-95 active:scale-95 transition-all text-xs uppercase tracking-wider ${wsState !== 'connected' ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                    >
                      {wsState !== 'connected' ? 'Offline' : 'Sell'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeMobileTab === 'trades' && (
              <div className="flex flex-col h-full bg-light-bg dark:bg-dark-bg text-light-primary dark:text-[#D1D4DC] p-4 font-sans">
                {/* Single-block Balance Summary with Dotted Separators */}
                <div className="bg-light-panel/60 dark:bg-[#1E222D]/60 backdrop-blur-md border border-light-border dark:border-[#2A2E39] rounded-2xl p-4 flex flex-col gap-2.5 shadow-xl mb-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#2962FF]/5 rounded-full blur-2xl pointer-events-none" />

                  <div className="flex flex-col gap-2 relative z-10 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-light-secondary dark:text-dark-secondary font-bold uppercase tracking-wider">Balance</span>
                      <div className="flex-1 border-b border-dotted border-light-border dark:border-[#2A2E39] mx-2 self-end mb-1"></div>
                      <span className="font-mono font-black text-light-primary dark:text-[#D1D4DC]">
                        ${activeBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-light-secondary dark:text-dark-secondary font-bold uppercase tracking-wider">Equity</span>
                      <div className="flex-1 border-b border-dotted border-light-border dark:border-[#2A2E39] mx-2 self-end mb-1"></div>
                      <span className={`font-mono font-black ${floatingPnl >= 0 ? 'text-[#089981]' : 'text-[#F23645]'}`}>
                        ${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-light-secondary dark:text-dark-secondary font-bold uppercase tracking-wider">Free Margin</span>
                      <div className="flex-1 border-b border-dotted border-light-border dark:border-[#2A2E39] mx-2 self-end mb-1"></div>
                      <span className="font-mono font-black text-light-primary dark:text-[#D1D4DC]">
                        ${freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-light-secondary dark:text-dark-secondary font-bold uppercase tracking-wider">Free Margin %</span>
                      <div className="flex-1 border-b border-dotted border-light-border dark:border-[#2A2E39] mx-2 self-end mb-1"></div>
                      <span className="font-mono font-black text-[#089981]">
                        {(activeBalance > 0 ? (freeMargin / activeBalance) * 100 : 100.0).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-black text-xs uppercase tracking-wider text-light-primary dark:text-[#D1D4DC]">ACTIVE POSITIONS</h3>
                  {activeTrades.length > 0 && (
                    <button
                      onClick={async () => {
                        for (const t of activeTrades) {
                          await closePosition(t.id);
                        }
                      }}
                      className="text-[10px] font-bold text-[#F23645] hover:underline"
                    >
                      Close All
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-16">
                  {activeTrades.map((t) => (
                    <div key={t.id} className="p-3 bg-light-panel dark:bg-[#1E222D] rounded-xl border border-light-border dark:border-[#2A2E39] flex justify-between items-center shadow-md">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-xs text-light-primary dark:text-[#D1D4DC]">{t.asset}</span>
                          <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${t.type === 'buy' ? 'bg-[#089981]/10 text-[#089981]' : 'bg-[#F23645]/10 text-[#F23645]'}`}>{t.type}</span>
                        </div>
                        <span className="text-[10px] text-light-secondary dark:text-dark-secondary mt-1 block font-medium">Vol: {t.quantity.toFixed(2)} | Entry: {t.entry_price.toFixed(t.asset.includes('JPY') ? 3 : 5)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`font-mono font-bold text-xs ${(t.pnl ?? 0) >= 0 ? 'text-[#089981]' : 'text-[#F23645]'}`}>${(t.pnl || 0).toFixed(2)}</span>
                        <button onClick={() => closePosition(t.id)} className="px-3 py-1.5 bg-[#F23645] hover:bg-opacity-95 text-white text-[10px] font-bold rounded-lg transition-all active:scale-95">Stop</button>
                      </div>
                    </div>
                  ))}
                  {activeTrades.length === 0 && (
                    <div className="h-48 flex flex-col items-center justify-center text-center">
                      <p className="text-xs text-light-secondary dark:text-dark-secondary">No active positions.</p>
                      <p className="text-[10px] text-light-secondary/60 dark:text-dark-secondary/60 mt-1">Open the Chart tab to place a trade.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeMobileTab === 'history' && (
              <div className="flex flex-col h-full p-4 bg-white dark:bg-dark-panel">
                <h3 className="font-extrabold text-sm mb-4 text-light-primary dark:text-dark-primary">CLOSED HISTORY</h3>
                <div className="flex-1 overflow-y-auto space-y-2 pb-16">
                  {tradeHistory.map((t) => (
                    <div key={t.id} className="p-3 bg-light-panel dark:bg-dark-bg rounded-xl border border-light-border dark:border-dark-border/20 flex justify-between items-center">
                      <div>
                        <span className="font-bold text-xs text-light-primary dark:text-dark-primary">{t.asset} ({t.type})</span>
                        <p className="text-[9px] text-light-secondary dark:text-dark-secondary">Closed: {new Date(t.created_at).toLocaleString()}</p>
                      </div>
                      <span className={`font-mono font-bold text-xs ${t.profit_loss >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                        {t.profit_loss >= 0 ? '+' : ''}${t.profit_loss.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeMobileTab === 'insights' && (
              <div className="flex flex-col h-full p-4 bg-white dark:bg-dark-panel overflow-y-auto space-y-4">
                <h3 className="font-extrabold text-sm text-light-primary dark:text-dark-primary">MARKET INSIGHTS</h3>
                <div className="space-y-4 pb-16">
                  {insights.map((ins) => (
                    <div key={ins.id} className="p-4 bg-light-panel dark:bg-dark-bg rounded-xl border border-light-border dark:border-dark-border/40">
                      <h4 className="font-bold text-xs mb-1 text-light-primary dark:text-dark-primary">{ins.title}</h4>
                      <p className="text-[10px] text-light-secondary dark:text-dark-secondary leading-relaxed mb-2">{ins.content}</p>
                      <span className="text-[9px] text-light-secondary dark:text-dark-secondary font-mono">{new Date(ins.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sticky bottom mobile navigation */}
          <nav className="fixed bottom-0 left-0 right-0 h-16 border-t border-light-border dark:border-[#2A2E39] bg-white/95 dark:bg-[#1E222D]/95 backdrop-blur-md flex justify-around items-center z-[40]">
            {[
              { key: 'quotes', label: 'Quotes', icon: <ArrowLeftRight className="w-5 h-5" /> },
              { key: 'chart', label: 'Chart', icon: <CandlestickChart className="w-5 h-5" /> },
              { key: 'trades', label: 'Trades', icon: <TrendingUp className="w-5 h-5" /> },
              { key: 'history', label: 'History', icon: <History className="w-5 h-5" /> },
              { key: 'insights', label: 'Insights', icon: <Lightbulb className="w-5 h-5" /> }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveMobileTab(tab.key as any)}
                className={`flex flex-col items-center gap-1 transition-all ${activeMobileTab === tab.key ? 'text-[#2962FF] scale-105' : 'text-light-secondary dark:text-[#8A91A5] hover:text-[#2962FF]'
                  }`}
              >
                {tab.icon}
                <span className="text-[9px] font-extrabold capitalize">{tab.label}</span>
              </button>
            ))}
          </nav>

        </div>

      </main>

      {/* 3. Deposit Modal Overlay */}
      {showDepositModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <div className="w-full max-w-md p-6 bg-white dark:bg-dark-panel border border-light-border dark:border-dark-border rounded-3xl shadow-2xl relative">
            <div className="flex items-center justify-between mb-4 pr-6">
              <h3 className="text-lg font-extrabold text-light-primary dark:text-dark-primary">Real Wallet Deposit</h3>
              <Link
                to="/p2p"
                className="px-3 py-1.5 bg-[#2962FF] hover:bg-[#2962FF]/90 text-white text-[10px] font-bold rounded-xl transition-all shadow-md shadow-[#2962FF]/10"
              >
                Use P2P Deposit
              </Link>
            </div>
            <button onClick={() => setShowDepositModal(false)} className="absolute top-4 right-4 text-light-secondary dark:text-dark-secondary hover:text-white font-bold">✕</button>

            <form onSubmit={handleDepositSubmit} className="space-y-4">

              <div>
                <label className="block text-xs font-bold text-light-secondary dark:text-dark-secondary uppercase mb-2">Amount (USD)</label>
                <input
                  type="number"
                  min="5"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-light-panel dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-sm focus:outline-none focus:border-accent text-light-primary dark:text-dark-primary font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-light-secondary dark:text-dark-secondary uppercase mb-2">Select Method</label>
                <div className="grid grid-cols-4 gap-2">
                  {['mpesa', 'paypal', 'stripe', 'crypto'].map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setDepositMethod(method as any)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all capitalize ${depositMethod === method
                        ? 'bg-accent border-accent text-white'
                        : 'bg-light-panel dark:bg-dark-bg border-light-border dark:border-dark-border text-light-secondary dark:text-dark-secondary'
                        }`}
                    >
                      {method === 'stripe' ? 'Card' : method === 'mpesa' ? 'M-Pesa' : method === 'paypal' ? 'PayPal' : 'Crypto'}
                    </button>
                  ))}
                </div>
              </div>

              {depositMethod === 'mpesa' && (
                <div>
                  <label className="block text-xs font-bold text-light-secondary dark:text-dark-secondary uppercase mb-2">M-Pesa Mobile Number</label>
                  <input
                    type="tel"
                    placeholder="07XXXXXXXX"
                    value={mpesaPhone}
                    onChange={(e) => setMpesaPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-light-panel dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-sm focus:outline-none focus:border-accent text-light-primary dark:text-dark-primary"
                  />
                </div>
              )}

              {depositMethod === 'stripe' && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-light-secondary dark:text-dark-secondary uppercase mb-1">Pay with Card</label>
                  <div className="p-3.5 bg-light-panel dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl">
                    <div id="stripe-card-element" className="min-h-[20px]" />
                  </div>
                </div>
              )}

              {depositMethod === 'paypal' && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-light-secondary dark:text-dark-secondary uppercase mb-1">Pay with PayPal</label>
                  <div id="paypal-button-container" className="p-2 bg-white rounded-xl border border-light-border dark:border-dark-border min-h-[50px] flex items-center justify-center" />
                </div>
              )}

              {depositMethod === 'crypto' && (
                <div className="space-y-3">
                  <div className="p-3 bg-light-panel dark:bg-dark-bg rounded-xl border border-light-border dark:border-dark-border/40 text-[10px] leading-relaxed text-light-secondary dark:text-dark-secondary">
                    <span className="font-bold text-white block mb-1">Crypto Deposit Details:</span>
                    {cryptoAddresses.btc && (
                      <div className="mb-1">BTC Address: <span className="font-mono text-accent block select-all">{cryptoAddresses.btc}</span></div>
                    )}
                    {cryptoAddresses.usdt && (
                      <div className="mb-1">USDT (TRC20): <span className="font-mono text-accent block select-all">{cryptoAddresses.usdt}</span></div>
                    )}
                    {cryptoAddresses.ltc && (
                      <div className="mb-1">LTC Address: <span className="font-mono text-accent block select-all">{cryptoAddresses.ltc}</span></div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-light-secondary dark:text-dark-secondary uppercase mb-2">Transaction Hash (TxID)</label>
                    <input
                      type="text"
                      placeholder="Enter txn hash"
                      value={cryptoTx}
                      onChange={(e) => setCryptoTx(e.target.value)}
                      className="w-full px-3 py-2 bg-light-panel dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-sm focus:outline-none focus:border-accent text-light-primary dark:text-dark-primary font-mono"
                    />
                  </div>
                </div>
              )}

              {depositMethod !== 'paypal' && (
                <button
                  type="submit"
                  disabled={stripeProcessing}
                  className="w-full py-3.5 bg-bullish text-white font-bold rounded-xl text-xs hover:opacity-95 transition-all shadow-lg shadow-bullish/10 disabled:opacity-50"
                >
                  {stripeProcessing ? 'Processing Payment...' : depositMethod === 'stripe' ? 'Pay now with Card' : 'Proceed with Deposit'}
                </button>
              )}

            </form>
          </div>
        </div>
      )}

      {/* 4. Withdraw Modal Overlay */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <div className="w-full max-w-md p-6 bg-white dark:bg-dark-panel border border-light-border dark:border-dark-border rounded-3xl shadow-2xl relative">
            <button onClick={() => setShowWithdrawModal(false)} className="absolute top-4 right-4 text-light-secondary dark:text-dark-secondary hover:text-white font-bold">✕</button>

            <h3 className="text-lg font-extrabold mb-4 text-light-primary dark:text-dark-primary">Request Withdrawal</h3>

            <form onSubmit={handleWithdrawSubmit} className="space-y-4">

              <div>
                <label className="block text-xs font-bold text-light-secondary dark:text-dark-secondary uppercase mb-2">Amount (USD)</label>
                <input
                  type="number"
                  min="10"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-light-panel dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-sm focus:outline-none focus:border-accent text-light-primary dark:text-dark-primary font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-light-secondary dark:text-dark-secondary uppercase mb-2">Method</label>
                <select
                  value={withdrawMethod}
                  onChange={(e) => {
                    setWithdrawMethod(e.target.value);
                    if (e.target.value !== 'p2p') {
                      setSelectedBuyOfferId('');
                    }
                  }}
                  className="w-full px-3 py-2 bg-light-panel dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-sm focus:outline-none focus:border-accent text-light-primary dark:text-dark-primary"
                >
                  <option value="bank">Bank Transfer</option>
                  <option value="mpesa">M-Pesa Mobile Money</option>
                  <option value="crypto">USDT / BTC Address</option>
                  <option value="p2p">P2P (Sell Balance)</option>
                </select>
              </div>

              {withdrawMethod === 'p2p' && (
                <div>
                  <label className="block text-xs font-bold text-light-secondary dark:text-dark-secondary uppercase mb-2">Select Broker Buy Offer</label>
                  <select
                    value={selectedBuyOfferId}
                    onChange={(e) => {
                      setSelectedBuyOfferId(e.target.value);
                      const selected = p2pOffers.find(o => o.id === e.target.value);
                      if (selected) {
                        setWithdrawAmount(String(selected.min_limit));
                      }
                    }}
                    className="w-full px-3 py-2 bg-light-panel dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-sm focus:outline-none focus:border-accent text-light-primary dark:text-dark-primary"
                  >
                    <option value="">-- Select an offer --</option>
                    {p2pOffers.filter(o => o.type === 'buy' && o.status === 'active' && o.broker_id !== user?.id).map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.broker?.username} (Limits: ${o.min_limit}-${o.max_limit}) - Pays via {o.payment_method}
                      </option>
                    ))}
                  </select>
                  {p2pOffers.filter(o => o.type === 'buy' && o.status === 'active' && o.broker_id !== user?.id).length === 0 && (
                    <p className="text-[10px] text-[#F23645] mt-1 font-semibold">⚠️ No active P2P buying offers listed by brokers right now.</p>
                  )}
                </div>
              )}

              {withdrawMethod !== 'p2p' ? (
                <div>
                  <label className="block text-xs font-bold text-light-secondary dark:text-dark-secondary uppercase mb-2">Payment Details</label>
                  <textarea
                    required
                    placeholder="Enter Account Number, Swift Code, Mobile Number, or Wallet Address details..."
                    rows={3}
                    value={withdrawDetails}
                    onChange={(e) => setWithdrawDetails(e.target.value)}
                    className="w-full px-3 py-2 bg-light-panel dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-xs focus:outline-none focus:border-accent text-light-primary dark:text-dark-primary"
                  />
                </div>
              ) : (
                selectedBuyOfferId && (
                  <div className="p-3 bg-light-panel dark:bg-[#1E222D] border border-light-border dark:border-[#2A2E39] rounded-xl text-xs space-y-1 text-light-secondary dark:text-[#8A91A5]">
                    <div className="font-bold text-light-primary dark:text-white uppercase text-[9px] mb-1">Escrow Info:</div>
                    <div>Broker wants to buy: <span className="font-mono text-light-primary dark:text-[#D1D4DC]">${(p2pOffers.find(o => o.id === selectedBuyOfferId)?.amount || 0).toFixed(2)}</span></div>
                    <div>Payment Method: <span className="text-[#2962FF] font-bold">{p2pOffers.find(o => o.id === selectedBuyOfferId)?.payment_method}</span></div>
                    <div className="text-[10px] text-amber-500 italic mt-1 font-semibold">Funds will be locked in Escrow until the broker pays and you release them.</div>
                  </div>
                )
              )}

              <button
                type="submit"
                className="w-full py-3.5 bg-bearish text-white font-bold rounded-xl text-xs hover:opacity-95 transition-all shadow-lg shadow-bearish/10"
              >
                {withdrawMethod === 'p2p' ? 'Initiate P2P Escrow Sell' : 'Submit Withdrawal Request'}
              </button>

            </form>
          </div>
        </div>
      )}

      {/* 5. Quotes Selector Modal Overlay */}
      {showQuotesModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <div className="w-full max-w-2xl h-[550px] bg-white dark:bg-[#1E222D] border border-light-border dark:border-[#2A2E39] rounded-3xl shadow-2xl relative flex flex-col overflow-hidden">
            <button
              onClick={() => setShowQuotesModal(false)}
              className="absolute top-4 right-4 text-light-secondary dark:text-[#8A91A5] hover:text-white font-bold z-[100]"
            >
              ✕
            </button>

            <div className="px-6 py-4 border-b border-light-border dark:border-[#2A2E39]">
              <h3 className="text-lg font-extrabold text-light-primary dark:text-[#D1D4DC]">Select Tradable Instrument</h3>
            </div>

            <div className="flex-1 overflow-hidden">
              <Quotes onSelectAsset={(sym) => {
                setActiveAsset(sym);
                setShowQuotesModal(false);
              }} />
            </div>
          </div>
        </div>
      )}

      {/* 6. Transaction History Modal Overlay */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <div className="w-full max-w-2xl h-[500px] bg-white dark:bg-[#1E222D] border border-light-border dark:border-[#2A2E39] rounded-3xl shadow-2xl relative flex flex-col overflow-hidden">
            <button
              onClick={() => setShowHistoryModal(false)}
              className="absolute top-4 right-4 text-light-secondary dark:text-[#8A91A5] hover:text-white font-bold z-[100]"
            >
              ✕
            </button>

            <div className="px-6 py-4 border-b border-light-border dark:border-[#2A2E39]">
              <h3 className="text-lg font-extrabold text-light-primary dark:text-[#D1D4DC]">Transaction Logs</h3>
              <p className="text-[10px] text-light-secondary dark:text-[#8A91A5]">Full history of deposits, withdrawals, and broker applications</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {walletHistory.length === 0 ? (
                <div className="flex items-center justify-center h-full text-light-secondary dark:text-[#8A91A5] text-xs">
                  No transaction records found.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-light-border dark:border-[#2A2E39] text-light-secondary dark:text-[#8A91A5] uppercase font-bold text-[10px]">
                      <th className="py-2.5">Date</th>
                      <th className="py-2.5">Type</th>
                      <th className="py-2.5">Amount</th>
                      <th className="py-2.5">Gateway</th>
                      <th className="py-2.5">Status</th>
                      <th className="py-2.5">Approved At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-light-border/40 dark:divide-dark-border/20 font-mono text-[11px] text-light-primary dark:text-[#D1D4DC]">
                    {walletHistory.map((h) => (
                      <tr key={h.id} className="hover:bg-light-panel dark:hover:bg-dark-bg/25">
                        <td className="py-3">{new Date(h.created_at).toLocaleDateString()}</td>
                        <td className="py-3">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${h.type === 'deposit' ? 'bg-[#089981]/10 text-[#089981]' : 'bg-[#F23645]/10 text-[#F23645]'
                            }`}>
                            {h.type}
                          </span>
                        </td>
                        <td className="py-3 font-bold">${Number(h.amount).toFixed(2)}</td>
                        <td className="py-3 capitalize">{h.payment_method}</td>
                        <td className="py-3">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold capitalize ${h.status === 'approved' ? 'bg-[#089981]/10 text-[#089981]' :
                            h.status === 'pending' ? 'bg-amber-500/10 text-amber-500' : 'bg-[#F23645]/10 text-[#F23645]'
                            }`}>
                            {h.status}
                          </span>
                        </td>
                        <td className="py-3 text-[10px] text-light-secondary dark:text-[#8A91A5]">
                          {h.approved_at ? new Date(h.approved_at).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. Market Insights Modal Overlay */}
      {showInsightsModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <div className="w-full max-w-2xl h-[500px] bg-white dark:bg-[#1E222D] border border-light-border dark:border-[#2A2E39] rounded-3xl shadow-2xl relative flex flex-col overflow-hidden">
            <button
              onClick={() => setShowInsightsModal(false)}
              className="absolute top-4 right-4 text-light-secondary dark:text-[#8A91A5] hover:text-white font-bold z-[100]"
            >
              ✕
            </button>

            <div className="px-6 py-4 border-b border-light-border dark:border-[#2A2E39]">
              <h3 className="text-lg font-extrabold text-light-primary dark:text-[#D1D4DC]">Market Insights & Analyst Reports</h3>
              <p className="text-[10px] text-light-secondary dark:text-[#8A91A5]">Keep track of market trends and official publications</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {insights.length === 0 ? (
                <div className="flex items-center justify-center h-full text-light-secondary dark:text-[#8A91A5] text-xs">
                  No analyst reports published yet.
                </div>
              ) : (
                insights.map((ins) => (
                  <div key={ins.id} className="p-4 bg-light-panel dark:bg-[#1E222D] border border-light-border dark:border-[#2A2E39] rounded-2xl">
                    <h4 className="font-extrabold text-sm mb-1 text-[#2962FF]">{ins.title}</h4>
                    <p className="text-xs text-light-primary dark:text-[#D1D4DC] leading-relaxed mb-3">{ins.content}</p>
                    <div className="text-[9px] text-light-secondary dark:text-[#8A91A5] font-mono">
                      Published: {new Date(ins.created_at).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer access links */}
      <footer className="py-4 border-t border-light-border dark:border-dark-border/40 text-center text-[10px] text-light-secondary dark:text-dark-secondary bg-light-panel dark:bg-dark-panel flex-shrink-0">
        <div className="flex justify-center gap-4 mb-2">
          <a href="https://t.me/xfx" target="_blank" rel="noreferrer" className="hover:underline">Telegram</a>
          <a href="https://wa.me/xfx" target="_blank" rel="noreferrer" className="hover:underline">WhatsApp Channel</a>
          <a href="https://facebook.com/xfx" target="_blank" rel="noreferrer" className="hover:underline">Facebook</a>
          <a href="https://twitter.com/xfx" target="_blank" rel="noreferrer" className="hover:underline">Twitter / X</a>
        </div>
        <div>
          © 2026 ExtFx - ExtremeFxTrader. All rights reserved.
        </div>
      </footer>

    </div>
  );
}
