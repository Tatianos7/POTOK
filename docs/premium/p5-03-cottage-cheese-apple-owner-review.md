# P5-03 — recorded owner decisions and source candidates

Source decisions were fixed by owner instruction on 2026-10-13. They are not server
review events or issuance. No further choice of carbs semantics or branded/generic
curd identity is requested.

| Stage | Apple | Generic plain unsweetened curd 5% |
| --- | --- | --- |
| Source decision | Accepted USDA SR27 NDB 09003, raw with skin, core/stem excluded | Generic identity any brand fixed; branded identities stay separate |
| Source facts /100 g edible | 52 kcal; protein 0.26 g; fat 0.17 g; total carbohydrate 13.81 g including fiber 2.4 g | No accepted complete generic primary row |
| Mapped nutrition candidate | 52 kcal; protein 0.26 g; fat 0.17 g; available carbs 11.41 g; fiber 2.4 g | All proposed generic fields null; no manufacturer values transferred |
| Ready for issuance input | Source data only ready; runtime catalog/authority bindings still absent | NOT_READY |
| Server-issued reviewed evidence | NOT_ISSUED | NOT_ISSUED |
| Recipe review | NOT_REVIEWED | NOT_REVIEWED |
| Assembly eligibility | BLOCKED | BLOCKED |

Mapping version `potok-source-total-including-fiber-to-available-v1` explicitly
subtracts fiber only when the source establishes total includes fiber and identity,
state, units and basis match. It uses exact decimal arithmetic and rejects negative
results or unknown semantics. Original 13.81 and 2.4 remain retained separately;
source calories stay 52 without 4/9/4 recalculation. The EAEU regulation separates
available carbohydrates and dietary fiber; USDA defines carbohydrate by difference
without subtracting fiber. These justify the selected policy, not a server approval.

USMZ 121/16/5/3 with unknown fiber is retained solely as a separate branded example.
Its 100 g product basis applies to edible as-sold contents excluding packaging.
It cannot supply a nutrition revision for generic `cottage_cheese_5_percent`.

The bounded generic search found a university article with table 1 containing plain
5% input curd, 145/21/5/3 and fiber 0. That numeric zero is a real lead, but the
article does not bind its table to a primary analytical method/edition and its carbs
semantics are unspecified. It is not adopted or pooled with Food Core. The 2002
Skurikhin/Tutelyan mirror and secondary generic entry do not establish a verified
primary row. Search stopped; exact checks/reasons are in the source JSON.

Previous acquisition recommendation is superseded by the final resolution pass below.

[Source JSON and retained bindings](retained-sources/p5-03/source-review-package-v1.json).
Recipe composition/edible masses, measured yield/serving, portion, safety and eligibility
remain separate gates. 250 g is input mass sum, not measured yield. Batch exporter
remains a separate server task. CAN_ISSUE/CAN_ASSEMBLE=false. PLAN != FACT.

## Final official source-resolution pass — 2026-10-13

**NO-GO; generic-curd search stopped.** Official web.ion.ru direct HTTPS request
returned timeout; HTTP/directory fallbacks were inaccessible; bounded curl failed to
connect to the configured proxy. No database payload was obtained. Publisher
attribution to ФГБУН «ФИЦ питания и биотехнологии» is supported by its official
ion.ru site; database version, row/code, headings, basis, nutrient values, fiber type,
legend and carbs semantics remain unverified/null. The requested «Крестьянский» row
is a user-provided lead, not a directly read row. Its generic applicability is NOT_ESTABLISHED:
fat percentage alone cannot establish technology/composition equivalence to any-brand curd.

[RSL catalogue](https://search.rsl.ru/ru/record/01001844793) directly confirms title,
Institute of Nutrition RAMN, editors, publisher/year, ISBN and book-level 100 g edible
basis. The catalogue provides reading-room/fragment-order links, not an open page
viewer. Conventional viewer endpoint was inaccessible. Exact curd row, columns,
legend and carbohydrate definitions remain unavailable. Only minimal bibliographic
facts were retained; no protected full book was saved. No purchase/order/contact sent.

The official [EEC adopted PDF](https://eec.eaeunion.org/upload/medialibrary/9db/TrTsPishevkaMarkirovka.pdf)
article 4, part 4.9, paragraph 15, PDF p17, directly excludes dietary fiber.
Matching paragraph checked in identified consolidated edition dated 22.04.2024
(ConsultantPlus); the official PDF is labelled adopted base 09.12.2011, not a current
consolidated PDF or a draft amendment. The retained excerpt now pins that exact
paragraph. Full upstream PDF SHA: SKIP (proxy unavailable). Source arithmetic
13.81 − 2.4 = 11.41 is a separate approved mapping policy, not a regulatory formula
or change to source calories. Exact retained hashes are in the JSON manifest.

## Recommended next action

Select existing `oatmeal_with_apple` as the next pilot only by owner decision.
[Audit fallback table](p5-03-cottage-cheese-apple-evidence-audit.md) compares it with
buckwheat_with_carrot and tomato_omelet, including source/fiber/yield blockers.
No recipe was replaced. SOURCE_DATA_READY_FOR_ISSUANCE_INPUT=false;
CAN_ISSUE_REAL_REVIEWED_EVIDENCE=false; CAN_ASSEMBLE=false. PLAN != FACT.
