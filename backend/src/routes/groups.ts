import { Router } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

router.post('/create', async (req, res) => {
  const { name, description, adminId, participantIds } = req.body;

  try {
    const { data: group, error } = await supabase
      .from('groups')
      .insert({
        name,
        description,
        admin_id: adminId,
        avatar: `/placeholder.svg?height=100&width=100&query=group ${name}`,
      })
      .select()
      .single();

    if (error) throw error;

    const participants = [adminId, ...participantIds].map((userId: string) => ({
      group_id: group.id,
      user_id: userId,
      role: userId === adminId ? 'admin' : 'member',
    }));

    await supabase.from('group_participants').insert(participants);

    const { data: chat } = await supabase
      .from('chats')
      .insert({ type: 'group', group_id: group.id })
      .select()
      .single();

    if (chat) {
      await supabase
        .from('chat_participants')
        .insert(participants.map((p) => ({ chat_id: chat.id, user_id: p.user_id })));
    }

    res.json(group);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const { data: groups, error } = await supabase
      .from('group_participants')
      .select(`
        groups (
          id, name, description, avatar, admin_id, created_at
        )
      `)
      .eq('user_id', userId);

    if (error) throw error;

    const result = groups?.map((g: any) => g.groups).filter(Boolean) || [];
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:groupId', async (req, res) => {
  const { groupId } = req.params;
  const updates = req.body;

  try {
    const { data, error } = await supabase
      .from('groups')
      .update(updates)
      .eq('id', groupId)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:groupId/:userId', async (req, res) => {
  const { groupId, userId } = req.params;

  try {
    const { error } = await supabase
      .from('group_participants')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
