import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, Account, Group, Currency, AIAnalysisResult } from '../types';

// Initialize the API client
// Note: In a real production app, never expose the API KEY in the frontend.
// However, for this client-side demo, we use the env variable.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeFinancialData = async (
  scope: 'Global' | 'Group' | 'Account',
  name: string,
  transactions: Transaction[],
  accounts: Account[],
  currency: Currency,
  totalBalance: number
): Promise<AIAnalysisResult> => {

  // 1. Prepare Context Data
  // We limit transactions to the last 50 to fit in context window and be relevant
  const recentTx = transactions
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 50)
    .map(t => ({
      date: t.date.split('T')[0],
      amount: t.amount,
      reason: t.reason,
      balanceAfter: t.newBalance
    }));

  const accountSummaries = accounts.map(a => `${a.name} (${a.currency}): ${a.balance}`);

  const prompt = `
    Act as an expert financial advisor. Analyze the following financial data for: ${scope} - ${name}.
    
    Context:
    - Total Balance (approx in ${currency}): ${totalBalance}
    - Accounts involved: ${JSON.stringify(accountSummaries)}
    - Recent Transactions (Last 50): ${JSON.stringify(recentTx)}

    Task:
    1. Analyze the "reason" fields in transactions to identify spending habits and income sources.
    2. Identify variability causes.
    3. Provide actionable advice to improve financial health (e.g., debt reduction, saving opportunities).
    4. Keep it concise and professional but friendly.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "A brief summary of the financial situation." },
            keyInsights: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "3-4 bullet points on key observations (e.g. 'High spending on food')."
            },
            spendingHabits: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Patterns observed in the transaction reasons."
            },
            financialAdvice: { type: Type.STRING, description: "Concrete advice for the user." }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as AIAnalysisResult;
    }
    throw new Error("No response from AI");
  } catch (error) {
    console.error("AI Analysis Failed", error);
    return {
      summary: "No se pudo generar el análisis en este momento.",
      keyInsights: [],
      spendingHabits: [],
      financialAdvice: "Por favor intenta nuevamente más tarde."
    };
  }
};