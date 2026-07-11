import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { showToast } from '../App';
import { getDecimals } from '../store/useTradeStore';

interface AdmindashboardProps {
  toggleTheme?: () => void;
  theme?: 'dark' | 'light';
}

export default function Admindashboard({ toggleTheme, theme }: AdmindashboardProps = {}) {
  const [activeTab, setActiveTab] = useState<'deposits' | 'withdrawals' | 'brokers' | 'insights' | 'trades' | 'reviews' | 'settings'>('deposits');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [brokerApps, setBrokerApps] = useState<any[]>([]);
  const [insightsList, setInsightsList] = useState<any[]>([]);
  const [tradesList, setTradesList] = useState<any[]>([]);
  const [reviewsList, setReviewsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Form for new insight
  const [insightTitle, setInsightTitle] = useState('');
  const [insightContent, setInsightContent] = useState('');

  // Settings & Manual reward states
  const [onboardingEnabled, setOnboardingEnabled] = useState(false);
  const [awardUserId, setAwardUserId] = useState('');
  const [awardAmount, setAwardAmount] = useState('');
  const [awardMessage, setAwardMessage] = useState('');
  const [submittingAward, setSubmittingAward] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'deposits' || activeTab === 'withdrawals') {
        const res = await axios.get('/api/admin/transactions');
        setTransactions(res.data);
      } else if (activeTab === 'brokers') {
        const res = await axios.get('/api/admin/brokers');
        setBrokerApps(res.data);
      } else if (activeTab === 'insights') {
        const res = await axios.get('/api/insights');
        setInsightsList(res.data);
      } else if (activeTab === 'trades') {
        const res = await axios.get('/api/admin/trades');
        setTradesList(res.data);
      } else if (activeTab === 'reviews') {
        const res = await axios.get('/api/admin/reviews');
        setReviewsList(res.data);
      } else if (activeTab === 'settings') {
        const res = await axios.get('/api/admin/settings/onboarding-bonus');
        setOnboardingEnabled(res.data.value === 'true');
      }
    } catch (err) {
      showToast('Failed to load admin data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveReview = async (reviewId: string) => {
    try {
      await axios.post('/api/admin/reviews/approve', { reviewId });
      showToast('Review approved successfully!', 'success');
      fetchData();
    } catch (err) {
      showToast('Failed to approve review', 'error');
    }
  };

  const handleRejectReview = async (reviewId: string) => {
    try {
      await axios.post('/api/admin/reviews/reject', { reviewId });
      showToast('Review deleted/rejected successfully!', 'info');
      fetchData();
    } catch (err) {
      showToast('Failed to reject review', 'error');
    }
  };

  const handleToggleOnboarding = async (val: boolean) => {
    try {
      await axios.post('/api/admin/settings/onboarding-bonus', { enabled: val });
      setOnboardingEnabled(val);
      showToast(`Onboarding bonus ${val ? 'enabled' : 'disabled'}!`, 'success');
    } catch (err) {
      showToast('Failed to toggle onboarding setting', 'error');
    }
  };

  const handleAwardBonus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!awardUserId || !awardAmount) {
      showToast('User ID and Amount are required', 'error');
      return;
    }
    setSubmittingAward(true);
    try {
      await axios.post('/api/admin/referral/award-bonus', {
        userId: awardUserId,
        amount: parseFloat(awardAmount),
        message: awardMessage || 'Manual balance adjustment'
      });
      showToast('Bonus awarded successfully!', 'success');
      setAwardUserId('');
      setAwardAmount('');
      setAwardMessage('');
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to award bonus';
      showToast(msg, 'error');
    } finally {
      setSubmittingAward(false);
    }
  };

  const handleReverseTransaction = async (id: string, type: 'deposit' | 'withdrawal' | 'broker') => {
    try {
      await axios.post('/api/admin/transactions/reverse', { id, type });
      showToast('Transaction reversed to pending successfully!', 'success');
      fetchData();
    } catch (err) {
      showToast('Action failed to reverse', 'error');
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleApproveDeposit = async (id: string) => {
    try {
      await axios.post('/api/admin/deposits/approve', { transactionId: id });
      showToast('Deposit approved successfully!', 'success');
      fetchData();
    } catch (err) {
      showToast('Action failed', 'error');
    }
  };

  const handleRejectDeposit = async (id: string) => {
    try {
      await axios.post('/api/admin/deposits/reject', { transactionId: id });
      showToast('Deposit rejected', 'info');
      fetchData();
    } catch (err) {
      showToast('Action failed', 'error');
    }
  };

  const handleApproveWithdrawal = async (id: string) => {
    try {
      await axios.post('/api/admin/withdrawals/approve', { transactionId: id });
      showToast('Withdrawal marked as approved & sent', 'success');
      fetchData();
    } catch (err) {
      showToast('Action failed', 'error');
    }
  };

  const handleRejectWithdrawal = async (id: string) => {
    try {
      await axios.post('/api/admin/withdrawals/reject', { transactionId: id });
      showToast('Withdrawal rejected & refunded', 'info');
      fetchData();
    } catch (err) {
      showToast('Action failed', 'error');
    }
  };

  const handleApproveBroker = async (id: string) => {
    try {
      await axios.post('/api/admin/brokers/approve', { applicationId: id });
      showToast('Broker application approved. Verified badge set!', 'success');
      fetchData();
    } catch (err) {
      showToast('Action failed', 'error');
    }
  };

  const handleRejectBroker = async (id: string) => {
    try {
      await axios.post('/api/admin/brokers/reject', { applicationId: id });
      showToast('Broker application rejected', 'info');
      fetchData();
    } catch (err) {
      showToast('Action failed', 'error');
    }
  };

  const handleCreateInsight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!insightTitle || !insightContent) return;

    try {
      await axios.post('/api/admin/insights', { title: insightTitle, content: insightContent });
      showToast('Insight posted successfully!', 'success');
      setInsightTitle('');
      setInsightContent('');
      fetchData();
    } catch (err) {
      showToast('Failed to create insight', 'error');
    }
  };

  const handleDeleteInsight = async (id: string) => {
    try {
      await axios.delete(`/api/admin/insights/${id}`);
      showToast('Insight deleted', 'info');
      fetchData();
    } catch (err) {
      showToast('Delete failed', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-light-bg dark:bg-[#111112] text-light-primary dark:text-[#D1D4DC] flex flex-col p-6 transition-colors duration-200">

      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-light-border dark:border-[#2A2E39]">
        <div>
          <h1 className="text-2xl font-black text-light-primary dark:text-white">Administrator Dashboard</h1>
          <p className="text-xs text-light-secondary dark:text-[#8A91A5]">Manage deposits, withdrawals, brokers, and analysis reports</p>
        </div>
        <div className="flex items-center gap-3">
          {toggleTheme && (
            <button
              onClick={toggleTheme}
              className="p-2 bg-light-panel dark:bg-[#1E222D] border border-light-border dark:border-[#2A2E39] rounded-xl hover:scale-105 active:scale-95 transition-all text-xs"
              title="Toggle theme"
            >
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>
          )}
          <Link
            to="/dashboard"
            className="px-4 py-2 bg-[#2962FF] text-white text-xs font-bold rounded-xl shadow-lg shadow-[#2962FF]/20 hover:scale-105 active:scale-95 transition-all"
          >
            ← Back to Trading Room
          </Link>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex gap-3 mb-6 border-b border-light-border dark:border-[#2A2E39] pb-2 overflow-x-auto">
        {(['deposits', 'withdrawals', 'brokers', 'insights', 'trades', 'reviews', 'settings'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-bold capitalize transition-all shrink-0 ${activeTab === tab
                ? 'text-[#2962FF] border-b-2 border-[#2962FF]'
                : 'text-light-secondary dark:text-[#8A91A5] hover:text-light-primary dark:hover:text-white'
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-white dark:bg-[#1E222D] border border-light-border dark:border-[#2A2E39] rounded-3xl p-6 relative">

        {loading && (
          <div className="absolute inset-0 bg-white/40 dark:bg-dark-bg/40 backdrop-blur-xs flex items-center justify-center rounded-3xl z-50">
            <div className="w-8 h-8 border-4 border-[#2962FF] border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* Tab 1: Deposits list */}
        {activeTab === 'deposits' && (
          <div className="space-y-4">
            <h3 className="font-extrabold text-sm mb-4 uppercase tracking-wider text-light-primary dark:text-white">Deposits History & Actions</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-light-border dark:border-[#2A2E39] text-light-secondary dark:text-[#8A91A5] uppercase font-bold text-[10px]">
                    <th className="p-3">User</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Details</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-light-border/40 dark:divide-dark-border/20 font-mono">
                  {transactions.filter(t => t.type === 'deposit').length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center p-8 text-light-secondary dark:text-[#8A91A5]">No deposits found.</td>
                    </tr>
                  ) : (
                    transactions.filter(t => t.type === 'deposit').map((t) => (
                      <tr key={t.id} className="hover:bg-light-panel dark:hover:bg-dark-bg/25">
                        <td className="p-3 text-light-primary dark:text-white font-sans">{t.profile?.username} ({t.profile?.email})</td>
                        <td className="p-3 capitalize text-[#2962FF] font-sans">{t.payment_method}</td>
                        <td className="p-3 text-[#089981] font-bold">${t.amount.toFixed(2)}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                            t.status === 'pending' ? 'bg-[#2962FF]/10 text-[#2962FF]' : 
                            t.status === 'approved' ? 'bg-[#089981]/10 text-[#089981]' : 'bg-[#F23645]/10 text-[#F23645]'
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="p-3 text-[10px] text-light-secondary dark:text-[#8A91A5]">
                          {t.payment_method === 'mpesa' && `CheckOutID: ${t.payment_details?.CheckoutRequestID || t.payment_details}`}
                          {t.payment_method === 'crypto' && `TxHash: ${t.payment_details?.txHash || t.payment_details}`}
                          {t.payment_method === 'paypal' && `OrderID: ${t.payment_details?.orderID || t.payment_details}`}
                          {t.payment_method === 'stripe' && `StripeID: ${t.payment_details?.stripeId || t.payment_details}`}
                        </td>
                        <td className="p-3 text-right space-x-2">
                          {t.status === 'pending' ? (
                            <>
                              <button
                                onClick={() => handleApproveDeposit(t.id)}
                                className="px-3 py-1 bg-[#089981] text-white font-bold rounded-lg hover:opacity-90 active:scale-95"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectDeposit(t.id)}
                                className="px-3 py-1 bg-[#F23645] text-white font-bold rounded-lg hover:opacity-90 active:scale-95"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleReverseTransaction(t.id, 'deposit')}
                              className="px-3 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold rounded-lg hover:bg-amber-500/20 active:scale-95 transition-all"
                            >
                              Reverse
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Withdrawals list */}
        {activeTab === 'withdrawals' && (
          <div className="space-y-4">
            <h3 className="font-extrabold text-sm mb-4 uppercase tracking-wider text-light-primary dark:text-white">Withdrawals History & Actions</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-light-border dark:border-[#2A2E39] text-light-secondary dark:text-[#8A91A5] uppercase font-bold text-[10px]">
                    <th className="p-3">User</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Account Details</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-light-border/40 dark:divide-dark-border/20 font-mono">
                  {transactions.filter(t => t.type === 'withdrawal').length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center p-8 text-light-secondary dark:text-[#8A91A5]">No withdrawals found.</td>
                    </tr>
                  ) : (
                    transactions.filter(t => t.type === 'withdrawal').map((t) => (
                      <tr key={t.id} className="hover:bg-light-panel dark:hover:bg-dark-bg/25">
                        <td className="p-3 text-light-primary dark:text-white font-sans">{t.profile?.username} ({t.profile?.email})</td>
                        <td className="p-3 capitalize text-[#2962FF] font-sans">{t.payment_method}</td>
                        <td className="p-3 text-[#F23645] font-bold">${t.amount.toFixed(2)}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                            t.status === 'pending' ? 'bg-[#2962FF]/10 text-[#2962FF]' : 
                            t.status === 'approved' ? 'bg-[#089981]/10 text-[#089981]' : 'bg-[#F23645]/10 text-[#F23645]'
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="p-3 text-[10px] text-light-secondary dark:text-[#8A91A5] font-sans">
                          {typeof t.payment_details === 'object' ? JSON.stringify(t.payment_details) : t.payment_details}
                        </td>
                        <td className="p-3 text-right space-x-2">
                          {t.status === 'pending' ? (
                            <>
                              <button
                                onClick={() => handleApproveWithdrawal(t.id)}
                                className="px-3 py-1 bg-[#089981] text-white font-bold rounded-lg hover:opacity-90 active:scale-95"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectWithdrawal(t.id)}
                                className="px-3 py-1 bg-[#F23645] text-white font-bold rounded-lg hover:opacity-90 active:scale-95"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleReverseTransaction(t.id, 'withdrawal')}
                              className="px-3 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold rounded-lg hover:bg-amber-500/20 active:scale-95 transition-all"
                            >
                              Reverse
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Broker Applications */}
        {activeTab === 'brokers' && (
          <div className="space-y-4">
            <h3 className="font-extrabold text-sm mb-4 uppercase tracking-wider text-light-primary dark:text-white">Broker Applications</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-light-border dark:border-[#2A2E39] text-light-secondary dark:text-[#8A91A5] uppercase font-bold text-[10px]">
                    <th className="p-3">User</th>
                    <th className="p-3">Target Capital</th>
                    <th className="p-3">Payment Options</th>
                    <th className="p-3">Payment Details</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-light-border/40 dark:divide-dark-border/20 font-mono">
                  {brokerApps.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center p-8 text-light-secondary dark:text-[#8A91A5]">No applications found.</td>
                    </tr>
                  ) : (
                    brokerApps.map((app) => (
                      <tr key={app.id} className="hover:bg-light-panel dark:hover:bg-dark-bg/25">
                        <td className="p-3 text-light-primary dark:text-white font-sans">{app.profile?.username} ({app.profile?.email})</td>
                        <td className="p-3 text-[#089981] font-bold">${app.capital.toFixed(2)}</td>
                        <td className="p-3 capitalize font-sans text-light-primary dark:text-[#D1D4DC]">{app.payment_options}</td>
                        <td className="p-3 text-[10px] text-light-secondary dark:text-[#8A91A5] font-sans">{app.payment_details}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                            app.status === 'pending' ? 'bg-[#2962FF]/10 text-[#2962FF]' : 
                            app.status === 'approved' ? 'bg-[#089981]/10 text-[#089981]' : 'bg-[#F23645]/10 text-[#F23645]'
                          }`}>
                            {app.status}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-2">
                          {app.status === 'pending' ? (
                            <>
                              <button
                                onClick={() => handleApproveBroker(app.id)}
                                className="px-3 py-1 bg-[#089981] text-white font-bold rounded-lg hover:opacity-90 active:scale-95"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectBroker(app.id)}
                                className="px-3 py-1 bg-[#F23645] text-white font-bold rounded-lg hover:opacity-90 active:scale-95"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleReverseTransaction(app.id, 'broker')}
                              className="px-3 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold rounded-lg hover:bg-amber-500/20 active:scale-95 transition-all"
                            >
                              Reverse
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Insights Publisher */}
        {activeTab === 'insights' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            {/* Create form */}
            <form onSubmit={handleCreateInsight} className="space-y-4 bg-light-panel dark:bg-dark-bg/30 p-5 rounded-2xl border border-light-border dark:border-[#2A2E39]">
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-light-primary dark:text-white mb-2">Publish Market Report</h3>
              <div>
                <label className="block text-[10px] font-bold text-light-secondary dark:text-[#8A91A5] uppercase mb-2">Insight Title</label>
                <input
                  type="text"
                  required
                  placeholder="US Interest Rate Cuts or Forex Shifts..."
                  value={insightTitle}
                  onChange={(e) => setInsightTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-[#111112] border border-light-border dark:border-[#2A2E39] rounded-xl text-xs focus:outline-none focus:border-[#2962FF] text-light-primary dark:text-[#D1D4DC]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-light-secondary dark:text-[#8A91A5] uppercase mb-2">Insight Content</label>
                <textarea
                  required
                  placeholder="Details of analytical predictions..."
                  rows={6}
                  value={insightContent}
                  onChange={(e) => setInsightContent(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-[#111112] border border-light-border dark:border-[#2A2E39] rounded-xl text-xs focus:outline-none focus:border-[#2962FF] text-light-primary dark:text-[#D1D4DC]"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-[#2962FF] text-white font-bold rounded-xl text-xs hover:opacity-95 shadow-md shadow-[#2962FF]/20"
              >
                Publish Insight
              </button>
            </form>

            {/* List insights */}
            <div className="space-y-4">
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-light-primary dark:text-white">Active Insights</h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {insightsList.length === 0 ? (
                  <p className="text-center text-xs text-light-secondary dark:text-[#8A91A5] p-8">No reports published yet.</p>
                ) : (
                  insightsList.map((ins) => (
                    <div key={ins.id} className="p-4 bg-light-panel dark:bg-dark-bg/25 border border-light-border dark:border-dark-border/30 rounded-xl flex justify-between items-start gap-4">
                      <div>
                        <h4 className="font-bold text-xs text-light-primary dark:text-white">{ins.title}</h4>
                        <p className="text-[10px] text-light-secondary dark:text-[#8A91A5] mt-1 line-clamp-2">{ins.content}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteInsight(ins.id)}
                        className="px-2.5 py-1 bg-[#F23645] text-white text-[10px] font-bold rounded-lg hover:opacity-90 shrink-0"
                      >
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

        {/* Tab 5: User Trades Overview */}
        {activeTab === 'trades' && (
          <div className="space-y-4">
            <h3 className="font-extrabold text-sm mb-4 uppercase tracking-wider text-light-primary dark:text-white">Retail Trader Trades Ledger</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-light-border dark:border-[#2A2E39] text-light-secondary dark:text-[#8A91A5] uppercase font-bold text-[10px]">
                    <th className="p-3">Trader</th>
                    <th className="p-3">Asset</th>
                    <th className="p-3">Direction</th>
                    <th className="p-3 text-right">Investment</th>
                    <th className="p-3 text-right">Strike Price</th>
                    <th className="p-3 text-right">Current/Close</th>
                    <th className="p-3 text-right">Profit / Loss</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-light-border/40 dark:divide-dark-border/20 font-mono">
                  {tradesList.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center p-8 text-light-secondary dark:text-[#8A91A5]">No retail trades logged yet.</td>
                    </tr>
                  ) : (
                    tradesList.map((t) => {
                      const pnlVal = Number(t.profit_loss || 0);
                      const isProfit = pnlVal > 0;
                      const isLoss = pnlVal < 0;
                      const decimals = getDecimals(t.asset);

                      return (
                        <tr key={t.id} className="hover:bg-light-panel dark:hover:bg-dark-bg/25">
                          <td className="p-3 text-light-primary dark:text-white font-sans">
                            {t.profile?.username || 'Guest'}
                            <span className="text-[10px] text-light-secondary dark:text-[#8A91A5] block font-mono">
                              {t.profile?.email || t.user_id}
                            </span>
                          </td>
                          <td className="p-3 text-light-primary dark:text-[#D1D4DC] uppercase font-bold">{t.asset}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-extrabold ${
                              t.type === 'buy' ? 'bg-[#089981]/15 text-[#089981]' : 'bg-[#F23645]/15 text-[#F23645]'
                            }`}>
                              {t.type === 'buy' ? 'predict up' : 'predict down'}
                            </span>
                          </td>
                          <td className="p-3 text-right font-bold text-light-primary dark:text-white">${Number(t.quantity).toFixed(2)}</td>
                          <td className="p-3 text-right text-light-secondary dark:text-[#8A91A5]">${Number(t.entry_price).toFixed(decimals)}</td>
                          <td className="p-3 text-right text-light-secondary dark:text-[#8A91A5]">${Number(t.exit_price || t.entry_price).toFixed(decimals)}</td>
                          <td className={`p-3 text-right font-bold ${
                            isProfit ? 'text-[#089981]' : isLoss ? 'text-[#F23645]' : 'text-light-secondary dark:text-[#8A91A5]'
                          }`}>
                            {isProfit ? '+' : ''}${pnlVal.toFixed(2)}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                              t.status === 'open' ? 'bg-[#2962FF]/10 text-[#2962FF]' : 'bg-light-secondary/15 text-light-secondary dark:text-dark-secondary'
                            }`}>
                              {t.status}
                            </span>
                          </td>
                          <td className="p-3 text-light-secondary dark:text-[#8A91A5] font-sans text-[10px]">
                            {new Date(t.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
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

        {/* Tab 6: Platform Reviews Moderation */}
        {activeTab === 'reviews' && (
          <div className="space-y-4">
            <h3 className="font-extrabold text-sm mb-4 uppercase tracking-wider text-light-primary dark:text-white">Platform Reviews Moderation</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-light-border dark:border-[#2A2E39] text-light-secondary dark:text-[#8A91A5] uppercase font-bold text-[10px]">
                    <th className="p-3">User / Author</th>
                    <th className="p-3">Rating</th>
                    <th className="p-3">Review / Quote</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-light-border/40 dark:divide-dark-border/20 font-mono">
                  {reviewsList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center p-8 text-light-secondary dark:text-[#8A91A5]">No reviews submitted yet.</td>
                    </tr>
                  ) : (
                    reviewsList.map((rev) => (
                      <tr key={rev.id} className="hover:bg-light-panel dark:hover:bg-dark-bg/25">
                        <td className="p-3 font-sans text-light-primary dark:text-white">
                          <div className="font-bold">{rev.name}</div>
                          <div className="text-[10px] text-light-secondary dark:text-[#8A91A5]">{rev.role}</div>
                        </td>
                        <td className="p-3 font-sans text-amber-500 font-bold">
                          {Array.from({ length: rev.stars || 5 }).map(() => '★').join('')}
                        </td>
                        <td className="p-3 font-sans text-light-primary dark:text-[#D1D4DC] max-w-sm whitespace-pre-wrap leading-relaxed">
                          "{rev.quote}"
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                            rev.approved ? 'bg-[#089981]/10 text-[#089981]' : 'bg-[#2962FF]/10 text-[#2962FF]'
                          }`}>
                            {rev.approved ? 'Approved' : 'Pending'}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-2">
                          {!rev.approved && (
                            <button
                              onClick={() => handleApproveReview(rev.id)}
                              className="px-3 py-1 bg-[#089981] text-white font-bold rounded-lg hover:opacity-90 active:scale-95 transition-all"
                            >
                              Approve
                            </button>
                          )}
                          <button
                            onClick={() => handleRejectReview(rev.id)}
                            className="px-3 py-1 bg-[#F23645] text-white font-bold rounded-lg hover:opacity-90 active:scale-95 transition-all"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 7: Settings (Onboarding toggle + Manual award) */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Onboarding Toggle UI */}
            <div className="p-5 bg-light-panel dark:bg-dark-bg/30 rounded-2xl border border-light-border dark:border-[#2A2E39] flex flex-col gap-4">
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-light-primary dark:text-white">Onboarding Settings</h3>
              <p className="text-[11px] text-light-secondary dark:text-[#8A91A5] leading-relaxed">
                Toggle whether new users receive a welcome signup bonus of $10 credited to their real trading account balance automatically upon email activation.
              </p>
              <div className="flex items-center justify-between mt-2 p-3 bg-white dark:bg-[#111112] rounded-xl border border-light-border dark:border-[#2A2E39]">
                <span className="text-xs font-bold text-light-primary dark:text-[#D1D4DC]">Enable Onboarding Signup Bonus ($10)</span>
                <button
                  onClick={() => handleToggleOnboarding(!onboardingEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                    onboardingEnabled ? 'bg-[#089981]' : 'bg-[#2A2E39]'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                      onboardingEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Award Manual Bonus Form */}
            <form onSubmit={handleAwardBonus} className="p-5 bg-light-panel dark:bg-dark-bg/30 rounded-2xl border border-light-border dark:border-[#2A2E39] flex flex-col gap-4">
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-light-primary dark:text-white">Award Manual Bonus</h3>
              <p className="text-[11px] text-light-secondary dark:text-[#8A91A5] leading-relaxed">
                Directly reward a specific user by adding funds to their real trading wallet. An email notification will be sent automatically to alert the user of this adjustment.
              </p>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-[9px] font-bold text-light-secondary dark:text-[#8A91A5] uppercase mb-1.5">User UUID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 8f6b0f1a-b68e-4a6c-941f-82a89345bc80"
                    value={awardUserId}
                    onChange={(e) => setAwardUserId(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-[#111112] border border-light-border dark:border-[#2A2E39] rounded-xl text-xs focus:outline-none focus:border-[#2962FF] text-light-primary dark:text-[#D1D4DC] font-mono"
                  />
                </div>
                
                <div>
                  <label className="block text-[9px] font-bold text-light-secondary dark:text-[#8A91A5] uppercase mb-1.5">Amount (USD)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    placeholder="e.g. 150.00"
                    value={awardAmount}
                    onChange={(e) => setAwardAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-[#111112] border border-light-border dark:border-[#2A2E39] rounded-xl text-xs focus:outline-none focus:border-[#2962FF] text-light-primary dark:text-[#D1D4DC] font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-light-secondary dark:text-[#8A91A5] uppercase mb-1.5">Custom Alert Message</label>
                  <input
                    type="text"
                    placeholder="e.g. Winner of the weekly broker trading challenge!"
                    value={awardMessage}
                    onChange={(e) => setAwardMessage(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-[#111112] border border-light-border dark:border-[#2A2E39] rounded-xl text-xs focus:outline-none focus:border-[#2962FF] text-light-primary dark:text-[#D1D4DC]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingAward}
                className="w-full py-2.5 bg-[#2962FF] hover:bg-opacity-95 text-white font-bold rounded-xl text-xs transition-all disabled:opacity-50 shadow-md shadow-[#2962FF]/10"
              >
                {submittingAward ? 'Awarding...' : 'Confirm and Award Bonus'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
