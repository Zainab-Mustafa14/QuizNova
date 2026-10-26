

console.log("QuizNova initialized successfully");


const QUIZ_FILES = [
  "./utils/constants.js",
  "./core/shuffle.js",
  "./data/categories.js",
  "./data/questions.js",
  "./core/scoring.js",
  "./services/questionService.js",
  "./services/storageServise.js",
  "./core/quizEngine.js",
  "./ui/quizScreen.js",
  "./ui/resultsScreen.js",
  "./ui/reviewScreen.js",
  "./ui/screenManager.js",
  "./ui/quizController.js",
];

function showMessage(text) {
  let box = document.querySelector("#start-error");
  if (!box) {
    box = document.createElement("p");
    box.id = "start-error";
    box.className = "notice notice--error";
    box.setAttribute("role", "alert");
    box.style.margin = "1rem";
    (document.querySelector("#main-content") || document.body).prepend(box);
  }
  box.textContent = text;
  box.hidden = false;
}


async function findBrokenFile() {
  for (const path of QUIZ_FILES) {
    const url = new URL(path, import.meta.url);
    try {
      await import(url.href);
    } catch (error) {
      const response = await fetch(url, { cache: "no-store" }).catch(() => null);
      const status = response ? response.status : "no response";
      return `${path.replace("./", "js/")} (HTTP ${status}): ${error.name}: ${error.message}`;
    }
  }
  return null;
}

try {
  const { initBackground } = await import("./ui/background.js");
  initBackground();
} catch (error) {
  console.warn("QuizNova: background effects are disabled.", error);
}

try {
  const { initQuiz } = await import("./ui/quizController.js");
  initQuiz();
} catch (error) {
  console.error("QuizNova: the quiz could not be initialized.", error);
  const broken = await findBrokenFile();
  showMessage(
    broken
      ? `The quiz couldn't load. Problem file: ${broken}`
      : `The quiz couldn't start: ${error.name}: ${error.message}`
  );
}