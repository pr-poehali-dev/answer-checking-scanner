import type { GradeScale, Work } from "@/store/appStore";

export const DEFAULT_PERCENT_SCALE = { grade2: 0, grade3: 50, grade4: 70, grade5: 85 };

export function isValidScale(gs: GradeScale | undefined | null): gs is GradeScale {
  return !!gs && gs.grade5 > 0 && gs.grade5 >= gs.grade4 && gs.grade4 >= gs.grade3 && gs.grade3 >= 0;
}

export function scaleFromPercent(total: number): GradeScale {
  const at = (p: number) => Math.ceil((total * p) / 100);
  return {
    grade1: 0,
    grade2: 0,
    grade3: at(DEFAULT_PERCENT_SCALE.grade3),
    grade4: at(DEFAULT_PERCENT_SCALE.grade4),
    grade5: at(DEFAULT_PERCENT_SCALE.grade5),
  };
}

export function effectiveScale(work: Pick<Work, "gradeScale" | "totalQuestions" | "maxScore">): GradeScale {
  if (isValidScale(work.gradeScale)) return work.gradeScale;
  return scaleFromPercent(work.maxScore || work.totalQuestions || 0);
}

export function calcGrade(correct: number, work: Pick<Work, "gradeScale" | "totalQuestions" | "maxScore">): string {
  const gs = effectiveScale(work);
  if (correct >= gs.grade5) return "5";
  if (correct >= gs.grade4) return "4";
  if (correct >= gs.grade3) return "3";
  return "2";
}
