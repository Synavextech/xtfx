import { create } from 'zustand';
import axios from 'axios';
import { showToast } from '../App';

// Setup base axios defaults
axios.defaults.withCredentials = true;

export const getDecimals = (symbol: string): number => {
  if (symbol.includes('PEPE')) return 8;
  if (symbol.includes('JPY')) return 3;
  if (symbol.includes('MXN') || symbol.includes('LEAD') || symbol.includes('XRP') || symbol.includes('DOGE')) return 4;
  if (symbol.includes('XAG') || symbol.includes('NAT_GAS') || symbol.includes('COPPER')) return 3;
  if (symbol.includes('EUR') || symbol.includes('GBP') || symbol.includes('CHF') || symbol.includes('CAD')) return 5;
  return 2;
};

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  email: string;
  phone: string;
  country: string;
  role: 'user' | 'trader' | 'broker' | 'admin';
  verified: boolean;
  rating: number;
  review_count: number;
  account_number?: string;
  referral_code?: string;
  referred_by?: string;
  referred_reward_claimed?: boolean;
}

export interface Wallet {
  id: string;
  type: 'real' | 'demo' | 'p2p';
  balance: number;
  pending_balance: number;
}

export interface Trade {
  id: string;
  wallet_id: string;
  asset: string;
  type: 'buy' | 'sell';
  quantity: number;
  entry_price: number;
  exit_price?: number | null;
  status: 'open' | 'closed';
  duration?: number | null;
  stop_loss?: number | null;
  take_profit?: number | null;
  profit_loss: number;
  livePrice?: number;
  pnl?: number;
  created_at: string;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface PriceTick {
  symbol: string;
  price: number;
  candle: Candle;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  message: string;
  created_at: string;
  sender?: { username: string; role?: string };
  recipient?: { username: string; role?: string };
}

export interface Insight {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

export interface P2POffer {
  id: string;
  broker_id: string;
  type: 'buy' | 'sell';
  amount: number;
  min_limit: number;
  max_limit: number;
  payment_method: string;
  status: string;
  broker?: { username: string; rating: number; review_count: number; verified: boolean; role?: string };
}

export interface P2PTrade {
  id: string;
  offer_id: string;
  buyer_id: string;
  broker_id: string;
  amount: number;
  status: 'pending' | 'paid' | 'completed' | 'cancelled' | 'disputed';
  payment_screenshot?: string;
  created_at: string;
  admin_involved?: boolean;
  broker?: { username: string };
  buyer?: { username: string };
  p2p_offers?: P2POffer;
}

interface TradeState {
  user: Profile | null;
  wallets: Wallet[];
  activeWalletType: 'real' | 'demo';
  activeAsset: string;
  activeMobileTab: 'quotes' | 'chart' | 'trades' | 'history' | 'insights' | 'chat';
  priceFeed: Record<string, { price: number; candleM1?: Candle; candleM5?: Candle; candle?: Candle }>;
  wsState: 'connected' | 'reconnecting' | 'disconnected';
  activeTrades: Trade[];
  tradeHistory: Trade[];
  chats: ChatMessage[];
  insights: Insight[];
  p2pOffers: P2POffer[];
  p2pTrades: P2PTrade[];
  brokerApplications: any[];
  unreadCount: number;
  tradeChats: ChatMessage[];
  adminUserTrades: any[];
  
  // Setters
  setUser: (user: Profile | null) => void;
  setWallets: (wallets: Wallet[]) => void;
  setActiveWalletType: (type: 'real' | 'demo') => void;
  setActiveAsset: (asset: string) => void;
  setActiveMobileTab: (tab: any) => void;
  
  // Handlers
  fetchUser: () => Promise<Profile | null>;
  logout: () => Promise<void>;
  connectWebSocket: () => void;
  fetchActiveTrades: () => Promise<void>;
  fetchTradeHistory: () => Promise<void>;
  fetchInsights: () => Promise<void>;
  fetchChats: () => Promise<void>;
  fetchP2pOffers: () => Promise<void>;
  fetchP2pTrades: () => Promise<void>;
  fetchBrokerStatus: () => Promise<void>;
  
