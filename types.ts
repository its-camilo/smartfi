export enum Currency {
  COP = 'COP',
  USD = 'USD'
}

export enum AccountType {
  DEBIT = 'DEBIT', // Cash, Savings, Investments
  CREDIT = 'CREDIT' // Credit Cards (Liabilities)
}

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  amount: number;
  newBalance: number;
  date: string; // ISO String
  exchangeRateUsed: number;
}

export interface Account {
  id: string;
  userId: string;
  groupId: string | null;
  name: string;
  description: string | null;
  type: AccountType;
  currency: Currency;
  balance: number;
  creditLimit?: number;
  initialBalance: number;
  createdAt: string;
}

export interface Group {
  id: string;
  userId: string;
  name: string;
}

export interface UserProfile {
  id: string;
  username: string;
  isPremium: boolean;
}

export interface AppData {
  accounts: Account[];
  groups: Group[];
  transactions: Transaction[];
  settings: {
    usdToCopRate: number;
  };
}

export interface AIAnalysisResult {
  summary: string;
  keyInsights: string[];
  spendingHabits: string[];
  financialAdvice: string;
}