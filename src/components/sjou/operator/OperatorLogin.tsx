import Icon from "@/components/ui/icon";

interface OperatorLoginProps {
  pwd: string;
  setPwd: (v: string) => void;
  authError: string;
  loading: boolean;
  doLogin: (e: React.FormEvent) => void;
}

export default function OperatorLogin({ pwd, setPwd, authError, loading, doLogin }: OperatorLoginProps) {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <form onSubmit={doLogin} className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-7">
        <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center mb-4">
          <Icon name="ShieldCheck" size={24} className="text-white" />
        </div>
        <h1 className="text-xl font-bold mb-1">Панель оператора СЖОУ</h1>
        <p className="text-sm text-slate-500 mb-5">Рассмотрение заявок образовательных организаций</p>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Пароль оператора</label>
        <input
          type="password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          placeholder="Введите пароль"
          className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 mb-4"
        />
        {authError && (
          <div className="flex items-center gap-2 text-red-600 text-sm mb-4">
            <Icon name="AlertCircle" size={16} />
            {authError}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading && <Icon name="Loader2" size={18} className="animate-spin" />}
          <span>Войти</span>
        </button>
      </form>
    </div>
  );
}