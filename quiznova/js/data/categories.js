

export const MIXED_CATEGORY_ID = "mixed";

export const CATEGORIES = Object.freeze([
  Object.freeze({ id: "html", label: "HTML", description: "Markup, elements, and semantics" }),
  Object.freeze({ id: "css", label: "CSS", description: "Styling, layout, and responsive design" }),
  Object.freeze({ id: "javascript", label: "JavaScript", description: "Language features and the browser" }),
  Object.freeze({ id: "computer-science", label: "Computer Science", description: "Algorithms, data, and how computers work" }),
  Object.freeze({ id: "science", label: "Science", description: "Physics, chemistry, and biology" }),
  Object.freeze({ id: "geography", label: "Geography", description: "Countries, capitals, and landscapes" }),
  Object.freeze({ id: "history", label: "History", description: "People and events that shaped the world" }),
  Object.freeze({ id: "general-knowledge", label: "General Knowledge", description: "A bit of everything" }),
]);

export const MIXED_OPTION = Object.freeze({
  id: MIXED_CATEGORY_ID,
  label: "Mixed Quiz",
  description: "Questions from all 8 categories",
});

export const CATEGORY_OPTIONS = Object.freeze([MIXED_OPTION, ...CATEGORIES]);

export function getCategoryLabel(categoryId) {
  const match = CATEGORY_OPTIONS.find((option) => option.id === categoryId);
  return match ? match.label : categoryId;
}