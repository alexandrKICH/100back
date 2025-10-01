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

// NEW BATCH ENDPOINT - Gets all last messages for user's chats in ONE query
// FIXED: Now handles both private and group chats correctly with proper UI keys
router.get('/batch/last-messages/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    // Get all user's chats (private and group) with type info
    const { data: userChats, error: chatsError } = await supabase
      .from('chat_participants')
      .select('chat_id, chats!inner(type, group_id)')
      .eq('user_id', userId);

    if (chatsError) throw chatsError;
    if (!userChats || userChats.length === 0) {
      return res.json({});
    }

    const chatIds = userChats.map((c: any) => c.chat_id);

    // Get last message for each chat in ONE query
    const { data: allMessages, error: messagesError } = await supabase
      .from('messages')
      .select('chat_id, content, created_at, message_type')
      .in('chat_id', chatIds)
      .order('chat_id')
      .order('created_at', { ascending: false });

    if (messagesError) throw messagesError;

    // Group messages by chat_id and get the latest one for each
    const lastMessagesByChatId: Record<string, any> = {};
    const seenChats = new Set<string>();

    if (allMessages) {
      for (const msg of allMessages) {
        if (!seenChats.has(msg.chat_id)) {
          seenChats.add(msg.chat_id);
          lastMessagesByChatId[msg.chat_id] = {
            text: msg.content || '',
            time: new Date(msg.created_at),
            type: msg.message_type,
          };
        }
      }
    }

    // Get all participants for private chats to determine the other user
    const { data: allParticipants, error: participantsError } = await supabase
      .from('chat_participants')
      .select('chat_id, user_id')
      .in('chat_id', chatIds)
      .neq('user_id', userId);

    if (participantsError) throw participantsError;

    // Map chat_id to the other user's ID (for private chats only)
    const chatToOtherUser: Record<string, string> = {};
    if (allParticipants) {
      for (const participant of allParticipants) {
        chatToOtherUser[participant.chat_id] = participant.user_id;
      }
    }

    // Build result with proper UI keys:
    // - For private chats: key = other user's ID
    // - For group chats: key = group_id
    const result: Record<string, any> = {};
    
    for (const chat of userChats) {
      const chatId = chat.chat_id;
      const chatInfo = Array.isArray(chat.chats) ? chat.chats[0] : chat.chats;
      const message = lastMessagesByChatId[chatId];
      
      if (message && chatInfo) {
        let uiKey: string;
        
        if (chatInfo.type === 'group' && chatInfo.group_id) {
          // For groups: use group_id as key
          uiKey = chatInfo.group_id;
        } else {
          // For private chats: use other user's ID as key
          uiKey = chatToOtherUser[chatId];
        }
        
        if (uiKey) {
          result[uiKey] = message;
        }
      }
    }

    res.json(result);
  } catch (error: any) {
    console.error('Batch last messages error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
