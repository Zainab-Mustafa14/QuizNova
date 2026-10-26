# QuizNova

QuizNova is a responsive multiple-choice quiz app built with HTML, CSS, and vanilla JavaScript modules.

## Features

- Mixed Quiz or one of eight categories: HTML, CSS, JavaScript, Computer Science, Science, Geography, History, and General Knowledge.
- 80 questions total (10 per category); each round contains 10 randomized questions with shuffled options.
- Optional 20-second countdown for each question.
- Immediate answer feedback with explanations.
- Question progress indicator and timer ring.
- Results screen with score, percentage, performance message, and a saved personal best for each category.
- Review Answers screen with the exact option order, selected answer, correct answer, timeout status, and explanations.
- Responsive layout and keyboard-friendly navigation.
- No framework, build step, or API key required.

## Run locally

QuizNova uses JavaScript ES modules, so run it through a local web server rather than opening `index.html` directly.

### Option 1: Python

From the project folder, run:

```bash
python -m http.server 8000
```

Open `http://localhost:8000` in your browser.

### Option 2: VS Code

Install the **Live Server** extension, right-click `index.html`, and select **Open with Live Server**.

## Deploy

The project is static and can be deployed to GitHub Pages, Vercel, or Netlify. Upload the project files and use the project root as the deployment root. No build command is required.

## Tech stack

- HTML5
- CSS3
- Vanilla JavaScript (ES modules)
- Browser LocalStorage for personal-best scores

## Quick test checklist

1. Start a Mixed Quiz and a quiz from an individual category.
2. Answer correctly and incorrectly; confirm feedback and explanations appear.
3. Enable the timer and let one question time out.
4. Finish all 10 questions and check the score and percentage.
5. Open **Review Answers** and verify the selected/correct answers and explanations.
6. Return to Results and confirm the score and personal-best message remain unchanged.
7. Return to Welcome, start another round, and confirm the previous answers are not reused.
8. Refresh the page and confirm saved personal-best scores remain available.
