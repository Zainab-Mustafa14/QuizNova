

import { createQuizEngine, QuizEngineError } from "../core/quizEngine.js";
import { createTimer } from "../core/timer.js";
import { getPerformanceTier } from "../core/scoring.js";
import { getCategoryLabel } from "../data/categories.js";
import { QUESTION_SECONDS } from "../utils/constants.js";
import { getBestScore, saveBestScore } from "../services/storageServise.js";
import { createQuizScreen } from "./quizScreen.js";
import { createResultsScreen } from "./resultsScreen.js";
import { createReviewScreen } from "./reviewScreen.js";
import { createScreenManager } from "./screenManager.js";

let initialized = false; // guard: never attach the listeners twice

function getElement(selector) {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`QuizNova: missing element ${selector}`);
  return element;
}

// Friendly text for the player. The technical details go to the console instead.
function getStartErrorMessage(error) {
  if (error instanceof QuizEngineError) {
    if (error.code === "INVALID_CATEGORY") {
      return "That category isn't available. Please choose one of the categories and try again.";
    }
    if (error.code === "QUESTIONS_UNAVAILABLE") {
      if (error.cause && error.cause.code === "LOAD_FAILED") {
        return "We couldn't load the questions. Please check your connection and try again.";
      }
      return "There aren't enough questions available for that choice right now. Please try another category.";
    }
  }
  return "Something went wrong while starting the quiz. Please try again.";
}

