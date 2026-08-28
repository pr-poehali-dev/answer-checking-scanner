/**
 * Поиск ученика по коду с бланка.
 *
 * Распознавание иногда не дочитывает один символ кода (например, ноль в
 * последней клетке). Чтобы работа не «повисала» без владельца, ищем ученика
 * сначала точно, а затем по совпадению начала кода — но только если такой
 * ученик ровно один, иначе есть риск приписать работу чужому.
 */
export interface CodedStudent {
  code: string;
  name: string;
}

export function matchStudentByCode<T extends CodedStudent>(
  students: T[],
  scannedCode: string,
): { student: T | null; exact: boolean } {
  const code = (scannedCode || "").replace(/\D/g, "");
  if (!code) return { student: null, exact: false };

  const exact = students.find(s => s.code === code);
  if (exact) return { student: exact, exact: true };

  // Код прочитан не полностью — ищем единственного подходящего ученика
  if (code.length >= 3) {
    const byPrefix = students.filter(s => s.code.startsWith(code));
    if (byPrefix.length === 1) return { student: byPrefix[0], exact: false };

    // Возможно, потерян символ в середине — сверяем как подпоследовательность
    const bySubseq = students.filter(s => isSubsequence(code, s.code));
    if (bySubseq.length === 1) return { student: bySubseq[0], exact: false };
  }

  return { student: null, exact: false };
}

/** Все ли символы `part` встречаются в `full` в том же порядке. */
function isSubsequence(part: string, full: string): boolean {
  let i = 0;
  for (const ch of full) {
    if (ch === part[i]) i++;
    if (i === part.length) return true;
  }
  return i === part.length;
}
