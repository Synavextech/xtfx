import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useTradeStore, getDecimals, Candle } from '../store/useTradeStore';

interface ChartProps {
  symbol: string;
  theme: 'dark' | 'light';
}

export default function Chart({ symbol, theme }: ChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'M1' | 'M5'>('M5');
  
  // Panning offset (scrolling to the left)
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<number>(0);
  const scrollStartRef = useRef<number>(0);

  const priceFeed = useTradeStore((state) => state.priceFeed);

  // Resize handling
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Colors
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

  // 1. Fetch history on symbol or timeframe change
  useEffect(() => {
    let active = true;
    setLoading(true);
    
    axios.get(`/api/market/candles?symbol=${encodeURIComponent(symbol)}&resolution=${timeframe}`)
      .then((res) => {
        if (active) {
          setCandles(res.data);
          setScrollOffset(0); // Reset scroll to newest
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load candles:', err);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [symbol, timeframe]);

  // 2. Consume real-time ticks
  useEffect(() => {
    const tick = priceFeed[symbol];
    if (!tick || candles.length === 0) return;

    // Use either candleM1 or candleM5 based on timeframe
    const currentTickCandle = timeframe === 'M1' ? tick.candleM1 : tick.candleM5;
    if (!currentTickCandle) return;

    setCandles((prevCandles) => {
      const updated = [...prevCandles];
      const last = updated[updated.length - 1];
      const tickTime = currentTickCandle.time;

      if (last.time === tickTime) {
        // Update the last candle
        updated[updated.length - 1] = {
          ...last,
          close: tick.price,
          high: Math.max(last.high, tick.price),
          low: Math.min(last.low, tick.price)
        };
      } else if (tickTime > last.time) {
        // Append new candle
        updated.push({
          time: tickTime,
          open: last.close,
          high: Math.max(last.close, tick.price),
          low: Math.min(last.close, tick.price),
          close: tick.price
        });
        const maxHistory = timeframe === 'M1' ? 3000 : 9000;
        if (updated.length > maxHistory) {
          updated.shift();
        }
      }
      return updated;
    });
  }, [priceFeed, symbol, timeframe]);

  // 3. Canvas rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || candles.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI retina screens
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Clear background
    ctx.fillStyle = activeColors.bg;
    ctx.fillRect(0, 0, width, height);

    // Chart parameters
    const candleWidth = 6;
    const candleGap = 3;
    const totalCandleWidth = candleWidth + candleGap;
    const rightMargin = 60;
    const chartWidth = width - rightMargin;

    // Render gridlines (horizontal and vertical)
    ctx.lineWidth = 1;
    ctx.strokeStyle = activeColors.grid;
    ctx.fillStyle = activeColors.text;
    ctx.font = '10px Inter';

    // Horizontal lines & price labels
    const gridRows = 6;
    const rowHeight = height / gridRows;

    // Determine min/max price for the visible window
    const maxVisibleCandles = Math.ceil(chartWidth / totalCandleWidth);
    const startIndex = Math.max(0, candles.length - maxVisibleCandles - scrollOffset);
    const endIndex = Math.max(0, candles.length - scrollOffset);
    const visibleCandles = candles.slice(startIndex, endIndex);

    if (visibleCandles.length === 0) return;

    let minPrice = Math.min(...visibleCandles.map(c => c.low));
    let maxPrice = Math.max(...visibleCandles.map(c => c.high));

    // Pad prices so they don't hit edges
    const priceDiff = maxPrice - minPrice || 1.0;
    maxPrice += priceDiff * 0.15;
    minPrice -= priceDiff * 0.15;

    const getPriceY = (price: number) => {
      return height - ((price - minPrice) / (maxPrice - minPrice)) * height;
    };

    const getPriceFromY = (y: number) => {
      return maxPrice - (y / height) * (maxPrice - minPrice);
    };

    // Draw horizontal grid and right-side prices
    for (let i = 1; i < gridRows; i++) {
      const y = i * rowHeight;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();

      const price = getPriceFromY(y);
      ctx.fillText(price.toFixed(getDecimals(symbol)), chartWidth + 5, y + 3);
    }

    // Draw Candlesticks (Fixed width & older candles scroll left)
    visibleCandles.forEach((candle, index) => {
      // Position from the right edge
      const x = chartWidth - (visibleCandles.length - index) * totalCandleWidth;
      
      if (x < 0) return;

      const isBullish = candle.close >= candle.open;
      ctx.strokeStyle = isBullish ? activeColors.bull : activeColors.bear;
      ctx.fillStyle = isBullish ? activeColors.bull : activeColors.bear;

      // Draw high/low shadow line
      ctx.beginPath();
      ctx.moveTo(x + candleWidth / 2, getPriceY(candle.high));
      ctx.lineTo(x + candleWidth / 2, getPriceY(candle.low));
      ctx.stroke();

      // Draw body
      const openY = getPriceY(candle.open);
      const closeY = getPriceY(candle.close);
      const bodyHeight = Math.max(1.5, Math.abs(openY - closeY));

      ctx.fillRect(x, Math.min(openY, closeY), candleWidth, bodyHeight);
    });

    // Draw Live price line
    const lastCandle = candles[candles.length - 1];
    const livePrice = lastCandle.close;
    const liveY = getPriceY(livePrice);

    ctx.strokeStyle = activeColors.line;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]); // Dashed line
    ctx.beginPath();
    ctx.moveTo(0, liveY);
    ctx.lineTo(chartWidth, liveY);
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash

    // Live price text badge
    ctx.fillStyle = activeColors.line;
    ctx.fillRect(chartWidth + 2, liveY - 9, rightMargin - 4, 18);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(livePrice.toFixed(getDecimals(symbol)), chartWidth + 6, liveY + 4);

  }, [candles, scrollOffset, activeColors, symbol, dimensions]);

  // Handle click and drag panning
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = e.clientX;
    scrollStartRef.current = scrollOffset;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartRef.current;
    
    // Scale panning to index shifts
    const candleWidthAndGap = 9;
    const shift = Math.round(deltaX / candleWidthAndGap);
    
    const maxScroll = candles.length - 20; // don't scroll past history start
    const newOffset = Math.max(0, Math.min(maxScroll, scrollStartRef.current + shift));
    
    setScrollOffset(newOffset);
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  return (
    <div ref={containerRef} className="w-full h-full relative select-none">
      {/* Timeframe Switcher */}
      <div className="absolute top-3 left-3 flex gap-1 z-10 p-0.5 rounded border shadow-lg glass-panel">
        <button
          onClick={() => setTimeframe('M1')}
          className={`px-2.5 py-1 text-xs font-semibold rounded transition-all duration-200 ${
            timeframe === 'M1'
              ? 'bg-[#2962FF] text-white shadow-sm'
              : 'text-[#8A91A5] hover:text-[#D1D4DC] dark:text-[#8A91A5] dark:hover:text-[#D1D4DC] light:text-[#787B86] light:hover:text-[#131722]'
          }`}
        >
          M1
        </button>
        <button
          onClick={() => setTimeframe('M5')}
          className={`px-2.5 py-1 text-xs font-semibold rounded transition-all duration-200 ${
            timeframe === 'M5'
              ? 'bg-[#2962FF] text-white shadow-sm'
              : 'text-[#8A91A5] hover:text-[#D1D4DC] dark:text-[#8A91A5] dark:hover:text-[#D1D4DC] light:text-[#787B86] light:hover:text-[#131722]'
          }`}
        >
          M5
        </button>
      </div>

      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-transparent">
          <div className="w-8 h-8 border-4 border-[#2962FF] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : null}

      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        className="w-full h-full cursor-crosshair block"
      />
    </div>
  );
}
