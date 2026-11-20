// JARVIS 2.0: role planner, without network access or side effects.
// This module does NOT activate agents, make API calls, or deploy workflows.
export const OFFICE_AGENTS = Object.freeze({
  product: Object.freeze({
    name: "Продакт",
    goal: "Преобразовать поручение в ТЗ, критерии приёмки и приоритеты.",
    deliverable: "Задача с результатом, ограничениями, зависимостями и проверками."
  }),
  analyst: Object.freeze({
    name: "Аналитик",
    goal: "Проверять гипотезы и экономику по проверяемым источникам.",
    deliverable: "Вывод с расчётом, источниками, допущениями и рисками."
  }),
  designer: Object.freeze({
    name: "Дизайнер",
    goal: "Создавать концепции интерфейсов и рекламных материалов.",
    deliverable: "Макет и спецификация для согласования."
  }),
  developer: Object.freeze({
    name: "Разработчик",
    goal: "Готовить изменения кода в отдельной ветке с тестами.",
    deliverable: "Pull request, инструкции и результаты тестов."
  }),
  tester: Object.freeze({
    name: "Тестировщик",
    goal: "Проверять сценарии, регрессии и критерии приёмки.",
    deliverable: "Отчёт о тестировании с воспроизведением ошибок."
  }),
  security: Object.freeze({
    name: "Безопасность",
    goal: "Проверять риски, доступы, резервирование и защиту данных.",
    deliverable: "Реестр уязвимостей с приоритетами и безопасными исправлениями."
  }),
  marketer: Object.freeze({
    name: "Маркетолог",
    goal: "Готовить офферы, контент и эксперименты по лидогенерации.",
    deliverable: "План кампании с метриками и материалами на согласование."
  })
});

const ROUTES = [
  ["security", /(?:безопасност|уязвим|взлом|резервн|бэкап|доступ|секрет|токен)/i],
  ["tester", /(?:тестир|проверь\s+(?:сайт|бот|код|форму)|qa\b|ошибк|баг|регресс)/i],
  ["developer", /(?:разработ|программир|код|api\b|интеграц|бота?\b|сайт|deploy|github)/i],
  ["designer", /(?:дизайн|макет|логотип|интерфейс|баннер|визуал|презентац)/i],
  ["marketer", /(?:маркетинг|реклам|лидогенерац|продвижен|объявлен|публикац|контент)/i],
  ["analyst", /(?:анализ|аналитик|конкурент|экономик|себестоимост|рентабельн|доходност|исследова)/i],
  ["product", /(?:техзадан|планир|приоритет|дорожн|функционал|продукт)/i]
];

// High-impact actions always require a separate, explicit human approval.
const APPROVAL_REQUIRED =
  /(?:отправ|разошл|рассыл|оплат|перевед|перечисл|купить|куп[и]|продать|продай|опублик|публику|удал|подпис|зарегистрир|выкат|депло|разверн|измени\s+(?:доступ|прав|парол)|персональн\s+данн)/i;

export function planOfficeTask(message, requestedRole = null) {
  const instruction = String(message || "").trim();
  if (!instruction || instruction.length > 2000) {
    return { ok: false, reason: "Поручение должно содержать от 1 до 2000 символов." };
  }
  if (requestedRole !== null && !Object.hasOwn(OFFICE_AGENTS, requestedRole)) {
    return { ok: false, reason: "Неизвестная роль ИИ-офиса." };
  }
  const role = requestedRole ?? ROUTES.find(([, pattern]) => pattern.test(instruction))?.[0] ?? "product";
  return {
    ok: true,
    role,
    title: OFFICE_AGENTS[role].name,
    goal: OFFICE_AGENTS[role].goal,
    expectedResult: OFFICE_AGENTS[role].deliverable,
    instruction,
    requiresHumanApproval: APPROVAL_REQUIRED.test(instruction),
    mode: "draft_only",
    status: "planned_not_executed"
  };
}
