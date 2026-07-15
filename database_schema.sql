-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    country TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'trader', 'broker', 'admin')),
    verified BOOLEAN NOT NULL DEFAULT false,
    rating NUMERIC(3,2) NOT NULL DEFAULT 0.00,
    review_count INTEGER NOT NULL DEFAULT 0,
    account_number TEXT UNIQUE,
    referral_code TEXT UNIQUE,
    referred_by UUID REFERENCES public.profiles(id),
    referred_reward_claimed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Wallets Table
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('real', 'demo', 'p2p')),
    balance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    pending_balance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, type)
);

-- Enable RLS for Wallets
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- 3. Trades Table
CREATE TABLE IF NOT EXISTS public.trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
    asset TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
    quantity NUMERIC(25,8) NOT NULL,
    entry_price NUMERIC(25,8) NOT NULL,
    exit_price NUMERIC(25,8),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    duration INTEGER, -- In seconds, closes automatically when elapses
    stop_loss NUMERIC(25,8),
    take_profit NUMERIC(25,8),
    profit_loss NUMERIC(25,8) DEFAULT 0.00,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for Trades
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- 4. Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
    amount NUMERIC(15,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    payment_method TEXT NOT NULL,
    payment_details JSONB,
    screenshot_url TEXT,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for Transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 5. Broker Applications Table
CREATE TABLE IF NOT EXISTS public.broker_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    capital NUMERIC(15,2) NOT NULL CHECK (capital >= 1000.00),
    payment_options JSONB NOT NULL, -- list of accepted payment platforms
    payment_details TEXT NOT NULL,
    instructions TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for Broker Applications
ALTER TABLE public.broker_applications ENABLE ROW LEVEL SECURITY;

-- 6. P2P Offers Table (Broker lists offers)
CREATE TABLE IF NOT EXISTS public.p2p_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
    amount NUMERIC(15,2) NOT NULL,
    min_limit NUMERIC(15,2) NOT NULL,
    max_limit NUMERIC(15,2) NOT NULL,
    payment_method TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for P2P Offers
ALTER TABLE public.p2p_offers ENABLE ROW LEVEL SECURITY;

-- 7. P2P Trades Table
CREATE TABLE IF NOT EXISTS public.p2p_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id UUID NOT NULL REFERENCES public.p2p_offers(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    broker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC(15,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'completed', 'cancelled')),
    payment_screenshot TEXT,
    admin_involved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for P2P Trades
ALTER TABLE public.p2p_trades ENABLE ROW LEVEL SECURITY;

-- 8. P2P Reviews Table
CREATE TABLE IF NOT EXISTS public.p2p_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_id UUID NOT NULL REFERENCES public.p2p_trades(id) ON DELETE CASCADE,
    broker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for P2P Reviews
ALTER TABLE public.p2p_reviews ENABLE ROW LEVEL SECURITY;

-- 9. Insights Table
CREATE TABLE IF NOT EXISTS public.insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for Insights
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;

-- 10. Comments Table
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insight_id UUID NOT NULL REFERENCES public.insights(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for Comments
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- 11. Chats Table
CREATE TABLE IF NOT EXISTS public.chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- NULL means Admin support
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    trade_id UUID REFERENCES public.p2p_trades(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for Chats
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

-- 12. Platform Reviews Table
CREATE TABLE IF NOT EXISTS public.platform_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT NOT NULL,
    approved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for Platform Reviews
ALTER TABLE public.platform_reviews ENABLE ROW LEVEL SECURITY;

-- 13. System Settings Table
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Enable RLS for System Settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;


-----------------------------------------
-- ROW LEVEL SECURITY POLICIES --
-----------------------------------------

-- Profiles Policies
CREATE POLICY "Public profiles are readable by authenticated users" 
    ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update their own profile" 
    ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Wallets Policies
CREATE POLICY "Users can view their own wallets" 
    ON public.wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins/Service can modify wallets" 
    ON public.wallets FOR ALL TO service_role USING (true);

-- Trades Policies
CREATE POLICY "Users can view their own trades" 
    ON public.trades FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trades" 
    ON public.trades FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trades" 
    ON public.trades FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Transactions Policies
CREATE POLICY "Users can view their own transactions" 
    ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can create transactions" 
    ON public.transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Broker Applications Policies
CREATE POLICY "Users can view their own applications" 
    ON public.broker_applications FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can create broker applications" 
    ON public.broker_applications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- P2P Offers Policies
CREATE POLICY "Anyone can view active P2P offers" 
    ON public.p2p_offers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Brokers can manage their own offers" 
    ON public.p2p_offers FOR ALL TO authenticated USING (auth.uid() = broker_id);

-- P2P Trades Policies
CREATE POLICY "Users involved in P2P trades can view them" 
    ON public.p2p_trades FOR SELECT TO authenticated USING (auth.uid() = buyer_id OR auth.uid() = broker_id);

CREATE POLICY "Buyers can initiate P2P trades" 
    ON public.p2p_trades FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Involved parties can update P2P trades" 
    ON public.p2p_trades FOR UPDATE TO authenticated USING (auth.uid() = buyer_id OR auth.uid() = broker_id);

-- P2P Reviews Policies
CREATE POLICY "Anyone can view broker reviews" 
    ON public.p2p_reviews FOR SELECT TO authenticated USING (true);

CREATE POLICY "Buyers can insert reviews" 
    ON public.p2p_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Insights Policies
CREATE POLICY "Anyone can view insights" 
    ON public.insights FOR SELECT TO authenticated USING (true);

-- Comments Policies
CREATE POLICY "Anyone can view comments" 
    ON public.comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create comments" 
    ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Chats Policies
CREATE POLICY "Users can view their own chats" 
    ON public.chats FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = recipient_id OR recipient_id IS NULL);

CREATE POLICY "Users can send chats" 
    ON public.chats FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

-- Platform Reviews Policies
CREATE POLICY "Anyone can view approved reviews" 
    ON public.platform_reviews FOR SELECT TO authenticated USING (approved = true OR auth.uid() = user_id);

CREATE POLICY "Users can create reviews" 
    ON public.platform_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all reviews" 
    ON public.platform_reviews FOR ALL TO service_role USING (true);

-- System Settings Policies
CREATE POLICY "Anyone can view settings" 
    ON public.system_settings FOR SELECT TO authenticated USING (true);


-----------------------------------------
-- AUTHENTICATION REGISTRATION TRIGGER --
-----------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  rand_num INTEGER;
  uname TEXT;
  acc_num TEXT;
  ref_code TEXT;
  ref_by_code TEXT;
  ref_by_id UUID;
  onboarding_bonus_active TEXT;
  initial_bal NUMERIC(15,2);
BEGIN
  uname := COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  rand_num := floor(random() * (999999 - 100000 + 1) + 100000)::integer;
  acc_num := 'XFX-' || rand_num || '-' || uname;
  ref_code := UPPER(SUBSTRING(new.id::text FROM 1 FOR 8));
  
  -- Resolve referred_by from metadata code
  ref_by_code := new.raw_user_meta_data->>'referred_by_code';
  IF ref_by_code IS NOT NULL AND ref_by_code <> '' THEN
    SELECT id INTO ref_by_id FROM public.profiles WHERE referral_code = ref_by_code LIMIT 1;
  END IF;

  INSERT INTO public.profiles (
    id, username, full_name, email, phone, country, role, verified, account_number, referral_code, referred_by, referred_reward_claimed
  )
  VALUES (
    new.id,
    uname,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    COALESCE(new.raw_user_meta_data->>'phone', ''),
    COALESCE(new.raw_user_meta_data->>'country', ''),
    'user',
    false,
    acc_num,
    ref_code,
    ref_by_id,
    false
  ) ON CONFLICT (id) DO NOTHING;

  -- Check onboarding bonus status
  SELECT value INTO onboarding_bonus_active FROM public.system_settings WHERE key = 'onboarding_bonus_enabled';
  IF onboarding_bonus_active = 'true' THEN
    initial_bal := 10.00;
  ELSE
    initial_bal := 0.00;
  END IF;

  -- Create default wallets
  INSERT INTO public.wallets (user_id, type, balance)
  VALUES 
    (new.id, 'real', initial_bal),
    (new.id, 'demo', 10000.00),
    (new.id, 'p2p', 0.00)
  ON CONFLICT (user_id, type) DO NOTHING;

  -- If onboarding bonus was active, record transaction
  IF onboarding_bonus_active = 'true' THEN
    DECLARE
      r_wallet_id UUID;
    BEGIN
      SELECT id INTO r_wallet_id FROM public.wallets WHERE user_id = new.id AND type = 'real' LIMIT 1;
      IF r_wallet_id IS NOT NULL THEN
        INSERT INTO public.transactions (user_id, wallet_id, type, amount, status, payment_method, payment_details)
        VALUES (new.id, r_wallet_id, 'deposit', 10.00, 'approved', 'onboarding_bonus', '{"message": "Welcome onboarding bonus"}');
      END IF;
    END;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution link
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
