import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { authenticate } from './auth';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export default async function chatRoutes(fastify: FastifyInstance) {

  // 1. Get messages (general support messages, trade_id is null)
  fastify.get('/api/chats', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    
    let query = supabaseAdmin
      .from('chats')
      .select('*, sender:profiles!chats_sender_id_fkey(username, role), recipient:profiles!chats_recipient_id_fkey(username, role)')
      .is('trade_id', null);

    // Admin sees all support messages. Users see messages they sent or received, or support chats
    if (user.role !== 'admin') {
      query = query.or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`);
    }

    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) return reply.code(500).send({ error: error.message });
    return data;
  });

  // 2. Send a new general support message
  fastify.post('/api/chats', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { message, recipientId } = request.body as any;
    const user = request.user!;

    if (!message || message.trim() === '') {
      return reply.code(400).send({ error: 'Message content cannot be empty' });
    }

    const { data, error } = await supabaseAdmin
      .from('chats')
      .insert({
        sender_id: user.id,
        recipient_id: recipientId || null,
        message,
        trade_id: null,
        is_read: false
      })
      .select('*, sender:profiles!chats_sender_id_fkey(username, role), recipient:profiles!chats_recipient_id_fkey(username, role)')
      .single();

    if (error) return reply.code(500).send({ error: error.message });

    return { success: true, chat: data };
  });

  // 3. Get distinct users chatted with (for Admin support dashboard)
  fastify.get('/api/chats/contacts', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;

    if (user.role !== 'admin') {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, username, role')
        .in('role', ['admin', 'broker']);

      if (error) return reply.code(500).send({ error: error.message });
      return data;
    }

    // Find all distinct senders in support chats (trade_id is null)
    const { data, error } = await supabaseAdmin
      .from('chats')
      .select('sender_id, sender:profiles!chats_sender_id_fkey(username)')
      .is('trade_id', null)
      .neq('sender_id', user.id);

    if (error) return reply.code(500).send({ error: error.message });

    const contactsMap = new Map();
    data.forEach(item => {
      if (item.sender) {
        const senderVal = item.sender as any;
        const name = Array.isArray(senderVal) ? senderVal[0]?.username : senderVal?.username;
        contactsMap.set(item.sender_id, name);
      }
    });

    return Array.from(contactsMap.entries()).map(([id, username]) => ({ id, username, role: 'user' }));
  });

  // 4. GET trade-specific P2P chat messages
  fastify.get('/api/chats/trade/:tradeId', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tradeId } = request.params as any;
    const user = request.user!;

    // Fetch the trade to authorize
    const { data: trade } = await supabaseAdmin
      .from('p2p_trades')
      .select('*')
      .eq('id', tradeId)
      .single();

    if (!trade) {
      return reply.code(404).send({ error: 'P2P Trade not found' });
    }

    // Allow buyer, broker, or admin (if dispute is raised or admin role)
    if (trade.buyer_id !== user.id && trade.broker_id !== user.id && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Forbidden: You are not authorized to view this trade chat' });
    }

    const { data, error } = await supabaseAdmin
      .from('chats')
      .select('*, sender:profiles!chats_sender_id_fkey(username, role), recipient:profiles!chats_recipient_id_fkey(username, role)')
      .eq('trade_id', tradeId)
      .order('created_at', { ascending: true });

    if (error) return reply.code(500).send({ error: error.message });
    return data;
  });

  // 5. POST a message to a trade-specific P2P chat
  fastify.post('/api/chats/trade/:tradeId', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tradeId } = request.params as any;
    const { message } = request.body as any;
    const user = request.user!;

    if (!message || message.trim() === '') {
      return reply.code(400).send({ error: 'Message content cannot be empty' });
    }

    const { data: trade } = await supabaseAdmin
      .from('p2p_trades')
      .select('*')
      .eq('id', tradeId)
      .single();

    if (!trade) {
      return reply.code(404).send({ error: 'P2P Trade not found' });
    }

    if (trade.buyer_id !== user.id && trade.broker_id !== user.id && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Forbidden: You cannot post to this trade chat' });
    }

    // Determine recipient
    let recipientId = null;
    if (user.id === trade.buyer_id) {
      recipientId = trade.broker_id;
    } else if (user.id === trade.broker_id) {
      recipientId = trade.buyer_id;
    }

    const { data, error } = await supabaseAdmin
      .from('chats')
      .insert({
        sender_id: user.id,
        recipient_id: recipientId,
        trade_id: tradeId,
        message,
        is_read: false
      })
      .select('*, sender:profiles!chats_sender_id_fkey(username, role), recipient:profiles!chats_recipient_id_fkey(username, role)')
      .single();

    if (error) return reply.code(500).send({ error: error.message });
    return { success: true, chat: data };
  });

  // 6. Mark messages as read
  fastify.post('/api/chats/read', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { senderId, tradeId } = request.body as any;
    const user = request.user!;

    let query = supabaseAdmin
      .from('chats')
      .update({ is_read: true });

    if (tradeId) {
      // Mark all unread messages for this trade where the user is recipient
      query = query.eq('trade_id', tradeId).eq('recipient_id', user.id);
    } else if (senderId) {
      // Mark support messages from a specific sender to the current user
      query = query.eq('sender_id', senderId).eq('recipient_id', user.id).is('trade_id', null);
    } else {
      // Mark all support messages to user or support admin as read
      if (user.role === 'admin') {
        query = query.is('recipient_id', null).is('trade_id', null);
      } else {
        query = query.eq('recipient_id', user.id).is('trade_id', null);
      }
    }

    const { error } = await query;
    if (error) return reply.code(500).send({ error: error.message });
    return { success: true };
  });

  // 7. Get unread messages count
  fastify.get('/api/chats/unread-count', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;

    let query = supabaseAdmin
      .from('chats')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false);

    if (user.role === 'admin') {
      // Admin unread are support messages from users (where recipient_id is null)
      query = query.is('recipient_id', null).is('trade_id', null);
    } else {
      // User unread are messages directed specifically to them
      query = query.eq('recipient_id', user.id);
    }

    const { count, error } = await query;
    if (error) return reply.code(500).send({ error: error.message });
    return { count: count || 0 };
  });
}
