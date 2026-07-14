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

export default async function insightsRoutes(fastify: FastifyInstance) {

  // 1. Get all insights
  fastify.get('/api/insights', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { data, error } = await supabaseAdmin
      .from('insights')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return reply.code(500).send({ error: error.message });
    return data;
  });

  // 2. Get insight with comments
  fastify.get('/api/insights/:id', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;

    const { data: insight, error: insightErr } = await supabaseAdmin
      .from('insights')
      .select('*')
      .eq('id', id)
      .single();

    if (insightErr || !insight) {
      return reply.code(404).send({ error: 'Insight not found' });
    }

    const { data: comments, error: commentsErr } = await supabaseAdmin
      .from('comments')
      .select('*, profile:profiles(username)')
      .eq('insight_id', id)
      .order('created_at', { ascending: true });

    return {
      insight,
      comments: comments || []
    };
  });

  // 3. Post a comment
  fastify.post('/api/insights/:id/comments', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const { content } = request.body as any;
    const user = request.user!;

    if (!content || content.trim() === '') {
      return reply.code(400).send({ error: 'Comment content is required' });
    }

    const { data, error } = await supabaseAdmin
      .from('comments')
      .insert({
        insight_id: id,
        user_id: user.id,
        content
      })
      .select('*, profile:profiles(username)')
      .single();

    if (error) return reply.code(500).send({ error: error.message });
    return data;
  });

  // 4. Delete comment
  fastify.delete('/api/insights/comments/:commentId', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { commentId } = request.params as any;
    const user = request.user!;

    const { data: comment } = await supabaseAdmin
      .from('comments')
      .select('*')
      .eq('id', commentId)
      .single();

    if (!comment) {
      return reply.code(404).send({ error: 'Comment not found' });
    }

    // Allow author or admin to delete comment
    if (comment.user_id !== user.id && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Forbidden: You can only delete your own comments' });
    }

    const { error } = await supabaseAdmin
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) return reply.code(500).send({ error: error.message });
    return { success: true };
  });
}