export function initQuiz() {
  if (initialized) return true;

  // ----- Find everything up front (throws a clear error if the HTML is out of sync) -----
  const startButton = getElement("#start-button");
  const startLabel = getElement("#start-button-label");
  const errorBox = getElement("#start-error");
  const timerToggle = getElement("#timer-toggle");

  const screens = createScreenManager();
  const screen = createQuizScreen(getElement("#quiz-screen"));
  const results = createResultsScreen(getElement("#results-screen"));
  const review = createReviewScreen(getElement("#review-screen"));
  const engine = createQuizEngine(); // one engine for the whole page; start() replaces the session

  // ONE timer for the whole page. start() always stops the previous countdown first.
  const timer = createTimer({
    onTick: (tick) => screen.updateTimer(tick),
    onExpire: handleTimeout,
  });

  let isStarting = false; // true while a quiz is loading
  let timerEnabled = false; // the toggle's value when the current quiz was started
  let completedBestInfo = null; // keep the result badge stable when returning from Review

  // ----- Countdown -----

  // Resets the display to a full 20s and starts the countdown (or hides it when the timer is off).
  function beginQuestionTimer() {
    timer.stop();
    screen.setTimer({ enabled: timerEnabled, seconds: QUESTION_SECONDS, fraction: 1 });
    if (timerEnabled) timer.start(QUESTION_SECONDS);
  }

  // The countdown reached zero. The engine refuses this if the question was
  // already answered, so a click and an expiry can never both score.
  function handleTimeout() {
    let feedback;
    try {
      if (engine.isComplete() || engine.hasAnsweredCurrent()) return;
      feedback = engine.recordTimeout(); // counts as incorrect, never earns a point
    } catch (error) {
      console.error("QuizNova: could not record the timeout.", error.code, error);
      return;
    }
    screen.showFeedback(feedback); // reveals the answer and explanation, enables Next
  }

  // ----- Small UI helpers -----

  function renderCurrentQuestion(question, { focus }) {
    const { currentNumber, totalQuestions } = engine.getProgress();
    screen.showQuestion(
      {
        question,
        number: currentNumber,
        total: totalQuestions,
        // Each question's own category: in a Mixed quiz the chip changes with the topic.
        categoryLabel: getCategoryLabel(question.category),
      },
      { focus }
    );
  }

  const welcomeUi = {
    setBusy(isBusy) {
      startButton.disabled = isBusy;
      startButton.setAttribute("aria-busy", String(isBusy));
      startLabel.textContent = isBusy ? "Starting…" : "Start Quiz";
    },
    showError(message) {
      errorBox.textContent = message;
      errorBox.hidden = false;
    },
    hideError() {
      errorBox.hidden = true;
      errorBox.textContent = "";
    },
    restoreFocus() {
      if (screens.getCurrent() === "welcome") startButton.focus();
    },
  };

  const resultsUi = {
    setBusy: (isBusy) => results.setBusy(isBusy),
    showError: (message) => results.showError(message),
    hideError: () => results.clearMessages(),
    restoreFocus() {
      if (screens.getCurrent() === "results") results.focusTryAgain();
    },
  };

  // ----- Starting a quiz (used by Start Quiz AND Try Again) -----

  // startFn returns the first question: engine.start(id) or engine.restart().
  // ui says where to show the loading state and any error.
  async function launchQuiz(startFn, ui) {
    if (isStarting) return; // ignore clicks while a quiz is loading
    isStarting = true;
    ui.hideError();
    ui.setBusy(true);

    let started = false;
    try {
      const firstQuestion = await startFn();
      
      completedBestInfo = null; // a successful new attempt starts a fresh result snapshot
      renderCurrentQuestion(firstQuestion, { focus: false });
      screens.show("quiz"); // unhides the quiz and focuses the question heading
      beginQuestionTimer(); // fresh 20s for question 1 (or no countdown)
      started = true;
    } catch (error) {
      console.error(
        "QuizNova: could not start the quiz.",
        { code: error.code, causeCode: error.cause && error.cause.code },
        error
      );
     
      if (!(error instanceof QuizEngineError && error.code === "START_SUPERSEDED")) {
        ui.showError(getStartErrorMessage(error));
      }
    } finally {
      isStarting = false;
      ui.setBusy(false);
    }

    // A disabled button loses focus. Give it back so keyboard users can retry.
    if (!started) ui.restoreFocus();
  }

  function handleStart() {
    if (isStarting) return;

    // Only the radio's value goes to the engine. No question logic lives here.
    const checked = document.querySelector('input[name="category"]:checked');
    const categoryId = checked ? checked.value : null;
    const wantsTimer = timerToggle.checked;

    launchQuiz(async () => {
      const firstQuestion = await engine.start(categoryId);
      timerEnabled = wantsTimer; // remembered for Try Again; only set once the quiz really started
      return firstQuestion;
    }, welcomeUi);
  }

  function handleTryAgain() {
    timer.stop();
    // Same category (the engine remembers it), same timer setting, brand-new random round
    launchQuiz(() => engine.restart(), resultsUi);
  }

  // ----- Results -----

  function showResults() {
    timer.stop();

    let summary;
    try {
      summary = engine.getSummary(); // the ONE source of every number on the Results screen
    } catch (error) {
      console.error("QuizNova: could not read the quiz summary.", error);
      welcomeUi.showError("We couldn't show your results. Please start a new quiz.");
      screens.show("welcome");
      return;
    }

    const categoryLabel = getCategoryLabel(summary.categoryId);
    // Save once per completed attempt. Returning from Review must not clear the
    // "New personal best!" message or attempt to save the same result again.
    if (!completedBestInfo) {
      const previousBest = getBestScore(summary.categoryId);
      const isNewBest = saveBestScore(summary.categoryId, summary.scorePercentage);
      const savedBest = getBestScore(summary.categoryId);
      completedBestInfo = {
        bestScore: savedBest === null ? previousBest : savedBest,
        isNewBest,
      };
    }

    results.show({
      categoryLabel,
      summary,
      tier: getPerformanceTier(summary.scorePercentage),
      ...completedBestInfo,
    });
    screens.show("results");
    results.play(); // animate the ring now that the screen is visible
  }

  function handleReview() {
    timer.stop();
    try {
      const summary = engine.getSummary();
      review.show({
        items: engine.getReviewData(),
        summary,
        categoryLabel: getCategoryLabel(summary.categoryId),
      });
      screens.show("review");
    } catch (error) {
      console.error("QuizNova: could not open answer review.", error);
      results.showError("We couldn't open answer review. Please return to Results and try again.");
    }
  }

  function handleBackToResults() {
    showResults();
  }

  function handleBackToWelcome() {
    timer.stop();
    welcomeUi.hideError();
    results.clearMessages();
    screens.show("welcome"); // category and timer selections are left exactly as they were
  }

  // ----- Answering and moving on -----

  screen.onAnswer((selectedIndex) => {
    try {
      const feedback = engine.submitAnswer(selectedIndex); // { selectedIndex, correctIndex, isCorrect, timedOut, explanation }
      timer.stop(); // answered: the countdown ends immediately
      return feedback;
    } catch (error) {
      console.error("QuizNova: the answer was rejected.", error.code, error);
      throw error; // the renderer unlocks the options so the player can try again
    }
  });

  screen.onNext(() => {
    if (engine.isComplete()) return;

    let nextQuestion;
    try {
      nextQuestion = engine.nextQuestion(); // throws NOT_ANSWERED if called too early
    } catch (error) {
      console.error("QuizNova: could not move to the next question.", error.code, error);
      return;
    }
    timer.stop();

    if (nextQuestion === null) {
      showResults(); // that was the last question
      return;
    }
    renderCurrentQuestion(nextQuestion, { focus: true });
    beginQuestionTimer(); // reset to a full 20s for the new question
  });

  // ----- Buttons -----

  startButton.addEventListener("click", handleStart);
  results.onTryAgain(handleTryAgain);
  results.onReview(handleReview);
  results.onBack(handleBackToWelcome);
  review.onBackResults(handleBackToResults);
  review.onBackWelcome(handleBackToWelcome);

  initialized = true;
  return true;
}