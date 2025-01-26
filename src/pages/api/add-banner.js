import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { thb_data } = req.body;

    if (!thb_data.th_username) {
      return res.status(400).json({ error: 'Missing th_username' });
    }

    try {
      const { data, error } = await supabase.from('banners').insert([
        {
          th_username: thb_data.th_username,
          thb_processing_time: thb_data.thb_processing_time,
          source_env: process.env.VERCEL_ENV ? process.env.VERCEL_ENV : 'development',
          thb_options: thb_data.thb_options,
          thb_version: thb_data.thb_version,
          thb_banner_hash: thb_data.bannerHash,
          th_nb_points: thb_data.rankData.points,
          th_nb_certif: thb_data.certificationsData.certifications.length,
          th_nb_sb: thb_data.superbadgesData.earnedAwards.edges.length,
          th_nb_badge: thb_data.rankData.badges,
          th_certif: thb_data.certificationsData.certifications,
          th_sb: thb_data.superbadgesData.earnedAwards.edges,
          th_mvp: thb_data.mvp,
        },
      ]);

      if (error) {
        res.status(500).json({ error: 'Failed to add banner: ', error });
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
