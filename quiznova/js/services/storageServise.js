
const STORAGE_KEY = "quiznova.bestScores.v1";

function readScores() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    console.warn("QuizNova: saved scores could not be read.", error);
    return {};
  }
}

export function getBestScore(categoryId) {
  if (typeof categoryId !== "string" || !categoryId) return null;
  const value = readScores()[categoryId];
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}


export function saveBestScore(categoryId, percentage) {
  if (
    typeof categoryId !== "string" ||
    !categoryId ||
    !Number.isFinite(percentage) ||
    percentage < 0 ||
    percentage > 100
  ) return false;

  const scores = readScores();
  const previous = scores[categoryId];
  if (Number.isFinite(previous) && percentage <= previous) return false;

  scores[categoryId] = percentage;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
    return true;
  } catch (error) {
    console.warn("QuizNova: personal best could not be saved.", error);
    return false;
  }
}

export function clearBestScores() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.warn("QuizNova: saved scores could not be cleared.", error);
    return false;
  }
}
