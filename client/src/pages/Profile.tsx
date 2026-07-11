import React, { useState, useEffect } from 'react';
import { useTradeStore } from '../store/useTradeStore';
import { User, Phone, Mail, Globe, Shield, Key, Copy, Check, Users, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { showToast } from '../App';

export default function Profile() {
  const { user, fetchUser } = useTradeStore();
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referrals, setReferrals] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  useEffect(() => {
    const fetchReferrals = async () => {
      try {
        const res = await axios.get('/api/auth/referrals');
        setReferrals(res.data || []);
      } catch (err) {
        console.error("Failed to load referrals list", err);
      }
    };
    fetchReferrals();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) {
      showToast('Username is required', 'error');
      return;
    }
    setIsUpdating(true);
    try {
      const res = await axios.post('/api/auth/profile/update', { username });
      if (res.data.success) {
        showToast('Profile updated successfully', 'success');
        await fetchUser();
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error || 'Profile update failed';
      showToast(errMsg, 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      showToast('Password must be at least 8 characters long', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }
    setIsChangingPass(true);
    try {
      const res = await axios.post('/api/auth/password/change', { newPassword });
      if (res.data.success) {
        showToast('Password updated successfully', 'success');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error || 'Password update failed';
      showToast(errMsg, 'error');
    } finally {
      setIsChangingPass(false);
    }
  };

  const copyReferralLink = () => {
    if (!user?.referral_code) return;
    const link = `${window.location.origin}/auth?ref=${user.referral_code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    showToast('Referral link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#111112] flex items-center justify-center text-[#8A91A5]">
        Loading Profile...
      </div>
    );
  }

  const referralLink = `${window.location.origin}/auth?ref=${user.referral_code}`;

  return (
    <div className="min-h-screen bg-[#111112] text-[#D1D4DC] flex flex-col font-sans">
      {/* Header */}
      <header className="w-full bg-[#1E222D] border-b border-[#2A2E39] px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <Link to="/" className="flex items-center gap-2 text-xs font-bold text-[#8A91A5] hover:text-[#D1D4DC] transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Workspace
        </Link>
        <span className="font-extrabold text-sm tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#2962FF] to-[#089981]">
          ExtFx - ExtremeFxTrader
        </span>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-4xl mx-auto py-10 px-6 w-full flex flex-col md:flex-row gap-8">
        {/* Left pane: Profile Info & Password */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Profile card */}
          <div className="bg-[#1E222D] border border-[#2A2E39] rounded-2xl p-6 flex flex-col gap-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#2962FF] to-[#089981] flex items-center justify-center font-black text-xl text-white shadow-lg">
                {user.username ? user.username[0].toUpperCase() : 'U'}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-lg font-bold text-[#D1D4DC]">{user.username}</h2>
                  {user.role === 'admin' ? (
                    <span className="bg-[#2962FF]/10 text-[#2962FF] border border-[#2962FF]/20 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                      Admin
                    </span>
                  ) : user.role === 'broker' ? (
                    <span className="bg-[#089981]/10 text-[#089981] border border-[#089981]/20 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                      Broker
                    </span>
                  ) : user.role === 'trader' ? (
                    <span className="bg-[#2962FF]/10 text-[#2962FF] border border-[#2962FF]/20 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                      Trader
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-[#8A91A5]">{user.email}</p>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[#8A91A5] uppercase tracking-wider">Username</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A91A5]" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-[#111112] border border-[#2A2E39] rounded-xl py-3 pl-10 pr-4 text-xs text-[#D1D4DC] focus:outline-none focus:border-[#2962FF] transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[#8A91A5] uppercase tracking-wider">Phone number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A91A5]" />
                  <input
                    type="text"
                    value={phone}
                    readOnly
                    className="w-full bg-[#111112]/50 border border-[#2A2E39] rounded-xl py-3 pl-10 pr-4 text-xs text-[#8A91A5]/70 cursor-not-allowed focus:outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isUpdating}
                className="w-full py-3 bg-[#2962FF] hover:bg-[#2962FF]/90 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-[0.98]"
              >
                {isUpdating ? 'Saving...' : 'Update Details'}
              </button>
            </form>
          </div>

          {/* Change Password Card */}
          <div className="bg-[#1E222D] border border-[#2A2E39] rounded-2xl p-6 flex flex-col gap-4 shadow-xl">
            <h3 className="text-sm font-bold text-[#D1D4DC] flex items-center gap-2">
              <Key className="w-4 h-4 text-[#2962FF]" /> Change Password
            </h3>

            <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[#8A91A5] uppercase tracking-wider">New Password</label>
                <input
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[#111112] border border-[#2A2E39] rounded-xl py-3 px-4 text-xs text-[#D1D4DC] focus:outline-none focus:border-[#2962FF] transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[#8A91A5] uppercase tracking-wider">Confirm New Password</label>
                <input
                  type="password"
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[#111112] border border-[#2A2E39] rounded-xl py-3 px-4 text-xs text-[#D1D4DC] focus:outline-none focus:border-[#2962FF] transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isChangingPass}
                className="w-full py-3 bg-[#2A2E39] hover:bg-[#2A2E39]/80 disabled:opacity-50 text-[#D1D4DC] rounded-xl text-xs font-bold transition-all shadow-md active:scale-[0.98] border border-[#2A2E39]"
              >
                {isChangingPass ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>

        {/* Right pane: Referral Program details */}
        <div className="w-full md:w-80 flex flex-col gap-6">
          {/* Referral Code card */}
          <div className="bg-[#1E222D] border border-[#2A2E39] rounded-2xl p-6 flex flex-col gap-5 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#089981]/5 rounded-full blur-2xl" />
            
            <h3 className="text-sm font-bold text-[#D1D4DC] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#089981]" /> Referral Program
            </h3>
            
            <p className="text-[11px] text-[#8A91A5] leading-relaxed">
              Invite friends to ExtFx - ExtremeFxTrader. Earn up to <span className="text-[#089981] font-bold">12.5%</span> bonus commission on their very first approved deposit!
            </p>

            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold text-[#8A91A5] uppercase tracking-wider">Your Referral Link</span>
              <div className="flex items-center gap-2 bg-[#111112] border border-[#2A2E39] rounded-xl p-2 pl-3">
                <span className="text-[10px] text-[#8A91A5] truncate flex-1">{referralLink}</span>
                <button
                  onClick={copyReferralLink}
                  className="p-2 rounded-lg bg-[#2A2E39] hover:bg-[#2962FF] text-[#D1D4DC] transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#089981]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-[#2A2E39]">
              <span className="text-[#8A91A5]">Referral Code</span>
              <span className="font-mono font-bold text-[#D1D4DC] bg-[#111112] px-2.5 py-1 rounded border border-[#2A2E39]">
                {user.referral_code}
              </span>
            </div>
          </div>

          {/* Referred List Card */}
          <div className="bg-[#1E222D] border border-[#2A2E39] rounded-2xl p-6 flex flex-col gap-4 shadow-xl flex-1 max-h-[360px] overflow-hidden">
            <h3 className="text-sm font-bold text-[#D1D4DC] flex items-center justify-between">
              <span>My Network</span>
              <span className="text-xs text-[#8A91A5] font-normal">{referrals.length} referred</span>
            </h3>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2">
              {referrals.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-10">
                  <p className="text-xs text-[#8A91A5]">No invitees yet.</p>
                  <p className="text-[10px] text-[#8A91A5]/60 mt-1">Share your link to begin earning.</p>
                </div>
              ) : (
                referrals.map((ref) => (
                  <div key={ref.id} className="flex items-center justify-between p-2.5 bg-[#111112] rounded-xl border border-[#2A2E39]">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-[#D1D4DC]">{ref.username}</span>
                      <span className="text-[9px] text-[#8A91A5]">{new Date(ref.created_at).toLocaleDateString()}</span>
                    </div>
                    {ref.verified ? (
                      <span className="text-[9px] bg-[#089981]/15 text-[#089981] border border-[#089981]/25 px-1.5 py-0.5 rounded-full font-bold">
                        Verified
                      </span>
                    ) : (
                      <span className="text-[9px] bg-[#2A2E39]/80 text-[#8A91A5] px-1.5 py-0.5 rounded-full">
                        Pending
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
