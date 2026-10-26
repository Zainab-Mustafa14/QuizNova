

import { getCategoryLabel } from "../data/categories.js";

const LETTERS = ["A", "B", "C", "D"];

function requireElement(root, name) {
  const element = root.querySelector(`[data-review="${name}"]`);
  if (!element) throw new Error(`Review screen markup is missing [data-review="${name}"].`);
  return element;
}

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export function createReviewScreen(root) {
  const el = {
    summary: requireElement(root, "summary"),
    list: requireElement(root, "list"),
    backResults: requireElement(root, "back-results"),
    backWelcome: requireElement(root, "back-welcome"),
  };
  let backResultsHandler = null;
  let backWelcomeHandler = null;

  function show({ items, summary, categoryLabel }) {
    if (!Array.isArray(items)) throw new Error("Review screen requires an answers array.");
    const correct = summary.correctCount;
    const total = summary.totalQuestions;
    el.summary.textContent = `${categoryLabel} · ${correct} of ${total} correct · ${summary.scorePercentage}%`;
    const fragment = document.createDocumentFragment();

    items.forEach((item, index) => {
      const card = make("article", `review-card ${item.isCorrect ? "review-card--correct" : "review-card--incorrect"}`);
      const top = make("div", "review-card__top");
      const meta = make("div", "review-card__meta");
      meta.append(
        make("span", "review-card__number", `Question ${index + 1} of ${total}`),
        make("span", "review-card__category", getCategoryLabel(item.category))
      );
      const statusText = item.timedOut ? "Timed out" : item.unanswered ? "Unanswered" : item.isCorrect ? "Correct" : "Incorrect";
      top.append(meta, make("span", `review-card__status ${item.isCorrect ? "is-correct" : "is-incorrect"}`, statusText));
      card.append(top, make("h2", "review-card__question", item.question));

      const options = make("ol", "review-card__options");
      item.options.forEach((option, optionIndex) => {
        const li = make("li", "review-option");
        if (optionIndex === item.correctIndex) li.classList.add("review-option--correct");
        if (optionIndex === item.selectedIndex && !item.isCorrect) li.classList.add("review-option--selected-wrong");
        const letter = make("span", "review-option__letter", `${LETTERS[optionIndex] || String.fromCharCode(65 + optionIndex)}.`);
        const label = make("span", "review-option__text", option);
        li.append(letter, label);
        if (optionIndex === item.correctIndex) li.append(make("span", "review-option__tag", "Correct answer"));
        else if (optionIndex === item.selectedIndex) li.append(make("span", "review-option__tag", "Your answer"));
        options.append(li);
      });
      card.append(options);

      const answerLine = item.timedOut
        ? `Your answer: No answer (time ran out). Correct answer: ${item.correctAnswer}`
        : item.unanswered
          ? `Your answer: Not answered. Correct answer: ${item.correctAnswer}`
          : `Your answer: ${item.selectedAnswer}. Correct answer: ${item.correctAnswer}`;
      card.append(make("p", "review-card__answer-line", answerLine));
      if (item.explanation) {
        const explanation = make("div", "review-card__explanation");
        explanation.append(make("strong", "", "Explanation"), make("p", "", item.explanation));
        card.append(explanation);
      }
      fragment.append(card);
    });
    el.list.replaceChildren(fragment);
  }

  el.backResults.addEventListener("click", () => backResultsHandler?.());
  el.backWelcome.addEventListener("click", () => backWelcomeHandler?.());

  return Object.freeze({
    show,
    onBackResults(handler) { backResultsHandler = handler; },
    onBackWelcome(handler) { backWelcomeHandler = handler; },
  });
}
