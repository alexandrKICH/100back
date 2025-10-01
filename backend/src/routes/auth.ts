import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { hashPassword, verifyPassword } from '../lib/hash';

const router = Router();

router.post('/register', async (req, res) => {
  const { login, password, name } = req.body;

  try {
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('login', login)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким логином уже существует' });
    }

    const passwordHash = await hashPassword(password);

    const userData = {
      login,
      password_hash: passwordHash,
      name,
      avatar: `/placeholder.svg?height=40&width=40&query=${login}`,
      status: '',
      is_online: true,
    };

    const { data: user, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();

    if (error) throw error;

    const { password_hash, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  const { login, password } = req.body;

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('login', login)
      .maybeSingle();

    if (error) throw error;
    if (!user) {
      return res.status(404).json({ error: `Пользователь "${login}" не найден` });
    }

    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Неверный пароль' });
    }

    await supabase
      .from('users')
      .update({
        is_online: true,
        last_seen: new Date().toISOString(),
      })
      .eq('id', user.id);

    const { password_hash, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/logout', async (req, res) => {
  const { userId } = req.body;

  try {
    await supabase
      .from('users')
      .update({
        is_online: false,
        last_seen: new Date().toISOString(),
      })
      .eq('id', userId);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/user/:userId', async (req, res) => {
  const { userId } = req.params;
  const updates = req.body;

  try {
    const { data, error } = await supabase
      .from('users')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
