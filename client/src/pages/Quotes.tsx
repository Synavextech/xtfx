import React, { useEffect, useRef, useState } from 'react';
import { useTradeStore, getDecimals } from '../store/useTradeStore';

interface QuotesProps {
  onSelectAsset?: (symbol: string) => void;
}

const ASSETS_LIST = [
  { symbol: '1HZ10V', name: 'Volatility 10 (1s)', category: 'synthetic', spread: '0.10' },
  { symbol: '1HZ25V', name: 'Volatility 25 (1s)', category: 'synthetic', spread: '0.10' },
  { symbol: '1HZ50V', name: 'Volatility 50 (1s)', category: 'synthetic', spread: '0.10' },
  { symbol: '1HZ75V', name: 'Volatility 75 (1s)', category: 'synthetic', spread: '0.10' },
  { symbol: '1HZ100V', name: 'Volatility 100 (1s)', category: 'synthetic', spread: '0.10' },
  // Forex
  { symbol: 'EUR/USD', name: 'Euro / US Dollar', category: 'forex', spread: '0.0001' },
  { symbol: 'GBP/USD', name: 'Pound / US Dollar', category: 'forex', spread: '0.0002' },
  { symbol: 'USD/JPY', name: 'US Dollar / Yen', category: 'forex', spread: '0.01' },
  { symbol: 'USD/MXN', name: 'US Dollar / Mexican Peso', category: 'forex', spread: '0.005' },
  { symbol: 'USD/CHF', name: 'US Dollar / Swiss Franc', category: 'forex', spread: '0.0002' },
  { symbol: 'USD/KES', name: 'US Dollar / Shilling', category: 'forex', spread: '0.10' },
  { symbol: 'USD/CAD', name: 'US Dollar / Canadian Dollar', category: 'forex', spread: '0.0001' },
  { symbol: 'GPC/CAD', name: 'GPC / Canadian Dollar', category: 'forex', spread: '0.0002' },
  // Cryptocurrencies
  { symbol: 'BTC/USD', name: 'Bitcoin / US Dollar', category: 'crypto', spread: '5.0' },
  { symbol: 'ETH/USD', name: 'Ethereum / US Dollar', category: 'crypto', spread: '0.6' },
  { symbol: 'XRP/USD', name: 'Ripple / US Dollar', category: 'crypto', spread: '0.0008' },
  { symbol: 'SOL/USD', name: 'Solana / US Dollar', category: 'crypto', spread: '0.15' },
  { symbol: 'DOGE/USD', name: 'Dogecoin / US Dollar', category: 'crypto', spread: '0.0002' },
  { symbol: 'PEPE/USD', name: 'Pepecoin / US Dollar', category: 'crypto', spread: '0.0000001' },
  // Commodities
  { symbol: 'XAU/USD', name: 'Gold / US Dollar', category: 'commodity', spread: '0.35' },
  { symbol: 'XAG/USD', name: 'Silver / US Dollar', category: 'commodity', spread: '0.02' },
  { symbol: 'WTI', name: 'US Crude Oil (WTI)', category: 'commodity', spread: '0.04' },
  { symbol: 'BRENT', name: 'UK Brent Oil', category: 'commodity', spread: '0.04' },
  { symbol: 'NAT_GAS', name: 'Natural Gas', category: 'commodity', spread: '0.005' },
  { symbol: 'COPPER', name: 'Copper / US Dollar', category: 'commodity', spread: '0.01' },
  { symbol: 'LEAD', name: 'Lead / US Dollar', category: 'commodity', spread: '0.005' },
  { symbol: 'COCOA', name: 'US Cocoa', category: 'commodity', spread: '15.0' },
  { symbol: 'COTTON', name: 'Cotton', category: 'commodity', spread: '0.15' },
  { symbol: 'SUGAR', name: 'Sugar', category: 'commodity', spread: '0.05' },
  // Equities
  { symbol: 'TSLA', name: 'Tesla Inc', category: 'equity', spread: '0.15' },
  { symbol: 'NVDA', name: 'Nvidia Corp', category: 'equity', spread: '0.10' },
  { symbol: 'META', name: 'Meta Platforms Inc', category: 'equity', spread: '0.45' },
  { symbol: 'AMD', name: 'Advanced Micro Devices Inc', category: 'equity', spread: '0.20' },
  { symbol: 'MU', name: 'Micron Technology', category: 'equity', spread: '0.12' },
  { symbol: 'MSTR', name: 'MicroStrategy Inc', category: 'equity', spread: '2.50' }
];

