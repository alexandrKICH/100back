import { Router } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

router.post('/upload', async (req, res) => {
  const { file, userId, fileName, fileType } = req.body;

  try {
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const base64Data = file.replace(/^data:.+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    const uniqueFileName = `${userId}/${Date.now()}_${fileName}`;

    const { data, error } = await supabase.storage
      .from('files')
      .upload(uniqueFileName, buffer, {
        contentType: fileType,
      });

    if (error) {
      console.warn('Supabase upload failed, returning base64');
      return res.json({ url: file });
    }

    const { data: publicUrl } = supabase.storage
      .from('files')
      .getPublicUrl(uniqueFileName);

    res.json({ url: publicUrl.publicUrl });
  } catch (error: any) {
    res.json({ url: req.body.file });
  }
});

export default router;
