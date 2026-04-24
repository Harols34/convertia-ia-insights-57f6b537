const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const match = line.match(/^([^=]+)=\"?(.*)\"?$/);
  if (match) acc[match[1]] = match[2].replace(/\"$/, '');
  return acc;
}, {});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function run() {
  const { data, error } = await supabase.from('leads').select('fch_creacion, tipo_llamada').order('fch_creacion', { ascending: false }).limit(5);
  console.log('LATEST LEADS:', data);
  const { data: ent, error: entErr } = await supabase.from('leads').select('fch_creacion, tipo_llamada').eq('tipo_llamada', 'Entrante').order('fch_creacion', { ascending: false }).limit(5);
  console.log('LATEST ENTRANTE LEADS:', ent);
}
run();
