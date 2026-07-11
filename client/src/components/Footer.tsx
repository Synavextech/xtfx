import React from 'react';
import { Link } from 'react-router-dom';
import { Send, MessageSquare, Facebook, Twitter, Shield, Info, HelpCircle } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full bg-[#1E222D]/40 backdrop-blur-md border-t border-[#2A2E39] py-8 px-6 mt-auto">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        
        {/* Slogan and Description */}
        <div className="flex flex-col gap-2 max-w-md text-center md:text-left">
          <div className="flex items-center gap-2 justify-center md:justify-start">
            <span className="font-black text-xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#2962FF] to-[#089981]">
              ExtFx <span className="text-[#D1D4DC]">ExtremeFxTrader</span>
            </span>
          </div>
          <p className="text-[11px] text-[#8A91A5] leading-relaxed">
            ExtFx - ExtremeFxTrader; For bold Ventures willing to go to the extreme ends.
            Make every investment count - make every investment produce extreme profits for we are the extreme traders, with extreme ambition and extreme anger for success.
          </p>
        </div>

        {/* Support Channels & Legal Links */}
        <div className="flex flex-col gap-4 items-center md:items-end">
          <div className="flex items-center gap-4 text-xs font-semibold text-[#D1D4DC]">
            <Link to="/terms" className="hover:text-[#2962FF] transition-colors flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Terms & Services
            </Link>
            <span className="text-[#2A2E39]">|</span>
            <a href="https://t.me/xfx_extremetrader" target="_blank" rel="noreferrer" className="hover:text-[#2962FF] transition-colors flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" /> Support
            </a>
          </div>

          {/* Social Icons */}
          <div className="flex items-center gap-3">
            <a 
              href="https://t.me/xfx_extremetrader" 
              target="_blank" 
              rel="noreferrer" 
              className="p-2 rounded-lg bg-[#2A2E39]/40 hover:bg-[#2962FF]/20 hover:text-[#2962FF] transition-all text-[#8A91A5] border border-[#2A2E39]"
              title="Telegram Channel"
            >
              <Send className="w-4 h-4" />
            </a>
            <a 
              href="https://wa.me/1234567890" 
              target="_blank" 
              rel="noreferrer" 
              className="p-2 rounded-lg bg-[#2A2E39]/40 hover:bg-[#089981]/20 hover:text-[#089981] transition-all text-[#8A91A5] border border-[#2A2E39]"
              title="WhatsApp Chat"
            >
              <MessageSquare className="w-4 h-4" />
            </a>
            <a 
              href="https://facebook.com/xfx.extremetrader" 
              target="_blank" 
              rel="noreferrer" 
              className="p-2 rounded-lg bg-[#2A2E39]/40 hover:bg-[#2962FF]/20 hover:text-[#2962FF] transition-all text-[#8A91A5] border border-[#2A2E39]"
              title="Facebook Page"
            >
              <Facebook className="w-4 h-4" />
            </a>
            <a 
              href="https://twitter.com/xfx_extreme" 
              target="_blank" 
              rel="noreferrer" 
              className="p-2 rounded-lg bg-[#2A2E39]/40 hover:bg-[#2962FF]/20 hover:text-[#2962FF] transition-all text-[#8A91A5] border border-[#2A2E39]"
              title="Twitter (X)"
            >
              <Twitter className="w-4 h-4" />
            </a>
          </div>
        </div>

      </div>

      {/* Risk Warning Disclaimer */}
      <div className="max-w-6xl mx-auto mt-6 pt-6 border-t border-[#2A2E39]/40">
        <div className="flex gap-2.5 items-start bg-[#F23645]/5 border border-[#F23645]/15 rounded-lg p-3 text-[10px] text-[#8A91A5] leading-relaxed">
          <Info className="w-4 h-4 text-[#F23645] flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-[#D1D4DC]">Extreme Risk Warning:</strong> Complex instruments come with a high risk of losing money rapidly due to leverage. 78.48% of retail investor accounts lose money when trading with this provider. You should consider whether you understand how the product works and whether you can afford to take the high risk of losing your money.
          </div>
        </div>
        <p className="text-[10px] text-[#8A91A5]/60 text-center mt-4">
          © {new Date().getFullYear()} ExtFx - ExtremeFxTrader. All rights reserved. Registered brokerage.
        </p>
      </div>
    </footer>
  );
}
