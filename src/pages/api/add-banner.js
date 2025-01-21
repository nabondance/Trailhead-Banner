import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { th_username, thb_banner_hash, source_env } = req.body;

    if (!th_username || !thb_banner_hash) {
      return res.status(400).json({ error: 'Missing th_username or thb_banner_hash' });
    }

    try {
      const { data, error } = await supabase.from('banners').insert([{ th_username, thb_banner_hash, source_env }]);

      if (error) {
        throw error;
      }

      res.status(200).json({ message: 'Banner added successfully', data });
    } catch (error) {
      console.error('Error adding banner:', error.message);
      res.status(500).json({ error: 'Failed to add banner. Please try again later.' });
    }
  } else {
    res.status(405).end(); // Method Not Allowed
  }
}
