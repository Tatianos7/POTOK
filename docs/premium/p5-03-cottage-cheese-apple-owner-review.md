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

One next step: obtain the authorized Skurikhin/Tutelyan 2002 edition, ISBN
5-94343-028-8, exact generic 5% curd row with column headings and symbol/method
legend for independent source review. Do not replace the pilot automatically.

[Source JSON and retained bindings](retained-sources/p5-03/source-review-package-v1.json).
Recipe composition/edible masses, measured yield/serving, portion, safety and eligibility
remain separate gates. 250 g is input mass sum, not measured yield. Batch exporter
remains a separate server task. CAN_ISSUE/CAN_ASSEMBLE=false. PLAN != FACT.
