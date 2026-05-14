export interface AnalysisDetail {
  question: number;
  student: string;
  key: string;
  correct: boolean;
  part: number;
}

export interface RecognitionResult {
  student_code: string;
  answers_part1: string[];
  answers_part2: string[];
  all_answers: string[];
  analysis: {
    total: number;
    correct: number;
    wrong: number;
    score_raw: number;
    score_scaled: number;
    percent: number;
    details: AnalysisDetail[];
    _dbg?: unknown;
  };
  image_size_kb: number;
}

export type FlowStep = "idle" | "uploading" | "recognizing" | "done" | "error";