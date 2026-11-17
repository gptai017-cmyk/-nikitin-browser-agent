import test from "node:test";
import assert from "node:assert/strict";
import { OFFICE_AGENTS, planOfficeTask } from "../worker/src/office-agents.js";

test("all seven office specialties exist", () => {
  assert.deepEqual(Object.keys(OFFICE_AGENTS).sort(), [
    "analyst", "designer", "developer", "marketer", "product", "security", "tester"
  ]);
});

test("routes Russian business tasks to appropriate specialist", () => {
  const examples = [
    ["Составь техзадание для ЛЕКС", "product"],
    ["Анализ конкурентов в Пензе", "analyst"],
    ["Сделай дизайн интерфейса", "designer"],
    ["Разработай API интеграцию", "developer"],
    ["Протестируй сайт", "tester"],
    ["Проверь резервные копии и безопасность", "security"],
    ["Подготовь рекламные объявления", "marketer"]
  ];
  for (const [message, role] of examples) {
    const result = planOfficeTask(message);
    assert.equal(result.ok, true, message);
    assert.equal(result.role, role, message);
    assert.equal(result.mode, "draft_only");
    assert.equal(result.status, "planned_not_executed");
  }
});

test("never treats a high-risk command as silently approved", () => {
  for (const task of [
    "Оплати счёт подрядчику",
    "Отправь письмо клиенту",
    "Опубликуй рекламу",
    "Удалить всю базу",
    "Разверни production"
  ]) {
    assert.equal(planOfficeTask(task).requiresHumanApproval, true, task);
  }
  assert.equal(planOfficeTask("Подготовь концепт баннера").requiresHumanApproval, false);
});

test("explicit role is respected; invalid and empty tasks are rejected", () => {
  assert.equal(planOfficeTask("Посмотри документацию", "security").role, "security");
  assert.equal(planOfficeTask("", "analyst").ok, false);
  assert.equal(planOfficeTask("задача", "director").ok, false);
  assert.equal(planOfficeTask("a".repeat(2001)).ok, false);
});
