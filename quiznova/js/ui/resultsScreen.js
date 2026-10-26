

const RING_CIRCUMFERENCE = 326.73; 

function requireElement(root, name) {
  const element = root.querySelector(`[data-results="${name}"]`);
  if (!element) {
    throw new Error(`Results screen markup is missing [data-results="${name}"].`);
  }
  return element;
}

export function createResultsScreen(root) {
  const el = {
    category: requireElement(root, "category"),
    ring: requireElement(root, "ring"),
    ringFill: requireElement(root, "ring-fill"),
    percent: requireElement(root, "percent"),
    score: requireElement(root, "score"),
    correct: requireElement(root, "correct"),
    incorrect: requireElement(root, "incorrect"),
    incorrectNote: requireElement(root, "incorrect-note"),
    tier: requireElement(root, "tier"),
    message: requireElement(root, "message"),
    summary: requireElement(root, "summary"),
    bestScore: requireElement(root, "best-score"),
    tryAgain: requireElement(root, "try-again"),
    tryAgainLabel: requireElement(root, "try-again-label"),
    review: requireElement(root, "review"),
    back: requireElement(root, "back"),
    note: requireElement(root, "note"),
    error: requireElement(root, "error"),
  };

  let ringTargetOffset = RING_CIRCUMFERENCE;
  let tryAgainHandler = null;
  let reviewHandler = null;
  let backHandler = null;

  function clearMessages() {
    el.note.hidden = true;
    el.note.textContent = "";
    el.error.hidden = true;
    el.error.textContent = "";
  }

  function show({ categoryLabel, summary, tier, bestScore = null, isNewBest = false }) {
    const { correctCount, incorrectCount, timedOutCount, totalQuestions, scorePercentage } = summary;

    el.category.textContent = categoryLabel;
    el.percent.textContent = `${scorePercentage}%`;
    el.score.textContent = `${correctCount} / ${totalQuestions}`;
    el.ring.setAttribute(
      "aria-label",
      `Score: ${correctCount} out of ${totalQuestions}, ${scorePercentage} percent`
    );

    el.correct.textContent = String(correctCount);
    el.incorrect.textContent = String(incorrectCount);
    el.incorrectNote.hidden = timedOutCount === 0;
    el.incorrectNote.textContent = timedOutCount === 0 ? "" : `includes ${timedOutCount} timed out`;

    el.tier.textContent = tier.title;
    el.message.textContent = tier.message;

    let sentence = `You answered ${correctCount} of ${totalQuestions} questions correctly in ${categoryLabel}.`;
    if (timedOutCount > 0) {
      sentence += ` ${timedOutCount} ${timedOutCount === 1 ? "question ran" : "questions ran"} out of time.`;
    }
    el.summary.textContent = sentence;
    el.bestScore.textContent = bestScore === null
      ? "Personal best: not saved in this browser"
      : `Personal best for ${categoryLabel}: ${bestScore}%${isNewBest ? " — New personal best!" : ""}`;

    clearMessages();
    el.tryAgain.disabled = false;
    el.tryAgainLabel.textContent = "Try Again";

    // Park the ring at empty without animating. play() fills it once the screen is visible.
    el.ringFill.style.transition = "none";
    el.ringFill.style.strokeDashoffset = String(RING_CIRCUMFERENCE);
    ringTargetOffset = RING_CIRCUMFERENCE * (1 - scorePercentage / 100);
  }

  function play() {
    void el.ringFill.getBoundingClientRect(); // commit the empty ring first
    el.ringFill.style.transition = "";
    el.ringFill.style.strokeDashoffset = String(ringTargetOffset);
  }

  el.tryAgain.addEventListener("click", () => {
    if (tryAgainHandler) tryAgainHandler();
  });
  el.review.addEventListener("click", () => {
    if (reviewHandler) reviewHandler();
  });
  el.back.addEventListener("click", () => {
    if (backHandler) backHandler();
  });

  return Object.freeze({
    show,
    play,
    setBusy(isBusy) {
      el.tryAgain.disabled = isBusy;
      el.tryAgain.setAttribute("aria-busy", String(isBusy));
      el.tryAgainLabel.textContent = isBusy ? "Starting…" : "Try Again";
    },
    showError(message) {
      el.error.textContent = message;
      el.error.hidden = false;
    },
    showNote(message) {
      el.note.textContent = message;
      el.note.hidden = false;
    },
    clearMessages,
    focusTryAgain() {
      el.tryAgain.focus();
    },
    onTryAgain(handler) {
      tryAgainHandler = handler;
    },
    onReview(handler) {
      reviewHandler = handler;
    },
    onBack(handler) {
      backHandler = handler;
    },
  });
}