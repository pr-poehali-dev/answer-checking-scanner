import { useState } from "react";
import Icon from "@/components/ui/icon";
import { usePersistedState, clearPersistedState } from "@/hooks/usePersistedState";
import { taskRunner, useTaskState } from "@/lib/taskRunner";
import { appStore, useAppStore, type SynopsisItem } from "@/store/appStore";
import { synopsisApi } from "@/lib/api";
import { SUBJECTS } from "./types";
import { SynopsisForm } from "./SynopsisForm";
import { SynopsisRow } from "./SynopsisRow";

const TASK_KEY = "gen:synopsis";

const STAGE_MESSAGES = [
  "ИИ изучает программу Минпросвещения РФ по теме…",
  "Составляю цели и задачи урока…",
  "Пишу теоретический материал — это займёт несколько минут…",
  "Подбираю примеры и вопросы для учеников…",
  "Финальная проверка и оформление конспекта…",
];

export function SynopsisSection() {
  const { teacher, synopses } = useAppStore();

  const [subject, setSubject] = usePersistedState("synopsis:subject", SUBJECTS[0]);
  const [classNum, setClassNum] = usePersistedState("synopsis:classNum", 9);
  const [topic, setTopic] = usePersistedState("synopsis:topic", "");
  const [description, setDescription] = usePersistedState("synopsis:description", "");

  const task = useTaskState(TASK_KEY);
  const busy = task.running;
  const stage = task.stage;
  const error = task.error;
  const stageIdx = Math.max(0, STAGE_MESSAGES.indexOf(stage));
  const [created, setCreated] = useState<SynopsisItem | null>(null);

  const generate = () => {
    if (busy) return;
    if (!topic.trim()) { taskRunner.run({ key: TASK_KEY, run: async () => { throw new Error("Укажите тему урока"); } }); return; }
    if (!teacher) return;

    const params = {
      subject, classNum,
      topic: topic.trim(),
      description: description.trim(),
      teacherName: teacher.name,
      teacherSchool: teacher.school,
      login: teacher.login,
    };

    setCreated(null);
    setTopic("");
    setDescription("");
    clearPersistedState("synopsis:topic");
    clearPersistedState("synopsis:description");

    taskRunner.run({
      key: TASK_KEY,
      run: async (handle) => {
        // Ротация поясняющих стадий
        handle.setStage(STAGE_MESSAGES[0]);
        let idx = 0;
        const rot = setInterval(() => {
          idx = Math.min(idx + 1, STAGE_MESSAGES.length - 1);
          handle.setStage(STAGE_MESSAGES[idx]);
        }, 70_000);

        try {
          const result = await synopsisApi.generate(
            {
              subject: params.subject,
              class_num: params.classNum,
              topic: params.topic,
              description: params.description,
              teacher_name: params.teacherName,
              teacher_school: params.teacherSchool,
              login: params.login,
            },
            (attempt) => handle.setStage(`Повторная попытка ${attempt} из 3 — сервис занят, ждём…`),
          );

          const item: SynopsisItem = {
            id: String(Date.now()),
            subject: params.subject,
            classNum: params.classNum,
            topic: params.topic,
            description: params.description,
            text: result.text,
            wordCount: result.word_count,
            createdAt: new Date().toISOString(),
            docxB64: result.docx_b64,
            filename: result.filename,
            spentRub: result.spent_rub,
            balanceRub: result.balance_rub,
          };

          if (result.balance_rub !== undefined) {
            appStore.setAiBalance(Math.round(result.balance_rub * 100));
          }

          appStore.addSynopsis(item);
          setCreated(item);
          return `Готово! Конспект «${params.topic}» создан и добавлен в историю.`;
        } finally {
          clearInterval(rot);
        }
      },
    });
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

  const goToWorksheet = (item: SynopsisItem) => {
    sessionStorage.setItem("synopsis_worksheet_topic", item.topic);
    sessionStorage.setItem("synopsis_worksheet_subject", item.subject);
    sessionStorage.setItem("synopsis_worksheet_class", String(item.classNum));
    sessionStorage.setItem("synopsis_worksheet_description", item.text);
    window.dispatchEvent(new CustomEvent("navigate-to-section", { detail: "worksheets" }));
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
              <SynopsisRow key={s.id} item={s} onGoPresentation={goToPresentation} onGoTest={goToTest} onGoWorksheet={goToWorksheet} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SynopsisSection;