  openPosition: (tradeParams: any) => Promise<boolean>;
  closePosition: (tradeId: string) => Promise<void>;
  closeAllPositions: () => Promise<void>;

  fetchUnreadCount: () => Promise<number>;
  markMessagesRead: (senderId?: string, tradeId?: string) => Promise<void>;
  fetchTradeChats: (tradeId: string) => Promise<void>;
  sendTradeMessage: (tradeId: string, message: string) => Promise<boolean>;
  addAdminToTradeChat: (tradeId: string) => Promise<boolean>;
  topupP2pWallet: (amount: number, paymentDetails?: any) => Promise<boolean>;
  fetchUserTradesAdmin: () => Promise<void>;
  reverseTransactionAdmin: (id: string, type: 'deposit' | 'withdrawal' | 'broker') => Promise<boolean>;
}

let ws: WebSocket | null = null;
let wsReconnectTimeout: any = null;

export const useTradeStore = create<TradeState>((set, get) => ({
  user: null,
  wallets: [],
  activeWalletType: 'demo',
  activeAsset: '1HZ100V',
  activeMobileTab: 'quotes',
  priceFeed: {},
  wsState: 'disconnected',
  activeTrades: [],
  tradeHistory: [],
  chats: [],
  insights: [],
  p2pOffers: [],
  p2pTrades: [],
  brokerApplications: [],
  unreadCount: 0,
  tradeChats: [],
  adminUserTrades: [],

  setUser: (user) => set({ user }),
  setWallets: (wallets) => set({ wallets }),
  setActiveWalletType: (activeWalletType) => set({ activeWalletType }),
  
  setActiveAsset: (activeAsset) => {
    set({ activeAsset });
    // Tell websocket we want to subscribe to new asset ticks
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: 'subscribe', asset: activeAsset }));
    }
  },

  setActiveMobileTab: (activeMobileTab) => set({ activeMobileTab }),

  fetchUser: async () => {
    try {
      const res = await axios.get('/api/auth/user');
      set({ user: res.data.user, wallets: res.data.wallets });
      return res.data.user;
    } catch (err) {
      set({ user: null, wallets: [] });
      return null;
    }
  },

