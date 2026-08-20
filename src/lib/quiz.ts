export type QuizQuestionType = "multiple_choice" | "essay";

export type ParsedImportQuestion = {
  question_text: string;
  question_type: QuizQuestionType;
  options: Array<{ label: string; text: string }>;
  correct_answer: string;
  grading_guide: string;
  points: number;
  isValid: boolean;
};

export function parseQuizImport(text: string, type: QuizQuestionType): ParsedImportQuestion[] {
  const matches = [...text.matchAll(/(?:^|\n)\s*(\d+)\.\s+([\s\S]*?)(?=(?:\n\s*\d+\.\s+)|$)/g)];

  return matches.map((match) => {
    const lines = match[2].trim().split("\n").map((line) => line.trim()).filter(Boolean);
    const questionText = lines[0] ?? "";
    const pointsLine = lines.find((line) => /^poin\s*:/i.test(line));
    const points = pointsLine ? Number(pointsLine.replace(/^poin\s*:/i, "").trim()) : 10;

    if (type === "essay") {
      const guideLine = lines.find((line) => /^panduan\s*:/i.test(line));
      const gradingGuide = guideLine?.replace(/^panduan\s*:/i, "").trim() ?? "";
      return {
        question_text: questionText,
        question_type: "essay",
        options: [],
        correct_answer: "",
        grading_guide: gradingGuide,
        points,
        isValid: questionText.length > 0 && Number.isFinite(points) && points > 0,
      };
    }

    const options: Array<{ label: string; text: string }> = [];
    let correctAnswer = "";
    for (const line of lines.slice(1)) {
      const optionMatch = line.match(/^([A-E])[.)]\s*(.*)/i);
      const keyMatch = line.match(/^kunci\s*:\s*([A-E])/i);
      if (optionMatch) options.push({ label: optionMatch[1].toUpperCase(), text: optionMatch[2].trim() });
      if (keyMatch) correctAnswer = keyMatch[1].toUpperCase();
    }

    return {
      question_text: questionText,
      question_type: "multiple_choice",
      options,
      correct_answer: correctAnswer,
      grading_guide: "",
      points,
      isValid: questionText.length > 0 && options.length >= 2 && correctAnswer !== "" && Number.isFinite(points) && points > 0,
    };
  });
}

export function quizAttemptStatusLabel(status: string) {
  const labels: Record<string, string> = {
    ongoing: "Sedang dikerjakan",
    submitted: "Terkumpul",
    pending_review: "Menunggu penilaian",
    graded: "Sudah dinilai",
    abandoned: "Dibatalkan",
  };
  return labels[status] ?? status;
}
