import React, { useState, useEffect, useMemo, createContext, useContext } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
  useLocation,
  Navigate
} from 'react-router-dom';
import {
  LayoutDashboard,
  Wallet,
  Plus,
  ArrowRightLeft,
  Menu,
  X,
  TrendingUp,
  Trash2,
  LogOut,
  Loader2,
  AlertTriangle,
  Settings,
  ArrowUp,
  ArrowDown,
  Edit
} from 'lucide-react';

// Modules
import { AppData, Account, Group, Transaction, Currency, AccountType, UserProfile } from './types';
import { INITIAL_DATA, PROJECT_START_DATE } from './constants';
import { api } from './services/api';
import { isSupabaseConfigured } from './supabaseClient';

// Charts
import {
  ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, AreaChart, Area, ComposedChart, Tooltip,
  Bar, Cell, Line, PieChart, Pie
} from 'recharts';

// --- AUTH CONTEXT ---

interface AuthContextType {
  user: UserProfile | null;
  login: (email: string, p: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (email: string, username: string, p: string) => Promise<boolean>; // Returns true if pending confirmation
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (p: string) => Promise<void>;
  updatePremiumStatus: (isPremium: boolean) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --- BUDGET CONTEXT ---

interface BudgetContextType {
  data: AppData;
  loading: boolean;
  refresh: () => Promise<void>;
  addAccount: (account: Account) => Promise<void>;
  updateAccount: (id: string, updates: Partial<Account>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  addGroup: (group: Group) => Promise<void>;
  updateGroup: (id: string, updates: Partial<Group>) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  addTransaction: (transaction: Transaction, updateAccountBalance: boolean) => Promise<void>;
  updateUSDRate: (rate: number) => void;
  getFormattedValue: (value: number, currency: Currency) => string;
  convertValue: (value: number, from: Currency, to: Currency) => number;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  setPremiumModalOpen: (open: boolean) => void;
  user: UserProfile | null;
}

const BudgetContext = createContext<BudgetContextType | undefined>(undefined);

// --- HOOKS USED ---

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

const useBudget = () => {
  const context = useContext(BudgetContext);
  if (!context) throw new Error("useBudget must be used within BudgetProvider");
  return context;
};

const MAX_FREE_ACCOUNTS = 3;
const MAX_FREE_GROUPS = 1;

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children?: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b border-slate-700">
          <h3 className="text-xl font-bold text-slate-100">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={24} /></button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
};

const TimeRangeSelector = ({ current, onChange }: { current: string, onChange: (r: any) => void }) => (
  <div className="flex bg-slate-900 rounded-lg p-1 overflow-x-auto max-w-full">
    {['1M', '3M', '6M', '1Y', 'ALL'].map(range => (
      <button
        key={range}
        onClick={() => onChange(range)}
        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${current === range
          ? 'bg-slate-700 text-white shadow-sm'
          : 'text-slate-400 hover:text-slate-200'
          }`}
      >
        {range}
        {current === range && <div className="h-0.5 w-4 bg-blue-500 mx-auto mt-0.5 rounded-full"></div>}
      </button>
    ))}
  </div>
);

// --- PAGES ---

const PremiumModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { updatePremiumStatus } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCodeSubmit = async () => {
    setError('');
    const secretCode = (import.meta as any).env.VITE_PREMIUM_CODE || 'SMARTFI-PRO-2026';
    if (code === secretCode) {
      setLoading(true);
      try {
        await updatePremiumStatus(true);
        alert("¡Felicidades! Ahora eres SmartFi Pro para siempre.");
        onClose();
        window.location.reload();
      } catch (err) {
        setError("Error al activar. Inténtalo de nuevo.");
      } finally {
        setLoading(false);
      }
    } else {
      setError("Código inválido. Verifica e intenta de nuevo.");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mejora a SmartFi Pro 🚀">
      <div className="space-y-6 text-center py-4">
        <div className="bg-indigo-500/10 p-4 rounded-xl border border-indigo-500/20">
          <h4 className="font-bold text-indigo-400 mb-2">Beneficios Premium</h4>
          <ul className="text-sm text-slate-300 space-y-2 text-left list-disc list-inside">
            <li>Cuentas ilimitadas (más de 3)</li>
            <li>Grupos ilimitados (más de 1)</li>
            <li>Analisis de Rendimiento y Bola de Nieve</li>
            <li>Categorias y Etiquetas jerarquicas</li>
          </ul>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-slate-400">Suscríbete mensualmente</p>
          <a
            href={(import.meta as any).env.VITE_PAYPAL_SUBSCRIPTION_URL || "https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-74J23549XT158990DNFXNRNY"}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Wallet size={20} /> Suscribirse ($4.99/mes)
          </a>
        </div>

        <div className="relative py-4">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-slate-700"></div>
          <span className="relative z-10 bg-slate-800 px-4 text-xs text-slate-500 uppercase">O usa un código de acceso</span>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            placeholder="Introduce tu código Pro"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white text-center font-mono tracking-widest focus:border-indigo-500 outline-none"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            onClick={handleCodeSubmit}
            disabled={loading || !code}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : "Activar Acceso de por Vida"}
          </button>
        </div>

        <p className="text-[10px] text-slate-500 mt-4 leading-relaxed">
          Los pagos por PayPal se activan automáticamente. Si pagas por otros medios (Wise, Crypto), contacta a soporte para tu código: <span className="text-indigo-400">camiloalejandrolagosmalaver@gmail.com</span>
        </p>
      </div>
    </Modal>
  );
};

const SetupPage = () => (
  <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
    <div className="bg-slate-900 max-w-2xl w-full p-8 rounded-xl border border-amber-500/30 shadow-2xl">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-4 bg-amber-500/20 rounded-full text-amber-500">
          <AlertTriangle size={32} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Configuración Necesaria</h1>
          <p className="text-slate-400">Conexión a Supabase no detectada</p>
        </div>
      </div>

      <div className="space-y-4 text-slate-300">
        <p>Para usar <strong>SmartFi</strong>, necesitas configurar tu base de datos en Supabase.</p>

        <ol className="list-decimal list-inside space-y-3 ml-2">
          <li>Crea un proyecto gratis en <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">supabase.com</a>.</li>
          <li>Ve a <strong>SQL Editor</strong> y ejecuta el script de creación de tablas (ver <code>supabaseClient.ts</code>).</li>
          <li>Ve a <strong>Project Settings &gt; API</strong>.</li>
          <li>Crea un archivo <code>.env</code> en la raíz del proyecto con tus credenciales:</li>
        </ol>

        <div className="bg-slate-950 p-4 rounded border border-slate-800 font-mono text-xs overflow-x-auto">
          <p>REACT_APP_SUPABASE_URL=https://tu-proyecto.supabase.co</p>
          <p>REACT_APP_SUPABASE_ANON_KEY=tu-anon-key-larga...</p>
        </div>

        <p className="text-sm text-slate-500 italic mt-4">
          Si usas Vite/StackBlitz, usa <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>.
        </p>
      </div>

      <div className="mt-8 text-center">
        <button onClick={() => window.location.reload()} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-bold transition-colors">
          Recargar Aplicación
        </button>
      </div>
    </div>
  </div>
);

const AuthPage = () => {
  const { login, register, resetPassword, loginWithGoogle } = useAuth();
  const [view, setView] = useState<'login' | 'register' | 'forgot' | 'confirm-sent'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (view === 'register') {
        const pending = await register(email, username, password);
        if (pending) {
          setView('confirm-sent');
        }
      } else if (view === 'login') {
        await login(email, password);
      } else if (view === 'forgot') {
        await resetPassword(email);
        setSuccess('Enlace de recuperación enviado a tu correo.');
      }
    } catch (err: any) {
      setError(err.message || 'Error de autenticación');
    } finally {
      setLoading(false);
    }
  };

  if (view === 'confirm-sent') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-center">
        <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl w-full max-w-md space-y-4">
          <div className="mx-auto w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400">
            <Wallet size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white">¡Confirma tu correo!</h2>
          <p className="text-slate-400">Te hemos enviado un enlace de confirmación. Por favor, revisa tu bandeja de entrada y haz clic en el enlace para activar tu cuenta.</p>
          <button onClick={() => setView('login')} className="w-full bg-slate-800 text-white py-3 rounded-lg hover:bg-slate-700 transition-colors">Volver al Inicio</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent mb-1">SmartFi</h1>
          <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">AI Assistant</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 bg-red-900/30 border border-red-800 text-red-300 rounded text-sm">{error}</div>}
          {success && <div className="p-3 bg-emerald-900/30 border border-emerald-800 text-emerald-300 rounded text-sm">{success}</div>}

          <div>
            <label className="block text-xs text-slate-400 mb-1">Correo Electrónico</label>
            <input
              type="email"
              className="w-full bg-slate-800 border border-slate-700 rounded p-3 text-white focus:border-indigo-500 focus:outline-none transition-colors"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              required
            />
          </div>

          {view === 'register' && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nombre de Usuario</label>
              <input
                type="text"
                className="w-full bg-slate-800 border border-slate-700 rounded p-3 text-white focus:border-indigo-500 focus:outline-none transition-colors"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej: camilo_fi"
                required
              />
            </div>
          )}

          {view !== 'forgot' && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Contraseña</label>
              <input
                type="password"
                className="w-full bg-slate-800 border border-slate-700 rounded p-3 text-white focus:border-indigo-500 focus:outline-none transition-colors"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          )}

          {view === 'login' && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => setView('forgot')}
                className="text-xs text-slate-500 hover:text-indigo-400 transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg transition-colors mt-4 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center"
          >
            {loading ? <Loader2 className="animate-spin" /> : (
              view === 'register' ? 'Crear Cuenta' :
                view === 'forgot' ? 'Recuperar Contraseña' : 'Iniciar Sesión'
            )}
          </button>
        </form>

        <div className="mt-4">
          <button
            onClick={() => loginWithGoogle()}
            className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continuar con Google
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800 text-center space-y-3">
          <button
            onClick={() => { setView(view === 'register' ? 'login' : 'register'); setError(''); setSuccess(''); }}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            {view === 'register' ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate gratis'}
          </button>

          {view === 'forgot' && (
            <button
              onClick={() => { setView('login'); setError(''); setSuccess(''); }}
              className="block mx-auto text-sm text-slate-500 hover:text-white transition-colors"
            >
              Volver al Login
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const UpdatePasswordPage = () => {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await updatePassword(password);
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Error actualizando contraseña');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-center">
        <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl w-full max-w-md space-y-4">
          <h2 className="text-2xl font-bold text-white">¡Contraseña Actualizada!</h2>
          <p className="text-slate-400">Ya puedes usar tu nueva contraseña.</p>
          <button onClick={() => window.location.href = '/'} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold">Ir al Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl w-full max-w-md">
        <h2 className="text-2xl font-bold text-white mb-6">Nueva Contraseña</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 bg-red-900/30 text-red-300 rounded text-sm">{error}</div>}
          <input
            type="password"
            required
            placeholder="Nueva contraseña"
            className="w-full bg-slate-800 border border-slate-700 rounded p-3 text-white"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" disabled={loading} className="w-full bg-indigo-600 py-3 rounded-lg text-white font-bold flex justify-center">
            {loading ? <Loader2 className="animate-spin" /> : 'Guardar Cambios'}
          </button>
        </form>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { data, getFormattedValue, convertValue } = useBudget();
  const [timeRange, setTimeRange] = useState('1M');

  const metrics = useMemo(() => {
    let totalAssets = 0;
    let totalLiabilities = 0;
    let liquidity = 0;
    let creditLimitTotal = 0;

    data.accounts.forEach(acc => {
      const valInCop = convertValue(acc.balance, acc.currency, Currency.COP);
      if (acc.type === AccountType.CREDIT) {
        totalLiabilities += valInCop;
        if (acc.creditLimit) {
          creditLimitTotal += convertValue(acc.creditLimit, acc.currency, Currency.COP);
        }
      } else {
        totalAssets += valInCop;
        liquidity += valInCop;
      }
    });

    return { totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities, liquidity, buyingPower: liquidity + (creditLimitTotal - totalLiabilities), creditLimitTotal };
  }, [data, convertValue]);

  // Simplified Chart Logic
  // Historical Trend Reconstruction
  const chartData = useMemo(() => {
    const points = [];
    const start = new Date(PROJECT_START_DATE);
    const now = new Date();

    // 1. Initial State (Current)
    let curLiq = metrics.liquidity;
    let curLiabilities = metrics.totalLiabilities;
    let curLimit = metrics.creditLimitTotal;

    // 2. Walk backwards through transactions
    const sortedTxs = [...data.transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    let txIdx = 0;

    const diffTime = Math.abs(now.getTime() - start.getTime());
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    for (let i = 0; i < diffDays; i++) {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i).getTime();

      // Points represent the state at the BEGINNING of the day
      // So we subtract transactions that happened on or after this day's start
      while (txIdx < sortedTxs.length && new Date(sortedTxs[txIdx].date).getTime() >= dayStart) {
        const tx = sortedTxs[txIdx];
        const acc = data.accounts.find(a => a.id === tx.accountId);
        const amountCOP = tx.exchangeRateUsed ? tx.amount * tx.exchangeRateUsed : tx.amount;

        if (acc?.type === AccountType.CREDIT) {
          curLiabilities -= amountCOP;
        } else {
          curLiq -= amountCOP;
        }
        txIdx++;
      }

      points.unshift({
        date: dayStart,
        netWorth: curLiq - curLiabilities,
        liquidity: curLiq,
        buyingPower: curLiq + (curLimit - curLiabilities)
      });
    }
    return points;
  }, [data, metrics]);

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Panel Principal</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard label="Patrimonio Neto" value={metrics.netWorth} currency={Currency.COP} color="text-white" description="Dinero - Deudas" />
        <MetricCard label="Liquidez Disponible" value={metrics.liquidity} currency={Currency.COP} color="text-emerald-400" description="Dinero" />
        <MetricCard label="Poder de Compra" value={metrics.buyingPower} currency={Currency.COP} color="text-blue-400" description="Dinero + Cupo de Endeudamiento" />
      </div>

      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg min-h-[400px]">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-slate-100">Tendencia Patrimonial</h3>
          <TimeRangeSelector current={timeRange} onChange={setTimeRange} />
        </div>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={chartData}>
            <defs>
              <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ffffff" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorLiquidity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorBuyingPower" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString()} stroke="#64748b" fontSize={10} />
            <YAxis stroke="#64748b" fontSize={10} tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} />
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
              labelFormatter={(l) => new Date(l).toLocaleDateString()}
              formatter={(v: any) => getFormattedValue(v, Currency.COP)}
            />
            <Area type="monotone" dataKey="netWorth" stroke="#ffffff" fill="url(#colorNetWorth)" strokeWidth={2} name="Patrimonio Neto" />
            <Area type="monotone" dataKey="liquidity" stroke="#10b981" fill="url(#colorLiquidity)" strokeWidth={2} name="Liquidez" />
            <Area type="monotone" dataKey="buyingPower" stroke="#3b82f6" fill="url(#colorBuyingPower)" strokeWidth={2} name="Poder de Compra" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const AccountsPage = () => {
  const { data, setData, user, setPremiumModalOpen, addAccount, updateAccount, deleteAccount, addGroup, updateGroup, deleteGroup, addTransaction, getFormattedValue, convertValue } = useBudget();

  // Modals State
  const [modals, setModals] = useState({ group: false, account: false, tx: false, edit: false });
  const [selectedItem, setSelectedItem] = useState<{ type: 'account' | 'group', id: string } | null>(null);

  // Forms
  const [newGroup, setNewGroup] = useState({ name: '' });
  const [newAccount, setNewAccount] = useState<Partial<Account>>({
    name: '', type: AccountType.DEBIT, currency: Currency.COP, balance: 0, groupId: '', category: ''
  });
  const [txForm, setTxForm] = useState({ newBalance: '', newCreditLimit: '', date: new Date().toISOString().split('T')[0] });

  // Handlers
  const handleCreateGroup = async () => {
    if (!newGroup.name) return;
    await addGroup({ id: crypto.randomUUID(), userId: '', name: newGroup.name });
    setModals(m => ({ ...m, group: false })); setNewGroup({ name: '' });
  };

  const handleCreateAccount = async () => {
    if (!newAccount.name) return;
    await addAccount({
      id: crypto.randomUUID(),
      userId: '',
      groupId: newAccount.groupId || null,
      name: newAccount.name,
      description: '',
      type: newAccount.type || AccountType.DEBIT,
      currency: newAccount.currency || Currency.COP,
      balance: Number(newAccount.balance),
      initialBalance: Number(newAccount.balance),
      creditLimit: newAccount.type === AccountType.CREDIT ? Number(newAccount.creditLimit) : undefined,
      createdAt: new Date().toISOString(),
      sortOrder: 0,
      category: newAccount.category || 'Sin Categoría'
    });
    setModals(m => ({ ...m, account: false }));
  };

  const openTxModal = (accId: string) => {
    const acc = data.accounts.find(a => a.id === accId);
    if (acc) {
      setSelectedItem({ type: 'account', id: accId });
      setTxForm({
        newBalance: acc.balance.toString(),
        newCreditLimit: acc.creditLimit?.toString() || '',
        date: new Date().toISOString().split('T')[0]
      });
      setModals(m => ({ ...m, tx: true }));
    }
  };

  const handleUpdateBalance = async () => {
    if (!selectedItem || selectedItem.type !== 'account') return;
    const acc = data.accounts.find(a => a.id === selectedItem.id);
    if (!acc) return;

    if (acc.type === AccountType.CREDIT && txForm.newCreditLimit) {
      await updateAccount(acc.id, { creditLimit: Number(txForm.newCreditLimit) });
    }

    const newBal = Number(txForm.newBalance);
    const diff = newBal - acc.balance;

    if (diff !== 0) {
      await addTransaction({
        id: crypto.randomUUID(),
        userId: '',
        accountId: acc.id,
        amount: diff,
        newBalance: newBal,
        date: new Date(txForm.date).toISOString(),
        exchangeRateUsed: data.settings.usdToCopRate
      }, true);
    }
    setModals(m => ({ ...m, tx: false }));
  };

  const handleUpdateGroup = async (groupId: string | null) => {
    if (!selectedItem || selectedItem.type !== 'account') return;
    await updateAccount(selectedItem.id, { groupId });
    setModals(m => ({ ...m, edit: false }));
  };

  const handleUpdateGroupTitle = async (name: string) => {
    if (!selectedItem || selectedItem.type !== 'group') return;
    await updateGroup(selectedItem.id, { name });
    setModals(m => ({ ...m, edit: false }));
  };

  const handleMoveAccount = async (id: string, direction: 'up' | 'down') => {
    const groupAccs = [...data.accounts].sort((a, b) => {
      const groupA = data.accounts.find(x => x.id === a.id)?.groupId;
      const groupB = data.accounts.find(x => x.id === b.id)?.groupId;
      if (groupA !== groupB) return 0;
      return a.sortOrder - b.sortOrder;
    });

    const acc = data.accounts.find(a => a.id === id);
    if (!acc) return;

    const siblings = data.accounts
      .filter(a => a.groupId === acc.groupId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));

    const index = siblings.findIndex(a => a.id === id);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex >= 0 && targetIndex < siblings.length) {
      const other = siblings[targetIndex];
      const newOrderSelf = other.sortOrder === acc.sortOrder ? (direction === 'up' ? acc.sortOrder - 1 : acc.sortOrder + 1) : other.sortOrder;
      const newOrderOther = acc.sortOrder;

      // Single state update for immediate feedback
      setData(prev => ({
        ...prev,
        accounts: prev.accounts.map(a => {
          if (a.id === id) return { ...a, sortOrder: newOrderSelf };
          if (a.id === other.id) return { ...a, sortOrder: newOrderOther };
          return a;
        })
      }));

      // Background API sync
      await Promise.all([
        api.data.updateAccount(id, { sortOrder: newOrderSelf }),
        api.data.updateAccount(other.id, { sortOrder: newOrderOther })
      ]);
    }
  };

  const handleMoveGroup = async (id: string, direction: 'up' | 'down') => {
    const siblings = [...data.groups].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
    const index = siblings.findIndex(g => g.id === id);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex >= 0 && targetIndex < siblings.length) {
      const g = siblings[index];
      const other = siblings[targetIndex];
      const newOrderSelf = other.sortOrder === g.sortOrder ? (direction === 'up' ? g.sortOrder - 1 : g.sortOrder + 1) : other.sortOrder;
      const newOrderOther = g.sortOrder;

      // Single state update
      setData(prev => ({
        ...prev,
        groups: prev.groups.map(item => {
          if (item.id === id) return { ...item, sortOrder: newOrderSelf };
          if (item.id === other.id) return { ...item, sortOrder: newOrderOther };
          return item;
        })
      }));

      // Sync
      await Promise.all([
        api.data.updateGroup(id, { sortOrder: newOrderSelf }),
        api.data.updateGroup(other.id, { sortOrder: newOrderOther })
      ]);
    }
  };

  return (
    <div className="space-y-8 pb-10 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Cuentas y Grupos</h2>
        <div className="flex gap-2">
          <button onClick={() => setModals(m => ({ ...m, group: true }))} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-sm">
            <Plus size={16} /> Grupo
          </button>
          <button onClick={() => setModals(m => ({ ...m, account: true }))} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm">
            <Plus size={16} /> Cuenta
          </button>
        </div>
      </div>

      {/* Ungrouped */}
      {data.accounts.filter(a => !a.groupId).length > 0 && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
          <h3 className="text-lg font-semibold text-slate-300 mb-4">Sin Grupo</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.accounts.filter(a => !a.groupId).sort((a, b) => a.sortOrder - b.sortOrder).map((acc, index) => {
              const isLocked = !user?.isPremium && index >= MAX_FREE_ACCOUNTS;
              return (
                <AccountCard
                  key={acc.id}
                  account={acc}
                  isLocked={isLocked}
                  onUpdate={isLocked ? () => setPremiumModalOpen(true) : () => openTxModal(acc.id)}
                  onEdit={isLocked ? () => setPremiumModalOpen(true) : () => { setSelectedItem({ type: 'account', id: acc.id }); setModals(m => ({ ...m, edit: true })); }}
                  onDelete={isLocked ? () => setPremiumModalOpen(true) : () => deleteAccount(acc.id)}
                  onMoveUp={isLocked ? undefined : () => handleMoveAccount(acc.id, 'up')}
                  onMoveDown={isLocked ? undefined : () => handleMoveAccount(acc.id, 'down')}
                  format={getFormattedValue}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Groups */}
      {data.groups.sort((a, b) => a.sortOrder - b.sortOrder).map(group => {
        const groupAccs = data.accounts.filter(a => a.groupId === group.id).sort((a, b) => a.sortOrder - b.sortOrder);
        const total = groupAccs.reduce((sum, acc) => {
          const v = convertValue(acc.balance, acc.currency, Currency.COP);
          return acc.type === AccountType.CREDIT ? sum - v : sum + v;
        }, 0);

        const isGroupLocked = !user?.isPremium && data.groups.sort((a, b) => a.sortOrder - b.sortOrder).findIndex(g => g.id === group.id) >= MAX_FREE_GROUPS;

        return (
          <div key={group.id} className={`bg-slate-800 rounded-xl border border-slate-700 overflow-hidden transition-all ${isGroupLocked ? 'opacity-50 grayscale pointer-events-none select-none relative' : ''}`}>
            {isGroupLocked && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px]">
                <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-xl flex items-center gap-2 text-amber-500 font-bold pointer-events-auto">
                  <AlertTriangle size={18} /> Bloqueado (SmartFi Pro)
                </div>
              </div>
            )}
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-700/30">
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-1 mr-2 border-r border-slate-700 pr-3">
                  <button onClick={() => handleMoveGroup(group.id, 'up')} className="text-slate-500 hover:text-white transition-colors"><ArrowUp size={14} /></button>
                  <button onClick={() => handleMoveGroup(group.id, 'down')} className="text-slate-500 hover:text-white transition-colors"><ArrowDown size={14} /></button>
                </div>
                <h3 className="text-xl font-bold text-white pr-2">{group.name}</h3>
                <button onClick={() => { setSelectedItem({ type: 'group', id: group.id }); setModals(m => ({ ...m, edit: true })); }} className="text-slate-500 hover:text-indigo-400 p-1"><Edit size={16} /></button>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-slate-400">Total (COP)</p>
                  <p className={`font-mono font-bold ${total >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{getFormattedValue(total, Currency.COP)}</p>
                </div>
                <button onClick={() => deleteGroup(group.id)} className="text-slate-500 hover:text-red-400"><Trash2 size={18} /></button>
              </div>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {groupAccs.map((acc, index) => {
                const isGroupLocked = !user?.isPremium && data.groups.sort((a, b) => a.sortOrder - b.sortOrder).findIndex(g => g.id === group.id) >= MAX_FREE_GROUPS;
                const isAccountLocked = isGroupLocked || (!user?.isPremium && index >= MAX_FREE_ACCOUNTS);

                return (
                  <AccountCard
                    key={acc.id}
                    account={acc}
                    isLocked={isAccountLocked}
                    onUpdate={isAccountLocked ? () => setPremiumModalOpen(true) : () => openTxModal(acc.id)}
                    onEdit={isAccountLocked ? () => setPremiumModalOpen(true) : () => { setSelectedItem({ type: 'account', id: acc.id }); setModals(m => ({ ...m, edit: true })); }}
                    onDelete={isAccountLocked ? () => setPremiumModalOpen(true) : () => deleteAccount(acc.id)}
                    onMoveUp={isAccountLocked ? undefined : () => handleMoveAccount(acc.id, 'up')}
                    onMoveDown={isAccountLocked ? undefined : () => handleMoveAccount(acc.id, 'down')}
                    format={getFormattedValue}
                  />
                );
              })}
              {groupAccs.length === 0 && <p className="text-slate-500 text-sm italic">Grupo vacío.</p>}
            </div>
          </div>
        );
      })}

      {/* Modals */}
      <Modal isOpen={modals.group} onClose={() => setModals(m => ({ ...m, group: false }))} title="Nuevo Grupo">
        <div className="space-y-4">
          <input className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" placeholder="Nombre" value={newGroup.name} onChange={e => setNewGroup({ name: e.target.value })} />
          <button onClick={handleCreateGroup} className="w-full bg-indigo-600 py-2 rounded text-white">Crear</button>
        </div>
      </Modal>

      <Modal isOpen={modals.account} onClose={() => setModals(m => ({ ...m, account: false }))} title="Nueva Cuenta">
        <div className="space-y-4">
          <input className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" placeholder="Nombre" value={newAccount.name} onChange={e => setNewAccount({ ...newAccount, name: e.target.value })} />
          <select className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" value={newAccount.groupId || ''} onChange={e => setNewAccount({ ...newAccount, groupId: e.target.value })}>
            <option value="">Sin Grupo</option>
            {data.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <select className="bg-slate-900 border border-slate-700 rounded p-2 text-white" value={newAccount.type} onChange={e => setNewAccount({ ...newAccount, type: e.target.value as AccountType })}>
              <option value={AccountType.DEBIT}>Débito/Efectivo</option>
              <option value={AccountType.CREDIT}>Crédito</option>
            </select>
            <select className="bg-slate-900 border border-slate-700 rounded p-2 text-white" value={newAccount.currency} onChange={e => setNewAccount({ ...newAccount, currency: e.target.value as Currency })}>
              <option value={Currency.COP}>COP</option>
              <option value={Currency.USD}>USD</option>
            </select>
          </div>
          <input className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" type="number" step="0.01" placeholder="Saldo Inicial" value={newAccount.balance} onChange={e => setNewAccount({ ...newAccount, balance: Number(e.target.value) })} />
          {newAccount.type === AccountType.CREDIT && (
            <input className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" type="number" step="0.01" placeholder="Cupo Total" value={newAccount.creditLimit || ''} onChange={e => setNewAccount({ ...newAccount, creditLimit: Number(e.target.value) })} />
          )}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Etiqueta (Ej: CDTs, Ahorros, Viajes)</label>
            <input className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" placeholder="Sin Etiqueta" value={newAccount.category} onChange={e => setNewAccount({ ...newAccount, category: e.target.value })} />
          </div>
          <button onClick={handleCreateAccount} className="w-full bg-indigo-600 py-2 rounded text-white">Crear</button>
        </div>
      </Modal>

      <Modal isOpen={modals.tx} onClose={() => setModals(m => ({ ...m, tx: false }))} title="Actualizar Saldo">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Nuevo Saldo / Deuda Actual</label>
            <input className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-lg font-mono" type="number" step="0.01" value={txForm.newBalance} onChange={e => setTxForm({ ...txForm, newBalance: e.target.value })} />
          </div>
          {selectedItem?.type === 'account' && data.accounts.find(a => a.id === selectedItem.id)?.type === AccountType.CREDIT && (
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Nuevo Cupo (Opcional)</label>
              <input className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-mono" type="number" step="0.01" value={txForm.newCreditLimit} onChange={e => setTxForm({ ...txForm, newCreditLimit: e.target.value })} />
            </div>
          )}

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Fecha</label>
            <input className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" type="date" value={txForm.date} onChange={e => setTxForm({ ...txForm, date: e.target.value })} />
          </div>
          <button onClick={handleUpdateBalance} className="w-full bg-indigo-600 py-2 rounded text-white">Guardar Transacción</button>
        </div>
      </Modal>

      <Modal isOpen={modals.edit} onClose={() => setModals(m => ({ ...m, edit: false }))} title={selectedItem?.type === 'account' ? "Editar Cuenta" : "Editar Grupo"}>
        <div className="space-y-4">
          {selectedItem?.type === 'account' ? (
            <>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Cambiar Nombre (Opcional)</label>
                <input
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                  defaultValue={data.accounts.find(a => a.id === selectedItem?.id)?.name}
                  onBlur={(e) => updateAccount(selectedItem.id, { name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Etiqueta</label>
                <input
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                  defaultValue={data.accounts.find(a => a.id === selectedItem?.id)?.category}
                  onBlur={(e) => updateAccount(selectedItem.id, { category: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Mover a Grupo</label>
                <select
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                  value={data.accounts.find(a => a.id === selectedItem?.id)?.groupId || ''}
                  onChange={(e) => handleUpdateGroup(e.target.value || null)}
                >
                  <option value="">Sin Grupo</option>
                  {data.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            </>
          ) : (
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Nombre del Grupo</label>
              <input
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-lg"
                defaultValue={data.groups.find(g => g.id === selectedItem?.id)?.name}
                onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateGroupTitle((e.target as HTMLInputElement).value) }}
                onBlur={(e) => handleUpdateGroupTitle(e.target.value)}
              />
            </div>
          )}
          <p className="text-[10px] text-slate-500 italic">Los cambios se guardan automáticamente al presionar Enter o salir del campo.</p>
        </div>
      </Modal>
    </div>
  );
};

const AccountCard = ({ account, onUpdate, onEdit, onDelete, onMoveUp, onMoveDown, format, isLocked }: any) => (
  <div className={`bg-slate-700/50 hover:bg-slate-700 transition-colors rounded-lg p-4 border border-slate-600 relative group ${isLocked ? 'opacity-60 grayscale' : ''}`}>
    {isLocked && (
      <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
        <div className="bg-slate-800/90 border border-slate-600 px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 text-amber-500 text-[10px] font-bold uppercase tracking-wider">
          <AlertTriangle size={14} /> Pro
        </div>
      </div>
    )}
    <div className="flex justify-between items-start mb-2">
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isLocked && (
            <>
              <button onClick={onMoveUp} className="text-slate-500 hover:text-white"><ArrowUp size={12} /></button>
              <button onClick={onMoveDown} className="text-slate-500 hover:text-white"><ArrowDown size={12} /></button>
            </>
          )}
        </div>
        <div>
          <h4 className="font-bold text-white truncate max-w-[150px]">{account.name}</h4>
          <div className="flex gap-1 mt-1">
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${account.type === AccountType.CREDIT ? 'bg-purple-900 text-purple-200' : 'bg-emerald-900 text-emerald-200'}`}>
              {account.type === AccountType.CREDIT ? 'CRÉDITO' : 'DÉBITO'}
            </span>
            {account.currency === Currency.USD && <span className="text-[10px] bg-amber-900 text-amber-200 px-2 py-0.5 rounded-full">USD</span>}
          </div>
        </div>
      </div>
      <button onClick={onEdit} className="text-slate-500 hover:text-indigo-400 p-1 transition-colors">
        <Settings size={16} />
      </button>
    </div>
    <div className="mt-3 mb-4">
      <p className="text-xs text-slate-400">{account.type === AccountType.CREDIT ? 'Deuda' : 'Saldo'}</p>
      <p className="text-xl font-mono text-white">{format(account.balance, account.currency)}</p>
      {account.creditLimit && (
        <div className="mt-1 w-full bg-slate-800 h-1 rounded overflow-hidden">
          <div className="bg-purple-500 h-full" style={{ width: `${Math.min((account.balance / account.creditLimit) * 100, 100)}%` }}></div>
        </div>
      )}
    </div>
    <div className="flex gap-2">
      <button onClick={onUpdate} className="flex-1 bg-slate-800 hover:bg-slate-900 text-slate-200 text-xs py-2 rounded border border-slate-600 flex justify-center items-center gap-2">
        <ArrowRightLeft size={12} /> {isLocked ? 'Bloqueado' : 'Actualizar'}
      </button>
      {!isLocked && (
        <button onClick={onDelete} className="px-3 bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded border border-red-900/50">
          <Trash2 size={14} />
        </button>
      )}
    </div>
  </div>
);

const PerformancePage = () => {
  const { user } = useAuth();
  const { data, convertValue, getFormattedValue } = useBudget();
  const [timeRange, setTimeRange] = useState('ALL');
  const [dimension, setDimension] = useState<'GENERAL' | 'GROUP' | 'CATEGORY'>('GENERAL');
  const [filterId, setFilterId] = useState('ALL');
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);

  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  const stats = useMemo(() => {
    // 1. Identify Accounts in scope
    let inScopeAccs = data.accounts;
    if (dimension === 'GROUP' && filterId !== 'ALL') inScopeAccs = data.accounts.filter(a => a.groupId === filterId);
    if (dimension === 'CATEGORY' && filterId !== 'ALL') inScopeAccs = data.accounts.filter(a => a.category === filterId);

    const accIds = inScopeAccs.map(a => a.id);
    const rangeTxs = data.transactions.filter(t => accIds.includes(t.accountId));

    if (!rangeTxs.length && inScopeAccs.length === 0) return { ea: 0, normal: 0, projections: [], currentVal: 0 };

    const now = new Date();
    let startDate = new Date();
    if (timeRange === '1M') startDate.setMonth(now.getMonth() - 1);
    else if (timeRange === '3M') startDate.setMonth(now.getMonth() - 3);
    else if (timeRange === '6M') startDate.setMonth(now.getMonth() - 6);
    else if (timeRange === '1Y') startDate.setFullYear(now.getFullYear() - 1);
    else startDate = new Date(PROJECT_START_DATE);

    // Filter relevant transactions for timing
    const timelyTxs = rangeTxs.filter(t => new Date(t.date) >= startDate).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate current filtered value
    const currentVal = inScopeAccs.reduce((sum, acc) => {
      const v = convertValue(acc.balance, acc.currency, Currency.COP);
      return acc.type === AccountType.CREDIT ? sum - v : sum + v;
    }, 0);

    if (timelyTxs.length < 1 && inScopeAccs.length === 0) return { ea: 0, normal: 0, projections: [], currentVal };
    if (timelyTxs.length < 1 && inScopeAccs.length > 0) { // No transactions in range, but accounts exist
      return { ea: 0, normal: 0, projections: [], currentVal };
    }

    // Best way: startVal = Sum of (acc balances at firstPoint date)
    // Since we don't have historical balances per account easily, we use the reconstruction.
    let startVal = currentVal;
    timelyTxs.forEach(tx => {
      startVal -= (tx.exchangeRateUsed ? tx.amount * tx.exchangeRateUsed : tx.amount);
    });

    const endVal = currentVal;
    const normal = startVal !== 0 ? (endVal / startVal) - 1 : 0;

    const diffMs = now.getTime() - startDate.getTime();
    const years = diffMs / (1000 * 60 * 60 * 24 * 365);
    const ea = startVal !== 0 ? (Math.pow(endVal / startVal, 1 / (years || 1)) - 1) : 0;
    const monthlyRate = Math.pow(1 + ea, 1 / 12) - 1;

    const projections = [3, 6, 12].map(months => ({
      label: `${months} meses`,
      value: endVal * Math.pow(1 + monthlyRate, months)
    }));

    return {
      ea: ea * 100,
      normal: normal * 100,
      projections,
      currentVal
    };
  }, [data.transactions, data.accounts, data.groups, timeRange, dimension, filterId]);

  if (!user?.isPremium) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 space-y-6 text-slate-200">
        <TrendingUp size={64} className="text-indigo-500 opacity-20" />
        <h2 className="text-2xl font-bold">Análisis de Rendimiento Pro</h2>
        <p className="max-w-md text-slate-400">Desbloquea proyecciones avanzadas, indicadores %EA y desglose por etiquetas.</p>
        <button onClick={() => setPremiumModalOpen(true)} className="bg-indigo-600 px-8 py-3 rounded-xl font-bold">Mejorar a Pro</button>
        <PremiumModal isOpen={premiumModalOpen} onClose={() => setPremiumModalOpen(false)} />
      </div>
    );
  }

  const snowballChart = [
    { name: 'Hoy', value: stats.currentVal, isFuture: false },
    ...stats.projections.map(p => ({ name: p.label, value: p.value, isFuture: true }))
  ];

  const filterOptions = useMemo(() => {
    if (dimension === 'GROUP') return data.groups.map(g => ({ id: g.id, label: g.name }));
    if (dimension === 'CATEGORY') {
      const tags = Array.from(new Set(data.accounts.map(a => a.category).filter(Boolean)));
      return tags.map(t => ({ id: t!, label: t! }));
    }
    return [];
  }, [data, dimension]);

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Rendimiento Detallado</h2>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-sm text-slate-500">Filtrar por:</span>
            <select
              className="bg-slate-900 border border-slate-700 text-indigo-400 font-bold rounded px-2 py-1 text-xs focus:outline-none"
              value={dimension}
              onChange={e => { setDimension(e.target.value as any); setFilterId('ALL'); }}
            >
              <option value="GENERAL">Todo el Patrimonio</option>
              <option value="GROUP">Por Grupo</option>
              <option value="CATEGORY">Por Etiqueta</option>
            </select>

            {dimension !== 'GENERAL' && (
              <select
                className="bg-slate-900 border border-slate-700 text-white rounded px-2 py-1 text-xs focus:outline-none"
                value={filterId}
                onChange={e => setFilterId(e.target.value)}
              >
                <option value="ALL">Seleccionar {dimension === 'GROUP' ? 'Grupo' : 'Etiqueta'}...</option>
                {filterOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
              </select>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <TimeRangeSelector current={timeRange} onChange={setTimeRange} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
          <p className="text-slate-400 text-[10px] font-bold uppercase mb-1">Rendimiento Normal</p>
          <h3 className={`text-xl font-bold font-mono ${stats.normal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {stats.normal > 0 ? '+' : ''}{stats.normal.toFixed(2)}%
          </h3>
        </div>
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
          <p className="text-slate-400 text-[10px] font-bold uppercase mb-1">Efectivo Anual (%EA)</p>
          <h3 className="text-xl font-bold text-indigo-400 font-mono">
            {stats.ea > 0 ? '+' : ''}{stats.ea.toFixed(2)}%
          </h3>
        </div>
        {stats.projections.map((p, i) => (
          <div key={i} className="bg-slate-800 p-4 rounded-xl border border-slate-700 lg:col-span-1">
            <p className="text-slate-400 text-[10px] font-bold uppercase mb-1">Proy. {p.label}</p>
            <h3 className="text-lg font-bold text-emerald-400 font-mono">
              {getFormattedValue(p.value, Currency.COP)}
            </h3>
          </div>
        ))}
        <div className="bg-slate-800 p-4 rounded-xl border border-indigo-500/30 lg:col-span-1">
          <p className="text-indigo-400 text-[10px] font-bold uppercase mb-1">Valor Actual</p>
          <h3 className="text-lg font-bold text-white font-mono">
            {getFormattedValue(stats.currentVal, Currency.COP)}
          </h3>
        </div>
      </div>

      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
        <h3 className="text-lg font-bold text-slate-100 mb-6 flex items-center gap-2">
          Gráfico de Bola de Nieve <span className="text-xs font-normal text-slate-500">(Basado en tendencia actual)</span>
        </h3>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={snowballChart}>
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} tickFormatter={v => `$${(v / 1000000).toFixed(1)}M`} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }} formatter={(v: any) => getFormattedValue(v, Currency.COP)} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {snowballChart.map((e, i) => <Cell key={i} fill={e.isFuture ? '#10b981' : '#3b82f6'} fillOpacity={e.isFuture ? 0.4 : 1} />)}
              </Bar>
              <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} dot={{ r: 6, fill: '#6366f1' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// --- APP SHELL ---

const MetricCard = ({ label, value, currency, color, description }: any) => {
  const { getFormattedValue } = useBudget();
  return (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
      <p className="text-slate-400 text-sm font-medium">{label}</p>
      <h2 className={`text-2xl font-bold mt-2 ${color}`}>{getFormattedValue(value, currency)}</h2>
      {description && <p className="text-[10px] text-slate-500 mt-1 italic">{description}</p>}
    </div>
  );
};

const Layout = () => {
  const { logout, user } = useAuth();
  const { data, updateUSDRate } = useBudget();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-200 font-sans">
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 sticky top-0 h-screen">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">SmartFi</h1>
          <p className="text-xs text-slate-500 mt-1">Usuario: {user?.username}</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <NavItem to="/" icon={<LayoutDashboard size={20} />} label="Panel Principal" />
          <NavItem to="/accounts" icon={<Wallet size={20} />} label="Cuentas y Grupos" />
          <NavItem to="/performance" icon={<TrendingUp size={20} />} label="Rendimiento" />
        </nav>
        <div className="p-4 border-t border-slate-800 space-y-4">
          <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
            <label className="text-xs text-slate-400 block mb-1">Tasa USD (COP) - Auto</label>
            <div className="w-full bg-slate-950/50 border border-slate-700 rounded px-2 py-1 text-sm text-right font-mono text-indigo-400">
              {new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2 }).format(data.settings.usdToCopRate)}
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm w-full px-2">
            <LogOut size={16} /> Cerrar Sesión
          </button>
        </div>
      </aside>

      <div className="md:hidden fixed top-0 w-full bg-slate-900 border-b border-slate-800 z-40 flex justify-between items-center p-4">
        <h1 className="text-xl font-bold text-white">SmartFi</h1>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-white">
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-slate-900 pt-20 px-4 space-y-4">
          <NavItem to="/" icon={<LayoutDashboard size={20} />} label="Panel" onClick={() => setMobileMenuOpen(false)} />
          <NavItem to="/accounts" icon={<Wallet size={20} />} label="Cuentas" onClick={() => setMobileMenuOpen(false)} />
          <button onClick={logout} className="flex items-center gap-3 px-4 py-3 text-slate-400"><LogOut size={20} /> Salir</button>
        </div>
      )}

      <main className="flex-1 p-4 md:p-8 pt-20 md:pt-8 overflow-y-auto w-full">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/performance" element={<PerformancePage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
};

const NavItem = ({ to, icon, label, onClick }: any) => (
  <NavLink to={to} onClick={onClick} className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
    {icon} <span className="font-medium text-sm">{label}</span>
  </NavLink>
);

// --- MAIN APP ENTRY ---

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(true);
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);

