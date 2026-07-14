import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      username: string;
      email: string;
      role: 'user' | 'trader' | 'broker' | 'admin';
    };
  }
}

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const jwtSecret = process.env.JWT_SECRET || 'extreme_jwt_secret_2026_key_long_enough_to_be_secure';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Middleware for authenticated routes
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies.token;
  if (!token) {
    reply.code(401).send({ error: 'Unauthorized: No session token found' });
    return;
  }

  try {
    const decoded: any = jwt.verify(token, jwtSecret);
    request.user = decoded;
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized: Session has expired or is invalid' });
  }
}

export default async function authRoutes(fastify: FastifyInstance) {
  // Register User
  fastify.post('/api/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const { username, email, password, fullName, phone, country, referredByCode } = request.body as any;

    if (!username || !email || !password || !fullName || !phone || !country) {
      return reply.code(400).send({ error: 'All fields are required' });
    }

    if (password.length < 8) {
      return reply.code(400).send({ error: 'Password must be at least 8 characters long' });
    }

    // Check if username already exists in profiles
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existingUser) {
      return reply.code(400).send({ error: 'Username is already taken' });
    }

    // Create user in Supabase Auth (automatically triggers profiles & wallets insertions in SQL)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        full_name: fullName,
        phone,
        country,
        referred_by_code: referredByCode || null
      }
    });

    if (authError) {
      return reply.code(400).send({ error: authError.message });
    }

    // Fetch the inserted profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      return reply.code(500).send({ error: 'Failed to create user profile sync' });
    }

    // Fallback: If trigger didn't resolve referred_by but referredByCode was provided
    if (referredByCode && !profile.referred_by) {
      const { data: referrer } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('referral_code', referredByCode)
        .maybeSingle();

      if (referrer && referrer.id !== profile.id) {
        await supabaseAdmin
          .from('profiles')
          .update({ referred_by: referrer.id })
          .eq('id', profile.id);
        profile.referred_by = referrer.id;
      }
    }

    // Generate JWT Token
    const token = jwt.sign({
      id: profile.id,
      email: profile.email,
      role: profile.role,
      username: profile.username
    }, jwtSecret, { expiresIn: '30d' });

    // Set HttpOnly Cookie
    reply.setCookie('token', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 // 30 days in seconds
    });

    return { user: profile };
  });

  // Get Referred Users list
  fastify.get('/api/auth/referrals', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { data: referrals, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, email, created_at, role, verified')
      .eq('referred_by', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return reply.code(500).send({ error: error.message });
    }
    return referrals || [];
  });

  // Login User (support both username or email)
  fastify.post('/api/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const { usernameOrEmail, password } = request.body as any;

    if (!usernameOrEmail || !password) {
      return reply.code(400).send({ error: 'Username/Email and password are required' });
    }

    let emailToUse = usernameOrEmail;

    // Check if it is a username
    if (!usernameOrEmail.includes('@')) {
      const { data: profileData } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('username', usernameOrEmail)
        .maybeSingle();

      if (!profileData) {
        return reply.code(400).send({ error: 'No user exists with this username' });
      }
      emailToUse = profileData.email;
    }

    // Sign in using Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: emailToUse,
      password
    });

    if (authError) {
      return reply.code(400).send({ error: authError.message });
    }

    // Fetch details from profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      return reply.code(500).send({ error: 'Failed to fetch user profile' });
    }

    // Generate JWT Token
    const token = jwt.sign({
      id: profile.id,
      email: profile.email,
      role: profile.role,
      username: profile.username
    }, jwtSecret, { expiresIn: '30d' });

    // Set HttpOnly Cookie
    reply.setCookie('token', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 // 30 days in seconds
    });

    return { user: profile };
  });

  // Logout User
  fastify.post('/api/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.clearCookie('token', { path: '/' });
    return { success: true };
  });

  // Get Current Authenticated User profile
  fastify.get('/api/auth/user', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies.token;
    if (!token) {
      return reply.code(401).send({ error: 'No active session' });
    }

    try {
      const decoded: any = jwt.verify(token, jwtSecret);
      
      // Fetch fresh profile from database
      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', decoded.id)
        .single();

      if (error || !profile) {
        return reply.code(401).send({ error: 'User profile not found' });
      }

      // Fetch wallet balances
      const { data: wallets } = await supabaseAdmin
        .from('wallets')
        .select('*')
        .eq('user_id', decoded.id);

      return { user: profile, wallets: wallets || [] };
    } catch (err) {
      reply.clearCookie('token', { path: '/' });
      return reply.code(401).send({ error: 'Session expired or invalid' });
    }
  });

  // Update Profile details
  fastify.post('/api/auth/profile/update', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { username } = request.body as any;
    const user = request.user!;

    if (!username) {
      return reply.code(400).send({ error: 'Username is required' });
    }

    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .neq('id', user.id)
      .maybeSingle();

    if (existingUser) {
      return reply.code(400).send({ error: 'Username is already taken' });
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: { username }
    });
    if (authError) return reply.code(500).send({ error: authError.message });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ username })
      .eq('id', user.id)
      .select()
      .single();

    if (profileError) return reply.code(500).send({ error: profileError.message });

    const token = jwt.sign({
      id: profile.id,
      email: profile.email,
      role: profile.role,
      username: profile.username
    }, jwtSecret, { expiresIn: '30d' });

    reply.setCookie('token', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60
    });

    return { success: true, user: profile };
  });

  // Change Password directly
  fastify.post('/api/auth/password/change', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { newPassword } = request.body as any;
    const user = request.user!;

    if (!newPassword || newPassword.length < 8) {
      return reply.code(400).send({ error: 'New password must be at least 8 characters long' });
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: newPassword
    });

    if (error) return reply.code(500).send({ error: error.message });

    return { success: true, message: 'Password updated successfully' };
  });
}
