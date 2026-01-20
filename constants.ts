import { AppData } from './types';

export const INITIAL_DATA: AppData = {
  accounts: [],
  groups: [],
  transactions: [],
  settings: {
    usdToCopRate: 4000, // Default fallback
  }
};

export const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const PROJECT_START_DATE = '2025-12-31T00:00:00.000Z';