  logout: async () => {
    try {
      await axios.post('/api/auth/logout');
      set({ user: null, wallets: [], activeTrades: [], tradeHistory: [] });
      if (wsReconnectTimeout) {
        clearTimeout(wsReconnectTimeout);
        wsReconnectTimeout = null;
      }
      if (ws) {
        try {
          ws.onopen = null;
          ws.onmessage = null;
          ws.onclose = null;
          ws.onerror = null;
          ws.close();
        } catch (e) {
          console.error('Error closing WebSocket on logout:', e);
        }
        ws = null;
      }
      set({ wsState: 'disconnected' });
      showToast('Logged out successfully', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Logout failed', 'error');
    }
  },

  connectWebSocket: () => {
    if (wsReconnectTimeout) {
      clearTimeout(wsReconnectTimeout);
      wsReconnectTimeout = null;
    }

    if (ws) {
      try {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.close();
      } catch (e) {
        console.error('Error closing old WebSocket:', e);
      }
      ws = null;
    }

    const loc = window.location;
    const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = import.meta.env.PROD 
      ? `${protocol}//${loc.host}/ws` 
      : `ws://localhost:5001`;

    console.log(`Connecting to WebSocket: ${wsUrl}`);
    set({ wsState: 'reconnecting' });

    const currentWs = new WebSocket(wsUrl);
    ws = currentWs;

    currentWs.onopen = () => {
      if (ws !== currentWs) return;
      console.log('WebSocket connected successfully');
      set({ wsState: 'connected' });
      if (wsReconnectTimeout) {
        clearTimeout(wsReconnectTimeout);
        wsReconnectTimeout = null;
      }

      // Subscribe to active asset ticks
      const activeAsset = get().activeAsset;
      currentWs.send(JSON.stringify({ action: 'subscribe', asset: activeAsset }));

      // Authenticate socket for user notifications
      const user = get().user;
      if (user) {
        currentWs.send(JSON.stringify({ action: 'auth', userId: user.id }));
      }
    };

    currentWs.onmessage = (event) => {
      if (ws !== currentWs) return;
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'tick') {
          // Update live price feed
          set((state) => {
            const feed = { ...state.priceFeed };
            feed[data.symbol] = {
              price: data.price,
              candle: data.candleM5,
              candleM1: data.candleM1,
              candleM5: data.candleM5
            };
            
            // Update active trade values locally in memory for low latency UI
            const updatedActive = state.activeTrades.map(t => {
              if (t.asset === data.symbol) {
                const diff = data.price - t.entry_price;
                const pnl = Number((t.type === 'buy' ? diff * t.quantity : -diff * t.quantity).toFixed(2));
                return { ...t, livePrice: data.price, pnl };
              }
              return t;
            });

            return { priceFeed: feed, activeTrades: updatedActive };
          });
        } 
        
        else if (data.type === 'trade_closed') {
          // Update wallet balance immediately and remove trade
          set((state) => {
            const updatedWallets = state.wallets.map(w => {
              if (w.id === data.walletId || w.type === (state.activeWalletType)) {
                return { ...w, balance: data.newBalance };
              }
              return w;
            });
            const filteredActive = state.activeTrades.filter(t => t.id !== data.tradeId);
            return { wallets: updatedWallets, activeTrades: filteredActive };
          });

          const profitStr = data.pnl >= 0 ? `+$${data.pnl}` : `-$${Math.abs(data.pnl)}`;
          showToast(`Trade closed on ${data.asset}! Profit/Loss: ${profitStr}`, data.pnl >= 0 ? 'success' : 'error');
          get().fetchTradeHistory();
        }
        else if (data.type === 'p2p_trade_paid') {
          showToast(`P2P Trade has been marked as PAID by buyer.`, 'info');
          get().fetchP2pTrades();
        }
        else if (data.type === 'p2p_trade_completed') {
          showToast(`P2P Trade successfully completed! Escrow released.`, 'success');
          get().fetchP2pTrades();
          get().fetchUser();
        }
      } catch (err) {
        console.error('Error handling WS message:', err);
      }
    };

    currentWs.onclose = () => {
      if (ws !== currentWs) return;
      console.log('WebSocket disconnected. Reconnecting...');
      set({ wsState: 'reconnecting' });
      
      if (wsReconnectTimeout) {
        clearTimeout(wsReconnectTimeout);
      }
      
      // Auto reconnect every 3 seconds
      wsReconnectTimeout = setTimeout(() => {
        get().connectWebSocket();
      }, 3000);
    };

