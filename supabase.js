// Fyll inn dine Supabase-verdier her
const SUPABASE_URL = 'https://awdokoonjrehzmquqdjm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Ss_ZV_vAhmddz9Vni9IpOA_Yz8dpSed';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
