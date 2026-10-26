

const OPTION_LETTERS = ["A", "B", "C", "D"];
const TIMER_CIRCUMFERENCE = 113.1; 
const URGENT_SECONDS = 5; 

function getLetter(index) {
  return OPTION_LETTERS[index] ?? String.fromCharCode(65 + index);
}

function requireElement(root, name) {
  const element = root.querySelector(`[data-quiz="${name}"]`);
  if (!element) {
    throw new Error(`Quiz screen markup is missing [data-quiz="${name}"].`);
  }
  return element;
}

function createOptionButton(text, index) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "option";
  button.dataset.index = String(index);

  const letter = document.createElement("span");
  letter.className = "option__letter";
  letter.setAttribute("aria-hidden", "true");
  letter.textContent = getLetter(index);

  const label = document.createElement("span");
  label.className = "option__text";
  label.textContent = text;

  const status = document.createElement("span");
  status.className = "option__status";
  status.setAttribute("aria-hidden", "true");

  button.append(letter, label, status);
  return button;
}

export function createQuizScreen(root) {
  const el = {
    category: requireElement(root, "category"),
    current: requireElement(root, "current"),
    total: requireElement(root, "total"),
    progress: requireElement(root, "progress"),
    progressFill: requireElement(root, "progress-fill"),
    timer: requireElement(root, "timer"),
    timerText: requireElement(root, "timer-text"),
    timerFill: requireElement(root, "timer-fill"),
    question: requireElement(root, "question"),
    options: requireElement(root, "options"),
    feedback: requireElement(root, "feedback"),
    feedbackIcon: requireElement(root, "feedback-icon"),
    feedbackTitle: requireElement(root, "feedback-title"),
    feedbackAnswer: requireElement(root, "feedback-answer"),
    feedbackExplanation: requireElement(root, "feedback-explanation"),
    next: requireElement(root, "next"),
    nextLabel: requireElement(root, "next-label"),
  };

  let number = 0; // 1-based number of the question on screen
  let total = 0;
  let answered = false;
  let locked = false; // becomes true the instant an option is clicked (or time runs out)
  let answerHandler = null;
  let nextHandler = null;

  function updateProgress() {
    const percent = total > 0 ? (number / total) * 100 : 0;

    el.progress.setAttribute("aria-valuemin", "0");
    el.progress.setAttribute("aria-valuemax", String(total));
    el.progress.setAttribute("aria-valuenow", String(number));
    el.progress.setAttribute("aria-valuetext", `Question ${number} of ${total}`);
    el.progressFill.style.setProperty("--progress", `${percent}%`);
  }


  function setTimerRing(fraction) {
    const clamped = Math.min(1, Math.max(0, fraction));
    el.timerFill.style.strokeDashoffset = String((1 - clamped) * TIMER_CIRCUMFERENCE);
  }

  function setTimer({ enabled, seconds = 0, fraction = 1 }) {
    el.timer.hidden = !enabled;
    el.timer.classList.remove("timer--urgent", "timer--expired");
    if (!enabled) return;

    el.timerText.textContent = String(seconds);

    // Jump to the full ring instead of animating a refill from empty
    el.timerFill.style.transition = "none";
    setTimerRing(fraction);
    void el.timerFill.getBoundingClientRect(); // force the browser to apply it now
    el.timerFill.style.transition = "";
  }

  // Called on every timer tick.
  function updateTimer({ remainingSeconds, fraction }) {
    if (el.timer.hidden) return;
    const seconds = Math.max(0, remainingSeconds);
    el.timerText.textContent = String(seconds);
    setTimerRing(fraction);
    el.timer.classList.toggle("timer--urgent", seconds > 0 && seconds <= URGENT_SECONDS);
    el.timer.classList.toggle("timer--expired", seconds === 0);
  }

  // ----- Questions -----

  // data: { question: {question, options}, number, total, categoryLabel }
  function showQuestion(data, { focus = false } = {}) {
    const { question, categoryLabel = "" } = data;
    if (!question || !Array.isArray(question.options) || question.options.length === 0) {
      throw new Error("showQuestion needs a question with an options array.");
    }

    number = data.number;
    total = data.total;
    answered = false;
    locked = false;

    el.category.textContent = categoryLabel;
    el.category.hidden = categoryLabel === "";
    el.current.textContent = String(number);
    el.total.textContent = String(total);
    el.question.textContent = question.question;
    el.options.replaceChildren(...question.options.map(createOptionButton));

    el.feedback.hidden = true;
    el.next.disabled = true;
    el.nextLabel.textContent = number === total ? "Finish Quiz" : "Next Question";

    updateProgress();

    // Move focus to the new question so keyboard and screen reader users aren't left behind
    if (focus) el.question.focus();
  }

  // feedback: { selectedIndex (null when time ran out), correctIndex, isCorrect, timedOut, explanation }
  function showFeedback(feedback) {
    const { selectedIndex, correctIndex, isCorrect, explanation } = feedback;
    const timedOut = feedback.timedOut === true;
    const buttons = [...el.options.querySelectorAll(".option")];

    if (!Number.isInteger(correctIndex) || !buttons[correctIndex]) {
      throw new Error("showFeedback needs a valid correctIndex.");
    }

    locked = true;
    answered = true;

    // Lock all options and mark each one
    buttons.forEach((button, index) => {
      button.disabled = true;

      const text = button.querySelector(".option__text").textContent;
      const status = button.querySelector(".option__status");
      let note = "";

      if (index === correctIndex) {
        button.classList.add("option--correct");
        status.textContent = "✓";
        note = index === selectedIndex ? "your answer, correct" : "correct answer";
      } else if (index === selectedIndex) {
        button.classList.add("option--incorrect");
        status.textContent = "✗";
        note = "your answer, incorrect";
      } else {
        button.classList.add("option--dimmed");
      }

      // Screen readers can't see colors or icons, so spell the result out
      if (note) button.setAttribute("aria-label", `${getLetter(index)}: ${text} (${note})`);
    });

    // Feedback panel
    const correctText = buttons[correctIndex].querySelector(".option__text").textContent;
    el.feedback.classList.toggle("feedback--correct", isCorrect);
    el.feedback.classList.toggle("feedback--incorrect", !isCorrect);
    el.feedbackIcon.textContent = timedOut ? "!" : isCorrect ? "✓" : "✗";
    el.feedbackTitle.textContent = timedOut ? "Time's up!" : isCorrect ? "Correct!" : "Not quite.";
    el.feedbackAnswer.hidden = isCorrect;
    el.feedbackAnswer.textContent = isCorrect ? "" : `The correct answer is ${getLetter(correctIndex)}: ${correctText}.`;
    el.feedbackExplanation.textContent = explanation;
    el.feedback.hidden = false;

    el.next.disabled = false;
    updateProgress();

      el.feedback.focus();
  }

  el.options.addEventListener("click", (event) => {
    const button = event.target.closest(".option");
    if (!button || !el.options.contains(button)) return;
    if (locked || !answerHandler) return; // already answered or timed out: ignore

    locked = true; // lock immediately, so a fast double-click cannot submit twice

    let feedback;
    try {
      feedback = answerHandler(Number(button.dataset.index));
    } catch (error) {
      locked = false; // the answer was rejected: allow another try
      throw error;
    }
    showFeedback(feedback);
  });

  el.next.addEventListener("click", () => {
    if (!answered || !nextHandler) return;
    nextHandler();
  });

  return Object.freeze({
    showQuestion,
    showFeedback,
    setTimer,
    updateTimer,
    onAnswer(handler) {
      answerHandler = handler;
    },
    onNext(handler) {
      nextHandler = handler;
    },
  });
}