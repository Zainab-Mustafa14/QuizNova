
export function isAnswerCorrect(question, selectedIndex) {
  return Number.isInteger(selectedIndex) && selectedIndex === question.correctIndex;
}


export function calculatePercentage(part, total) {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
  const percentage = (part / total) * 100;
  return Math.round(Math.min(100, Math.max(0, percentage)));
}


export function calculateResults(answers) {
  const records = Array.isArray(answers) ? answers : [];
  const answered = records.filter((record) => record !== null && record !== undefined);

  const totalQuestions = records.length;
  const answeredCount = answered.length;
  const correctCount = answered.filter((record) => record.isCorrect === true).length;
  const timedOutCount = answered.filter((record) => record.timedOut === true).length;

  return {
    totalQuestions,
    answeredCount,
    correctCount,
    incorrectCount: answeredCount - correctCount, // wrong answers AND timeouts
    timedOutCount, // the timeouts alone (already included in incorrectCount)
    unansweredCount: totalQuestions - answeredCount, // never reached, never correct
    score: correctCount, // 1 point per correct answer
    scorePercentage: calculatePercentage(correctCount, totalQuestions),
    accuracy: calculatePercentage(correctCount, answeredCount),
  };
}

// A title and message for the results screen, chosen from the percentage.
export function getPerformanceTier(percentage) {
  const value = Number.isFinite(percentage) ? percentage : 0;
  if (value >= 90) {
    return { id: "outstanding", title: "Outstanding!", message: "Near-perfect. You really know your stuff." };
  }
  if (value >= 70) {
    return { id: "great", title: "Great job!", message: "A strong result. Only a few gaps left to fill." };
  }
  if (value >= 50) {
    return { id: "good", title: "Good effort", message: "You're past the halfway mark. Another round will sharpen it." };
  }
  if (value >= 30) {
    return { id: "practice", title: "Keep practicing", message: "There's room to grow. Try again and watch the explanations." };
  }
  return { id: "start", title: "Fresh start", message: "Everyone starts somewhere. The explanations will help on the next round." };
}