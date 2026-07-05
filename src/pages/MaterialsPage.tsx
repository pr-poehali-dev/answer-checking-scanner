import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MaterialCard from "@/components/materials/MaterialCard";
import UploadMaterialDialog from "@/components/materials/UploadMaterialDialog";
import MaterialViewDialog from "@/components/materials/MaterialViewDialog";
import { materialsApi, type MaterialItem } from "@/lib/api";
import { getMaterialsSession, type MaterialsSession } from "@/lib/materialsSession";

export default function MaterialsPage() {
  const [session] = useState<MaterialsSession | null>(() => getMaterialsSession());
  const [items, setItems] = useState<MaterialItem[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [activeSubject, setActiveSubject] = useState("");
  const [selected, setSelected] = useState<MaterialItem | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const [access, setAccess] = useState<{ authorized: boolean; unlimited: boolean; remaining?: number; limit: number } | null>(null);

  const load = useCallback(async (search: string, subject: string) => {
    setLoading(true);
    try {
      const res = await materialsApi.list(search, subject);
      setItems(res.items);
      setSubjects(res.subjects);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAccess = useCallback(async () => {
    try {
      const a = await materialsApi.accessStatus(session?.login, session?.token);
      setAccess(a);
    } catch { /* ignore */ }
  }, [session]);

  useEffect(() => { load("", ""); loadAccess(); }, [load, loadAccess]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(q, activeSubject);
  };

  const pickSubject = (s: string) => {
    const next = activeSubject === s ? "" : s;
    setActiveSubject(next);
    load(q, next);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Шапка */}
      <header className="border-b border-border bg-card">
        <div className="container py-4 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            <Icon name="GraduationCap" size={24} className="text-primary" />
            САОУ
          </Link>
          <div className="flex items-center gap-2">
            {session ? (
              <span className="text-sm text-muted-foreground hidden sm:flex items-center gap-1.5">
                <Icon name="UserCheck" size={16} className="text-primary" />
                {session.name}
              </span>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link to="/">Войти</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-primary/5 to-transparent border-b border-border">
        <div className="container py-10 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">База учебных материалов</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
            Презентации, тесты, конспекты и разработки от учителей и учеников. Все материалы проверены сотрудниками УДС.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {session ? (
              <Button size="lg" onClick={() => setUploadOpen(true)}>
                <Icon name="Upload" size={18} className="mr-2" />
                Загрузить материал
              </Button>
            ) : (
              <Button size="lg" asChild>
                <Link to="/">
                  <Icon name="LogIn" size={18} className="mr-2" />
                  Войдите, чтобы загрузить
                </Link>
              </Button>
            )}
          </div>

          {/* Индикатор доступа для анонимов */}
          {access && !access.authorized && (
            <div className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground bg-muted rounded-full px-4 py-1.5">
              <Icon name="Info" size={15} />
              Бесплатно доступно скачиваний: {access.remaining ?? access.limit} из {access.limit}
            </div>
          )}
          {access?.authorized && !access.unlimited && (
            <div className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground bg-muted rounded-full px-4 py-1.5">
              <Icon name="Info" size={15} />
              Оформите подписку САОУ для безлимитного доступа
            </div>
          )}
          {access?.unlimited && (
            <div className="mt-4 inline-flex items-center gap-2 text-sm text-success bg-success/10 rounded-full px-4 py-1.5">
              <Icon name="Check" size={15} />
              У вас безлимитный доступ по подписке САОУ
            </div>
          )}
        </div>
      </section>

      {/* Поиск и фильтры */}
      <div className="container py-6">
        <form onSubmit={onSearch} className="flex gap-2 max-w-xl mx-auto mb-5">
          <div className="relative flex-1">
            <Icon name="Search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по названию или описанию" className="pl-10" />
          </div>
          <Button type="submit">Найти</Button>
        </form>

        {subjects.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center mb-6">
            {subjects.map((s) => (
              <button
                key={s}
                onClick={() => pickSubject(s)}
                className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                  activeSubject === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border hover:bg-muted"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Сетка материалов */}
        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Загрузка материалов...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Icon name="FolderOpen" size={48} className="mx-auto mb-3 opacity-40" />
            Пока нет материалов. Будьте первым — загрузите свой!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {items.map((m) => (
              <MaterialCard key={m.id} item={m} onOpen={setSelected} />
            ))}
          </div>
        )}
      </div>

      {/* Модалки */}
      {session && (
        <UploadMaterialDialog
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          session={session}
          onUploaded={() => { load(q, activeSubject); }}
        />
      )}
      <MaterialViewDialog
        item={selected}
        onClose={() => setSelected(null)}
        session={session}
        onLimitReached={() => { setLimitOpen(true); loadAccess(); }}
      />

      {/* Гейт лимита скачиваний */}
      <Dialog open={limitOpen} onOpenChange={setLimitOpen}>
        <DialogContent className="max-w-md text-center">
          <DialogHeader>
            <DialogTitle className="text-center">Лимит бесплатных скачиваний</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="mx-auto w-14 h-14 rounded-full bg-warning/15 flex items-center justify-center">
              <Icon name="Lock" size={28} className="text-warning" />
            </div>
            <p className="text-muted-foreground">
              Вы скачали 5 материалов. Чтобы продолжить скачивать без ограничений, оформите подписку
              <b> 99 ₽ в месяц</b>, или войдите с активной подпиской САОУ.
            </p>
            <div className="flex flex-col gap-2">
              <Button asChild size="lg">
                <Link to="/">Оформить подписку</Link>
              </Button>
              <Button variant="outline" onClick={() => setLimitOpen(false)}>Позже</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
