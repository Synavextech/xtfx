import React from 'react';
import { Shield, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <div className="min-h-screen bg-[#111112] text-[#D1D4DC] flex flex-col font-sans">
      {/* Header */}
      <header className="w-full bg-[#1E222D] border-b border-[#2A2E39] px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <Link to="/" className="flex items-center gap-2 text-xs font-bold text-[#8A91A5] hover:text-[#D1D4DC] transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Platform
        </Link>
        <span className="font-extrabold text-sm tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#2962FF] to-[#089981]">
          ExtFx - ExtremeFxTrader
        </span>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl mx-auto py-12 px-6 w-full flex flex-col gap-8">

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#2962FF]/10 text-[#2962FF] border border-[#2962FF]/20">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#D1D4DC]">Terms and Services</h1>
            <p className="text-xs text-[#8A91A5] mt-0.5">Last updated: July 2026</p>
          </div>
        </div>

        {/* Terms Sections */}
        <div className="flex flex-col gap-6 text-xs text-[#8A91A5] leading-relaxed">

          <section className="bg-[#1E222D] border border-[#2A2E39] rounded-xl p-5 flex flex-col gap-3">
            <h2 className="text-sm font-bold text-[#D1D4DC]">1. Trading and Leverage Conditions</h2>
            <p>
              By opening positions on ExtFx - ExtremeFxTrader, you accept that leverage up to 1:100 is applied. Margin requirement calculations are dynamically checked. If free margin drops below required margin, the trade cannot be placed.
            </p>
            <p>
              Standard minimum trade value is set to <strong>$10.00 USD</strong>. Any trade submitted with a valuation below this limit will be rejected automatically.
            </p>
          </section>

          <section className="bg-[#1E222D] border border-[#2A2E39] rounded-xl p-5 flex flex-col gap-3">
            <h2 className="text-sm font-bold text-[#D1D4DC]">2. Referral Program & Onboarding</h2>
            <p>
              Users can invite colleagues using their personal referral code. The referrer is awarded a first-deposit commission bonus:
            </p>
            <ul className="list-disc pl-4 flex flex-col gap-1.5 mt-1 text-[#8A91A5]">
              <li>Standard referral bonus: <strong>10%</strong> of the referee's first approved deposit.</li>
              <li>Trader referral bonus: <strong>12.5%</strong> of the first approved deposit, awarded if either the referrer or referee has their account role set to 'trader'.</li>
            </ul>
          </section>

          <section className="bg-[#1E222D] border border-[#2A2E39] rounded-xl p-5 flex flex-col gap-3">
            <h2 className="text-sm font-bold text-[#D1D4DC]">3. Execution and Connection Drop Masking</h2>
            <p>
              Trading contains inherent latency and slippage risks. In the event of network disruption or WebSocket disconnection, a "Reconnecting to server..." mask is applied to the chart area to protect users against actions on outdated prices. Execution buttons are locked until a stable connection is re-established.
            </p>
          </section>

          <section className="bg-[#1E222D] border border-[#2A2E39] rounded-xl p-5 flex flex-col gap-3">
            <h2 className="text-sm font-bold text-[#D1D4DC]">4. User Responsibilities and Account Safety</h2>
            <ul className="list-disc pl-4 flex flex-col gap-1.5 mt-1 text-[#8A91A5]">
              <li>
                <strong className="text-[#D1D4DC]">Password Security:</strong> You are responsible for maintaining the confidentiality of your account password. Do not share your password with anyone. ExtFx is not liable for any losses incurred due to unauthorized access resulting from password compromise.
              </li>
              <li>
                <strong className="text-[#D1D4DC]">Account Sharing:</strong> You must use your account only for your own personal trading activities. Sharing your account with other individuals is strictly prohibited and may result in account suspension or termination.
              </li>
              <li>
                <strong className="text-[#D1D4DC]">Device Security:</strong> Ensure that the devices you use to access the platform are secured with up-to-date antivirus software and operating system patches to prevent unauthorized access and protect your account credentials.
              </li>
              <li>
                <strong className="text-[#D1D4DC]">Reporting Suspicious Activity:</strong> You should immediately report any suspicious activity, including unrecognized transactions or login attempts, to our support team to prevent potential fraud or account compromise.
              </li>
            </ul>
          </section>

        </div>
      </main>
    </div>
  );
}
