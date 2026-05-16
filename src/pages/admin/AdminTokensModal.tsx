import { useState } from "react";
import Icon from "@/components/ui/icon";
import { UserRow } from "@/lib/api";

const PRESETS = [500, 1000, 2000, 5000, 10000];

interface Props {
  user: UserRow;
  busy: boolean;
  onAdd: (login: string, amount: number) => void;
  onClose: () => void;
}

export default function AdminTokensModal({ user, busy, onAdd, onClose }: Props) {
  const [amount, setAmount] = useState<number>(1000);
  const [custom, setCustom] = useState("");

  const current = user.ai_tokens_balance ?? 0;
  const finalAmount = custom ? parseInt(custom) || 0 : amount;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-sm shadow-xl w-full max-w-sm border border-border">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="Coins" size={15} className="text-primary" />
            <p className="text-sm font-bold">Выдача токенов ИИ</p>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <Icon name="X" size={15} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Пользователь */}
          <div className="flex items-center gap-3 p-3 rounded-sm bg-muted/50 border border-border">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
              {user.full_name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{user.full_name}</p>
              <p className="text-xs text-muted-foreground font-mono">{user.login}</p>
            </div>
            <div className="ml-auto text-right flex-shrink-0">
              <p className="text-xs text-muted-foreground">Баланс</p>
              <p className="text-sm font-bold text-primary">{current.toLocaleString("ru-RU")}</p>
            </div>
          </div>

          {/* Пресеты */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Количество токенов</p>
            <div className="flex gap-1.5 flex-wrap">
              {PRESETS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => { setAmount(p); setCustom(""); }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-sm border transition-colors ${
                    !custom && amount === p
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {p.toLocaleString("ru-RU")}
                </button>
              ))}
            </div>
          </div>

          {/* Ввод вручную */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
              Или введите вручную
            </label>
            <input
              type="number"
              min={1}
              max={999999}
              value={custom}
              onChange={e => setCustom(e.target.value)}
              placeholder="Например: 3000"
              className="w-full border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Итого */}
          {finalAmount > 0 && (
            <div className="flex items-center justify-between p-2.5 rounded-sm bg-primary/5 border border-primary/20">
              <span className="text-xs text-muted-foreground">Станет после начисления:</span>
              <span className="text-sm font-bold text-primary">
                {(current + finalAmount).toLocaleString("ru-RU")} токенов
              </span>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-border flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-2 text-xs border border-border rounded-sm hover:bg-muted transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={() => onAdd(user.login, finalAmount)}
            disabled={busy || finalAmount <= 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Icon name={busy ? "Loader2" : "Plus"} size={13} className={busy ? "animate-spin" : ""} />
            Начислить {finalAmount > 0 ? finalAmount.toLocaleString("ru-RU") : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
