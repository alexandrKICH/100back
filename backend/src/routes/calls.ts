import { Router } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

router.post('/initiate', async (req, res) => {
  const { callerId, receiverId, type } = req.body;

  try {
    const { data: call, error } = await supabase
      .from('calls')
      .insert({
        caller_id: callerId,
        receiver_id: receiverId,
        type,
        status: 'ringing',
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ callId: call.id });
  } catch (error: any) {
    const mockCallId = 'mock_call_' + Date.now();
    res.json({ callId: mockCallId });
  }
});

router.put('/accept/:callId', async (req, res) => {
  const { callId } = req.params;

  try {
    const { error } = await supabase
      .from('calls')
      .update({ status: 'active' })
      .eq('id', callId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/decline/:callId', async (req, res) => {
  const { callId } = req.params;

  try {
    const { error } = await supabase
      .from('calls')
      .update({ status: 'declined' })
      .eq('id', callId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/end/:callId', async (req, res) => {
  const { callId } = req.params;

  try {
    const { error } = await supabase
      .from('calls')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
      })
      .eq('id', callId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/active/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const { data: calls, error } = await supabase
      .from('calls')
      .select('*')
      .or(`caller_id.eq.${userId},receiver_id.eq.${userId}`)
      .in('status', ['ringing', 'active'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(calls || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
