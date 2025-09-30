import { Router } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

router.get('/search', async (req, res) => {
  const { query, userId } = req.query;

  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, login, name, avatar, is_online, last_seen')
      .neq('id', userId as string)
      .or(`login.ilike.%${query}%,name.ilike.%${query}%`)
      .order('is_online', { ascending: false })
      .limit(20);

    if (error) throw error;

    res.json(users || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/add', async (req, res) => {
  const { userId, contactUserId } = req.body;

  try {
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', userId)
      .eq('contact_user_id', contactUserId)
      .maybeSingle();

    if (existingContact) {
      return res.status(400).json({ error: 'Контакт уже добавлен' });
    }

    const { data: contact, error } = await supabase
      .from('contacts')
      .insert({
        user_id: userId,
        contact_user_id: contactUserId,
      })
      .select()
      .single();

    if (error) throw error;

    const chatId = await createPrivateChat(userId, contactUserId);

    res.json({ contact, chatId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select(`
        *,
        contact_user:contact_user_id (
          id, login, name, avatar, is_online, last_seen
        )
      `)
      .eq('user_id', userId);

    if (error) throw error;

    const { data: userChats } = await supabase
      .from('chat_participants')
      .select('chat_id, chats!inner(type)')
      .eq('user_id', userId)
      .eq('chats.type', 'private');

    const explicitContactIds = new Set((contacts || []).map((c: any) => c.contact_user?.id).filter(Boolean));
    const allContacts = [...(contacts || [])];

    if (userChats && userChats.length > 0) {
      const chatIds = userChats.map((c: any) => c.chat_id);

      const { data: otherParticipants } = await supabase
        .from('chat_participants')
        .select(`
          chat_id,
          user_id,
          users!user_id(id, login, name, avatar, is_online, last_seen)
        `)
        .in('chat_id', chatIds)
        .neq('user_id', userId);

      if (otherParticipants) {
        for (const participant of otherParticipants) {
          const user = Array.isArray(participant.users) ? participant.users[0] : participant.users;
          if (user && !explicitContactIds.has(user.id)) {
            allContacts.push({
              id: `chat_${participant.chat_id}`,
              user_id: userId,
              contact_user_id: user.id,
              contact_user: user,
              created_at: new Date().toISOString(),
            });
            explicitContactIds.add(user.id);
          }
        }
      }
    }

    res.json(allContacts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:userId/:contactUserId', async (req, res) => {
  const { userId, contactUserId } = req.params;

  try {
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('user_id', userId)
      .eq('contact_user_id', contactUserId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

async function createPrivateChat(user1Id: string, user2Id: string) {
  const { data: existingChat } = await supabase
    .from('chats')
    .select(`
      id,
      chat_participants!inner(user_id)
    `)
    .eq('type', 'private');

  if (existingChat) {
    for (const chat of existingChat) {
      const { data: participants } = await supabase
        .from('chat_participants')
        .select('user_id')
        .eq('chat_id', chat.id);

      const userIds = participants?.map((p) => p.user_id) || [];
      if (userIds.includes(user1Id) && userIds.includes(user2Id) && userIds.length === 2) {
        return chat.id;
      }
    }
  }

  const { data: chat, error } = await supabase
    .from('chats')
    .insert({ type: 'private' })
    .select()
    .single();

  if (error) throw error;

  await supabase.from('chat_participants').insert([
    { chat_id: chat.id, user_id: user1Id },
    { chat_id: chat.id, user_id: user2Id },
  ]);

  return chat.id;
}

export default router;
