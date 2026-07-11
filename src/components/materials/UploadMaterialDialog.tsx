import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import Icon from "@/components/ui/icon";
import { materialsApi } from "@/lib/api";
import { toast } from "sonner";
import type { MaterialsSession } from "@/lib/materialsSession";

interface UploadMaterialDialogProps {
  open: boolean;
  onClose: () => void;
  session: MaterialsSession;
  onUploaded: () => void;
}

const ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.zip,.txt";
const MAX_MB = 25;

export default function UploadMaterialDialog({ open, onClose, session, onUploaded }: UploadMaterialDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [materialType, setMaterialType] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle(""); setDescription(""); setSubject(""); setGrade(""); setMaterialType(""); setFile(null);
  };

  const submit = async () => {
    if (!title.trim() || !file) {
      toast.error("Заполните название и прикрепите файл");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Файл больше ${MAX_MB} МБ`);
      return;
    }
    setSaving(true);
    try {
      // 1. Получаем ссылку и грузим файл напрямую в хранилище (минуя лимит тела).
      const { upload_url, file_key, content_type } = await materialsApi.uploadUrl(
        session.login, session.token, file.name,
      );
      const put = await fetch(upload_url, {
        method: "PUT",
        headers: { "Content-Type": content_type },
        body: file,
      });
      if (!put.ok) throw { message: "Файл не загрузился в хранилище. Попробуйте ещё раз." };

      // 2. Сохраняем материал с ссылкой на уже загруженный файл.
      const res = await materialsApi.upload(session.login, session.token, {
        title: title.trim(),
        description: description.trim(),
        subject: subject.trim(),
        grade: grade.trim(),
        material_type: materialType.trim(),
        file_name: file.name,
        file_key,
      });
      toast.success("Отправлено на проверку", { description: res.message });
      reset();
      onUploaded();
      onClose();
    } catch (e) {
      const err = e as { error?: string; message?: string };
      toast.error("Не удалось загрузить", { description: err.error || err.message || "Ошибка" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Загрузить материал</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md bg-info/10 text-sm p-3 flex gap-2">
            <Icon name="Info" size={16} className="shrink-0 mt-0.5 text-info" />
            <span>Материал появится в базе после проверки сотрудниками УДС. Учителя получают 10 бонусов за одобренный материал.</span>
          </div>
          <div>
            <Label>Название *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Контрольная по алгебре, 8 класс" maxLength={256} />
          </div>
          <div>
            <Label>Описание</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Коротко о содержании материала" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Предмет</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Математика" maxLength={128} />
            </div>
            <div>
              <Label>Класс / группа</Label>
              <Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="8 класс" maxLength={32} />
            </div>
          </div>
          <div>
            <Label>Тип материала</Label>
            <Input value={materialType} onChange={(e) => setMaterialType(e.target.value)} placeholder="Презентация / Тест / Конспект" maxLength={64} />
          </div>
          <div>
            <Label>Файл *</Label>
            <label className="mt-1 flex items-center gap-3 border border-dashed border-border rounded-md p-3 cursor-pointer hover:bg-muted/50">
              <Icon name="Upload" size={18} className="text-muted-foreground" />
              <span className="text-sm truncate">{file ? file.name : "Выбрать файл (до 25 МБ)"}</span>
              <input type="file" accept={ACCEPT} className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>Отмена</Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Загрузка..." : "Отправить на проверку"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}