    currentWs.onerror = (err) => {
      if (ws !== currentWs) return;
      console.error('WebSocket encountered an error', err);
      set({ wsState: 'disconnected' });
      currentWs.close();
    };
  },

  fetchActiveTrades: async () => {
    try {
      const res = await axios.get('/api/trades/active');
      set({ activeTrades: res.data });
    } catch (err) {
      console.error('Failed to fetch active trades', err);
    }
  },

  fetchTradeHistory: async () => {
    try {
      const res = await axios.get('/api/trades/history');
      set({ tradeHistory: res.data });
    } catch (err) {
      console.error('Failed to fetch trade history', err);
    }
  },

  fetchInsights: async () => {
    try {
      const res = await axios.get('/api/insights');
      set({ insights: res.data });
    } catch (err) {
      console.error('Failed to fetch insights', err);
    }
  },

  fetchChats: async () => {
    try {
      const res = await axios.get('/api/chats');
      set({ chats: res.data });
    } catch (err) {
      console.error('Failed to fetch chats', err);
    }
  },

  fetchP2pOffers: async () => {
    try {
      const res = await axios.get('/api/p2p/offers');
      set({ p2pOffers: res.data });
    } catch (err) {
      console.error('Failed to fetch P2P offers', err);
    }
  },

  fetchP2pTrades: async () => {
    try {
      const res = await axios.get('/api/p2p/trades');
      set({ p2pTrades: res.data });
    } catch (err) {
      console.error('Failed to fetch P2P trades', err);
    }
  },

  fetchBrokerStatus: async () => {
    try {
      const res = await axios.get('/api/p2p/broker/status');
      set({ brokerApplications: res.data });
    } catch (err) {
      console.error('Failed to fetch broker applications status', err);
    }
  },

  openPosition: async (params) => {
    try {
      const res = await axios.post('/api/trades/open', params);
      if (res.data.success) {
        showToast('Trade opened successfully!', 'success');
        get().fetchActiveTrades();
        return true;
      }
      return false;
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to place trade', 'error');
      return false;
    }
  },

  closePosition: async (tradeId) => {
    try {
      const res = await axios.post('/api/trades/close', { tradeId });
      if (res.data.success) {
        // Handled also by websocket, but update here just in case
        set((state) => ({
          activeTrades: state.activeTrades.filter(t => t.id !== tradeId)
        }));
        get().fetchUser(); // refresh balance
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to close position', 'error');
    }
  },

  closeAllPositions: async () => {
    const active = get().activeTrades;
    if (active.length === 0) return;
    
    try {
      const ids = active.map(t => t.id);
      const res = await axios.post('/api/trades/close-multiple', { tradeIds: ids });
      if (res.data) {
        showToast('All trades closed', 'info');
        get().fetchActiveTrades();
        get().fetchUser();
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to close positions', 'error');
    }
  },

  fetchUnreadCount: async () => {
    try {
      const res = await axios.get('/api/chats/unread-count');
      set({ unreadCount: res.data.count });
      return res.data.count;
    } catch (err) {
      console.error('Failed to fetch unread count', err);
      return 0;
    }
  },

  markMessagesRead: async (senderId, tradeId) => {
    try {
      await axios.post('/api/chats/read', { senderId, tradeId });
      get().fetchUnreadCount();
    } catch (err) {
      console.error('Failed to mark messages as read', err);
    }
  },

  fetchTradeChats: async (tradeId) => {
    try {
      const res = await axios.get(`/api/chats/trade/${tradeId}`);
      set({ tradeChats: res.data });
    } catch (err) {
      console.error('Failed to fetch trade chats', err);
    }
  },

  sendTradeMessage: async (tradeId, message) => {
    try {
      const res = await axios.post(`/api/chats/trade/${tradeId}`, { message });
      if (res.data.success) {
        set((state) => ({
          tradeChats: [...state.tradeChats, res.data.chat]
        }));
        return true;
      }
      return false;
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to send trade message', 'error');
      return false;
    }
  },

  addAdminToTradeChat: async (tradeId) => {
    try {
      const res = await axios.post(`/api/p2p/trades/${tradeId}/add-admin`);
      if (res.data.success) {
        showToast('Admin added to trade chat for dispute resolution.', 'success');
        get().fetchTradeChats(tradeId);
        return true;
      }
      return false;
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to add admin', 'error');
      return false;
    }
  },

  topupP2pWallet: async (amount, paymentDetails) => {
    try {
      const res = await axios.post('/api/p2p/broker/topup', { amount, paymentDetails });
      if (res.data.success) {
        showToast('P2P wallet top-up request submitted successfully!', 'success');
        return true;
      }
      return false;
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Top-up request failed', 'error');
      return false;
    }
  },

  fetchUserTradesAdmin: async () => {
    try {
      const res = await axios.get('/api/admin/trades');
      set({ adminUserTrades: res.data });
    } catch (err) {
      console.error('Failed to fetch user trades for admin', err);
    }
  },

  reverseTransactionAdmin: async (id, type) => {
    try {
      const res = await axios.post('/api/admin/transactions/reverse', { id, type });
      if (res.data.success) {
        showToast('Transaction reversed successfully!', 'success');
        return true;
      }
      return false;
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to reverse transaction', 'error');
      return false;
    }
  }
}));
