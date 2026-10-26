

const SCREEN_CONFIG = Object.freeze({
  welcome: { selector: "#welcome-screen", focus: "#welcome-title" },
  quiz: { selector: "#quiz-screen", focus: '[data-quiz="question"]' },
  results: { selector: "#results-screen", focus: "#results-title" },
  review: { selector: "#review-screen", focus: "#review-title" },
});

export function createScreenManager() {
  const screens = {};

  for (const [name, config] of Object.entries(SCREEN_CONFIG)) {
    const element = document.querySelector(config.selector);
    const focusTarget = element ? element.querySelector(config.focus) : null;
    if (!element || !focusTarget) {
      throw new Error(`QuizNova: the "${name}" screen is missing from the page (${config.selector}).`);
    }
    screens[name] = { element, focusTarget };
  }

  // Start from whatever the HTML currently shows (the Welcome screen).
  let current = Object.keys(screens).find((name) => !screens[name].element.hidden) ?? "welcome";

  function show(name, { focus = true } = {}) {
    if (!screens[name]) {
      throw new Error(`QuizNova: unknown screen "${name}".`);
    }

    // The "hidden" attribute does the work (reset.css makes it reliable).
    for (const [key, screen] of Object.entries(screens)) {
      screen.element.hidden = key !== name;
    }
    current = name;

    window.scrollTo(0, 0);
    // A focus target must be visible to receive focus, which is why we unhide first.
    if (focus) screens[name].focusTarget.focus({ preventScroll: true });
  }

  return Object.freeze({
    show,
    getCurrent: () => current,
  });
}