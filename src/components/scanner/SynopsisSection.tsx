import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import { appStore, useAppStore, type SynopsisItem } from "@/store/appStore";
import { synopsisApi } from "@/lib/api";
import { SUBJECTS } from "./types";
import { SynopsisForm } from "./SynopsisForm";
import { SynopsisRow } from "./SynopsisRow";

const STAGE_MESSAGES = [
  "ИИ изучает программу Минпросвещения РФ по теме…",
  "Составляю цели и задачи урока…",
  "Пишу теоретический материал — это займёт несколько минут…",
  "Подбираю примеры и вопросы для учеников…",
  "Финальная проверка и оформление конспекта…",
];

export function SynopsisSection() {
  const { teacher, synopses } = useAppStore();

  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [classNum, setClassNum] = useState(9);
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");

  const [busy, setBusy] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  const [stage, setStage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [created, setCreated] = useState<SynopsisItem | null>(null);

  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const startStageRotation = () => {
    setStageIdx(0);
    setStage(STAGE_MESSAGES[0]);
    let idx = 0;
    stageTimer.current = setInterval(() => {
      idx = Math.min(idx + 1, STAGE_MESSAGES.length - 1);
      setStageIdx(idx);
      setStage(STAGE_MESSAGES[idx]);
    }, 70_000);
  };

  const stopStageRotation = () => {
    if (stageTimer.current) clearInterval(stageTimer.current);
    stageTimer.current = null;
  };

  const generate = async () => {
    if (!topic.trim()) { setError("Укажите тему урока"); return; }
    if (!teacher) return;

    setError(null);
    setCreated(null);
    setBusy(true);
    startStageRotation();

    try {
      const result = await synopsisApi.generate(
        {
          subject,
          class_num: classNum,
          topic: topic.trim(),
          description: description.trim(),
          teacher_name: teacher.name,
          teacher_school: teacher.school,
          login: teacher.login,
        },
        (attempt) => setStage(`Повторная попытка ${attempt} из 3 — сервис занят, ждём…`),
      );

      const item: SynopsisItem = {
        id: String(Date.now()),
        subject,
        classNum,
        topic: topic.trim(),
        description: description.trim(),
        text: result.text,
        wordCount: result.word_count,
        createdAt: new Date().toISOString(),
        docxB64: result.docx_b64,
        filename: result.filename,
      };

      appStore.addSynopsis(item);
      setCreated(item);
      setTopic("");
      setDescription("");
    } catch (e) {
      setError((e as Error).message || "Не удалось создать конспект");
    } finally {
      stopStageRotation();
      setBusy(false);
      setStage("");
    }
  };

  const goToPresentation = (item: SynopsisItem) => {
    sessionStorage.setItem("synopsis_topic", item.topic);
    sessionStorage.setItem("synopsis_description", item.text);
    window.dispatchEvent(new CustomEvent("navigate-to-section", { detail: "presentations" }));
  };

  const goToTest = (item: SynopsisItem) => {
    sessionStorage.setItem("synopsis_test_topic", item.topic);
    sessionStorage.setItem("synopsis_test_subject", item.subject);
    sessionStorage.setItem("synopsis_test_class", String(item.classNum));
    sessionStorage.setItem("synopsis_test_description", item.text);
    window.dispatchEvent(new CustomEvent("navigate-to-section", { detail: "tests" }));
  };

  return (
    <div className="animate-slide-up space-y-5">
      <SynopsisForm
        subject={subject}
        classNum={classNum}
        topic={topic}
        description={description}
        busy={busy}
        stageIdx={stageIdx}
        stage={stage}
        error={error}
        created={created}
        teacherName={teacher?.name || ""}
        teacherSchool={teacher?.school || ""}
        onSubjectChange={setSubject}
        onClassNumChange={setClassNum}
        onTopicChange={setTopic}
        onDescriptionChange={setDescription}
        onGenerate={generate}
        onGoTest={goToTest}
        onGoPresentation={goToPresentation}
      />

      {/* История конспектов */}
      <div className="border border-border rounded-sm bg-white">
        <div className="px-4 py-3 border-b border-border bg-muted flex items-center justify-between">
          <p className="text-sm font-semibold">История конспектов</p>
          <span className="text-xs text-muted-foreground">{synopses.length}</span>
        </div>
        {synopses.length === 0 ? (
          <div className="p-8 text-center">
            <Icon name="BookOpen" size={32} className="mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-xs text-muted-foreground">Здесь появятся созданные конспекты</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {synopses.map(s => (
              <SynopsisRow key={s.id} item={s} onGoPresentation={goToPresentation} onGoTest={goToTest} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SynopsisSection;