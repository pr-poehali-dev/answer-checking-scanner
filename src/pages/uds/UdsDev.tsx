import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, DevInfo, DevTableRow, DevFileItem, DevSecretItem, DevSecretValue } from "@/lib/api";

interface Props {
  login: string;
  token: string;
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadJson(filename: string, data: unknown) {
  downloadText(filename, JSON.stringify(data, null, 2));
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`;
  return `${(n / 1024 / 1024).toFixed(1)} МБ`;
}

export default function UdsDev({ login, token }: Props) {
  const [info, setInfo] = useState<DevInfo | null>(null);
  const [tables, setTables] = useState<DevTableRow[]>([]);
  const [files, setFiles] = useState<DevFileItem[]>([]);
  const [secrets, setSecrets] = useState<DevSecretItem[]>([]);
  const [revealConfigured, setRevealConfigured] = useState(false);
  const [revealed, setRevealed] = useState<DevSecretValue[] | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      devApi.info(login, token),
      devApi.tables(login, token),
      devApi.files(login, token),
      devApi.secrets(login, token),
    ]).then(([i, t, f, s]) => {
      if (!alive) return;
      setInfo(i);
      setTables(t.tables);
      setFiles(f.files);
      setSecrets(s.secrets);
      setRevealConfigured(s.reveal_configured);
    }).catch(e => setError((e as Error).message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [login, token]);

  const downloadSchema = async () => {
    setBusy("schema"); setError("");
    try {
      const sql = await devApi.schemaAll(login, token);
      downloadText("schema.sql", sql);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  };

  const downloadTableData = async (table: string) => {
    setBusy(`data-${table}`); setError("");
    try {
      const sql = await devApi.tableData(login, token, table);
      downloadText(`${table}_data.sql`, sql);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  };

  const downloadAllData = async () => {
    setBusy("all-data"); setError("");
    try {
      let out = `-- Полный дамп данных схемы ${info?.schema || ""}\n\n`;
      for (const t of tables) {
        out += `-- ── ${t.table} (${t.rows} строк) ──\n`;
        out += await devApi.tableData(login, token, t.table);
        out += "\n";
      }
      downloadText("data_full.sql", out);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  };

  const downloadFilesList = () => downloadJson("files_list.json", files);

  const doReveal = async () => {
    if (!confirmCode.trim()) return;
    setBusy("reveal"); setError("");
    try {
      const r = await devApi.revealSecrets(login, token, confirmCode.trim());
      setRevealed(r.secrets);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  };

  const downloadSecrets = () => {
    if (!revealed) return;
    const lines = revealed.map(s => `${s.name}=${s.value}`).join("\n");
    downloadText(".env", lines);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm gap-2">
        <Icon name="Loader2" size={16} className="animate-spin" /> Загрузка...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 flex gap-3">
        <Icon name="TriangleAlert" size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800 space-y-1.5">
          <p className="font-semibold">Раздел для переноса проекта на собственный хостинг (например Beget)</p>
          <p>Этот экспорт закрывает данные и файлы. Код проекта (фронтенд + backend-функции) выгружается отдельно —
            кнопка <b>«Скачать → Скачать код»</b> или <b>«Подключить GitHub»</b> в верхнем меню редактора.</p>
          <p>Живой автоматической синхронизации со внешним сервером не существует технически — каждый раз после
            обновления сайта нужно заходить сюда и скачивать актуальный снимок вручную.</p>
        </div>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 text-red-700 text-xs rounded-lg p-3">{error}</div>
      )}

      {info && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-border rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Таблиц в БД</div>
            <div className="text-lg font-bold">{info.tables_count}</div>
          </div>
          <div className="bg-white border border-border rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Строк данных</div>
            <div className="text-lg font-bold">{info.total_rows}</div>
          </div>
          <div className="bg-white border border-border rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Файлов в S3</div>
            <div className="text-lg font-bold">{info.s3_files_count}</div>
            <div className="text-[10px] text-muted-foreground">{formatBytes(info.s3_files_size_bytes)}</div>
          </div>
          <div className="bg-white border border-border rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Секретов задано</div>
            <div className="text-lg font-bold">{info.secrets_set}/{info.secrets_total}</div>
          </div>
        </div>
      )}

      {/* База данных */}
      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Icon name="Database" size={15} className="text-primary" />
            <span className="text-sm font-semibold">База данных PostgreSQL</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={downloadSchema}
              disabled={busy === "schema"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-sm border border-border hover:bg-muted disabled:opacity-50"
            >
              <Icon name={busy === "schema" ? "Loader2" : "FileCode"} size={13} className={busy === "schema" ? "animate-spin" : ""} />
              Скачать структуру (schema.sql)
            </button>
            <button
              onClick={downloadAllData}
              disabled={busy === "all-data"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-sm bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Icon name={busy === "all-data" ? "Loader2" : "Download"} size={13} className={busy === "all-data" ? "animate-spin" : ""} />
              Скачать все данные (data_full.sql)
            </button>
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-xs">
            <tbody>
              {tables.map(t => (
                <tr key={t.table} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-2 font-mono">{t.table}</td>
                  <td className="px-4 py-2 text-muted-foreground w-24 text-right">{t.rows} стр.</td>
                  <td className="px-4 py-2 w-32 text-right">
                    <button
                      onClick={() => downloadTableData(t.table)}
                      disabled={busy === `data-${t.table}`}
                      className="text-primary hover:underline disabled:opacity-50"
                    >
                      скачать
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-border bg-muted/40 text-[11px] text-muted-foreground">
          Импорт на Beget: <code className="bg-white px-1 rounded border border-border">psql -U пользователь -d база -f schema.sql</code>,
          затем аналогично для <code className="bg-white px-1 rounded border border-border">data_full.sql</code>
        </div>
      </div>

      {/* Файлы */}
      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Icon name="FolderOpen" size={15} className="text-primary" />
            <span className="text-sm font-semibold">Файлы (S3)</span>
          </div>
          <button
            onClick={downloadFilesList}
            disabled={files.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-sm border border-border hover:bg-muted disabled:opacity-50"
          >
            <Icon name="Download" size={13} />
            Скачать список ссылок (files_list.json)
          </button>
        </div>
        {files.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground">Файлов не найдено.</div>
        ) : (
          <div className="max-h-56 overflow-y-auto">
            <table className="w-full text-xs">
              <tbody>
                {files.map(f => (
                  <tr key={f.key} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-2 font-mono truncate max-w-[200px]">{f.key}</td>
                    <td className="px-4 py-2 text-muted-foreground w-20 text-right">{formatBytes(f.size)}</td>
                    <td className="px-4 py-2 w-24 text-right">
                      <a href={f.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">открыть</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 py-2 border-t border-border bg-muted/40 text-[11px] text-muted-foreground">
          Каждый файл нужно скачать по прямой ссылке (CDN) и загрузить в файловый менеджер Beget в ту же папку.
        </div>
      </div>

      {/* Секреты */}
      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted flex items-center gap-2">
          <Icon name="KeyRound" size={15} className="text-primary" />
          <span className="text-sm font-semibold">Секреты и ключи</span>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {secrets.map(s => (
              <div key={s.name} className="flex items-center gap-1.5 text-xs">
                <Icon name={s.is_set ? "CheckCircle2" : "Circle"} size={12} className={s.is_set ? "text-green-600" : "text-muted-foreground/40"} />
                <span className="font-mono truncate">{s.name}</span>
              </div>
            ))}
          </div>

          {!revealConfigured ? (
            <div className="text-xs text-muted-foreground border-t border-border pt-3">
              Чтобы можно было получить реальные значения секретов, обратитесь к разработчику платформы:
              нужно создать секрет проекта <code className="bg-muted px-1 rounded">DEV_EXPORT_CODE</code> — код подтверждения раскрытия ключей.
            </div>
          ) : !revealed ? (
            <div className="border-t border-border pt-3 flex items-center gap-2">
              <input
                type="password"
                value={confirmCode}
                onChange={e => setConfirmCode(e.target.value)}
                placeholder="Код подтверждения"
                className="flex-1 max-w-xs border border-border rounded-sm px-3 py-1.5 text-xs"
              />
              <button
                onClick={doReveal}
                disabled={busy === "reveal" || !confirmCode.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-sm bg-red-600 text-white hover:opacity-90 disabled:opacity-50"
              >
                <Icon name={busy === "reveal" ? "Loader2" : "Unlock"} size={13} className={busy === "reveal" ? "animate-spin" : ""} />
                Показать значения
              </button>
            </div>
          ) : (
            <div className="border-t border-border pt-3 space-y-2">
              <div className="bg-red-50 border border-red-200 rounded-sm p-2 text-[11px] text-red-700">
                Значения секретов показаны один раз за сессию. Действие записано в лог.
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {revealed.map(s => (
                  <div key={s.name} className="flex items-center gap-2 text-[11px] font-mono">
                    <span className="text-muted-foreground w-44 truncate flex-shrink-0">{s.name}</span>
                    <span className="truncate">{s.value}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={downloadSecrets}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-sm border border-border hover:bg-muted"
              >
                <Icon name="Download" size={13} />
                Скачать как .env
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Гайд по переносу */}
      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted flex items-center gap-2">
          <Icon name="BookOpen" size={15} className="text-primary" />
          <span className="text-sm font-semibold">Как перенести на Beget</span>
        </div>
        <ol className="p-4 space-y-3 text-xs list-decimal list-inside">
          <li><b>Код.</b> В редакторе поехали.dev: «Скачать → Скачать код» (архив) или «Подключить GitHub» —
            получите репозиторий с фронтендом (React/Vite) и backend-функциями (Python).</li>
          <li><b>Сервер на Beget.</b> Возьмите VPS или облачный сервер с Ubuntu — на shared-хостинге Python-приложение
            и PostgreSQL полноценно не развернуть. Установите Node.js (сборка фронтенда), Python 3.11, PostgreSQL, Nginx.</li>
          <li><b>База данных.</b> Создайте БД в PostgreSQL на Beget, импортируйте <code className="bg-muted px-1 rounded">schema.sql</code>, затем <code className="bg-muted px-1 rounded">data_full.sql</code>.</li>
          <li><b>Файлы.</b> Скачайте каждый файл по ссылке из списка выше, загрузите в папку на сервере
            (например <code className="bg-muted px-1 rounded">/var/www/files/</code>), настройте Nginx на её отдачу.</li>
          <li><b>Backend-функции.</b> Каждая функция в /backend — отдельный Python-модуль с <code className="bg-muted px-1 rounded">handler(event, context)</code>.
            На Beget нет serverless-движка поехали.dev — их нужно переупаковать в одно Flask/FastAPI приложение
            (каждая функция → один роут) и запускать через gunicorn под Nginx.</li>
          <li><b>Секреты.</b> Значения из блока выше положите в переменные окружения сервера
            (файл <code className="bg-muted px-1 rounded">.env</code> + <code className="bg-muted px-1 rounded">python-dotenv</code>, или systemd Environment=).</li>
          <li><b>Домен.</b> Отвяжите домен saou.ru от Рег.ру-хостинга и укажите DNS/A-запись на новый сервер Beget.</li>
        </ol>
      </div>
    </div>
  );
}
