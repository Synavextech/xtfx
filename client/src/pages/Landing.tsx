import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTradeStore, getDecimals } from '../store/useTradeStore';
import { showToast } from '../App';
import Footer from '../components/Footer';
import {
  TrendingUp,
  TrendingDown,
  Coins,
  Activity,
  ShieldAlert,
  ArrowRight,
  Sun,
  Moon,
  Globe,
  Lock,
  Zap,
  Layers,
  BadgeCheck
} from 'lucide-react';

// Sub-component: Lightweight real-time TSLA Canvas Candlestick Chart
function TSLAPreviewChart({ theme, tickHandlerRef }: { theme: 'dark' | 'light'; tickHandlerRef: React.MutableRefObject<((data: any) => void) | null> }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [candles, setCandles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const colors = {
    dark: {
      bg: '#111112',
      grid: '#2A2E39',
      text: '#8A91A5',
      bull: '#089981',
      bear: '#F23645',
      line: '#2962FF'
    },
    light: {
      bg: '#FFFFFF',
      grid: '#E0E3EB',
      text: '#787B86',
      bull: '#089981',
      bear: '#F23645',
      line: '#2962FF'
    }
  };
  const activeColors = theme === 'dark' ? colors.dark : colors.light;

  useEffect(() => {
    setLoading(true);
    axios.get('/api/market/candles?symbol=TSLA')
      .then(res => {
        setCandles(res.data.slice(-70)); // display last 70 candles
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load TSLA candles:', err);
        setLoading(false);
      });

    tickHandlerRef.current = (tick: any) => {
      setCandles(prev => {
        if (prev.length === 0) return prev;
        const updated = [...prev];
        const last = updated[updated.length - 1];
        const tickTime = tick.candle.time;

        if (last.time === tickTime) {
          updated[updated.length - 1] = {
            ...last,
            close: tick.price,
            high: Math.max(last.high, tick.price),
            low: Math.min(last.low, tick.price)
          };
        } else if (tickTime > last.time) {
          updated.push({
            time: tickTime,
            open: last.close,
            high: Math.max(last.close, tick.price),
            low: Math.min(last.close, tick.price),
            close: tick.price
          });
          if (updated.length > 150) updated.shift();
        }
        return updated;
      });
    };

    return () => {
      tickHandlerRef.current = null;
    };
  }, [tickHandlerRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || candles.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    ctx.fillStyle = activeColors.bg;
    ctx.fillRect(0, 0, width, height);

    const candleWidth = 6;
    const candleGap = 3;
    const totalCandleWidth = candleWidth + candleGap;
    const rightMargin = 55;
    const chartWidth = width - rightMargin;

    ctx.lineWidth = 1;
    ctx.strokeStyle = activeColors.grid;
    ctx.fillStyle = activeColors.text;
    ctx.font = '9px monospace';

    const gridRows = 5;
    const rowHeight = height / gridRows;

    const maxVisibleCandles = Math.ceil(chartWidth / totalCandleWidth);
    const visibleCandles = candles.slice(-maxVisibleCandles);

    if (visibleCandles.length === 0) return;

    let minPrice = Math.min(...visibleCandles.map(c => c.low));
    let maxPrice = Math.max(...visibleCandles.map(c => c.high));
    const priceDiff = maxPrice - minPrice || 1.0;
    maxPrice += priceDiff * 0.12;
    minPrice -= priceDiff * 0.12;

    const getPriceY = (price: number) => {
      return height - ((price - minPrice) / (maxPrice - minPrice)) * height;
    };

    const getPriceFromY = (y: number) => {
      return maxPrice - (y / height) * (maxPrice - minPrice);
    };

    for (let i = 1; i < gridRows; i++) {
      const y = i * rowHeight;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();

      const price = getPriceFromY(y);
      ctx.fillText(price.toFixed(2), chartWidth + 5, y + 3);
    }

    visibleCandles.forEach((candle, index) => {
      const x = chartWidth - (visibleCandles.length - index) * totalCandleWidth;
      if (x < 0) return;

      const isBullish = candle.close >= candle.open;
      ctx.strokeStyle = isBullish ? activeColors.bull : activeColors.bear;
      ctx.fillStyle = isBullish ? activeColors.bull : activeColors.bear;

      ctx.beginPath();
      ctx.moveTo(x + candleWidth / 2, getPriceY(candle.high));
      ctx.lineTo(x + candleWidth / 2, getPriceY(candle.low));
      ctx.stroke();

      const openY = getPriceY(candle.open);
      const closeY = getPriceY(candle.close);
      const bodyHeight = Math.max(1, Math.abs(openY - closeY));
      ctx.fillRect(x, Math.min(openY, closeY), candleWidth, bodyHeight);
    });

    const lastCandle = candles[candles.length - 1];
    const livePrice = lastCandle.close;
    const liveY = getPriceY(livePrice);

    ctx.strokeStyle = activeColors.line;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(0, liveY);
    ctx.lineTo(chartWidth, liveY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = activeColors.line;
    ctx.fillRect(chartWidth + 2, liveY - 8, rightMargin - 4, 16);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(livePrice.toFixed(2), chartWidth + 6, liveY + 4);

  }, [candles, activeColors]);

  return (
    <div className="w-full h-full relative font-sans">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#111112]/40 backdrop-blur-xs">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}

export default function Landing({ toggleTheme, theme }: { toggleTheme: () => void; theme: 'dark' | 'light' }) {
  const navigate = useNavigate();
  const { user } = useTradeStore();

  const [tradersCount, setTradersCount] = useState(498920);
  const [volumeCount, setVolumeCount] = useState(9984143);
  const [activeStep, setActiveStep] = useState(0);
  const [liveTrades, setLiveTrades] = useState<any[]>([]);

  // Simulation of other traders' live activity feed
  useEffect(() => {
    const assets = ['1HZ100V', 'BTC/USD', 'EUR/USD', 'TSLA', 'XAU/USD', 'GBP/USD', 'USD/JPY', 'SOL/USD', 'WTI', 'NVDA', 'PEPE/USD'];
    const usernames = ['trader_849', 'crypto_max', 'synthetics_pro', 'gold_miner', 'fx_scalper', 'bull_runner', 'extreme_venturer', 'whale_watcher'];

    const generateRandomTrade = () => {
      const isProfit = Math.random() > 0.35;
      const pnlAmount = isProfit ? (Math.random() * 250 + 10) : -(Math.random() * 120 + 5);
      return {
        id: Math.random().toString(36).substring(2, 9),
        username: usernames[Math.floor(Math.random() * usernames.length)],
        asset: assets[Math.floor(Math.random() * assets.length)],
        type: Math.random() > 0.5 ? 'BUY' : 'SELL',
        pnl: parseFloat(pnlAmount.toFixed(2)),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
    };

    setLiveTrades(Array.from({ length: 6 }, () => generateRandomTrade()));

    const interval = setInterval(() => {
      setLiveTrades(prev => [generateRandomTrade(), ...prev.slice(0, 5)]);
    }, 2800);

    return () => clearInterval(interval);
  }, []);

  // Ticker items dynamic state
  const [tickerItems, setTickerItems] = useState([
    { symbol: 'EUR/USD', price: '1.08500', change: '+0.00%', isUp: true, logo: '€', color: 'bg-blue-600' },
    { symbol: 'GBP/USD', price: '1.27200', change: '+0.00%', isUp: true, logo: '£', color: 'bg-teal-600' },
    { symbol: 'USD/JPY', price: '157.500', change: '+0.00%', isUp: true, logo: '¥', color: 'bg-rose-600' },
    { symbol: 'XAU/USD', price: '2330.00', change: '+0.00%', isUp: true, logo: 'Au', color: 'bg-yellow-600' },
    { symbol: 'WTI', price: '78.50', change: '+0.00%', isUp: true, logo: 'Oil', color: 'bg-zinc-700' },
    { symbol: 'BTC/USD', price: '67500.00', change: '+0.00%', isUp: true, logo: '₿', color: 'bg-orange-500' },
    { symbol: 'ETH/USD', price: '3500.00', change: '+0.00%', isUp: true, logo: 'Ξ', color: 'bg-purple-600' },
    { symbol: 'SOL/USD', price: '145.00', change: '+0.00%', isUp: true, logo: 'S', color: 'bg-indigo-600' },
    { symbol: 'PEPE/USD', price: '0.00000950', change: '+0.00%', isUp: true, logo: 'P', color: 'bg-emerald-600' },
    { symbol: 'TSLA', price: '178.20', change: '+0.00%', isUp: true, logo: 'T', color: 'bg-red-600' },
    { symbol: 'NVDA', price: '125.40', change: '+0.00%', isUp: true, logo: 'N', color: 'bg-green-600' },
    { symbol: '1HZ100V', price: '250.00', change: '+0.00%', isUp: true, logo: '⚡', color: 'bg-amber-500' }
  ]);

  const tslaTickHandlerRef = useRef<((data: any) => void) | null>(null);

  // Local WebSockets connection for live price tickers & TSLA chart
  useEffect(() => {
    const loc = window.location;
    const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = import.meta.env.PROD
      ? `${protocol}//${loc.host}/ws`
      : `ws://localhost:5001`;

    let localWs: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connect = () => {
      localWs = new WebSocket(wsUrl);

      localWs.onopen = () => {
        const assets = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'XAU/USD', 'WTI', 'BTC/USD', 'ETH/USD', 'SOL/USD', 'PEPE/USD', 'TSLA', 'NVDA', '1HZ100V'];
        assets.forEach(asset => {
          localWs?.send(JSON.stringify({ action: 'subscribe', asset }));
        });
      };

      localWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'tick') {
            setTickerItems(prev => prev.map(item => {
              if (item.symbol === data.symbol) {
                const prevPrice = parseFloat(item.price);
                const currentPrice = data.price;
                const diff = currentPrice - prevPrice;
                const pctChange = prevPrice > 0 ? ((diff / prevPrice) * 100).toFixed(2) : '0.00';
                const sign = diff >= 0 ? '+' : '';
                return {
                  ...item,
                  price: currentPrice.toFixed(getDecimals(data.symbol)),
                  change: `${sign}${pctChange}%`,
                  isUp: diff >= 0
                };
              }
              return item;
            }));

            if (data.symbol === 'TSLA' && tslaTickHandlerRef.current) {
              tslaTickHandlerRef.current(data);
            }
          }
        } catch (err) {
          // ignore parsing error
        }
      };

      localWs.onclose = () => {
        reconnectTimeout = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      if (localWs) {
        localWs.onclose = null;
        localWs.close();
      }
      clearTimeout(reconnectTimeout);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTradersCount((prev) => prev + Math.floor(Math.random() * 3) + 1);
      setVolumeCount((prev) => prev + Math.floor(Math.random() * 15) + 3);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleDemoAccess = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      showToast('Redirecting to secure login...', 'info');
      navigate('/auth');
    }
  };

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg text-light-primary dark:text-dark-primary transition-colors duration-200 select-none">

      {/* 1. Hero Section with video background */}
      <header className="relative w-full min-h-[95vh] flex flex-col justify-between overflow-hidden">

        {/* Background Video loop using hero.webm */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0 opacity-40 dark:opacity-55 filter brightness-[0.55]"
        >
          <source src="/images/hero.webm" type="video/webm" />
        </video>

        {/* Overlay Dark/Light Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-light-bg dark:from-dark-bg via-transparent to-black/30 z-10" />

        {/* Navbar */}
        <nav className="relative z-30 w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center font-black text-white text-base shadow-lg shadow-accent/20">
              E
            </div>
            <span className="font-extrabold text-lg tracking-wider text-light-primary dark:text-white flex items-center gap-1.5">
              ExtFx <span className="text-accent">TRADER</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-light-panel dark:bg-dark-panel border border-light-border dark:border-dark-border text-light-secondary dark:text-dark-secondary hover:text-accent dark:hover:text-white transition-all flex items-center gap-2 text-xs font-semibold"
              title="Toggle Dark/Light Mode"
            >
              {theme === 'dark' ? (
                <>
                  <Sun size={14} className="text-brand-gold" />
                  <span>Light</span>
                </>
              ) : (
                <>
                  <Moon size={14} className="text-accent" />
                  <span>Dark</span>
                </>
              )}
            </button>

            <button
              onClick={() => navigate('/auth')}
              className="px-4 py-2.5 bg-accent hover:bg-accent/90 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-accent/20 transition-all active:scale-95 flex items-center gap-1"
            >
              <span>Start Trading</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </nav>

        {/* Hero Copy */}

        {/* SCROLLING ASSET TICKER */}
        <div className="w-full bg-[#111622] py-3.5 border-t border-b border-dark-border/80 overflow-hidden relative">
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-dark-bg to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-dark-bg to-transparent z-10 pointer-events-none" />
          <div className="relative max-w-full overflow-hidden flex items-center">
            <div className="animate-marquee whitespace-nowrap flex gap-8">
              {tickerItems.map((item, idx) => (
                <div key={idx} className="inline-flex items-center gap-3 font-mono bg-[#1E222D]/60 border border-[#2A2E39]/40 px-3.5 py-1.5 rounded-full">
                  {/* Symbol Logo */}
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-md ${item.color}`}>
                    {item.logo}
                  </span>
                  <span className="text-xs font-bold text-white">{item.symbol}</span>
                  <span className="text-xs text-gray-300">{item.price}</span>
                  <span className={`text-[10px] font-extrabold flex items-center gap-0.5 ${item.isUp ? 'text-[#089981]' : 'text-[#F23645]'}`}>
                    {item.isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {item.change}
                  </span>
                </div>
              ))}
              {/* Duplicate for seamless scrolling */}
              {tickerItems.map((item, idx) => (
                <div key={`dup-${idx}`} className="inline-flex items-center gap-3 font-mono bg-[#1E222D]/60 border border-[#2A2E39]/40 px-3.5 py-1.5 rounded-full">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-md ${item.color}`}>
                    {item.logo}
                  </span>
                  <span className="text-xs font-bold text-white">{item.symbol}</span>
                  <span className="text-xs text-gray-300">{item.price}</span>
                  <span className={`text-[10px] font-extrabold flex items-center gap-0.5 ${item.isUp ? 'text-[#089981]' : 'text-[#F23645]'}`}>
                    {item.isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {item.change}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-20 flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto px-6 text-center gap-6 py-12">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-accent/10 border border-accent/30 text-accent text-[10px] font-bold tracking-widest uppercase rounded-full">
            <Zap size={10} className="animate-pulse" />
            <span>Extreme Ambition • Extreme Profits</span>
          </div>

          <h1 className="text-4xl sm:text-7xl font-black tracking-tight text-light-primary dark:text-white leading-tight uppercase">
            ExtFx - ExtremeFxTrader;<br />
            FOR BOLD <span className="text-accent underline decoration-wavy decoration-accent/60">VENTURES</span>
          </h1>

          <p className="text-xs sm:text-sm text-light-secondary dark:text-dark-secondary max-w-xl leading-relaxed font-medium">
            Make every investment count - make every investment produce extreme profits for we are the extreme traders, with extreme ambition and extreme anger for success.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mt-2 w-full justify-center max-w-md">
            <button
              onClick={handleDemoAccess}
              className="px-6 py-3.5 bg-accent hover:bg-accent/95 text-white font-bold text-xs rounded-xl shadow-xl shadow-accent/25 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Lock size={12} />
              <span>Access Demo Wallet</span>
            </button>
            <button
              onClick={() => navigate('/auth')}
              className="px-6 py-3.5 bg-light-panel dark:bg-dark-panel border border-light-border dark:border-dark-border text-light-primary dark:text-white font-bold text-xs rounded-xl hover:bg-light-border/40 dark:hover:bg-dark-border/40 transition-all"
            >
              Login/Register Account
            </button>
          </div>
        </div>

        {/* Live Counters */}
        <div className="relative z-20 w-full max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-4 py-8 border-t border-light-border dark:border-dark-border/30">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-lg bg-accent/10 text-accent mt-0.5">
              <Globe size={16} />
            </div>
            <div>
              <span className="text-[10px] text-light-secondary dark:text-dark-secondary uppercase font-bold tracking-wider">Active Traders</span>
              <p className="text-xl font-bold font-mono mt-0.5 text-light-primary dark:text-white">{tradersCount.toLocaleString()}+</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-lg bg-accent/10 text-accent mt-0.5">
              <Coins size={16} />
            </div>
            <div>
              <span className="text-[10px] text-light-secondary dark:text-dark-secondary uppercase font-bold tracking-wider">24h Vol (USD)</span>
              <p className="text-xl font-bold font-mono mt-0.5 text-light-primary dark:text-white">${volumeCount.toLocaleString()}+</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-lg bg-[#089981]/10 text-[#089981] mt-0.5">
              <Activity size={16} />
            </div>
            <div>
              <span className="text-[10px] text-light-secondary dark:text-dark-secondary uppercase font-bold tracking-wider">Execution Speed</span>
              <p className="text-xl font-bold font-mono mt-0.5 text-[#089981]">~ 4.2ms</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-lg bg-accent/10 text-accent mt-0.5">
              <Layers size={16} />
            </div>
            <div>
              <span className="text-[10px] text-light-secondary dark:text-dark-secondary uppercase font-bold tracking-wider">Leverage Offered</span>
              <p className="text-xl font-bold font-mono mt-0.5 text-light-primary dark:text-white">Up to 1:100</p>
            </div>
          </div>
        </div>

      </header>

      {/* 2. Platform Preview & Live Trades Dual-Pane Layout */}
      <section className="max-w-7xl mx-auto px-6 py-12 border-t border-light-border/40 dark:border-[#2A2E39]/30">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left/Middle Pane: TSLA Live Market Chart (2 columns on large screens) */}
          <div className="lg:col-span-2 p-6 bg-light-panel dark:bg-[#1E222D] border border-light-border dark:border-[#2A2E39] rounded-3xl shadow-xl flex flex-col h-[480px]">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-red-600/10 text-red-600 flex items-center justify-center font-extrabold text-sm shadow-sm">T</span>
                <div className="text-left">
                  <h3 className="text-sm font-black text-light-primary dark:text-white uppercase tracking-wider">Tesla, Inc. (TSLA)</h3>
                  <p className="text-[10px] text-light-secondary dark:text-[#8A91A5] font-semibold">Real-Time Canvas Chart • 5m Interval</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-[#089981]/10 text-[#089981] rounded-full text-[9px] font-extrabold tracking-widest uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-[#089981] animate-ping" />
                <span>Live Feed</span>
              </div>
            </div>

            <div className="flex-1 w-full overflow-hidden relative bg-white dark:bg-[#111112] rounded-2xl border border-light-border/60 dark:border-[#2A2E39]/50 p-2">
              <TSLAPreviewChart theme={theme} tickHandlerRef={tslaTickHandlerRef} />
            </div>
          </div>

          {/* Right Pane: Live Trades Feed (1 column) */}
          <div className="p-6 bg-light-panel dark:bg-[#1E222D] border border-light-border dark:border-[#2A2E39] rounded-3xl shadow-xl flex flex-col h-[480px]">
            <div className="flex items-center justify-between mb-4 shrink-0 text-left">
              <div>
                <h3 className="text-sm font-black text-light-primary dark:text-white uppercase tracking-wider">Live Platform Activity</h3>
                <p className="text-[10px] text-light-secondary dark:text-[#8A91A5] font-semibold">Global Order Executions</p>
              </div>
              <div className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
            </div>

            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 scrollbar-thin">
              {liveTrades.map((trade) => (
                <div
                  key={trade.id}
                  className="p-3 bg-white dark:bg-[#111112] border border-light-border/60 dark:border-[#2A2E39]/50 rounded-2xl flex items-center justify-between font-mono transition-all duration-350 hover:border-accent/40"
                >
                  <div className="flex flex-col gap-0.5 text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-light-primary dark:text-white">{trade.username}</span>
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider ${trade.type === 'BUY' ? 'bg-[#089981]/15 text-[#089981]' : 'bg-[#F23645]/15 text-[#F23645]'}`}>
                        {trade.type}
                      </span>
                    </div>
                    <span className="text-[10px] text-light-secondary dark:text-[#8A91A5] font-bold uppercase">{trade.asset}</span>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-black tracking-tight ${trade.pnl >= 0 ? 'text-[#089981]' : 'text-[#F23645]'}`}>
                      {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                    </span>
                    <p className="text-[8px] text-light-secondary dark:text-[#8A91A5]/60 mt-0.5">{trade.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* 3. Three steps to your first trade timeline */}
      <section className="max-w-7xl mx-auto px-6 py-16 border-t border-light-border/40 dark:border-[#2A2E39]/30">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-4xl font-black text-light-primary dark:text-white uppercase tracking-tight leading-tight">
            Three Steps To Your <span className="text-accent">First Trade</span>
          </h2>
          <p className="text-xs sm:text-sm text-light-secondary dark:text-[#8A91A5] mt-2">
            Get started on ExtFx - ExtremeFxTrader in minutes and unlock professional broker and high-frequency trading capabilities.
          </p>
        </div>

        {/* Step Cards Selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[
            {
              step: 0,
              title: "Create Account",
              summary: "Register in under 2 minutes. Open a secure profile and verify your details."
            },
            {
              step: 1,
              title: "Deposit Capital",
              summary: "Top up securely via Stripe Card, PayPal, M-Pesa STK, or manual Crypto."
            },
            {
              step: 2,
              title: "Trade & Earn",
              summary: "Execute real-time trades with 4.2ms speeds or list P2P broker offers."
            }
          ].map((item) => (
            <button
              key={item.step}
              onClick={() => setActiveStep(item.step)}
              className={`p-6 text-left rounded-3xl border transition-all duration-200 relative overflow-hidden flex flex-col justify-between h-[160px] ${activeStep === item.step
                ? 'bg-accent/5 border-accent shadow-md shadow-accent/5'
                : 'bg-light-panel dark:bg-[#1E222D] border-light-border dark:border-[#2A2E39] hover:bg-light-border/30 dark:hover:bg-[#2A2E39]/30'
                }`}
            >
              <div>
                <h4 className="text-xs font-black uppercase text-light-primary dark:text-white tracking-wider mb-1">{item.title}</h4>
                <p className="text-[11px] text-light-secondary dark:text-[#8A91A5] leading-relaxed">{item.summary}</p>
              </div>
              {activeStep === item.step && (
                <div className="absolute right-0 top-0 w-1.5 h-full bg-accent" />
              )}
            </button>
          ))}
        </div>

        {/* Interactive Walkthrough Details */}
        <div className="p-8 bg-light-panel dark:bg-[#1E222D] border border-light-border dark:border-[#2A2E39] rounded-3xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-6 transition-all duration-350">
          <div className="space-y-3 max-w-xl text-left">
            <span className="text-[9px] font-black uppercase text-accent tracking-widest bg-accent/15 px-2.5 py-1 rounded-md">
              Step {activeStep + 1} Walkthrough
            </span>
            <h3 className="text-lg font-black text-light-primary dark:text-white uppercase tracking-wider">
              {activeStep === 0 && "1. Instant Account Registration"}
              {activeStep === 1 && "2. Safe & Production-Ready Funding"}
              {activeStep === 2 && "3. High-Frequency Order Execution"}
            </h3>
            <p className="text-xs text-light-secondary dark:text-[#8A91A5] leading-relaxed">
              {activeStep === 0 && "Sign up securely using an email address. New accounts automatically receive a pre-loaded $10,000 Demo wallet to practice trading. Brokers can apply at the P2P tab to secure their verified blue badge."}
              {activeStep === 1 && "Choose between credit card payment (Stripe), instant PayPal checkout, M-Pesa STK push for immediate mobile money conversion, or secure Crypto transfers (BTC/USDT). Capital additions are credited instantly."}
              {activeStep === 2 && "Enter your stake, target take-profit/stop-loss, and execute Buy/Sell positions. Leverage up to 1:100 allows maximizing returns, while our sub-5ms WS loop ensures zero slippage."}
            </p>
          </div>
          <button
            onClick={handleDemoAccess}
            className="w-full md:w-auto px-6 py-3 bg-accent hover:bg-accent/90 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-accent/25 transition-all flex items-center justify-center gap-1.5 shrink-0"
          >
            <span>Proceed to Dashboard</span>
            <ArrowRight size={12} />
          </button>
        </div>
      </section>

      {/* 4. Six Value Propositions */}
      <section className="max-w-7xl mx-auto px-6 py-16 border-t border-light-border/40 dark:border-[#2A2E39]/30">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-4xl font-black text-light-primary dark:text-white uppercase tracking-tight leading-tight">
            Extreme Ambition • <span className="text-accent">Extreme Profits</span>
          </h2>
          <p className="text-xs sm:text-sm text-light-secondary dark:text-[#8A91A5] mt-2">
            Why professional retail traders and authorized desk brokers trade through ExtFx - ExtremeFxTrader.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: <Zap size={22} />,
              title: "Sub-4ms Trade Routing",
              desc: "Engineered with native uWebSockets and high-frequency in-memory feeds. Order requests bypass db overhead for instant entry."
            },
            {
              icon: <Lock size={22} />,
              title: "Native Escrow Contracts",
              desc: "All P2P marketplace trades are protected by automated escrow layers. Releasing funds requires double-signature approvals."
            },
            {
              icon: <Globe size={22} />,
              title: "100+ Live Markets",
              desc: "Instant access to Forex, commodity futures, cryptocurrencies, equity tokens, and continuous Volatility Synthetics."
            },
            {
              icon: <Coins size={22} />,
              title: "Zero Hidden Commissions",
              desc: "We stand for direct pricing models. Low fixed spreads are applied clearly with zero extra deposit/withdrawal commission."
            },
            {
              icon: <Layers size={22} />,
              title: "Lightweight 3-Pane Layout",
              desc: "Optimized fluid grids adapt seamlessly. Desktop features split panels; mobile collapses into thumb-reach controls."
            },
            {
              icon: <Activity size={22} />,
              title: "24/7 Operations",
              desc: "Synthetic index price feeds run continuously all year round. Trade volatility indices during weekend stock closures."
            }
          ].map((feat, idx) => (
            <div
              key={idx}
              className="p-6 bg-light-panel dark:bg-[#1E222D] border border-light-border dark:border-[#2A2E39] rounded-3xl flex flex-col gap-4 transition-all duration-350 hover:translate-y-[-4px]"
            >
              <div className="w-10 h-10 rounded-2xl bg-accent/15 text-accent flex items-center justify-center shrink-0">
                {feat.icon}
              </div>
              <div className="space-y-1 text-left">
                <h4 className="text-xs font-black uppercase text-light-primary dark:text-white tracking-wider">{feat.title}</h4>
                <p className="text-[11px] text-light-secondary dark:text-[#8A91A5] leading-relaxed">{feat.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. About Section Grid: about.mp4 + description */}
      <section className="max-w-7xl mx-auto px-6 py-20 border-t border-light-border/40 dark:border-[#2A2E39]/30">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">

          {/* Left Grid: HTML5 about.mp4 video looping */}
          <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-light-border dark:border-dark-border aspect-video group">
            <video
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            >
              <source src="/images/about.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-4 left-6 flex items-center gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-widest bg-accent px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg">
                <Activity size={12} />
                <span>Live Feed Terminal</span>
              </span>
            </div>
          </div>

          {/* Right Grid: Mobile & Desktop Compatible Description */}
          <div className="space-y-6 text-left">
            <h2 className="text-3xl sm:text-5xl font-black text-light-primary dark:text-white tracking-tight uppercase leading-tight">
              A Platform Built For the <br />
              <span className="text-accent">Extreme Trader</span>
            </h2>

            <p className="text-light-secondary dark:text-dark-secondary text-xs sm:text-sm leading-relaxed">
              In trading, average results are not enough. We configure continuous 24/7 trading channels for currencies, cryptocurrencies, stocks, and our specialized gamified Synthetic Indices. Stream real-time ticks instantly using native WebSocket loops with zero database lag.
            </p>

            <p className="text-light-secondary dark:text-dark-secondary text-xs sm:text-sm leading-relaxed">
              Whether you are trading on a dual-monitor desktop workstation or tapping order keys on your mobile device during a commute, ExtFx adjusts dynamically. Experience high-frequency execution in a beautiful, low-latency fluid grid environment.
            </p>

            <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-light-panel dark:bg-[#1E222D] border border-light-border dark:border-[#2A2E39] rounded-2xl flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-accent">
                  <Zap size={16} />
                  <span className="text-xs font-black text-light-primary dark:text-white uppercase tracking-wider">Continuous 24/7</span>
                </div>
                <p className="text-[11px] text-light-secondary dark:text-[#8A91A5] leading-relaxed">
                  Synthetic indices keep ticking even when global exchanges close. Trade anytime.
                </p>
              </div>
              <div className="p-4 bg-light-panel dark:bg-[#1E222D] border border-light-border dark:border-[#2A2E39] rounded-2xl flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-accent">
                  <BadgeCheck size={16} />
                  <span className="text-xs font-black text-light-primary dark:text-white uppercase tracking-wider">P2P Escrow</span>
                </div>
                <p className="text-[11px] text-light-secondary dark:text-[#8A91A5] leading-relaxed">
                  Broker applications, verified badge checks, and secure, automated payment escrows.
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 5. Reviews Feed / Testimonials */}
      <section className="max-w-7xl mx-auto px-6 py-16 border-t border-light-border/40 dark:border-[#2A2E39]/30">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-4xl font-black text-light-primary dark:text-white uppercase tracking-tight leading-tight">
            Vouched By the <span className="text-accent">Community</span>
          </h2>
          <p className="text-xs sm:text-sm text-light-secondary dark:text-[#8A91A5] mt-2">
            Real feedback from verified active traders and authorized P2P brokers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            {
              name: "Alex Mutua",
              role: "Verified Broker",
              badge: true,
              stars: "★★★★★",
              quote: "The 110% deposit credit boost for broker capital is incredibly lucrative. P2P wallet transfers are clean and admin verification is solid."
            },
            {
              name: "Sarah K.",
              role: "Retail Trader",
              badge: false,
              stars: "★★★★★",
              quote: "Volatility Synthetics are a game changer. Execution actually holds up, even during peak hours, and the canvas rendering keeps charts lag-free."
            },
            {
              name: "Nicolas L.",
              role: "Verified Broker",
              badge: true,
              stars: "★★★★☆",
              quote: "Running my escrow desk here has been super smooth. The direct broker rating system builds great trust and the chat inbox makes negotiation simple."
            },
            {
              name: "Elena Rostova",
              role: "Day Trader",
              badge: false,
              stars: "★★★★★",
              quote: "Extremely clean dark theme. Switching operational wallets between Demo and Real balance takes just one tap, letting me test ideas instantly."
            }
          ].map((rev, idx) => (
            <div key={idx} className="p-6 bg-light-panel dark:bg-[#1E222D] border border-light-border dark:border-[#2A2E39] rounded-3xl flex flex-col justify-between h-[210px] text-left">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-light-primary dark:text-white">{rev.name}</span>
                  {rev.badge && (
                    <span className="text-[8px] bg-accent/20 text-accent font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-0.5">
                      ✓ Verified
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-amber-500 block leading-none">{rev.stars}</span>
                <p className="text-[10px] text-light-secondary dark:text-[#8A91A5] leading-relaxed italic">
                  "{rev.quote}"
                </p>
              </div>
              <span className="text-[9px] font-black uppercase tracking-wider text-light-secondary dark:text-dark-secondary block mt-2">
                {rev.role}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 7. Risk Disclosure Footer */}
      <Footer />

    </div>
  );
}
