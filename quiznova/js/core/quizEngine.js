

import { MIXED_CATEGORY_ID } from "../data/categories.js";
import { createRound, QuestionServiceError } from "../services/questionService.js";
import { isAnswerCorrect, calculateResults } from "./scoring.js";

const STATUS = Object.freeze({
  IDLE: "idle",
  IN_PROGRESS: "in-progress",
  COMPLETE: "complete",
});

export class QuizEngineError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = "QuizEngineError";
    this.code = code;
  }
}

// Turns a question-service failure into an engine error (keeping the original as `cause`).
function translateServiceError(error) {
  if (error instanceof QuestionServiceError) {
    if (error.code === "INVALID_CATEGORY") {
      return new QuizEngineError("INVALID_CATEGORY", error.message, { cause: error });
    }
    return new QuizEngineError(
      "QUESTIONS_UNAVAILABLE",
      `A quiz could not be created: ${error.message}`,
      { cause: error }
    );
  }
  return error; // not ours (a genuine bug): let it through untouched
}

// Callers get copies, so changing a returned question can never change the session.
function copyQuestion(question) {
  return { ...question, options: [...question.options] };
}

export function createQuizEngine() {
  // ----- Session state (private: only the functions below can touch it) -----
  let status = STATUS.IDLE;
  let categoryId = null;
  let questions = [];
  let answers = []; // one slot per question: null until answered, then a record
  let currentIndex = 0;
  let latestStartId = 0; // used to detect overlapping start() calls

  // ----- Guards -----

  function requireActiveQuiz() {
    if (status === STATUS.IDLE) {
      throw new QuizEngineError("NOT_STARTED", "No quiz has been started. Call start() first.");
    }
    if (status === STATUS.COMPLETE) {
      throw new QuizEngineError("QUIZ_COMPLETE", "The quiz is already complete.");
    }
  }

  function requireUnansweredCurrent() {
    if (answers[currentIndex] !== null) {
      throw new QuizEngineError("ALREADY_ANSWERED", "This question has already been answered.");
    }
  }

  // ----- Starting and restarting -----

  // Fetches a fresh round, then replaces the session.
  // If anything fails, the previous session is left exactly as it was.
  async function start(selectedCategoryId = MIXED_CATEGORY_ID) {
    const startId = (latestStartId += 1);

    let round;
    try {
      round = await createRound(selectedCategoryId);
    } catch (error) {
      throw translateServiceError(error);
    }

    // A newer start() began while we were waiting (e.g. a double-click): drop this result.
    if (startId !== latestStartId) {
      throw new QuizEngineError("START_SUPERSEDED", "A newer quiz start replaced this one.");
    }
    if (!Array.isArray(round) || round.length === 0) {
      throw new QuizEngineError("QUESTIONS_UNAVAILABLE", "A quiz could not be created: no questions are available.");
    }

    categoryId = selectedCategoryId;
    questions = round;
    answers = new Array(round.length).fill(null);
    currentIndex = 0;
    status = STATUS.IN_PROGRESS;

    return copyQuestion(questions[0]);
  }

  // Same category, brand-new questions, empty score.
  async function restart() {
    if (categoryId === null) {
      throw new QuizEngineError("NOT_STARTED", "There is no previous quiz to restart.");
    }
    return start(categoryId);
  }

  // ----- Reading the session -----

  function getCurrentQuestion() {
    requireActiveQuiz();
    return copyQuestion(questions[currentIndex]);
  }

  function hasAnsweredCurrent() {
    requireActiveQuiz();
    return answers[currentIndex] !== null;
  }

  function isLastQuestion() {
    requireActiveQuiz();
    return currentIndex === questions.length - 1;
  }

  function isComplete() {
    return status === STATUS.COMPLETE;
  }

  // Safe to call at any time, in any state.
  function getProgress() {
    const total = questions.length;
    return {
      status,
      categoryId,
      totalQuestions: total,
      currentNumber: status === STATUS.IDLE ? 0 : Math.min(currentIndex + 1, total), // 1-based, for display
      answeredCount: answers.filter((answer) => answer !== null).length,
    };
  }

  // ----- Answering -----

  // selectedIndex is zero-based. Returns the feedback the UI needs.
  function submitAnswer(selectedIndex) {
    requireActiveQuiz();

    const question = questions[currentIndex];

    // Validate BEFORE changing anything, so bad input can never corrupt the score.
    if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= question.options.length) {
      throw new QuizEngineError(
        "INVALID_ANSWER",
        `Answer must be a whole number from 0 to ${question.options.length - 1}.`
      );
    }
    requireUnansweredCurrent();

    const isCorrect = isAnswerCorrect(question, selectedIndex);
    answers[currentIndex] = { questionId: question.id, selectedIndex, isCorrect, timedOut: false };

    return {
      selectedIndex,
      correctIndex: question.correctIndex,
      isCorrect,
      timedOut: false,
      explanation: question.explanation,
    };
  }

  // The countdown ran out. Records the question as answered-incorrectly (it can
  // never earn a point) and returns feedback in the same shape as submitAnswer().
  // If the question was already answered, this throws ALREADY_ANSWERED and changes nothing.
  function recordTimeout() {
    requireActiveQuiz();
    requireUnansweredCurrent();

    const question = questions[currentIndex];
    answers[currentIndex] = { questionId: question.id, selectedIndex: null, isCorrect: false, timedOut: true };

    return {
      selectedIndex: null, // the player chose nothing
      correctIndex: question.correctIndex,
      isCorrect: false,
      timedOut: true,
      explanation: question.explanation,
    };
  }

  // ----- Moving forward -----

  // Returns the next question, or null if the answered question was the last one
  // (the quiz is then complete and getSummary() becomes available).
  function nextQuestion() {
    requireActiveQuiz();

    if (answers[currentIndex] === null) {
      throw new QuizEngineError("NOT_ANSWERED", "Answer the current question before moving on.");
    }

    if (currentIndex === questions.length - 1) {
      status = STATUS.COMPLETE;
      return null;
    }

    currentIndex += 1;
    return copyQuestion(questions[currentIndex]);
  }

  // ----- Results -----

  function getSummary() {
    if (status === STATUS.IDLE) {
      throw new QuizEngineError("NOT_STARTED", "No quiz has been started.");
    }
    if (status !== STATUS.COMPLETE) {
      throw new QuizEngineError("QUIZ_NOT_COMPLETE", "The summary is available once every question is answered.");
    }
    return { categoryId, ...calculateResults(answers) };
  }

  // Review data is a safe snapshot of the completed round. Options are returned
  // in the exact order the player saw, and each answer is matched by question index.
  function getReviewData() {
    if (status !== STATUS.COMPLETE) {
      throw new QuizEngineError("QUIZ_NOT_COMPLETE", "Review is available once the quiz is complete.");
    }
    return questions.map((question, index) => {
      const answer = answers[index];
      return {
        questionId: question.id,
        question: question.question,
        category: question.category,
        options: [...question.options],
        correctIndex: question.correctIndex,
        correctAnswer: question.options[question.correctIndex],
        selectedIndex: answer ? answer.selectedIndex : null,
        selectedAnswer: answer && Number.isInteger(answer.selectedIndex) ? question.options[answer.selectedIndex] : null,
        isCorrect: Boolean(answer && answer.isCorrect),
        timedOut: Boolean(answer && answer.timedOut),
        unanswered: !answer,
        explanation: question.explanation,
      };
    });
  }

  return Object.freeze({
    start,
    restart,
    getCurrentQuestion,
    hasAnsweredCurrent,
    isLastQuestion,
    isComplete,
    getProgress,
    submitAnswer,
    recordTimeout,
    nextQuestion,
    getSummary,
    getReviewData,
  });
}