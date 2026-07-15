import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useTradeStore, P2POffer, P2PTrade } from '../store/useTradeStore';
import { showToast } from '../App';

interface P2pProps {
  toggleTheme: () => void;
  theme: 'dark' | 'light';
}

export default function P2p({ toggleTheme, theme }: P2pProps) {
  const {
    user,
    wallets,
    p2pOffers,
    p2pTrades,
    brokerApplications,
    fetchP2pOffers,
    fetchP2pTrades,
    fetchBrokerStatus,
    fetchUser,
    markMessagesRead,
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

  const [activeTab, setActiveTab] = useState<'offers' | 'trades' | 'broker_panel'>('offers');
  const [loading, setLoading] = useState(false);

  // Broker application form
  const [capital, setCapital] = useState('1000');
  const [paymentOptions, setPaymentOptions] = useState('M-Pesa, Bank Transfer');
  const [paymentDetails, setPaymentDetails] = useState('');
  const [instructions, setInstructions] = useState('');

  // Broker create offer form
  const [offerType, setOfferType] = useState<'buy' | 'sell'>('sell');
  const [offerAmount, setOfferAmount] = useState('500');
  const [minLimit, setMinLimit] = useState('50');
  const [maxLimit, setMaxLimit] = useState('500');
  const [offerPayment, setOfferPayment] = useState('M-Pesa');

  // Broker wallet transfer form
  const [transferAmount, setTransferAmount] = useState('100');
  const [transferDirection, setTransferDirection] = useState<'to_p2p' | 'to_trading'>('to_p2p');

  // Initiate trade modal
  const [selectedOffer, setSelectedOffer] = useState<P2POffer | null>(null);
  const [tradeAmount, setTradeAmount] = useState('');

  // Rating modal
  const [ratingTrade, setRatingTrade] = useState<P2PTrade | null>(null);
  const [ratingVal, setRatingVal] = useState(5);
  const [reviewText, setReviewText] = useState('');

  // Top-up Modal states
  const [showTopupModal, setShowTopupModal] = useState(false);

  // Edit offer states
  const [editingOffer, setEditingOffer] = useState<P2POffer | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editMinLimit, setEditMinLimit] = useState('');
  const [editMaxLimit, setEditMaxLimit] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('');

  // Broker onboarding deposit states
  const [depositMethod, setDepositMethod] = useState<'mpesa' | 'paypal' | 'stripe' | 'crypto'>('mpesa');
  const [depositAmount, setDepositAmount] = useState('1000');
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [cryptoTx, setCryptoTx] = useState('');
  const [stripeCard, setStripeCard] = useState<any>(null);
  const [stripeProcessing, setStripeProcessing] = useState(false);
  const [cryptoAddresses, setCryptoAddresses] = useState<{ btc: string; usdt: string; ltc: string }>({
    btc: '',
    usdt: '',
    ltc: ''
  });
  const [topupAmount, setTopupAmount] = useState('1000');
  const [topupMethod, setTopupMethod] = useState('Bank Transfer');
  const [topupTx, setTopupTx] = useState('');

  // Escrow trade chat states
  const [selectedChatTrade, setSelectedChatTrade] = useState<P2PTrade | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessageText, setNewMessageText] = useState('');

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      fetchP2pOffers(),
      fetchP2pTrades(),
      fetchBrokerStatus(),
      fetchUser()
    ]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const p2pWallet = wallets.find(w => w.type === 'p2p');
  const realWallet = wallets.find(w => w.type === 'real');

  const handleApplyBroker = async (e: React.FormEvent) => {
    e.preventDefault();
    const capNum = parseFloat(capital);
    if (capNum < 1000) return showToast('Minimum capital is $1000', 'error');

    try {
      await axios.post('/api/p2p/broker/apply', {
        capital: capNum,
        paymentOptions,
        paymentDetails,
        instructions
      });
      showToast('Broker application submitted for review!', 'success');
      loadData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Application failed', 'error');
    }
  };

  const approvedApp = brokerApplications.find(a => a.status === 'approved');

  // Set default capital on approved application
  useEffect(() => {
    if (approvedApp) {
      setDepositAmount(String(approvedApp.capital || 1000));
      setMpesaPhone(user?.phone || '');
      fetchCryptoAddresses();
    }
  }, [approvedApp]);

  const fetchCryptoAddresses = async () => {
    try {
      const res = await axios.get('/api/wallet/crypto-addresses');
      setCryptoAddresses(res.data);
    } catch (err) {
      console.error('Failed to fetch crypto deposit addresses', err);
    }
  };

  const handleEditOffer = (offer: P2POffer) => {
    setEditingOffer(offer);
    setEditAmount(String(offer.amount));
    setEditMinLimit(String(offer.min_limit));
    setEditMaxLimit(String(offer.max_limit));
    setEditPaymentMethod(offer.payment_method);
  };

  const handleUpdateOfferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOffer) return;
    const amountNum = parseFloat(editAmount);
    const minNum = parseFloat(editMinLimit);
    const maxNum = parseFloat(editMaxLimit);

    if (!amountNum || amountNum <= 0 || !minNum || !maxNum || !editPaymentMethod) {
      return showToast('Please enter valid fields', 'error');
    }
    if (minNum > maxNum) {
      return showToast('Minimum limit cannot exceed maximum limit', 'error');
    }

    try {
      await axios.put(`/api/p2p/offers/${editingOffer.id}`, {
        amount: amountNum,
        minLimit: minNum,
        maxLimit: maxNum,
        paymentMethod: editPaymentMethod
      });
      showToast('Offer updated successfully!', 'success');
      setEditingOffer(null);
      loadData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update offer', 'error');
    }
  };

  const handleDeleteOffer = async (offerId: string) => {
    if (!window.confirm('Are you sure you want to cancel this offer?')) return;
    try {
      await axios.delete(`/api/p2p/offers/${offerId}`);
      showToast('Offer cancelled successfully!', 'success');
      loadData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to cancel offer', 'error');
    }
  };

  // Stripe & PayPal SDK dynamic loads
  useEffect(() => {
    if (!approvedApp) return;

    if (depositMethod === 'stripe') {
      if (!(window as any).Stripe && !document.getElementById('stripe-js')) {
        const script = document.createElement('script');
        script.id = 'stripe-js';
        script.src = 'https://js.stripe.com/v3/';
        script.async = true;
        document.body.appendChild(script);
      }
    }

    if (depositMethod === 'paypal') {
      if (!(window as any).paypal && !document.getElementById('paypal-js')) {
        const script = document.createElement('script');
        script.id = 'paypal-js';
        script.src = `https://www.paypal.com/sdk/js?client-id=${import.meta.env.VITE_PAYPAL_CLIENT_ID || 'sb'}&currency=USD`;
        script.async = true;
        document.body.appendChild(script);
      }
    }
  }, [approvedApp, depositMethod]);

  // Init Stripe element in P2P page
  useEffect(() => {
    if (!approvedApp || depositMethod !== 'stripe') {
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
        card.mount('#broker-stripe-card-element');
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
  }, [approvedApp, depositMethod]);

  // Init PayPal buttons in P2P page
  useEffect(() => {
    if (!approvedApp || depositMethod !== 'paypal') return;

    const initPaypal = () => {
      if (!(window as any).paypal) {
        setTimeout(initPaypal, 100);
        return;
      }

      const container = document.getElementById('broker-paypal-button-container');
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
                showToast('PayPal deposit capture successful! Your broker capital has been updated.', 'success');
                fetchUser();
                loadData();
              }
            } catch (err: any) {
              showToast(err.response?.data?.error || 'PayPal capture failed', 'error');
            }
          },
          onError: (err: any) => {
            showToast('PayPal Checkout error occurred', 'error');
            console.error('PayPal Error:', err);
          }
        }).render('#broker-paypal-button-container');
      } catch (err) {
        console.error('PayPal Button render failed:', err);
      }
    };

    initPaypal();
  }, [approvedApp, depositMethod, depositAmount]);

  const handleBrokerDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(depositAmount);
    if (!amountNum || amountNum <= 0) return;
    
    const minCap = approvedApp ? Number(approvedApp.capital || 1000) : 1000;
    if (amountNum < minCap) {
      return showToast(`Minimum deposit amount required is $${minCap}`, 'error');
    }

    try {
      if (depositMethod === 'mpesa') {
        if (!mpesaPhone) return showToast('Please enter your phone number', 'error');
        await axios.post('/api/wallet/deposit/mpesa-stk', { amount: amountNum, phone: mpesaPhone });
        showToast('M-Pesa STK Push initiated. Check your phone!', 'success');
      } else if (depositMethod === 'crypto') {
        if (!cryptoTx) return showToast('Please enter transaction hash', 'error');
        await axios.post('/api/wallet/deposit/crypto', { amount: amountNum, txHash: cryptoTx });
        showToast('Crypto deposit notification submitted for manual review!', 'info');
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
              name: user?.username || 'Broker'
            }
          }
        });

        if (result.error) {
          showToast(result.error.message || 'Payment confirmation failed', 'error');
        } else if (result.paymentIntent?.status === 'succeeded') {
          const confirmRes = await axios.post('/api/wallet/deposit/stripe-confirm', {
            paymentIntentId: result.paymentIntent.id
          });
          if (confirmRes.data.success) {
            showToast('Stripe card deposit successful! Your broker capital has been updated.', 'success');
            fetchUser();
            loadData();
          }
        }
        setStripeProcessing(false);
      }
    } catch (err: any) {
      setStripeProcessing(false);
      showToast(err.response?.data?.error || 'Deposit failed', 'error');
    }
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(offerAmount);
    if (!amt || amt <= 0) return;

    const realWallet = wallets.find(w => w.type === 'real');
    if (user?.role !== 'broker') {
      if (offerType !== 'sell') {
        showToast('Only authorized brokers can list P2P buy offers', 'error');
        return;
      }
      if (!realWallet || Number(realWallet.balance) < 100) {
        showToast('Standard traders must have a balance greater than $100 to list sell offers', 'error');
        return;
      }
      if (Number(realWallet.balance) < amt) {
        showToast('Insufficient real wallet balance to list this sell offer', 'error');
        return;
      }
    }

    try {
      await axios.post('/api/p2p/offers', {
        type: offerType,
        amount: amt,
        minLimit: parseFloat(minLimit),
        maxLimit: parseFloat(maxLimit),
        paymentMethod: offerPayment
      });
      showToast('P2P Offer listed successfully!', 'success');
      setOfferAmount('');
      loadData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to create offer', 'error');
    }
  };

  const handleBrokerTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(transferAmount);
    if (!amt || amt <= 0) return;

    try {
      await axios.post('/api/wallet/transfer', {
        amount: amt,
        direction: transferDirection
      });
      showToast('Transfer completed!', 'success');
      loadData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Transfer failed', 'error');
    }
  };

  const handleInitiateTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOffer) return;
    const amt = parseFloat(tradeAmount);
    if (!amt || amt <= 0) return;

    if (selectedOffer.type === 'buy') {
      const realWallet = wallets.find(w => w.type === 'real');
      if (!realWallet || Number(realWallet.balance) < amt) {
        showToast('Insufficient real wallet balance to place in escrow for this P2P sale.', 'error');
        return;
      }
    }

    try {
      await axios.post('/api/p2p/trades/initiate', {
        offerId: selectedOffer.id,
        amount: amt
      });
      showToast('Trade initiated! Funds locked in escrow.', 'success');
      setSelectedOffer(null);
      setTradeAmount('');
      setActiveTab('trades');
      loadData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Trade initiation failed', 'error');
    }
  };

  const handleMarkPaid = async (tradeId: string) => {
    try {
      await axios.post('/api/p2p/trades/pay', { tradeId });
      showToast('Trade marked as Paid. Waiting for broker escrow release.', 'success');
      loadData();
    } catch (err) {
      showToast('Action failed', 'error');
    }
  };

  const handleReleaseEscrow = async (tradeId: string) => {
    try {
      await axios.post('/api/p2p/trades/complete', { tradeId });
      showToast('Escrow released! Buyer credited.', 'success');
      loadData();
    } catch (err) {
      showToast('Release failed', 'error');
    }
  };

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratingTrade) return;

    try {
      await axios.post('/api/p2p/trades/rate', {
        tradeId: ratingTrade.id,
        rating: ratingVal,
        review: reviewText
      });
      showToast('Review submitted successfully!', 'success');
      setRatingTrade(null);
      setReviewText('');
      loadData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Rating submission failed', 'error');
    }
  };

  const fetchTradeChat = async (tradeId: string) => {
    try {
      const res = await axios.get(`/api/chats/trade/${tradeId}`);
      setChatMessages(res.data);
      await markMessagesRead(undefined, tradeId);
    } catch (err) {
      console.error('Failed to fetch chat', err);
    }
  };

  useEffect(() => {
    if (!selectedChatTrade) return;
    fetchTradeChat(selectedChatTrade.id);
    const interval = setInterval(() => {
      fetchTradeChat(selectedChatTrade.id);
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedChatTrade]);

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() || !selectedChatTrade) return;

    try {
      await axios.post(`/api/chats/trade/${selectedChatTrade.id}`, {
        message: newMessageText
      });
      setNewMessageText('');
      fetchTradeChat(selectedChatTrade.id);
    } catch (err) {
      showToast('Failed to send message', 'error');
    }
  };

  const handleDisputeTrade = async (tradeId: string) => {
    try {
      await axios.post(`/api/p2p/trades/${tradeId}/add-admin`);
      showToast('Dispute opened. Admin added to chat.', 'success');
      setSelectedChatTrade(prev => prev ? { ...prev, admin_involved: true } : null);
      fetchTradeChat(tradeId);
      loadData();
    } catch (err) {
      showToast('Failed to trigger dispute', 'error');
    }
  };

  const handleBrokerTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(topupAmount);
    if (!amt || amt <= 0) return;

    try {
      await axios.post('/api/p2p/broker/topup', {
        amount: amt,
        paymentMethod: topupMethod,
        details: `TxRef: ${topupTx}`
      });
      showToast('Manual Top-up requested. Pending admin approval.', 'success');
      setShowTopupModal(false);
      setTopupTx('');
      loadData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Topup request failed', 'error');
    }
  };

  const pendingApp = brokerApplications.find(a => a.status === 'pending');

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
                  className="w-full pl-3 pr-8 py-2 bg-light-panel dark:bg-[#111112] border border-light-border dark:border-[#2A2E39] rounded-xl text-xs font-bold text-light-primary dark:text-dark-primary"
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
                  className="py-2.5 bg-light-panel dark:bg-dark-bg border border-light-border dark:border-[#2A2E39] text-light-primary dark:text-[#D1D4DC] font-bold rounded-xl text-xs text-center flex items-center justify-center"
                >
                  Withdraw
                </Link>
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
                  className="text-left py-2 px-3 hover:bg-light-panel dark:hover:bg-[#2A2E39] rounded-xl flex items-center gap-2"
                >
                  💡 Market Insights
                </Link>
                <Link
                  to="/p2p"
                  onClick={() => setShowMobileDrawer(false)}
                  className="py-2 px-3 hover:bg-light-panel dark:hover:bg-[#2A2E39] rounded-xl flex items-center gap-2 bg-[#2962FF]/10 text-[#2962FF]"
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
            to="/transactions"
            className="hidden md:block px-3 py-2 bg-light-panel dark:bg-dark-bg border border-light-border dark:border-[#2A2E39] text-light-primary dark:text-[#D1D4DC] font-bold rounded-xl text-xs hover:opacity-90 text-center"
          >
            History
          </Link>

          <Link
            to="/insights"
            className="hidden md:block px-3 py-2 bg-light-panel dark:bg-dark-bg border border-light-border dark:border-[#2A2E39] text-light-primary dark:text-[#D1D4DC] font-bold rounded-xl text-xs hover:opacity-90 animate-pulse text-center"
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
          <div className="relative border-l border-light-border dark:border-[#2A2E39] pl-3">
            <button
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-tr from-[#2962FF] to-[#089981] hover:opacity-90 border border-light-border dark:border-[#2A2E39] text-white text-xs font-black transition-all shadow-sm"
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
                    <div className="font-bold text-light-primary dark:text-[#D1D4DC] flex items-center gap-1.5 mb-0.5">
                      <span className="truncate">{user?.username}</span>
                      {user?.verified && (
                        <span className="px-1 bg-[#2962FF]/10 text-[#2962FF] text-[8px] rounded font-bold">✓</span>
                      )}
                    </div>
                    <div className="text-[10px] text-light-secondary dark:text-[#8A91A5] truncate">{user?.email}</div>
                  </div>
                </div>

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

                <Link
                  to="/transactions"
                  onClick={() => setShowProfileDropdown(false)}
                  className="w-full text-left py-2 px-3 hover:bg-light-panel dark:hover:bg-[#2A2E39] rounded-xl text-xs font-bold text-light-primary dark:text-[#D1D4DC] flex items-center gap-2 text-center"
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

      {/* Main Content Area */}
      <div className="flex-1 p-6 flex flex-col overflow-y-auto">

      {/* P2P Balance Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="p-5 bg-white dark:bg-dark-panel border border-light-border dark:border-dark-border rounded-2xl">
          <span className="text-[10px] text-light-secondary dark:text-[#8A91A5] font-bold uppercase">P2P Wallet Balance</span>
          <p className="font-mono text-xl font-extrabold text-light-primary dark:text-white mt-1">
            ${p2pWallet ? Number(p2pWallet.balance).toFixed(2) : '0.00'}
          </p>
        </div>
        <div className="p-5 bg-white dark:bg-dark-panel border border-light-border dark:border-dark-border rounded-2xl">
          <span className="text-[10px] text-light-secondary dark:text-[#8A91A5] font-bold uppercase">Escrow Locked (Pending)</span>
          <p className="font-mono text-xl font-extrabold text-[#F23645] mt-1">
            ${p2pWallet ? Number(p2pWallet.pending_balance).toFixed(2) : '0.00'}
          </p>
        </div>
        <div className="p-5 bg-white dark:bg-dark-panel border border-light-border dark:border-dark-border rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-light-secondary dark:text-[#8A91A5] font-bold uppercase">Broker Account Badges</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`text-xs font-bold ${user?.role === 'broker' ? 'text-[#089981]' : 'text-light-secondary dark:text-[#8A91A5]'}`}>
                {user?.role === 'broker' ? 'Authorized Broker' : 'Standard Trader'}
              </span>
              {user?.verified && (
                <span className="w-4 h-4 bg-[#2962FF] text-white flex items-center justify-center rounded-full text-[9px]">✓</span>
              )}
            </div>
          </div>
          {user?.role !== 'broker' && !pendingApp && (
            <button
              onClick={() => setActiveTab('broker_panel')}
              className="px-3 py-1.5 bg-brand-gold text-dark-bg font-extrabold rounded-lg text-[10px] hover:opacity-95"
            >
              Apply Broker
            </button>
          )}
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex gap-4 border-b border-light-border dark:border-[#2A2E39] pb-2 mb-6">
        <button
          onClick={() => setActiveTab('offers')}
          className={`px-4 py-2 text-xs font-bold capitalize transition-all ${
            activeTab === 'offers' 
              ? 'text-[#2962FF] border-b-2 border-[#2962FF]' 
              : 'text-light-secondary dark:text-dark-secondary hover:text-[#2962FF]'
          }`}
        >
          Marketplace Offers
        </button>
        <button
          onClick={() => setActiveTab('trades')}
          className={`px-4 py-2 text-xs font-bold capitalize transition-all ${
            activeTab === 'trades' 
              ? 'text-[#2962FF] border-b-2 border-[#2962FF]' 
              : 'text-light-secondary dark:text-dark-secondary hover:text-[#2962FF]'
          }`}
        >
          Active Escrows / History
        </button>
        {(user?.role === 'broker' || (user?.role === 'trader' && (realWallet?.balance || 0) > 100)) ? (
          <button
            onClick={() => setActiveTab('broker_panel')}
            className={`px-4 py-2 text-xs font-bold capitalize transition-all ${
              activeTab === 'broker_panel' 
                ? 'text-[#2962FF] border-b-2 border-[#2962FF]' 
                : 'text-light-secondary dark:text-dark-secondary hover:text-[#2962FF]'
            }`}
          >
            {user?.role === 'broker' ? 'Broker Console' : 'P2P Trader Console'}
          </button>
        ) : (
          <button
            onClick={() => setActiveTab('broker_panel')}
            className={`px-4 py-2 text-xs font-bold capitalize transition-all ${
              activeTab === 'broker_panel' 
                ? 'text-[#2962FF] border-b-2 border-[#2962FF]' 
                : 'text-light-secondary dark:text-dark-secondary hover:text-[#2962FF]'
            }`}
          >
            Apply to be a Broker
          </button>
        )}
      </div>

      {/* Main Tab Views */}
      <div className="flex-1 bg-white dark:bg-dark-panel border border-light-border dark:border-dark-border rounded-3xl p-6 relative">
        
        {loading && (
          <div className="absolute inset-0 bg-light-panel/40 dark:bg-dark-bg/40 backdrop-blur-xs flex items-center justify-center rounded-3xl z-50">
            <div className="w-8 h-8 border-4 border-[#2962FF] border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* Tab 1: Marketplace Offers List */}
        {activeTab === 'offers' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-light-primary dark:text-white">Listed Liquidity Offers</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {p2pOffers.length === 0 ? (
                <p className="text-center text-xs text-light-secondary dark:text-dark-secondary p-8 col-span-2">No active broker offers listed. Check back later.</p>
              ) : (
                p2pOffers.map((o) => (
                  <div key={o.id} className="p-5 bg-light-panel dark:bg-dark-bg/30 border border-light-border dark:border-[#2A2E39] rounded-2xl flex flex-col justify-between gap-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-light-primary dark:text-white">{o.broker?.username}</span>
                          {o.broker?.verified && (
                            <span className="w-3.5 h-3.5 bg-[#2962FF] text-white flex items-center justify-center rounded-full text-[8px]" title="Verified Provider">✓</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-light-secondary dark:text-[#8A91A5] mt-0.5">
                          <span>Rating: {o.broker?.rating ? o.broker.rating.toFixed(2) : '5.00'} ★</span>
                          <span>({o.broker?.review_count || 0} reviews)</span>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                        o.type === 'buy' ? 'bg-[#089981]/15 text-[#089981]' : 'bg-[#F23645]/15 text-[#F23645]'
                      }`}>
                        {o.broker?.role === 'broker' ? 'Broker' : 'Trader'} {o.type === 'buy' ? 'Buying' : 'Selling'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-b border-light-border/40 dark:border-[#2A2E39]/40 py-3">
                      <div>
                        <span className="text-[10px] text-light-secondary dark:text-[#8A91A5] uppercase">Available Amount</span>
                        <p className="text-sm font-extrabold text-light-primary dark:text-white font-mono">${o.amount.toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-light-secondary dark:text-[#8A91A5] uppercase">Limits</span>
                        <p className="text-xs text-light-primary dark:text-white font-mono">${o.min_limit} - ${o.max_limit}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-light-secondary dark:text-[#8A91A5]">
                        Payment: <span className="text-[#2962FF] font-bold">{o.payment_method}</span>
                      </span>
                      {user?.id !== o.broker_id && (
                        <button
                          onClick={() => setSelectedOffer(o)}
                          className="px-4 py-2 bg-[#2962FF] text-white font-bold rounded-lg text-xs hover:opacity-95"
                        >
                          Initiate Trade
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Active P2P Trades / History */}
        {activeTab === 'trades' && (
          <div className="space-y-4">
            <h3 className="font-extrabold text-sm mb-4 uppercase tracking-wider text-light-primary dark:text-white">Your active P2P transactions</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-light-border dark:border-[#2A2E39] text-light-secondary dark:text-[#8A91A5] uppercase font-bold text-[10px]">
                    <th className="p-3">Role</th>
                    <th className="p-3">Counterparty</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Escrow Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-light-border/40 dark:divide-dark-border/20">
                  {p2pTrades.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center p-8 text-light-secondary dark:text-[#8A91A5]">No transaction logs found.</td>
                    </tr>
                  ) : (
                    p2pTrades.map((t) => {
                      const isBuyOffer = t.p2p_offers?.type === 'buy';
                      const isBuyer = isBuyOffer ? (t.broker_id === user?.id) : (t.buyer_id === user?.id);
                      const isSeller = isBuyOffer ? (t.buyer_id === user?.id) : (t.broker_id === user?.id);
                      
                      const counterParty = isBuyer ? 
                        (isBuyOffer ? t.buyer?.username : t.broker?.username) : 
                        (isBuyOffer ? t.broker?.username : t.buyer?.username);

                      const sellerWallet = isBuyOffer ? realWallet : p2pWallet;
                      const isInsufficient = t.status === 'pending' && (sellerWallet ? (Number(sellerWallet.pending_balance) + Number(sellerWallet.balance)) < t.amount : true);

                      return (
                        <tr key={t.id} className="hover:bg-light-panel dark:hover:bg-dark-bg/25">
                          <td className="p-3 capitalize font-bold text-light-primary dark:text-white">{isBuyer ? 'buyer' : 'seller'}</td>
                          <td className="p-3 text-light-primary dark:text-[#D1D4DC]">{counterParty}</td>
                          <td className="p-3 font-mono font-bold text-[#089981]">${t.amount.toFixed(2)}</td>
                          <td className="p-3">
                            <div className="flex flex-col gap-1">
                              <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold self-start ${
                                t.status === 'pending' ? 'bg-[#2962FF]/10 text-[#2962FF]' : 
                                t.status === 'paid' ? 'bg-amber-500/10 text-amber-500' : 
                                t.status === 'completed' ? 'bg-[#089981]/10 text-[#089981]' : 'bg-[#F23645]/10 text-[#F23645]'
                              }`}>
                                {t.status}
                              </span>
                              {isInsufficient && (
                                <span className="text-[9px] text-[#F23645] font-bold block max-w-xs leading-normal">
                                  ⚠️ Insufficient Escrow Balance! Please request a manual top-up to proceed.
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-right space-x-2">
                            {/* Chat Button */}
                            <button
                              onClick={() => setSelectedChatTrade(t)}
                              className="px-3 py-1 bg-[#2962FF]/10 text-[#2962FF] font-bold rounded-lg text-[10px] hover:bg-[#2962FF]/20"
                            >
                              Open Chat
                            </button>

                            {/* Buyer Actions */}
                            {isBuyer && t.status === 'pending' && (
                              <button
                                onClick={() => handleMarkPaid(t.id)}
                                className="px-3 py-1 bg-brand-gold text-dark-bg font-extrabold rounded-lg text-[10px]"
                              >
                                I Have Paid
                              </button>
                            )}
                            
                            {/* Seller Actions */}
                            {isSeller && t.status === 'paid' && (
                              <button
                                onClick={() => handleReleaseEscrow(t.id)}
                                className="px-3 py-1 bg-[#089981] text-white font-bold rounded-lg text-[10px]"
                              >
                                Release Escrow
                              </button>
                            )}

                            {/* Rate Broker on completion */}
                            {user?.id === t.buyer_id && t.status === 'completed' && (
                              <button
                                onClick={() => setRatingTrade(t)}
                                className="px-3 py-1 bg-brand-gold text-dark-bg font-extrabold rounded-lg text-[10px]"
                              >
                                Rate Broker
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Broker panel / application console */}
        {activeTab === 'broker_panel' && (
          <div className="space-y-6">
            {(user?.role === 'broker' || (user?.role === 'trader' && (realWallet?.balance || 0) > 100)) ? (
              // Broker or Trader P2P Console
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Left side: Create Offer & P2P wallet transfer */}
                <div className="space-y-6">
                  
                  {/* Create offer form */}
                  <form onSubmit={handleCreateOffer} className="space-y-4 bg-light-panel dark:bg-dark-bg/30 p-5 rounded-2xl border border-light-border dark:border-[#2A2E39]">
                    <h4 className="font-extrabold text-xs uppercase text-light-primary dark:text-white mb-2">Create Marketplace Offer</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] text-light-secondary dark:text-[#8A91A5] uppercase mb-2">Type</label>
                        {user?.role === 'broker' ? (
                          <select
                            value={offerType}
                            onChange={(e) => setOfferType(e.target.value as any)}
                            className="w-full px-3 py-2 bg-white dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-xs text-light-primary dark:text-dark-primary"
                          >
                            <option value="sell">Sell (Liquidity Supply)</option>
                            <option value="buy">Buy (P2P Bid)</option>
                          </select>
                        ) : (
                          <select
                            disabled
                            value="sell"
                            className="w-full px-3 py-2 bg-light-panel dark:bg-dark-panel border border-light-border dark:border-dark-border rounded-xl text-xs text-light-secondary dark:text-dark-secondary cursor-not-allowed"
                          >
                            <option value="sell">Sell (Trader Sell Only)</option>
                          </select>
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] text-light-secondary dark:text-[#8A91A5] uppercase mb-2">Payment Method</label>
                        <input
                          type="text"
                          value={offerPayment}
                          onChange={(e) => setOfferPayment(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-[#111112] border border-light-border dark:border-[#2A2E39] rounded-xl text-xs text-light-primary dark:text-[#D1D4DC]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-light-secondary dark:text-[#8A91A5] uppercase mb-2">Total Amount (USD)</label>
                      <input
                        type="number"
                        value={offerAmount}
                        onChange={(e) => setOfferAmount(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-[#111112] border border-light-border dark:border-[#2A2E39] rounded-xl text-xs text-light-primary dark:text-[#D1D4DC] font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] text-light-secondary dark:text-[#8A91A5] uppercase mb-2">Min Limit</label>
                        <input
                          type="number"
                          value={minLimit}
                          onChange={(e) => setMinLimit(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-[#111112] border border-light-border dark:border-[#2A2E39] rounded-xl text-xs text-light-primary dark:text-[#D1D4DC] font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-light-secondary dark:text-[#8A91A5] uppercase mb-2">Max Limit</label>
                        <input
                          type="number"
                          value={maxLimit}
                          onChange={(e) => setMaxLimit(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-[#111112] border border-light-border dark:border-[#2A2E39] rounded-xl text-xs text-light-primary dark:text-[#D1D4DC] font-mono"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-3 bg-[#2962FF] text-white font-bold rounded-xl text-xs hover:opacity-95"
                    >
                      Post Marketplace Offer
                    </button>
                  </form>

                  {/* Transfer balance form */}
                  <form onSubmit={handleBrokerTransfer} className="space-y-4 bg-light-panel dark:bg-dark-bg/30 p-5 rounded-2xl border border-light-border dark:border-[#2A2E39]">
                    <h4 className="font-extrabold text-xs uppercase text-light-primary dark:text-white mb-2">Broker Wallet Transfer</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] text-light-secondary dark:text-[#8A91A5] uppercase mb-2">Transfer Direction</label>
                        <select
                          value={transferDirection}
                          onChange={(e) => setTransferDirection(e.target.value as any)}
                          className="w-full px-3 py-2 bg-white dark:bg-[#111112] border border-light-border dark:border-[#2A2E39] rounded-xl text-xs text-light-primary dark:text-[#D1D4DC]"
                        >
                          <option value="to_p2p">Trading → P2P Wallet</option>
                          <option value="to_trading">P2P Wallet → Trading</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-light-secondary dark:text-[#8A91A5] uppercase mb-2">Amount</label>
                        <input
                          type="number"
                          value={transferAmount}
                          onChange={(e) => setTransferAmount(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-[#111112] border border-light-border dark:border-[#2A2E39] rounded-xl text-xs text-light-primary dark:text-[#D1D4DC] font-mono"
                        />
                      </div>
                    </div>
                    <div className="flex justify-between text-[10px] text-light-secondary dark:text-[#8A91A5]">
                      <span>Trading Bal: ${realWallet ? Number(realWallet.balance).toFixed(2) : '0.00'}</span>
                      <span>P2P Bal: ${p2pWallet ? Number(p2pWallet.balance).toFixed(2) : '0.00'}</span>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-3 bg-brand-gold text-dark-bg font-extrabold rounded-xl text-xs hover:opacity-95"
                    >
                      Transfer Balances
                    </button>
                  </form>

                </div>

                {/* Right side: Your Listed Offers & Manual Top-up Trigger */}
                <div className="space-y-4">
                  {user?.role === 'broker' && (
                    <div className="p-5 bg-light-panel dark:bg-dark-bg/20 border border-light-border dark:border-[#2A2E39] rounded-2xl flex flex-col gap-3">
                      <h4 className="font-extrabold text-xs uppercase text-light-primary dark:text-white">Broker Top-Up Options</h4>
                      <p className="text-[10px] text-light-secondary dark:text-[#8A91A5]">
                        Need liquidity to fund your active P2P trade locks? Request a secure manual top-up here.
                      </p>
                      <button
                        onClick={() => setShowTopupModal(true)}
                        className="w-full py-2.5 bg-[#2962FF] text-white font-bold rounded-xl text-xs hover:opacity-95"
                      >
                        Request P2P Wallet Top-Up
                      </button>
                    </div>
                  )}

                  <h4 className="font-extrabold text-xs uppercase text-light-primary dark:text-white">Your Listed Offers</h4>
                  <div className="space-y-3">
                    {p2pOffers.filter(o => o.broker_id === user.id).length === 0 ? (
                      <p className="text-xs text-light-secondary dark:text-dark-secondary p-4 bg-light-panel dark:bg-dark-bg/20 rounded-xl">No active offers listed by you.</p>
                    ) : (
                      p2pOffers.filter(o => o.broker_id === user.id).map(o => {
                        const isEditing = editingOffer && editingOffer.id === o.id;
                        if (isEditing) {
                          return (
                            <form key={o.id} onSubmit={handleUpdateOfferSubmit} className="p-4 bg-light-panel dark:bg-[#1E222D] border border-[#2962FF]/50 rounded-xl space-y-3">
                              <div className="flex justify-between items-center pb-2 border-b border-light-border dark:border-[#2A2E39]">
                                <span className="text-[10px] font-extrabold text-[#2962FF] uppercase">Editing P2P Offer</span>
                                <button type="button" onClick={() => setEditingOffer(null)} className="text-xs text-light-secondary dark:text-dark-secondary hover:text-white">✕</button>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[9px] font-bold text-[#8A91A5] uppercase">Total Offer ($)</label>
                                  <input
                                    type="number"
                                    value={editAmount}
                                    onChange={(e) => setEditAmount(e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-light-bg dark:bg-[#111112] border border-light-border dark:border-[#2A2E39] rounded-lg text-xs font-bold text-light-primary dark:text-white"
                                    required
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] font-bold text-[#8A91A5] uppercase">Payment Method</label>
                                  <input
                                    type="text"
                                    value={editPaymentMethod}
                                    onChange={(e) => setEditPaymentMethod(e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-light-bg dark:bg-[#111112] border border-light-border dark:border-[#2A2E39] rounded-lg text-xs font-bold text-light-primary dark:text-white"
                                    required
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] font-bold text-[#8A91A5] uppercase">Min Limit ($)</label>
                                  <input
                                    type="number"
                                    value={editMinLimit}
                                    onChange={(e) => setEditMinLimit(e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-light-bg dark:bg-[#111112] border border-light-border dark:border-[#2A2E39] rounded-lg text-xs font-bold text-light-primary dark:text-white"
                                    required
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] font-bold text-[#8A91A5] uppercase">Max Limit ($)</label>
                                  <input
                                    type="number"
                                    value={editMaxLimit}
                                    onChange={(e) => setEditMaxLimit(e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-light-bg dark:bg-[#111112] border border-light-border dark:border-[#2A2E39] rounded-lg text-xs font-bold text-light-primary dark:text-white"
                                    required
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2 justify-end pt-1">
                                <button type="button" onClick={() => setEditingOffer(null)} className="px-3 py-1 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-[#2A2E39] text-light-secondary dark:text-dark-secondary rounded-lg text-[10px] font-bold">Cancel</button>
                                <button type="submit" className="px-3 py-1 bg-[#2962FF] text-white rounded-lg text-[10px] font-bold">Save</button>
                              </div>
                            </form>
                          );
                        }

                        return (
                          <div key={o.id} className="p-4 bg-light-panel dark:bg-dark-bg/20 border border-light-border dark:border-[#2A2E39] rounded-xl flex justify-between items-center">
                            <div>
                              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.25 rounded mr-2 ${o.type === 'sell' ? 'bg-[#F23645]/15 text-[#F23645]' : 'bg-[#089981]/15 text-[#089981]'}`}>
                                {o.type}
                              </span>
                              <span className="font-mono text-light-primary dark:text-white text-xs font-bold">${o.amount}</span>
                              <p className="text-[9px] text-light-secondary dark:text-[#8A91A5] mt-1">Limits: ${o.min_limit} - ${o.max_limit} | Payment: {o.payment_method}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEditOffer(o)}
                                className="px-2.5 py-1 bg-light-panel dark:bg-dark-bg border border-light-border dark:border-[#2A2E39] text-light-secondary dark:text-dark-secondary hover:text-light-primary dark:hover:text-white rounded-lg text-[10px] font-bold transition-all"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteOffer(o.id)}
                                className="px-2.5 py-1 bg-[#F23645]/10 hover:bg-[#F23645]/20 text-[#F23645] rounded-lg text-[10px] font-bold transition-all"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>
            ) : (
              // Broker application page
              <div className="max-w-xl mx-auto bg-light-panel dark:bg-dark-bg/30 p-8 rounded-3xl border border-light-border dark:border-[#2A2E39]">
                <h3 className="text-lg font-black text-light-primary dark:text-white mb-2">Liquidity Broker Application</h3>
                <p className="text-xs text-light-secondary dark:text-[#8A91A5] mb-6 leading-relaxed">
                  Apply to become an authorized liquidity provider on Xfx P2P. Brokers get a verified blue badge and receive 110% of their deposited capital directly into their P2P trading wallet.
                </p>

                {pendingApp ? (
                  <div className="p-4 bg-[#2962FF]/10 border border-[#2962FF]/30 rounded-2xl text-center">
                    <span className="font-bold text-xs text-[#2962FF]">Application Status: Pending Admin Review</span>
                    <p className="text-[10px] text-light-secondary dark:text-[#8A91A5] mt-2">Our risk officers are verifying your funding specifications.</p>
                  </div>
                ) : approvedApp ? (
                  <div className="p-6 bg-[#089981]/5 border border-[#089981]/20 rounded-3xl space-y-4">
                    <div className="text-center">
                      <span className="font-extrabold text-sm text-[#089981] block">Application Status: APPROVED!</span>
                      <p className="text-[11px] text-light-secondary dark:text-[#8A91A5] mt-1 leading-relaxed">
                        Your broker profile is authorized. Deposit your required capital of at least <span className="text-light-primary dark:text-white font-bold">${approvedApp.capital}</span> to activate your console and get 110% credited to your P2P balance.
                      </p>
                    </div>

                    <form onSubmit={handleBrokerDepositSubmit} className="space-y-4 text-left border-t border-light-border dark:border-[#2A2E39] pt-4">
                      <div>
                        <label className="block text-[10px] font-bold text-light-secondary dark:text-[#8A91A5] uppercase mb-1.5">Deposit Amount (USD)</label>
                        <input
                          type="number"
                          min={approvedApp.capital || 1000}
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          className="w-full px-3 py-2 bg-light-panel dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-xs focus:outline-none focus:border-[#2962FF] text-light-primary dark:text-white font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-light-secondary dark:text-[#8A91A5] uppercase mb-1.5">Select Payment Method</label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {['mpesa', 'paypal', 'stripe', 'crypto'].map((method) => (
                            <button
                              key={method}
                              type="button"
                              onClick={() => setDepositMethod(method as any)}
                              className={`py-2 rounded-xl text-[10px] font-bold border transition-all capitalize ${depositMethod === method
                                ? 'bg-[#2962FF] border-[#2962FF] text-white'
                                : 'bg-light-panel dark:bg-dark-panel border-light-border dark:border-dark-border text-light-secondary dark:text-dark-secondary'
                                }`}
                            >
                              {method === 'stripe' ? 'Card' : method === 'mpesa' ? 'M-Pesa' : method === 'paypal' ? 'PayPal' : 'Crypto'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {depositMethod === 'mpesa' && (
                        <div>
                          <label className="block text-[10px] font-bold text-light-secondary dark:text-[#8A91A5] uppercase mb-1.5">M-Pesa Phone Number</label>
                          <input
                            type="tel"
                            placeholder="07XXXXXXXX"
                            value={mpesaPhone}
                            onChange={(e) => setMpesaPhone(e.target.value)}
                            className="w-full px-3 py-2 bg-light-panel dark:bg-[#111112] border border-light-border dark:border-[#2A2E39] rounded-xl text-xs focus:outline-none focus:border-[#2962FF] text-light-primary dark:text-white"
                          />
                        </div>
                      )}

                      {depositMethod === 'stripe' && (
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-light-secondary dark:text-[#8A91A5] uppercase">Pay with Card</label>
                          <div className="p-3 bg-light-panel dark:bg-[#111112] border border-light-border dark:border-[#2A2E39] rounded-xl">
                            <div id="broker-stripe-card-element" className="min-h-[18px]" />
                          </div>
                        </div>
                      )}

                      {depositMethod === 'paypal' && (
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-light-secondary dark:text-[#8A91A5] uppercase">Pay with PayPal</label>
                          <div id="broker-paypal-button-container" className="p-2 bg-white rounded-xl border border-light-border dark:border-[#2A2E39] min-h-[45px] flex items-center justify-center" />
                        </div>
                      )}

                      {depositMethod === 'crypto' && (
                        <div className="space-y-3">
                          <div className="p-3 bg-light-panel dark:bg-[#111112] rounded-xl border border-light-border dark:border-[#2A2E39] text-[10px] leading-relaxed text-light-secondary dark:text-[#8A91A5]">
                            <span className="font-bold text-light-primary dark:text-white block mb-1">Crypto Deposit Addresses:</span>
                            {cryptoAddresses.btc && (
                              <div className="mb-1">BTC Address: <span className="font-mono text-[#2962FF] block select-all">{cryptoAddresses.btc}</span></div>
                            )}
                            {cryptoAddresses.usdt && (
                              <div className="mb-1">USDT (TRC20): <span className="font-mono text-[#2962FF] block select-all">{cryptoAddresses.usdt}</span></div>
                            )}
                            {cryptoAddresses.ltc && (
                              <div className="mb-1">LTC Address: <span className="font-mono text-[#2962FF] block select-all">{cryptoAddresses.ltc}</span></div>
                            )}
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-light-secondary dark:text-[#8A91A5] uppercase mb-1.5">Transaction Hash (TxID)</label>
                            <input
                              type="text"
                              placeholder="Enter txn hash"
                              value={cryptoTx}
                              onChange={(e) => setCryptoTx(e.target.value)}
                              className="w-full px-3 py-2 bg-light-panel dark:bg-[#111112] border border-light-border dark:border-[#2A2E39] rounded-xl text-xs focus:outline-none focus:border-[#2962FF] text-light-primary dark:text-white font-mono"
                            />
                          </div>
                        </div>
                      )}

                      {depositMethod !== 'paypal' && (
                        <button
                          type="submit"
                          disabled={stripeProcessing}
                          className="w-full py-3 bg-[#089981] hover:bg-[#089981]/90 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-[#089981]/10 disabled:opacity-50"
                        >
                          {stripeProcessing ? 'Processing Payment...' : depositMethod === 'stripe' ? 'Pay now with Card' : 'Proceed with Deposit'}
                        </button>
                      )}
                    </form>
                  </div>
                ) : (
                  <form onSubmit={handleApplyBroker} className="space-y-4">
                    <div>
                      <label className="block text-[10px] text-light-secondary dark:text-[#8A91A5] uppercase mb-2">Trading Capital Deposit (Min $1000)</label>
                      <input
                        type="number"
                        min="1000"
                        value={capital}
                        onChange={(e) => setCapital(e.target.value)}
                        className="w-full px-4 py-3 bg-white dark:bg-[#111112] border border-light-border dark:border-[#2A2E39] rounded-xl text-xs focus:outline-none focus:border-[#2962FF] text-light-primary dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-light-secondary dark:text-[#8A91A5] uppercase mb-2">Accepted Payment Platforms</label>
                      <input
                        type="text"
                        placeholder="M-Pesa, Bank Transfer, PayPal, Stripe"
                        value={paymentOptions}
                        onChange={(e) => setPaymentOptions(e.target.value)}
                        className="w-full px-4 py-3 bg-white dark:bg-[#111112] border border-light-border dark:border-[#2A2E39] rounded-xl text-xs focus:outline-none focus:border-[#2962FF] text-light-primary dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-light-secondary dark:text-[#8A91A5] uppercase mb-2">Broker Payment Address/Details</label>
                      <textarea
                        required
                        placeholder="Provide details on how buyers should pay you (e.g. M-Pesa Till, Bank Account Number)..."
                        rows={3}
                        value={paymentDetails}
                        onChange={(e) => setPaymentDetails(e.target.value)}
                        className="w-full px-4 py-3 bg-white dark:bg-[#111112] border border-light-border dark:border-[#2A2E39] rounded-xl text-xs focus:outline-none focus:border-[#2962FF] text-light-primary dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-light-secondary dark:text-[#8A91A5] uppercase mb-2">Additional Instructions</label>
                      <input
                        type="text"
                        placeholder="e.g. Please release payments within 15 minutes."
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        className="w-full px-4 py-3 bg-white dark:bg-[#111112] border border-light-border dark:border-[#2A2E39] rounded-xl text-xs focus:outline-none focus:border-[#2962FF] text-light-primary dark:text-white"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-3.5 bg-brand-gold text-dark-bg font-extrabold rounded-xl text-xs hover:opacity-95 shadow-lg shadow-brand-gold/15"
                    >
                      Submit Broker Application
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {/* 5. Initiate Trade Modal */}
      {selectedOffer && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm p-6 bg-white dark:bg-dark-panel border border-light-border dark:border-dark-border rounded-3xl shadow-2xl relative">
            <button onClick={() => setSelectedOffer(null)} className="absolute top-4 right-4 text-light-secondary dark:text-dark-secondary hover:text-white font-bold">✕</button>
            
            <h3 className="text-sm font-extrabold mb-2 text-light-primary dark:text-dark-primary uppercase tracking-wider">Buy Liquidity from {selectedOffer.broker?.username}</h3>
            <p className="text-[10px] text-light-secondary dark:text-dark-secondary mb-4">
              Enter amount to trade. Limit is ${selectedOffer.min_limit} - ${selectedOffer.max_limit}. Funds are locked in P2P Escrow.
            </p>

            <form onSubmit={handleInitiateTrade} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-light-secondary dark:text-dark-secondary uppercase mb-2">Trade Amount (USD)</label>
                <input
                  type="number"
                  min={selectedOffer.min_limit}
                  max={selectedOffer.max_limit}
                  required
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-light-panel dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-sm focus:outline-none focus:border-accent text-light-primary dark:text-dark-primary font-mono"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-accent text-white font-bold rounded-xl text-xs hover:opacity-95"
              >
                Initiate Secure Trade
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 6. Rating/Review Modal */}
      {ratingTrade && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm p-6 bg-white dark:bg-dark-panel border border-light-border dark:border-dark-border rounded-3xl shadow-2xl relative">
            <button onClick={() => setRatingTrade(null)} className="absolute top-4 right-4 text-light-secondary dark:text-dark-secondary hover:text-white font-bold">✕</button>
            
            <h3 className="text-sm font-extrabold mb-2 text-light-primary dark:text-dark-primary uppercase tracking-wider">Rate Broker</h3>
            <p className="text-[10px] text-light-secondary dark:text-dark-secondary mb-4">
              Leave a rating and review for your transaction with the broker.
            </p>

            <form onSubmit={handleSubmitRating} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-light-secondary dark:text-dark-secondary uppercase mb-2">Rating (1 to 5 Stars)</label>
                <select
                  value={ratingVal}
                  onChange={(e) => setRatingVal(parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-light-panel dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-xs text-light-primary dark:text-dark-primary"
                >
                  <option value={5}>★★★★★ (Excellent)</option>
                  <option value={4}>★★★★☆ (Good)</option>
                  <option value={3}>★★★☆☆ (Average)</option>
                  <option value={2}>★★☆☆☆ (Poor)</option>
                  <option value={1}>★☆☆☆☆ (Terrible)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-light-secondary dark:text-dark-secondary uppercase mb-2">Review / Feedback</label>
                <textarea
                  required
                  placeholder="Enter comments about this broker's service..."
                  rows={3}
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  className="w-full px-3 py-2 bg-light-panel dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-xs focus:outline-none focus:border-accent text-light-primary dark:text-dark-primary"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-accent text-white font-bold rounded-xl text-xs hover:opacity-95"
              >
                Submit Review
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 7. Broker Manual Top-up Modal */}
      {showTopupModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm p-6 bg-white dark:bg-dark-panel border border-light-border dark:border-dark-border rounded-3xl shadow-2xl relative">
            <button onClick={() => setShowTopupModal(false)} className="absolute top-4 right-4 text-light-secondary dark:text-[#8A91A5] hover:text-white font-bold">✕</button>
            
            <h3 className="text-sm font-extrabold mb-2 text-light-primary dark:text-white uppercase tracking-wider">Request Manual Top-Up</h3>
            <p className="text-[10px] text-light-secondary dark:text-[#8A91A5] mb-4">
              Submit your liquidity payment specifications. Our risk desk will approve and credit your P2P balance with a 110% multiplier.
            </p>

            <form onSubmit={handleBrokerTopup} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-light-secondary dark:text-[#8A91A5] uppercase mb-2">Deposit Amount (USD)</label>
                <input
                  type="number"
                  min="100"
                  required
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-light-panel dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-xs focus:outline-none focus:border-[#2962FF] text-light-primary dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-light-secondary dark:text-[#8A91A5] uppercase mb-2">Payment Platform Used</label>
                <select
                  value={topupMethod}
                  onChange={(e) => setTopupMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-light-panel dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-xs text-light-primary dark:text-white"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="M-Pesa">M-Pesa</option>
                  <option value="PayPal">PayPal</option>
                  <option value="Crypto Address">Crypto Address</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-light-secondary dark:text-[#8A91A5] uppercase mb-2">Transaction ID / Reference</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MPESA_TX_123 or Bank Receipt Ref..."
                  value={topupTx}
                  onChange={(e) => setTopupTx(e.target.value)}
                  className="w-full px-3 py-2 bg-light-panel dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-xs focus:outline-none focus:border-[#2962FF] text-light-primary dark:text-white"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-[#2962FF] text-white font-bold rounded-xl text-xs hover:opacity-95"
              >
                Submit Deposit proof
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 8. Escrow Trade Chat Modal */}
      {selectedChatTrade && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg h-[500px] bg-white dark:bg-dark-panel border border-light-border dark:border-dark-border rounded-3xl shadow-2xl relative flex flex-col overflow-hidden">
            
            {/* Chat Header */}
            <div className="px-6 py-4 border-b border-light-border dark:border-dark-border flex items-center justify-between bg-light-panel dark:bg-dark-panel">
              <div>
                <h3 className="text-xs font-extrabold text-light-primary dark:text-white uppercase tracking-wider">
                  Escrow Trade Chat Room
                </h3>
                <span className="text-[9px] font-mono text-light-secondary dark:text-[#8A91A5]">
                  Trade ID: {selectedChatTrade.id.slice(0, 8)}... | Escrow Locked: ${selectedChatTrade.amount}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {selectedChatTrade.status !== 'completed' && !selectedChatTrade.admin_involved && (
                  <button
                    onClick={() => handleDisputeTrade(selectedChatTrade.id)}
                    className="px-2.5 py-1.5 bg-[#F23645]/10 text-[#F23645] hover:bg-[#F23645]/20 font-bold rounded-lg text-[9px]"
                  >
                    Add Admin (Dispute)
                  </button>
                )}
                {selectedChatTrade.admin_involved && (
                  <span className="px-2.5 py-1 bg-[#F23645]/15 text-[#F23645] font-extrabold rounded text-[8px] animate-pulse">
                    Disputed: Admin Added
                  </span>
                )}
                <button 
                  onClick={() => setSelectedChatTrade(null)} 
                  className="text-light-secondary dark:text-[#8A91A5] hover:text-white font-bold text-sm"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Chat Messages Log */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-light-bg dark:bg-dark-bg">
              {chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-light-secondary dark:text-[#8A91A5] text-[10px] space-y-1">
                  <span>🔒 Escrow chat channel opened.</span>
                  <span>Both parties must communicate here. Payments should be handled externally.</span>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isMe = msg.sender_id === user?.id;
                  const isAdmin = msg.sender?.role === 'admin' || msg.sender?.username === 'admin';

                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <span className="text-[8px] text-light-secondary dark:text-[#8A91A5] mb-0.5 px-1 font-mono">
                        {msg.sender?.username} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div className={`px-3 py-2 rounded-2xl max-w-xs text-xs leading-normal font-sans ${
                        isAdmin 
                          ? 'bg-[#F23645]/15 text-[#F23645] border border-[#F23645]/30' 
                          : isMe 
                            ? 'bg-[#2962FF] text-white rounded-tr-none' 
                            : 'bg-light-panel dark:bg-dark-panel border border-light-border dark:border-dark-border text-light-primary dark:text-dark-primary rounded-tl-none'
                      }`}>
                        {msg.message}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Chat Input form */}
            <form onSubmit={handleSendChatMessage} className="p-4 border-t border-light-border dark:border-dark-border bg-light-panel dark:bg-dark-panel flex gap-3">
              <input
                type="text"
                placeholder="Type your message to counterparty..."
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-white dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-xs focus:outline-none focus:border-[#2962FF] text-light-primary dark:text-dark-primary"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-[#2962FF] text-white font-extrabold rounded-xl text-xs hover:opacity-95"
              >
                Send
              </button>
            </form>

          </div>
        </div>
      )}

      </div>
    </div>
  );
}