export default function Quotes({ onSelectAsset }: QuotesProps) {
  const { priceFeed, activeAsset, setActiveAsset } = useTradeStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const priceHistoryRef = useRef<Record<string, number[]>>({});

  const categories = ['all', 'synthetic', 'crypto', 'commodity', 'forex', 'equity'];

  const filteredAssets = selectedCategory === 'all' 
    ? ASSETS_LIST 
    : ASSETS_LIST.filter(a => a.category === selectedCategory);

  const handleAssetClick = (symbol: string) => {
    setActiveAsset(symbol);
    if (onSelectAsset) {
      onSelectAsset(symbol);
    }
  };

  return (
    <div className="flex flex-col h-full bg-light-panel dark:bg-dark-panel">
      {/* Category filters */}
      <div className="flex gap-2 overflow-x-auto p-3 border-b border-light-border dark:border-dark-border scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all shrink-0 ${
              selectedCategory === cat
                ? 'bg-accent text-white shadow-md shadow-accent/20'
                : 'bg-light-bg dark:bg-dark-bg text-light-secondary dark:text-dark-secondary hover:text-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Assets Grid / List */}
      <div className="flex-1 overflow-y-auto divide-y divide-light-border dark:divide-dark-border/40">
        {filteredAssets.map((asset) => {
          const feed = priceFeed[asset.symbol];
          const price = feed ? feed.price : 0.0;
          
          // Track historical ticks for sparkline rendering
          if (price > 0) {
            if (!priceHistoryRef.current[asset.symbol]) {
              priceHistoryRef.current[asset.symbol] = [];
            }
            const history = priceHistoryRef.current[asset.symbol];
            if (history[history.length - 1] !== price) {
              history.push(price);
              if (history.length > 25) {
                history.shift();
              }
            }
          }

          const currentHistory = priceHistoryRef.current[asset.symbol] || [];
          const isSelected = activeAsset === asset.symbol;

          return (
            <div
              key={asset.symbol}
              onClick={() => handleAssetClick(asset.symbol)}
              className={`flex items-center justify-between p-4 cursor-pointer hover:bg-light-bg/50 dark:hover:bg-dark-bg/30 transition-all ${
                isSelected ? 'bg-accent/5 dark:bg-accent/5 border-l-4 border-accent' : 'border-l-4 border-transparent'
              }`}
            >
              {/* Asset Name */}
              <div className="flex flex-col">
                <span className="font-extrabold text-sm text-light-primary dark:text-dark-primary">{asset.symbol}</span>
                <span className="text-[10px] text-light-secondary dark:text-dark-secondary capitalize">{asset.name}</span>
              </div>

              {/* Sparkline Canvas */}
              <div className="hidden sm:block w-24 h-8">
                <Sparkline history={currentHistory} />
              </div>

              {/* Spread & Price */}
              <div className="flex flex-col items-end">
                <span className={`font-mono font-bold text-sm transition-all duration-300 ${
                  price > 0 ? 'text-light-primary dark:text-dark-primary' : 'text-light-secondary dark:text-dark-secondary'
                }`}>
                  {price > 0 ? price.toFixed(getDecimals(asset.symbol)) : 'Closed'}
                </span>
                <span className="text-[9px] text-light-secondary dark:text-dark-secondary font-mono">
                  Spread: {asset.spread}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Sparkline Renderer Component using tiny HTML5 canvas
function Sparkline({ history }: { history: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || history.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    const min = Math.min(...history);
    const max = Math.max(...history);
    const diff = max - min || 1;

    const isUp = history[history.length - 1] >= history[0];

    ctx.strokeStyle = isUp ? '#089981' : '#F23645';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    history.forEach((val, i) => {
      const x = (i / (history.length - 1)) * w;
      const y = h - ((val - min) / diff) * h * 0.8 - h * 0.1; // pad top/bottom
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
  }, [history]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}
