import { supabase } from '../supabaseClient';
import { Account, Group, Transaction, AppData, AccountType, Currency } from '../types';

export const api = {
  auth: {
    login: async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      return {
        id: data.user.id,
        username: data.user.user_metadata?.username || email.split('@')[0],
        isPremium: !!data.user.user_metadata?.isPremium
      };
    },
    register: async (email: string, username: string, password: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username, isPremium: false }
        }
      });
      if (error) throw error;
      if (!data.user) throw new Error('Registration failed');

      return {
        id: data.user.id,
        username: username,
        isPremium: false,
        pendingConfirmation: data.session === null
      };
    },
    resetPassword: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://its-camilo.github.io/smartfi/set-password',
      });
      if (error) throw error;
    },
    updatePassword: async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    updatePremiumStatus: async (isPremium: boolean) => {
      const { error } = await supabase.auth.updateUser({
        data: { isPremium }
      });
      if (error) throw error;
    },
    getUser: async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        return {
          id: data.user.id,
          username: data.user.user_metadata?.username || data.user.email?.split('@')[0] || 'Usuario',
          isPremium: !!data.user.user_metadata?.isPremium
        };
      }
      return null;
    },
    onAuthStateChange: (callback: (user: any) => void) => {
      return supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          callback({
            id: session.user.id,
            username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'Usuario',
            isPremium: !!session.user.user_metadata?.isPremium
          });
        } else {
          callback(null);
        }
      });
    },
    loginWithGoogle: async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    },
    logout: async () => {
      await supabase.auth.signOut();
    }
  },

  data: {
    // Fetch all data for the logged-in user
    fetchAll: async (): Promise<AppData> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const [groups, accounts, transactions] = await Promise.all([
        supabase.from('groups').select('*'),
        supabase.from('accounts').select('*'),
        supabase.from('transactions').select('*')
      ]);

      if (groups.error) throw groups.error;
      if (accounts.error) throw accounts.error;
      if (transactions.error) throw transactions.error;

      // Map snake_case (DB) to camelCase (App)
      return {
        groups: groups.data.map((g: any) => ({
          id: g.id,
          userId: g.user_id,
          name: g.name
        })),
        accounts: accounts.data.map((a: any) => ({
          id: a.id,
          userId: a.user_id,
          groupId: a.group_id,
          name: a.name,
          description: a.description,
          type: a.type as AccountType,
          currency: a.currency as Currency,
          balance: Number(a.balance),
          creditLimit: a.credit_limit ? Number(a.credit_limit) : undefined,
          initialBalance: Number(a.initial_balance),
          createdAt: a.created_at
        })),
        transactions: transactions.data.map((t: any) => ({
          id: t.id,
          userId: t.user_id,
          accountId: t.account_id,
          amount: Number(t.amount),
          newBalance: Number(t.new_balance),
          date: t.date,
          reason: t.reason,
          exchangeRateUsed: Number(t.exchange_rate_used)
        })),
        settings: {
          usdToCopRate: 4000 // In a real app, this could be stored in a 'settings' table or user metadata
        }
      };
    },

    // Create Group
    createGroup: async (group: Group) => {
      const { error } = await supabase.from('groups').insert({
        id: group.id,
        name: group.name,
        user_id: group.userId
      });
      if (error) throw error;
    },

    // Delete Group
    deleteGroup: async (id: string) => {
      const { error } = await supabase.from('groups').delete().eq('id', id);
      if (error) throw error;
    },

    // Create Account
    createAccount: async (account: Account) => {
      const { error } = await supabase.from('accounts').insert({
        id: account.id,
        group_id: account.groupId,
        name: account.name,
        description: account.description,
        type: account.type,
        currency: account.currency,
        balance: account.balance,
        credit_limit: account.creditLimit,
        initial_balance: account.initialBalance,
        created_at: account.createdAt,
        user_id: account.userId
      });
      if (error) throw error;
    },

    // Update Account
    updateAccount: async (id: string, updates: Partial<Account>) => {
      // Map updates to snake_case
      const dbUpdates: any = {};
      if (updates.balance !== undefined) dbUpdates.balance = updates.balance;
      if (updates.creditLimit !== undefined) dbUpdates.credit_limit = updates.creditLimit;
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.groupId !== undefined) dbUpdates.group_id = updates.groupId;

      const { error } = await supabase.from('accounts').update(dbUpdates).eq('id', id);
      if (error) throw error;
    },

    // Delete Account
    deleteAccount: async (id: string) => {
      // Transactions should be deleted by cascade in DB, but let's be safe
      await supabase.from('transactions').delete().eq('account_id', id);
      const { error } = await supabase.from('accounts').delete().eq('id', id);
      if (error) throw error;
    },

    // Create Transaction
    createTransaction: async (tx: Transaction) => {
      const { error } = await supabase.from('transactions').insert({
        id: tx.id,
        account_id: tx.accountId,
        amount: tx.amount,
        new_balance: tx.newBalance,
        date: tx.date,
        reason: tx.reason,
        exchange_rate_used: tx.exchangeRateUsed,
        user_id: tx.userId
      });
      if (error) throw error;
    }
  }
};