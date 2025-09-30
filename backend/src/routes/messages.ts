import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { io } from '../index';

const router = Router();

router.post('/send', async (req, res) => {
  const { chatId, senderId, content, type = 'text', mediaUrl, fileName, fileSize } = req.body;

  try {
    const messageData = {
      chat_id: chatId,
      sender_id: senderId,
      content,
      message_type: type,
      file_url: mediaUrl,
      file_name: fileName,
      file_size: fileSize,
    };

    const { data: message, error } = await supabase
      .from('messages')
      .insert(messageData)
      .select()
      .single();

    if (error) throw error;

    io.to(`chat_${chatId}`).emit('new_message', message);

    res.json(message);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:chatId', async (req, res) => {
  const { chatId } = req.params;
  const { userId } = req.query;

  try {
    const { data: messages, error } = await supabase
      .from('messages')
      .select(`
        id,
        content,
        message_type,
        file_url,
        file_name,
        file_size,
        created_at,
        sender_id,
        sender:users!messages_sender_id_fkey(id, login, name, avatar)
      `)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) throw error;

    const formattedMessages = (messages || []).map((msg: any) => ({
      id: msg.id,
      text: msg.content || '',
      timestamp: msg.created_at,
      isOwn: msg.sender_id === userId,
      sender: msg.sender?.name || 'Unknown',
      senderAvatar: msg.sender?.avatar || '/placeholder.svg?height=32&width=32',
      senderLogin: msg.sender?.login || 'unknown',
      chatId: chatId,
      ...(msg.message_type === 'image' && { image: msg.file_url }),
      ...(msg.message_type === 'audio' && { audio: msg.file_url }),
      ...(msg.message_type === 'video' && { video: msg.file_url }),
      ...(msg.message_type === 'file' && {
        file: {
          name: msg.file_name || 'file',
          url: msg.file_url || '',
          size: msg.file_size || 0,
          type: 'application/octet-stream',
        },
      }),
    }));

    res.json(formattedMessages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/chat-id/private/:user1Id/:user2Id', async (req, res) => {
  const { user1Id, user2Id } = req.params;

  try {
    const { data: chats } = await supabase
      .from('chats')
      .select(`
        id,
        chat_participants!inner(user_id)
      `)
      .eq('type', 'private');

    if (!chats) return res.json({ chatId: null });

    for (const chat of chats) {
      const { data: participants } = await supabase
        .from('chat_participants')
        .select('user_id')
        .eq('chat_id', chat.id);

      const userIds = participants?.map((p) => p.user_id) || [];
      if (userIds.includes(user1Id) && userIds.includes(user2Id) && userIds.length === 2) {
        return res.json({ chatId: chat.id });
      }
    }

    res.json({ chatId: null });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/chat-id/group/:groupId', async (req, res) => {
  const { groupId } = req.params;

  try {
    const { data: chat } = await supabase
      .from('chats')
      .select('id')
      .eq('group_id', groupId)
      .eq('type', 'group')
      .single();

    res.json({ chatId: chat?.id || null });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/last/:chatId', async (req, res) => {
  const { chatId } = req.params;

  try {
    const { data: message, error } = await supabase
      .from('messages')
      .select('content, created_at, message_type')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !message) {
      return res.json(null);
    }

    res.json({
      text: message.content || '',
      time: new Date(message.created_at),
      type: message.message_type,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
