import { createClient } from '@supabase/supabase-js';

// Instructions:
// 1. Create a project on https://supabase.com
// 2. Run the SQL query below in the SQL Editor to set up your tables.
// 3. Get your URL and ANON KEY from Project Settings > API.
// 4. Create a .env file with REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY

/*
  -- SQL SETUP QUERY --

  create table groups (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    description text,
    user_id uuid references auth.users not null
  );

  create table accounts (
    id uuid default gen_random_uuid() primary key,
    group_id uuid references groups,
    name text not null,
    description text,
    type text not null, -- 'DEBIT' or 'CREDIT'
    currency text not null, -- 'COP' or 'USD'
    balance numeric not null default 0,
    credit_limit numeric,
    initial_balance numeric not null default 0,
    created_at timestamptz default now(),
    user_id uuid references auth.users not null
  );

  create table transactions (
    id uuid default gen_random_uuid() primary key,
    account_id uuid references accounts not null,
    amount numeric not null,
    new_balance numeric not null,
    date timestamptz not null,
    reason text,
    exchange_rate_used numeric,
    user_id uuid references auth.users not null
  );

  -- Enable RLS
  alter table groups enable row level security;
  alter table accounts enable row level security;
  alter table transactions enable row level security;

  -- Policies (Example for authenticated users)
  create policy "Users can only access their own data" on groups for all using (auth.uid() = user_id);
  create policy "Users can only access their own data" on accounts for all using (auth.uid() = user_id);
  create policy "Users can only access their own data" on transactions for all using (auth.uid() = user_id);
*/

// Support both standard CRA/Webpack (process.env) and Vite (import.meta.env)
const getEnvVar = (key: string) => {
  // @ts-ignore
  const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : (typeof process !== 'undefined' ? process.env : {});

  if (env[key]) return env[key];

  const viteKey = key.startsWith('REACT_APP_') ? key.replace('REACT_APP_', 'VITE_') : `VITE_${key}`;
  if (env[viteKey]) return env[viteKey];

  return '';
};

const supabaseUrl = getEnvVar('REACT_APP_SUPABASE_URL');
const supabaseKey = getEnvVar('REACT_APP_SUPABASE_ANON_KEY');

// To prevent the app from crashing immediately if keys are missing, we use a placeholder.
// The app will check isSupabaseConfigured() to warn the user.
const validUrl = supabaseUrl || 'https://placeholder.supabase.co';
const validKey = supabaseKey || 'placeholder';

export const supabase = createClient(validUrl, validKey);

export const isSupabaseConfigured = () => {
  return !!supabaseUrl && !!supabaseKey;
};