  // Check Supabase Configuration
  useEffect(() => {
    setIsConfigured(isSupabaseConfigured());
  }, []);

  // Check active session on mount
  useEffect(() => {
    if (!isConfigured) {
      setAuthLoading(false);
      return;
    }

    // Detect PayPal payment success
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      api.auth.getUser().then(async u => {
        if (u && !u.isPremium) {
          await api.auth.updatePremiumStatus(true);
          alert("¡Pago procesado con éxito! Tu cuenta ahora es SmartFi Pro.");
          window.location.href = "https://its-camilo.github.io/smartfi/"; // Clean URL to prod
        }
      });
    }

    api.auth.getUser().then(u => {
      setUser(u);
      setAuthLoading(false);
    });

    // Listen for auth changes (critical for recovery links)
    const { data: { subscription } } = api.auth.onAuthStateChange((u) => {
      setUser(u);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [isConfigured]);

  // Fetch data and rate when user logs in
  useEffect(() => {
    if (user) {
      refreshData();
      fetchUSDRate();

      // Auto-update rate every hour
      const interval = setInterval(fetchUSDRate, 1000 * 60 * 60);
      return () => clearInterval(interval);
    } else {
      setData(INITIAL_DATA);
    }
  }, [user]);

  const fetchUSDRate = async () => {
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD');
      const result = await response.json();
      if (result.result === 'success' && result.rates.COP) {
        // Format to 2 decimal places fixed as requested
        const rate = parseFloat(result.rates.COP.toFixed(2));
        setData(p => ({ ...p, settings: { ...p.settings, usdToCopRate: rate } }));
      }
    } catch (e) {
      console.error("Failed to fetch exchange rate", e);
    }
  };

  const refreshData = async () => {
    if (!isConfigured) return;
    setDataLoading(true);
    try {
      const fetched = await api.data.fetchAll();
      // Filter transactions to only those from PROJECT_START_DATE onwards
      const startDate = new Date(PROJECT_START_DATE).getTime();
      const filteredTransactions = fetched.transactions.filter(t => new Date(t.date).getTime() >= startDate);

      setData(prev => ({
        ...fetched,
        transactions: filteredTransactions,
        settings: {
          ...fetched.settings,
          usdToCopRate: prev.settings.usdToCopRate > 0 ? prev.settings.usdToCopRate : (fetched.settings.usdToCopRate || 4000)
        }
      }));
    } catch (e) {
      console.error("Failed to load data", e);
    } finally {
      setDataLoading(false);
    }
  };

  const authContext: AuthContextType = {
    user,
    loading: authLoading,
    login: async (e, p) => {
      const user = await api.auth.login(e, p);
      setUser(user);
    },
    loginWithGoogle: async () => {
      await api.auth.loginWithGoogle();
    },
    register: async (e, u, p) => {
      const res = await api.auth.register(e, u, p);
      if (res.pendingConfirmation) {
        return true;
      }
      setUser(res);
      return false;
    },
    resetPassword: async (e) => {
      await api.auth.resetPassword(e);
    },
    updatePassword: async (p) => {
      await api.auth.updatePassword(p);
    },
    updatePremiumStatus: async (isPremium: boolean) => {
      await api.auth.updatePremiumStatus(isPremium);
      if (user) setUser({ ...user, isPremium });
    },
    logout: async () => {
      await api.auth.logout();
      setUser(null);
    }
  };

  const budgetContext: BudgetContextType = {
    data,
    loading: dataLoading,
    refresh: refreshData,
    addAccount: async (acc) => {
      if (!user) return;

      // Premium checks
      if (data.accounts.length >= MAX_FREE_ACCOUNTS && !user.isPremium) {
        setPremiumModalOpen(true);
        return;
      }

      const accWithUser = { ...acc, userId: user.id };
      // Optimistic UI
      setData(p => ({ ...p, accounts: [...p.accounts, accWithUser] }));
      await api.data.createAccount(accWithUser);
      refreshData(); // Sync ID
    },
    updateAccount: async (id, updates) => {
      // Optimistic UI
      setData(p => ({ ...p, accounts: p.accounts.map(a => a.id === id ? { ...a, ...updates } : a) }));
      await api.data.updateAccount(id, updates);
    },
    deleteAccount: async (id) => {
      setData(p => ({
        ...p,
        accounts: p.accounts.filter(a => a.id !== id),
        transactions: p.transactions.filter(t => t.accountId !== id)
      }));
      await api.data.deleteAccount(id);
    },
    addGroup: async (grp) => {
      if (!user) return;

      // Premium check
      if (data.groups.length >= MAX_FREE_GROUPS && !user.isPremium) {
        setPremiumModalOpen(true);
        return;
      }

      const grpWithUser = { ...grp, userId: user.id };
      setData(p => ({ ...p, groups: [...p.groups, grpWithUser] }));
      await api.data.createGroup(grpWithUser);
      refreshData();
    },
    updateGroup: async (id, updates) => {
      setData(p => ({ ...p, groups: p.groups.map(g => g.id === id ? { ...g, ...updates } : g) }));
      await api.data.updateGroup(id, updates);
    },
    deleteGroup: async (id) => {
      setData(p => ({
        ...p,
        groups: p.groups.filter(g => g.id !== id),
        accounts: p.accounts.map(a => a.groupId === id ? { ...a, groupId: null } : a)
      }));
      await api.data.deleteGroup(id);
    },
    addTransaction: async (tx, updateBal) => {
      if (!user) return;
      const txWithUser = { ...tx, userId: user.id };
      setData(p => {
        const newAccs = p.accounts.map(a => a.id === tx.accountId && updateBal ? { ...a, balance: tx.newBalance } : a);
        return { ...p, transactions: [...p.transactions, txWithUser], accounts: newAccs };
      });

      // Execute in parallel
      const promises = [api.data.createTransaction(txWithUser)];
      if (updateBal) {
        promises.push(api.data.updateAccount(tx.accountId, { balance: tx.newBalance }));
      }
      await Promise.all(promises);
    },
    updateUSDRate: (rate) => setData(p => ({ ...p, settings: { ...p.settings, usdToCopRate: rate } })),
    getFormattedValue: (val, cur) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val),
    convertValue: (val, from, to) => {
      if (from === to) return val;
      return from === Currency.USD ? val * data.settings.usdToCopRate : val / data.settings.usdToCopRate;
    },
    setData: setData,
    setPremiumModalOpen: setPremiumModalOpen,
    user: user
  };

  if (!isConfigured) return <SetupPage />;
  if (authLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500"><Loader2 className="animate-spin" /></div>;

  return (
    <AuthContext.Provider value={authContext}>
      <BudgetContext.Provider value={budgetContext}>
        <Router basename={(import.meta as any).env.MODE === 'production' ? '/smartfi/' : '/'}>
          <Routes>
            <Route path="/set-password" element={<UpdatePasswordPage />} />
            <Route path="*" element={!user ? <AuthPage /> : <Layout />} />
          </Routes>
          <PremiumModal isOpen={premiumModalOpen} onClose={() => setPremiumModalOpen(false)} />
        </Router>
      </BudgetContext.Provider>
    </AuthContext.Provider>
  );
}