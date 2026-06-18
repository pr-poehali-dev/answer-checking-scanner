import { useState } from "react";
import Icon from "@/components/ui/icon";
import { appStore, useAppStore, Student } from "@/store/appStore";

const CLASS_LETTERS = ["А", "Б", "В", "Г", "Д"];
const CLASS_NUMS = Array.from({ length: 11 }, (_, i) => i + 1);

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

interface StudentFormProps {
  initial?: Student;
  onSave: (s: Student) => void;
  onCancel: () => void;
}

function StudentForm({ initial, onSave, onCancel }: StudentFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [classNum, setClassNum] = useState(initial?.classNum ?? 1);
  const [classLetter, setClassLetter] = useState(initial?.classLetter ?? "А");
  const [code] = useState(initial?.code ?? appStore.generateStudentCode());
  const [bindCode] = useState(initial?.bindCode ?? appStore.generateBindCode());
  const [copied, setCopied] = useState(false);

  const copyBind = () => {
    navigator.clipboard?.writeText(bindCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ code, bindCode, name: name.trim(), classNum, classLetter });
  };

  return (
    <div className="border border-border rounded-sm bg-white p-4 space-y-3">
      <p className="text-sm font-semibold">{initial ? "Редактировать ученика" : "Добавить ученика"}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground block mb-1">Фамилия Имя Отчество</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Иванов Иван Иванович"
            className="w-full border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Класс</label>
          <select
            value={classNum}
            onChange={e => setClassNum(Number(e.target.value))}
            className="w-full border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {CLASS_NUMS.map(n => <option key={n} value={n}>{n} класс</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Буква</label>
          <select
            value={classLetter}
            onChange={e => setClassLetter(e.target.value)}
            className="w-full border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {CLASS_LETTERS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground block mb-1">Код ученика (5 цифр)</label>
          <div className="flex gap-1">
            {code.split("").map((digit, i) => (
              <div key={i} className="w-10 h-10 border-2 rounded-sm flex items-center justify-center font-bold mono text-lg"
                style={{ borderColor: "hsl(var(--sidebar-primary))", color: "hsl(var(--sidebar-primary))" }}>
                {digit}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Код генерируется автоматически и уникален</p>
        </div>
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground block mb-1">Код привязки (8 символов)</label>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 flex-wrap">
              {bindCode.split("").map((ch, i) => (
                <div key={i} className="w-8 h-9 border-2 rounded-sm flex items-center justify-center font-bold mono text-base"
                  style={{ borderColor: "hsl(142 60% 35%)", color: "hsl(142 60% 30%)" }}>
                  {ch}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={copyBind}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-border text-xs rounded-sm hover:bg-muted transition-colors"
            >
              <Icon name={copied ? "Check" : "Copy"} size={13} className={copied ? "text-green-600" : ""} />
              {copied ? "Скопировано" : "Копировать"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Передайте этот код ученику — он введёт его в настройках своего кабинета, чтобы видеть свои результаты.
          </p>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Icon name="Check" size={14} />
          Сохранить
        </button>
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-border text-sm font-medium rounded-sm hover:bg-muted transition-colors"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

export function StudentsSection() {
  const { students, yadiskConnected } = useAppStore();
  const [adding, setAdding] = useState(false);
  const [editCode, setEditCode] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState<number | "all">("all");
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [importStatus, setImportStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  const filtered = students.filter(s => {
    const matchName = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.includes(search);
    const matchClass = filterClass === "all" || s.classNum === filterClass;
    return matchName && matchClass;
  });

  const grouped = CLASS_NUMS.reduce<Record<number, Student[]>>((acc, n) => {
    acc[n] = filtered.filter(s => s.classNum === n);
    return acc;
  }, {});

  const handleAdd = (student: Student) => {
    appStore.addStudent(student);
    setAdding(false);
  };

  const handleEdit = (student: Student) => {
    appStore.updateStudent(student.code, student);
    setEditCode(null);
  };

  const handleRemove = (code: string) => {
    if (confirm("Удалить ученика?")) appStore.removeStudent(code);
  };

  // Синхронизация — выгрузка на Яндекс Диск
  const handleSync = async () => {
    if (!yadiskConnected) {
      alert("Сначала подключите Яндекс Диск в разделе «Настройки»");
      return;
    }
    setSyncStatus("syncing");
    const r = await appStore.syncToYadisk();
    if (r.ok) {
      setSyncStatus("done");
    } else {
      setSyncStatus("error");
      alert(`Ошибка сохранения: ${r.error}`);
    }
    setTimeout(() => setSyncStatus("idle"), 3000);
  };

  // Загрузка с Яндекс Диска
  const handleImport = async () => {
    if (!yadiskConnected) {
      alert("Сначала подключите Яндекс Диск в разделе «Настройки»");
      return;
    }
    setImportStatus("loading");
    const r = await appStore.loadFromYadisk();
    if (r.ok) {
      setImportStatus("done");
    } else {
      setImportStatus("error");
      alert(`Ошибка загрузки: ${r.error}`);
    }
    setTimeout(() => setImportStatus("idle"), 3000);
  };

  return (
    <div className="animate-slide-up space-y-5">
      {/* Header controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative">
            <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Поиск по фамилии или коду..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 text-sm border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-ring w-56"
            />
          </div>
          <select
            value={filterClass === "all" ? "all" : String(filterClass)}
            onChange={e => setFilterClass(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">Все классы</option>
            {CLASS_NUMS.map(n => <option key={n} value={n}>{n} класс</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImport}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-border text-xs font-medium rounded-sm hover:bg-muted transition-colors"
          >
            <Icon name="CloudDownload" size={13} fallback="Download" />
            {importStatus === "loading" ? "Загрузка..." : importStatus === "done" ? "Загружено!" : importStatus === "error" ? "Ошибка" : "С Я.Диска"}
          </button>
          <button
            onClick={handleSync}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-border text-xs font-medium rounded-sm hover:bg-muted transition-colors"
          >
            <Icon name="CloudUpload" size={13} fallback="Upload" className={syncStatus === "syncing" ? "animate-pulse" : ""} />
            {syncStatus === "syncing" ? "Сохраняем..." : syncStatus === "done" ? "Сохранено!" : syncStatus === "error" ? "Ошибка" : "На Я.Диск"}
          </button>
          <button
            onClick={() => { setAdding(true); setEditCode(null); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90 transition-opacity"
          >
            <Icon name="UserPlus" size={14} />
            Добавить ученика
          </button>
        </div>
      </div>

      {/* Add form */}
      {adding && (
        <StudentForm
          onSave={handleAdd}
          onCancel={() => setAdding(false)}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Всего учеников</span>
            <Icon name="Users" size={15} className="text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold mono">{students.length}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Классов</span>
            <Icon name="BookOpen" size={15} className="text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold mono">
            {new Set(students.map(s => `${s.classNum}${s.classLetter}`)).size}
          </p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Синхронизация</span>
            <Icon name={yadiskConnected ? "CloudCheck" : "CloudOff"} size={15} className={yadiskConnected ? "text-green-500" : "text-muted-foreground"} fallback="Cloud" />
          </div>
          <p className="text-sm font-semibold">{yadiskConnected ? "Яндекс Диск подключён" : "Не подключён"}</p>
        </div>
      </div>

      {/* Empty state */}
      {students.length === 0 && !adding && (
        <div className="border border-dashed border-border rounded-sm p-10 text-center">
          <Icon name="Users" size={36} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-semibold mb-1">Список учеников пуст</p>
          <p className="text-xs text-muted-foreground mb-4">Добавьте учеников вручную или загрузите файл с Яндекс Диска</p>
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-sm hover:opacity-90 transition-opacity"
          >
            <Icon name="UserPlus" size={14} />
            Добавить первого ученика
          </button>
        </div>
      )}

      {/* Students by class */}
      {CLASS_NUMS.map(n => {
        const group = grouped[n];
        if (!group || group.length === 0) return null;
        const letters = [...new Set(group.map(s => s.classLetter))].sort();
        return (
          <div key={n} className="border border-border rounded-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-muted border-b border-border flex items-center gap-2">
              <span className="text-sm font-bold">{n} класс</span>
              <span className="text-xs text-muted-foreground">({letters.join(", ")} · {group.length} чел.)</span>
            </div>
            <div className="divide-y divide-border">
              {group.map(student => (
                editCode === student.code ? (
                  <div key={student.code} className="p-4">
                    <StudentForm
                      initial={student}
                      onSave={handleEdit}
                      onCancel={() => setEditCode(null)}
                    />
                  </div>
                ) : (
                  <div key={student.code} className="flex items-center gap-4 px-4 py-3 table-row-hover bg-white">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: "hsl(var(--sidebar-primary) / 0.12)", color: "hsl(var(--sidebar-primary))" }}>
                      {getInitials(student.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{student.name}</p>
                      <p className="text-xs text-muted-foreground">{student.classNum}{student.classLetter} класс</p>
                    </div>
                    <div className="flex items-center gap-1 mr-2">
                      {student.code.split("").map((d, i) => (
                        <div key={i} className="w-6 h-7 border rounded flex items-center justify-center mono text-sm font-bold"
                          style={{ borderColor: "hsl(215 60% 22% / 0.3)", color: "hsl(215 60% 22%)" }}>
                          {d}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditCode(student.code); setAdding(false); }}
                        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                        title="Редактировать"
                      >
                        <Icon name="Pencil" size={14} />
                      </button>
                      <button
                        onClick={() => handleRemove(student.code)}
                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                        title="Удалить"
                      >
                        <Icon name="Trash2" size={14} />
                      </button>
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}