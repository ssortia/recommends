## naming

- имя файла плана: `docs/plans/<issue-number>-<yyyymmdd>-<slug>.md`
  - `<issue-number>` — номер GitHub issue, в рамках которого делается план
  - `<yyyymmdd>` — текущая дата
  - `<slug>` — краткое описание задачи (kebab-case)
  - пример: `docs/plans/9-20260711-delete-source.md`

## testing

- написание и запуск (при необходимости) e2e тестов — всегда отдельный, последний пункт плана, выполняется в самом конце реализации задачи
- testing approach всегда Regular (код сначала, тесты после) — не задавать вопрос "TDD or regular?" при сборе контекста плана, сразу использовать Regular
