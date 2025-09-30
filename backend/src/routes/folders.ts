import { Router } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

router.get('/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const { data, error } = await supabase
      .from('chat_folders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json(data || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/create', async (req, res) => {
  const { userId, name } = req.body;

  try {
    const { data, error } = await supabase
      .from('chat_folders')
      .insert({
        user_id: userId,
        name,
        chat_ids: [],
      })
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:folderId', async (req, res) => {
  const { folderId } = req.params;
  const { name } = req.body;

  try {
    const { data, error } = await supabase
      .from('chat_folders')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', folderId)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:folderId', async (req, res) => {
  const { folderId } = req.params;

  try {
    const { error } = await supabase
      .from('chat_folders')
      .delete()
      .eq('id', folderId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:folderId/add-chat', async (req, res) => {
  const { folderId } = req.params;
  const { chatId } = req.body;

  try {
    const { data: folder, error: fetchError } = await supabase
      .from('chat_folders')
      .select('chat_ids')
      .eq('id', folderId)
      .single();

    if (fetchError) throw fetchError;

    const chatIds = folder.chat_ids || [];
    if (!chatIds.includes(chatId)) {
      chatIds.push(chatId);
    }

    const { error } = await supabase
      .from('chat_folders')
      .update({ chat_ids: chatIds, updated_at: new Date().toISOString() })
      .eq('id', folderId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:folderId/remove-chat', async (req, res) => {
  const { folderId } = req.params;
  const { chatId } = req.body;

  try {
    const { data: folder, error: fetchError } = await supabase
      .from('chat_folders')
      .select('chat_ids')
      .eq('id', folderId)
      .single();

    if (fetchError) throw fetchError;

    const chatIds = (folder.chat_ids || []).filter((id: string) => id !== chatId);

    const { error } = await supabase
      .from('chat_folders')
      .update({ chat_ids: chatIds, updated_at: new Date().toISOString() })
      .eq('id', folderId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
