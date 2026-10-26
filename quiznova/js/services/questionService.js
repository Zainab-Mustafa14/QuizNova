

import { CATEGORIES, MIXED_CATEGORY_ID } from "../data/categories.js";
import { shuffle, pickRandom } from "../core/shuffle.js";
import { QUESTIONS_PER_ROUND } from "../utils/constants.js";

const OPTIONS_PER_QUESTION = 4;
const CATEGORY_IDS = CATEGORIES.map((category) => category.id);

export class QuestionServiceError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = "QuestionServiceError";
    this.code = code;
  }
}

function findProblem(question, seenIds) {
  if (!question || typeof question !== "object") return "is not an object";
  if (typeof question.id !== "string" || question.id === "") return "has no id";
  if (seenIds.has(question.id)) return "has a duplicate id";
  if (!CATEGORY_IDS.includes(question.category)) return `has an unknown category "${question.category}"`;
  if (!question.id.startsWith(`${question.category}-`)) return "has an id that does not match its category";
  if (typeof question.question !== "string" || question.question.trim() === "") return "has no question text";
  if (!Array.isArray(question.options) || question.options.length !== OPTIONS_PER_QUESTION) {
    return `must have exactly ${OPTIONS_PER_QUESTION} options`;
  }
  if (question.options.some((option) => typeof option !== "string" || option.trim() === "")) {
    return "has an empty or non-text option";
  }
  if (new Set(question.options).size !== OPTIONS_PER_QUESTION) return "has duplicate options";
  if (!Number.isInteger(question.correctIndex) || question.correctIndex < 0 || question.correctIndex >= OPTIONS_PER_QUESTION) {
    return "has a correctIndex outside 0-3";
  }
  if (typeof question.explanation !== "string" || question.explanation.trim() === "") return "has no explanation";
  return null;
}

function validateQuestionBank(bank) {
  if (!Array.isArray(bank) || bank.length === 0) {
    throw new QuestionServiceError("NO_QUESTIONS", "No questions are available.");
  }

  const seenIds = new Set();
  bank.forEach((question, index) => {
    const problem = findProblem(question, seenIds);
    if (problem) {
      const label = question && question.id ? question.id : `item #${index}`;
      throw new QuestionServiceError("INVALID_DATA", `Question ${label} ${problem}.`);
    }
    seenIds.add(question.id);
  });
}

function freezeBank(bank) {
  bank.forEach((question) => {
    Object.freeze(question.options);
    Object.freeze(question);
  });
  return Object.freeze(bank);
}

// ---------- Loading ----------

let bankPromise = null; // cache: the data is loaded and validated only once

export function loadQuestions() {
  if (!bankPromise) {
    bankPromise = import("../data/questions.js")
      .then((module) => {
        validateQuestionBank(module.QUESTIONS);
        return freezeBank(module.QUESTIONS);
      })
      .catch((error) => {
        bankPromise = null; // forget the failure, so a Retry can try again
        if (error instanceof QuestionServiceError) throw error;
        throw new QuestionServiceError("LOAD_FAILED", "The question data could not be loaded.", { cause: error });
      });
  }
  return bankPromise;
}

// ---------- Helpers ----------

function assertRealCategory(categoryId) {
  if (!CATEGORY_IDS.includes(categoryId)) {
    throw new QuestionServiceError("INVALID_CATEGORY", `Unknown category: "${categoryId}".`);
  }
}

function assertValidCount(count) {
  if (!Number.isInteger(count) || count < 1) {
    throw new QuestionServiceError("INVALID_COUNT", "The number of questions must be a whole number of at least 1.");
  }
}

// A plain copy that callers can safely change (the originals are frozen).
function copyQuestion(question) {
  return { ...question, options: [...question.options] };
}

// A copy with shuffled options. correctIndex is recomputed from the correct
// ANSWER TEXT, so it always points at the right option after shuffling.
function prepareQuestion(question) {
  const correctText = question.options[question.correctIndex];
  const options = shuffle(question.options);
  return { ...question, options, correctIndex: options.indexOf(correctText) };
}

// ---------- Public API ----------

// All questions for one category, in their original order (copies).
export async function getQuestionsByCategory(categoryId) {
  assertRealCategory(categoryId);
  const bank = await loadQuestions();
  return bank.filter((question) => question.category === categoryId).map(copyQuestion);
}

// A random round from one category. Questions AND options are shuffled.
export async function createCategoryRound(categoryId, count = QUESTIONS_PER_ROUND) {
  assertRealCategory(categoryId);
  assertValidCount(count);

  const bank = await loadQuestions();
  const pool = bank.filter((question) => question.category === categoryId);

  if (pool.length < count) {
    throw new QuestionServiceError(
      "INSUFFICIENT_QUESTIONS",
      `Only ${pool.length} questions exist for "${categoryId}", but ${count} were requested.`
    );
  }

  return pickRandom(pool, count).map(prepareQuestion);
}

// A random round drawn from all eight categories with an even spread.
// For 10 questions: every category gives 1, and two randomly chosen
// categories give a second. No category ever gives more than 2.
export async function createMixedRound(count = QUESTIONS_PER_ROUND) {
  assertValidCount(count);

  const bank = await loadQuestions();
  const base = Math.floor(count / CATEGORY_IDS.length);
  const extra = count % CATEGORY_IDS.length;
  const bonusCategories = new Set(shuffle(CATEGORY_IDS).slice(0, extra));

  const picked = [];
  for (const categoryId of CATEGORY_IDS) {
    const quota = base + (bonusCategories.has(categoryId) ? 1 : 0);
    const pool = bank.filter((question) => question.category === categoryId);

    if (pool.length < quota) {
      throw new QuestionServiceError(
        "INSUFFICIENT_QUESTIONS",
        `Category "${categoryId}" has ${pool.length} questions, but ${quota} are needed for a mixed round of ${count}.`
      );
    }
    picked.push(...pickRandom(pool, quota));
  }

  // Shuffle again so the categories don't appear in a fixed order
  return shuffle(picked).map(prepareQuestion);
}

// The one function the app will call: "mixed" or any category id.
export function createRound(categoryId = MIXED_CATEGORY_ID, count = QUESTIONS_PER_ROUND) {
  return categoryId === MIXED_CATEGORY_ID ? createMixedRound(count) : createCategoryRound(categoryId, count);
}