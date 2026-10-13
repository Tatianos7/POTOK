# P5-03 — карточка source review для двух продуктов

Статус: **PENDING_REVIEW**.

Карточка содержит предложения для проверки владельцем. Она не является
`REVIEW_APPROVED`, Food Reviewed Evidence v1 proposal/request/receipt или разрешением
на issuance. В ней намеренно нет runtime UUID, server-issued timestamps, authority
reference и придуманных revisions/events.

## `apple`

| Поле | Предложение | Первичный источник | Решение владельца |
| --- | --- | --- | --- |
| Identity | `Яблоко`; source identity `Apples, raw, with skin`, `Malus domestica` | USDA SR27, NDB 09003 | Подтвердить, что generic `apple` означает усреднённое сырое яблоко с кожурой, а не конкретный сорт или очищенное яблоко |
| State/applicability | `raw`; сердцевина и плодоножка исключены, source refuse 10% | В отчёте прямо указаны raw/with skin, edible portion и 10% core/stem refuse | Подтвердить соответствие recipe note «без сердцевины» и обязательность кожуры |
| Nutrition/100 g edible | 52 kcal; protein 0.26 g; fat 0.17 g; carbs 13.81 g; fiber 2.4 g | USDA SR27 table, amount in 100 g edible portion | Source carbs 13.81 включает fiber; POTOK carbs mapping PENDING/null до решения total/available |
| Food Core v02 | 47 kcal; protein 0.4 g; fat 0.4 g; carbs 9.8 g; fiber `null` | `foods_import`, row 1543 | Решить source-of-truth conflict; значения нельзя смешивать между наборами |

Retained excerpt:
[`apple-usda-sr27-ndb-09003.txt`](retained-sources/p5-03/apple-usda-sr27-ndb-09003.txt),
SHA-256 `89d79388d19e3013fb7975d67c6a6cf5b4e42cad58fe6fb8fb08c2d81befaaca`.
Источник: [USDA SR27 food-group report](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR27/reports/sr27fg09.pdf);
связанный current SR Legacy identifier — [FDC 171688](https://api.nal.usda.gov/fdc/v1/food/171688?api_key=DEMO_KEY).

## `cottage_cheese_5_percent`

| Поле | Предложение | Первичный источник | Решение владельца |
| --- | --- | --- | --- |
| Identity | `Творог 5%`; конкретная карточка Угличского сыродельно-молочного завода, ГОСТ 31453-2013 | Страница производителя | Решить, допустим ли конкретный branded/as-sold продукт для generic core stable key; иначе нужен другой authoritative generic source |
| State/applicability | proposed `as-sold`; 5% mass fraction подтверждена названием и fat 5.0 g/100 g | Страница говорит «на 100 г продукта», но не использует evidence-contract state или edible-portion basis | Предлагается применимый edible as-sold basis: вся масса творога съедобна, упаковка исключена; буквальная фраза edible portion не требуется |
| Nutrition/100 g product | 121 kcal; protein 16.0 g; fat 5.0 g; carbs 3.0 g; fiber `null` | Страница производителя | Fiber нельзя принять как 0: поле отсутствует. Нужен первичный fiber для той же identity; per-100-g-product basis применим к съедобному as-sold содержимому |
| Food Core v02 | 121 kcal; protein 17.2 g; fat 5.0 g; carbs 1.8 g; fiber `null` | `foods_import`, row 679 | Protein отличается на −1.2 g, carbs на +1.2 g; выбрать целиком применимый продукт/source, не собирать гибрид |

Retained excerpt:
[`cottage-cheese-usmz-5-percent.txt`](retained-sources/p5-03/cottage-cheese-usmz-5-percent.txt),
SHA-256 `6c7d87dc89ab8e1eae9be9ff5e105e467069724c66887ce4d60ac8afb2f1dae7`.
Источник: [страница производителя «Творог 5%»](https://www.usmz.ru/products/iz-uglicha/tvorog-5-iz-uglicha/).

Полная машинно-читаемая карта источников, дат, версий, единиц и retained bytes:
[`source-review-package-v1.json`](retained-sources/p5-03/source-review-package-v1.json).

## Решение, необходимое сейчас

Владелец проверяет две независимые строки, не создавая server events вручную:

1. Для `apple` — принять или отклонить USDA SR27 NDB 09003 как exact source для
   `raw`, with-skin, core-excluded generic identity и всех пяти nutrition fields.
2. Для `cottage_cheese_5_percent` — отклонить branded-to-generic mapping либо явно
   выбрать эту конкретную identity; техническое получение первичного fiber specification для выбранного продукта
   остаётся задачей исполнителя; проверенные источники перечислены в source JSON.

До этих решений карточка остаётся `PENDING_REVIEW`; `CAN_ISSUE_REAL_REVIEWED_EVIDENCE`
и `CAN_ASSEMBLE` остаются `false`.

## Дополнительное конкретное решение по carbs

Статус mapping: **PENDING**. USDA 13.81 g — исходный total carbohydrate включая
fiber 2.4 g; предлагаемое POTOK carbs — `null`. Выберите и утвердите семантику
POTOK: total including fiber с прямым mapping 13.81 либо available с отдельной
проверенной политикой derivation. Арифметические 11.41 не утверждены; 52 kcal
сохраняются без пересчёта 4/9/4. Реализация consumers не устанавливает это решение.

По творогу нужен только выбор identity; missing primary fiber specification/report
будет получен техническим путём для выбранного производителя. Ни отсутствие поля,
ни secondary zero, ни данные другого продукта не закрывают fiber.
