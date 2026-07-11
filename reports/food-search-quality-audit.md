# Food Search Quality Audit

- Timestamp: 2026-07-11T14:17:31.550Z
- Mode: read-only staging audit
- Staging project ref: ozidryfvhkcbtpnulakq
- Production used: no
- DB writes: no
- Excel changed: no
- Supabase key kind used for reads: anon
- Final verdict: **SEARCH_QUALITY_MIXED_GAPS**

## Current Search Algorithm

| phase |current behavior |risk |
| --- | --- | --- |
| 1 | User foods from localStorage/Supabase are appended first when userId is present. | User rows outrank public rows in final sort. |
| 2 | Public foods are read with PostgREST textSearch(search_vector, websearch) ordered by popularity desc, limit 100. | DB text-search ranking is mostly lost later. |
| 3 | Exact alias lookup is equality-only on food_aliases.normalized_alias; alias target foods are appended after text search. | Alias exact has no explicit final ranking boost. |
| 4 | Fallback local cache is used only when public Supabase search returns no rows. | Stale cache should not affect staging when DB returns rows. |
| 5 | finalizeFoodSearchResults dedupes by normalized name + brand. | Different canonical UUIDs with different names can both remain. |
| 6 | Final sort: user first, core before brand, exact display name, then popularity desc. | No explicit prefix/contains/generic/specificity/cooking-state ranking. |

## Generic Product Coverage

- Required generic queries checked: 19
- Exact generic canonical covered: 10
- Missing exact generic canonical: 9

| query |generic canonical exists |stable_food_id |exact canonical name |aliases |category |cooking_state |current rank |
| --- | --- | --- | --- | --- | --- | --- | --- |
| йогурт | no |  |  |  |  |  |  |
| овсянка | no |  |  |  |  |  |  |
| сыр | no |  |  |  |  |  |  |
| хлеб | no |  |  |  |  |  |  |
| чай | no |  |  |  |  |  |  |
| рыба | no |  |  |  |  |  |  |
| молоко | yes | milk | Молоко | молоко | milk | unknown | 1 |
| кефир | no |  |  |  |  |  |  |
| творог | no |  |  |  |  |  |  |
| яйцо | no |  |  |  |  |  |  |
| курица | yes | chicken | Курица | курица | meat | raw | 1 |
| говядина | yes | beef | Говядина | говядина | meat | raw | 1 |
| свинина | yes | pork | Свинина | свинина | meat | raw | 1 |
| рис | no |  |  |  |  |  |  |
| гречка | no |  |  |  |  |  |  |
| макароны | no |  |  |  |  |  |  |
| картофель | yes | potato | Картофель | картофель | vegetables | fresh | 1 |
| яблоко | yes | apple | Яблоко | яблоко | fruit | fresh | 1 |
| банан | yes | banana | Банан | банан | fruit | fresh | 1 |
| кофе | no |  |  |  |  |  |  |
| вода | yes | water | Вода | вода | drinks | unknown | 1 |
| масло | no |  |  |  |  |  |  |
| сахар | no |  |  |  |  |  |  |
| соль | no |  |  |  |  |  |  |
| морковь | yes | carrot | Морковь | морковь | vegetables | fresh | 1 |
| лук | no |  |  |  |  |  |  |
| помидор | yes | tomato | Помидор | помидор | vegetables | raw | 1 |
| огурец | yes | cucumber | Огурец | огурец | vegetables | fresh | 1 |
| капуста | no |  |  |  |  |  |  |
| апельсин | yes | orange | Апельсин | апельсин | fruit | fresh | 1 |
| груша | yes | pear | Груша | груша | fruit | fresh | 1 |
| виноград | yes | grapes | Виноград | виноград | berry | fresh | 1 |
| творожок | no |  |  |  |  |  |  |
| сметана | no |  |  |  |  |  |  |
| сливки | no |  |  |  |  |  |  |
| индейка | no |  |  |  |  |  |  |
| лосось | no |  |  |  |  |  |  |
| тунец | no |  |  |  |  |  |  |
| суп | no |  |  |  |  |  |  |
| борщ | no |  |  |  |  |  |  |
| каша | no |  |  |  |  |  |  |
| салат | no |  |  |  |  |  |  |
| шоколад | yes | chocolate | Шоколад | шоколад | dessert | unknown | 1 |
| печенье | yes | cookies | Печенье | печенье | dessert | unknown | 1 |
| булочка | no |  |  |  |  |  |  |
| творожная запеканка | no |  |  | творожная запеканка |  |  |  |
| греческий йогурт | no |  |  |  |  |  |  |
| чай зеленый | no |  |  | чай зеленый |  |  |  |
| хлеб ржаной | no |  |  |  |  |  |  |
| картофель вареный | no |  |  | картофель вареный |  |  |  |

## Common Query Top Results

### йогурт

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Пирожное Йогуртовое | yogurtovoe_pastry | alias_prefix | dessert | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=alias_prefix |
| 2 | Торт Йогуртовый с клюквой | cranberry_yogurt_cake | canonical_contains | dessert | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |

### овсянка

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |

### сыр

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Бамбук побеги | raw_bamboo_shoots | alias_contains | vegetables | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=alias_contains |
| 2 | Блины с ветчиной и сыром | pancakes_with_ham_and_cheese | canonical_contains | flour_products | fried | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 3 | Блины с сыром | pancakes_with_cheese | canonical_contains | flour_products | fried | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 4 | Колбаса сыровяленая Сальчичон | salchichon_dry_cured_sausage | canonical_contains | sausages_and_processed_meat | dried | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 5 | Колбаса сырокопченая брауншвейгская | braunschweig_dry_smoked_sausage | canonical_contains | sausages_and_processed_meat | dried | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 6 | Колбаса сырокопченая зернистая | grainy_dry_smoked_sausage | canonical_contains | sausages_and_processed_meat | dried | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 7 | Колбаса сырокопченая любительская | amateur_dry_smoked_sausage | canonical_contains | sausages_and_processed_meat | dried | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 8 | Колбаса сырокопченая московская | moscow_dry_smoked_sausage | canonical_contains | sausages_and_processed_meat | dried | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 9 | Колбаса сырокопченая свиная | pork_dry_smoked_sausage | canonical_contains | sausages_and_processed_meat | dried | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 10 | Колбаса сырокопченая сервелат | cervelat_dry_smoked_sausage | canonical_contains | sausages_and_processed_meat | dried | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |

### хлеб

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Джекфрут (плод хлебного дерева) | jackfruit | canonical_contains | fruit | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 2 | Закваска хлебная ржаная | rye_bread_starter | canonical_contains | seasonings | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 3 | Квас хлебный | bread_kvass | canonical_contains | drinks | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 4 | Сухарики из белого хлеба | white_bread_croutons | canonical_contains | bread | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 5 | Хлеб Английский зерновой | english_grain_bread | canonical_prefix | bread | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 6 | Хлеб Ароматный с солодом и кориандром | aromatic_bread_with_malt_and_coriander | canonical_prefix | bread | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 7 | Хлеб Банановый | banana_bread | canonical_prefix | bread | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 8 | Хлеб Богородский бездрожжевой | bogorodsky_yeast_free_bread | canonical_prefix | bread | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 9 | Хлеб Богородский заварной | bogorodsky_sour_bread | canonical_prefix | bread | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 10 | Хлеб Бородинский | borodinsky_bread | canonical_prefix | bread | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |

### чай

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Булочка к чаю | tea_bun | db_text_search | bread | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 2 | Имбирь китайский (крачай) | chinese_ginger_krachai | canonical_contains | seasonings | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 3 | Кипрей (Иван-чай) сушеный | dried_fireweed_ivan_tea | canonical_contains | vegetables | dried | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 4 | Колбаса вареная Чайная | tea_boiled_sausage | canonical_contains | sausages_and_processed_meat | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 5 | Чай гречишный | buckwheat_tea | canonical_prefix | drinks | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 6 | Чай жёлтый сухой | dry_yellow_tea | canonical_prefix | tea | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 7 | Чай зелёный | green_tea | canonical_prefix | tea | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 8 | Чай зелёный сухой | dry_green_tea | canonical_prefix | tea | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 9 | Чай каркаде | hibiscus_tea | canonical_prefix | tea | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 10 | Чай каркаде сухой | dry_hibiscus_tea | canonical_prefix | tea | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |

### рыба

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Икра летучей рыбы | flying_fish_roe | db_text_search | fish | raw | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 2 | Ледяная рыба | ice_fish | alias_prefix | fish | raw | current final sort: source=core; not exact display name; popularity=0; observed match=alias_prefix |
| 3 | Летучая рыба | flying_fish | alias_prefix | fish | raw | current final sort: source=core; not exact display name; popularity=0; observed match=alias_prefix |
| 4 | Масляная рыба | butterfish | alias_prefix | fish | raw | current final sort: source=core; not exact display name; popularity=0; observed match=alias_prefix |
| 5 | Масляная рыба копченая | smoked_butterfish | canonical_contains | fish | smoked | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 6 | Молоки рыбьи | fish_milt | db_text_search | fish | raw | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 7 | Пельмени с рыбой | fish_pelmeni | db_text_search | flour_products | dried | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 8 | Приправа для рыбы | fish_seasoning | db_text_search | seasonings | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 9 | Треска чёрная (угольная рыба) | black_codfish | canonical_contains | fish | raw | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |

### молоко

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Молоко | milk | canonical_exact | milk | unknown | current final sort: source=core; exact display name; popularity=0; observed match=canonical_exact |
| 2 | Айран (тан) из козьего молока | ayran_(tan)_from_goat's_milk | db_text_search | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 3 | Блины со сгущеным молоком | pancakes_with_condensed_milk | canonical_contains | flour_products | fried | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 4 | Гречневая каша на молоке | buckwheat_porridge_with_milk | db_text_search | cereal | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 5 | Кофе с молоком и сахаром | coffee_with_milk_and_sugar | canonical_contains | coffee | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 6 | Кофе со сгущенным молоком | coffee_with_condensed_milk | canonical_contains | coffee | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 7 | Кофе со сгущенным молоком и сахаром | coffee_with_condensed_milk_and_sugar | canonical_contains | coffee | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 8 | Манная каша на молоке | semolina_porridge_with_milk | db_text_search | cereal | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 9 | Молоки рыбьи | fish_milt | db_text_search | fish | raw | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 10 | Молоко 0.1% (обезжиренное) | milk_0_1_(skim) | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |

### кефир

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Кефир 0 % | kefir_0 | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 2 | Кефир 1 % | kefir_1 | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 3 | Кефир 1.5 % | kefir_1_5 | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 4 | Кефир 2 % | kefir_2 | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 5 | Кефир 2.5 % | kefir_2_5 | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 6 | Кефир 3.2 % | kefir_3_2 | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 7 | Окрошка на кефире | kefir_okroshka | canonical_contains | soup | ready | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 8 | Хлеб Кефирный | kefir_bread | alias_prefix | bread | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=alias_prefix |

### творог

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Творог 0.1% | cottage_cheese_0_1_percent | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 2 | Творог 0.2% | cottage_cheese_0_2_percent | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 3 | Творог 0.3% | cottage_cheese_0_3_percent | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 4 | Творог 0.6% (маложирный) | cottage_cheese_0_6_percent | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 5 | Творог 0% (обезжиренный) | cottage_cheese_0_percent | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 6 | Творог 1.8% (нежирный) | cottage_cheese_1_8_percent | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 7 | Творог 1% | cottage_cheese_1_percent | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 8 | Творог 11% | cottage_cheese_11_percent | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 9 | Творог 18% (жирный) | cottage_cheese_18_percent | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 10 | Творог 2% | cottage_cheese_2_percent | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |

### яйцо

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Бычьи яйца | bull_eggs | db_text_search | meat | raw | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 2 | Макароны запеченные с яйцом | pasta_baked_with_egg | canonical_contains | flour_products | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 3 | Омлет (яйцо куриное) | egg_chicken_omelette | canonical_contains | eggs | raw | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 4 | Пашот (яйцо куриное) | chicken_egg_poached | canonical_contains | eggs | raw | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 5 | Яйцо гусиное | egg_goose | canonical_prefix | eggs | raw | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 6 | Яйцо куриное | egg_chicken | canonical_prefix | eggs | raw | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 7 | Яйцо куриное белок | egg_chicken_protein | canonical_prefix | eggs | raw | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 8 | Яйцо куриное вареное вкрутую | egg_hard_boiled_chicken | canonical_prefix | eggs | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 9 | Яйцо куриное вареное всмятку | egg_soft_boiled_chicken | canonical_prefix | eggs | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 10 | Яйцо куриное жареное | egg_fried_chicken | canonical_prefix | eggs | fried | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |

### курица

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Курица | chicken | canonical_exact | meat | raw | current final sort: source=core; exact display name; popularity=0; observed match=canonical_exact |
| 2 | Бефстроганов из курицы | chicken_beef_stroganoff | db_text_search | meat | raw | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 3 | Куриная грудка | chicken_breast | alias_prefix | meat | raw | current final sort: source=core; not exact display name; popularity=0; observed match=alias_prefix |
| 4 | Куриное филе | chicken_fillet | alias_prefix | meat | raw | current final sort: source=core; not exact display name; popularity=0; observed match=alias_prefix |
| 5 | Курица вареная (без кожи) | boiled_chicken_(skinless) | canonical_prefix | meat | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 6 | Курица жареная | fried_chicken | canonical_prefix | meat | fried | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 7 | Курица копченая | smoked_chicken | canonical_prefix | meat | smoked | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 8 | Пельмени с курицей | chicken_pelmeni | db_text_search | flour_products | dried | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 9 | Приправа для курицы | chicken_seasoning | db_text_search | seasonings | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |

### говядина

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Говядина | beef | canonical_exact | meat | raw | current final sort: source=core; exact display name; popularity=0; observed match=canonical_exact |
| 2 | Антрекот из говядины | beef_entrecote | db_text_search | meat | raw | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 3 | Бефстроганов из говядины | beef_stroganoff | db_text_search | meat | raw | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 4 | Говядина вареная | boiled_beef | canonical_prefix | meat | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 5 | Говядина вареная нежирная | boiled_lean_beef | canonical_prefix | meat | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 6 | Говядина жареная | fried_beef | canonical_prefix | meat | fried | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 7 | Говядина мраморная | marbled_beef | canonical_prefix | meat | raw | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 8 | Говядина постная | lean | canonical_prefix | meat | raw | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 9 | Говядина постная жареная | lean_fried | canonical_prefix | meat | fried | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 10 | Говядина средней жирности | medium_fat_beef | canonical_prefix | meat | raw | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |

### свинина

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Свинина | pork | canonical_exact | meat | raw | current final sort: source=core; exact display name; popularity=0; observed match=canonical_exact |
| 2 | Антрекот из свинины | pork_entrecote | db_text_search | meat | raw | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 3 | Бефстроганов из свинины | pork_beef_stroganoff | db_text_search | meat | raw | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 4 | Пельмени с говядиной и свининой | beef_and_pork_pelmeni | db_text_search | flour_products | dried | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 5 | Пельмени со свининой | pork_pelmeni | db_text_search | flour_products | dried | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 6 | Свинина вареная | boiled_pork | canonical_prefix | meat | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 7 | Свинина жареная | fried_pork | canonical_prefix | meat | fried | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 8 | Свинина копченая | smoked_pork | canonical_prefix | meat | smoked | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 9 | Свинина постная | lean_pork | canonical_prefix | meat | raw | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 10 | Свинина тушеная | stewed_pork | canonical_prefix | meat | stewed | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |

### рис

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Барбарис | barberry | canonical_contains | berry | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 2 | Барбарис сушеный | dried_barberries | canonical_contains | dried fruit | dried | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 3 | Воздушный рис | puffed_rice | alias_prefix | seasonings | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=alias_prefix |
| 4 | Мука рисовая диетическая | diet_rice_flour | canonical_contains | flour_products | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 5 | Приправа для риса | rice_seasoning | canonical_contains | seasonings | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 6 | Рис белый | white_rice | canonical_prefix | cereal | dried | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 7 | Рис белый вареный | boiled_white_rice | canonical_prefix | cereal | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 8 | Рис бурый | brown_rice | canonical_prefix | cereal | dried | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 9 | Рис Дикий | wild_rice | canonical_prefix | cereal | dried | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 10 | Рис дикий вареный | boiled_wild_rice | canonical_prefix | cereal | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |

### гречка

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Гречка зелёная вареная | boiled_green_buckwheat | canonical_prefix | cereal | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 2 | Гречневая крупа (продел) | crushed_buckwheat_groats | alias_prefix | cereal | dried | current final sort: source=core; not exact display name; popularity=0; observed match=alias_prefix |
| 3 | Гречневая крупа (ядрица) | whole_buckwheat_groats | alias_prefix | cereal | dried | current final sort: source=core; not exact display name; popularity=0; observed match=alias_prefix |
| 4 | Мука из зеленой гречки | green_buckwheat_flour | db_text_search | flour_products | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |

### макароны

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Макароны вареные с жиром | boiled_pasta_with_fat | canonical_prefix | flour_products | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 2 | Макароны высшего сорта | premium_grade_pasta | canonical_prefix | flour_products | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 3 | Макароны высшего сорта вареные | boiled_premium_grade_pasta | canonical_prefix | flour_products | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 4 | Макароны запеченные с яйцом | pasta_baked_with_egg | canonical_prefix | flour_products | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 5 | Макароны из полбы цельнозерновые | whole_grain_spelt_pasta | canonical_prefix | flour_products | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 6 | Макароны первого сорта | first_grade_pasta | canonical_prefix | flour_products | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 7 | Суп из лука-порея с макаронами | leek_soup_with_pasta | db_text_search | soup | ready | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 8 | Суп из помидоров с макаронами | tomato_soup_with_pasta | db_text_search | soup | ready | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 9 | Суп картофельный с макаронными изделиями | potato_soup_with_pasta | db_text_search | soup | ready | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 10 | Суп молочный с макаронами | milk_soup_with_pasta | db_text_search | soup | ready | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |

### картофель

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Картофель | potato | canonical_exact | vegetables | fresh | current final sort: source=core; exact display name; popularity=0; observed match=canonical_exact |
| 2 | Драники картофельные | potato_pancakes | canonical_contains | vegetables | fried | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 3 | Зразы картофельные с грибами | potato_zrazy_with_mushrooms | canonical_contains | vegetables | fried | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 4 | Зразы картофельные с капустой | potato_zrazy_with_cabbage | canonical_contains | vegetables | fried | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 5 | Картофель варёный | boiled_potato | canonical_prefix | vegetables | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 6 | Картофель жареный | fried_potato | canonical_prefix | vegetables | fried | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 7 | Картофель молодой | new_potato | canonical_prefix | vegetables | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 8 | Картофель сладкий (батат) | sweet_potato | canonical_prefix | vegetables | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 9 | Картофель фиолетовый | purple_potato | canonical_prefix | vegetables | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 10 | Картофельное пюре | mashed_potatoes | canonical_prefix | vegetables | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |

### яблоко

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Яблоко | apple | canonical_exact | fruit | fresh | current final sort: source=core; exact display name; popularity=0; observed match=canonical_exact |
| 2 | Варенье из яблок | apple_jam | db_text_search | dessert | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 3 | Звёздное яблоко | star_apple | alias_prefix | fruit | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=alias_prefix |
| 4 | Кисель из сушеных яблок | dried_apple_kissel | db_text_search | jelly | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 5 | Кисель из яблок | apple_kissel | db_text_search | jelly | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 6 | Суп фруктовый из яблок | apple_fruit_soup | db_text_search | soup | ready | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 7 | Цукаты из яблок | candied_apples | db_text_search | dried fruit | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 8 | Штрудель с яблоком | shtrudel_s_yablokom | canonical_contains | dessert | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 9 | Яблоки сушёные | dried_apples | db_text_search | dried fruit | dried | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 10 | Яблоко Голден | golden_delicious_apple | canonical_prefix | fruit | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |

### банан

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Банан | banana | canonical_exact | fruit | fresh | current final sort: source=core; exact display name; popularity=0; observed match=canonical_exact |
| 2 | Банановый сок | banana_juice | canonical_prefix | juice | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 3 | Бананы сушёные | dried_bananas | canonical_prefix | dried fruit | dried | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 4 | Джем банановый | banana_jam | alias_prefix | dessert | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=alias_prefix |
| 5 | Сироп банановый | banana_syrup | alias_prefix | seasonings | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=alias_prefix |
| 6 | Хлеб Банановый | banana_bread | alias_prefix | bread | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=alias_prefix |

### кофе

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Кофе жареный в зёрнах сухой | dry_roasted_coffee_beans | canonical_prefix | coffee | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 2 | Кофе зелёный сухой | dry_green_coffee_beans | canonical_prefix | coffee | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 3 | Кофе капучино | cappuccino | canonical_prefix | coffee | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 4 | Кофе латте | latte | canonical_prefix | coffee | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 5 | Кофе латте макиато | latte_macchiato | canonical_prefix | coffee | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 6 | Кофе моккачино | mochaccino | canonical_prefix | coffee | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 7 | Кофе натуральный молотый сухой | dry_ground_coffee | canonical_prefix | coffee | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 8 | Кофе по-Венски | viennese_coffee | canonical_prefix | coffee | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 9 | Кофе по-ирландски | irish_coffee | canonical_prefix | coffee | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 10 | Кофе растворимый сухой | dry_instant_coffee | canonical_prefix | coffee | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |

### вода

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Вода | water | canonical_exact | drinks | unknown | current final sort: source=core; exact display name; popularity=0; observed match=canonical_exact |
| 2 | Вода минеральная | mineral_water | canonical_prefix | drinks | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 3 | Вода содовая | soda_water | canonical_prefix | drinks | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 4 | Гречневая каша вязкая на воде | viscous_buckwheat_porridge_with_water | db_text_search | cereal | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 5 | Манная каша на воде | semolina_porridge_with_water | db_text_search | cereal | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 6 | Овсяная каша на воде | oatmeal_porridge_with_water | db_text_search | cereal | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 7 | Перловая каша на воде | pearl_barley_porridge_with_water | db_text_search | cereal | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 8 | Полбяная каша на воде | spelt_porridge_with_water | db_text_search | cereal | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 9 | Пшенная каша вязкая на воде | viscous_millet_porridge_with_water | db_text_search | cereal | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 10 | Рисовая каша на воде | rice_porridge_with_water | db_text_search | cereal | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |

### масло

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Блины с маслом | pancakes_with_butter | canonical_contains | flour_products | fried | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 2 | Гречневая каша с маслом | buckwheat_porridge_with_butter | canonical_contains | cereal | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 3 | Масло абрикосовое | apricot_oil | canonical_prefix | oil | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 4 | Масло авокадо | avocado_oil | canonical_prefix | oil | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 5 | Масло амаранта | amaranth_oil | canonical_prefix | oil | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 6 | Масло виноградных косточек | grape_seed_oil | canonical_prefix | oil | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 7 | Масло горчичное | mustard_oil | canonical_prefix | oil | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 8 | Масло грецкого ореха | walnut_oil | canonical_prefix | oil | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 9 | Масло гхи топлёное | clarified_ghee_butter | canonical_prefix | oil | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 10 | Масло зародышей пшеницы | wheat_germ_oil | canonical_prefix | oil | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |

### сахар

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Компот из сухофруктов без сахара | unsweetened_dried_fruit_compote | canonical_contains | compote | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 2 | Кофе с молоком и сахаром | coffee_with_milk_and_sugar | canonical_contains | coffee | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 3 | Кофе со сгущенным молоком и сахаром | coffee_with_condensed_milk_and_sugar | canonical_contains | coffee | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 4 | Мальтоза (солодовый сахар) | maltose | canonical_contains | seasonings | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 5 | Мастика сахарная | sugar_fondant | canonical_contains | dessert | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 6 | Молоко сгущённое без сахара | condensed_milk_without_sugar | canonical_contains | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 7 | Молоко сгущённое с сахаром | сondensed_milk_with_sugar | canonical_contains | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 8 | Сахар ванильный | vanilla_sugar | canonical_prefix | seasonings | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 9 | Сахар виноградный жидкий | liquid_grape_sugar | canonical_prefix | seasonings | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 10 | Сахар кленовый | maple_sugar | canonical_prefix | seasonings | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |

### соль

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Рассольник | rassolnik_soup | canonical_contains | soup | ready | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 2 | Соль гималайская розовая | pink_himalayan_salt | canonical_prefix | seasonings | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 3 | Соль чесночная | garlic_salt | canonical_prefix | seasonings | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 4 | Суп овощной с фасолью | vegetable_soup_with_beans | canonical_contains | soup | ready | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 5 | Сыр Чечил рассольный копчёный | smoked_brined_chechil_cheese | canonical_contains | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 6 | Фасоль (ростки) | bean_sprouts | canonical_contains | vegetables | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 7 | Фасоль белая | white_beans | canonical_contains | vegetables | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 8 | Фасоль белая консервированная | canned_white_beans | canonical_contains | vegetables | canned | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 9 | Фасоль варёная | boiled_beans | canonical_contains | vegetables | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 10 | Фасоль красная | red_beans | canonical_contains | vegetables | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |

### морковь

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Морковь | carrot | canonical_exact | vegetables | fresh | current final sort: source=core; exact display name; popularity=0; observed match=canonical_exact |
| 2 | Морковь варёная | boiled_carrot | canonical_prefix | vegetables | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 3 | Морковь жёлтая | yellow_carrot | canonical_prefix | vegetables | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 4 | Морковь квашеная | fermented_carrot | canonical_prefix | vegetables | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 5 | Морковь консервированная | canned_carrot | canonical_prefix | vegetables | canned | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 6 | Морковь пассерованная | sauteed_carrot | canonical_prefix | vegetables | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 7 | Морковь по-корейски классическая | classic_korean_style_carrot_salad | canonical_prefix | salad | ready | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 8 | Морковь по-корейски острая | spicy_korean_style_carrot_salad | canonical_prefix | salad | ready | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 9 | Морковь по-корейски с грибами | korean_style_carrot_salad_with_mushrooms | canonical_prefix | salad | ready | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 10 | Морковь по-корейски с кальмарами | korean_style_carrot_salad_with_squid | canonical_prefix | salad | ready | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |

### лук

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Колбаса полукопченая Закусочная | snack_semi_smoked_sausage | canonical_contains | sausages_and_processed_meat | smoked | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 2 | Колбаса полукопченая Краковская | krakow_semi_smoked_sausage | canonical_contains | sausages_and_processed_meat | smoked | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 3 | Колбаса полукопченая Минская | minsk_semi_smoked_sausage | canonical_contains | sausages_and_processed_meat | smoked | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 4 | Колбаса полукопченая Полтавская | poltava_semi_smoked_sausage | canonical_contains | sausages_and_processed_meat | smoked | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 5 | Колбаса полукопченая салями любительская | amateur_salami_semi_smoked_sausage | canonical_contains | sausages_and_processed_meat | smoked | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 6 | Колбаса полукопченая Таллиннская | tallinn_semi_smoked_sausage | canonical_contains | sausages_and_processed_meat | smoked | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 7 | Колбаски полукопченые охотничьи | hunter_semi_smoked_sausages | canonical_contains | sausages_raw_or_grill | smoked | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 8 | Лук белый | white_onion | canonical_prefix | vegetables | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 9 | Лук душистый джусай | chinese_chives_jusai | canonical_prefix | vegetables | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 10 | Лук зелёный | green_onion | canonical_prefix | vegetables | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |

### помидор

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Помидор | tomato | canonical_exact | vegetables | raw | current final sort: source=core; exact display name; popularity=0; observed match=canonical_exact |
| 2 | Суп из помидоров | tomato_soup | canonical_contains | soup | ready | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 3 | Суп из помидоров с макаронами | tomato_soup_with_pasta | canonical_contains | soup | ready | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 4 | Суп из помидоров с рисом | tomato_soup_with_rice | canonical_contains | soup | ready | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |

### огурец

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Огурец | cucumber | canonical_exact | vegetables | fresh | current final sort: source=core; exact display name; popularity=0; observed match=canonical_exact |
| 2 | Ангурия (Антильский огурец) | anguria_antillean_cucumber | canonical_contains | vegetables | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 3 | Огурец китайский | chinese_cucumber | canonical_prefix | vegetables | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 4 | Огурец консервированный | canned_cucumber | canonical_prefix | vegetables | canned | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 5 | Огурец маринованный | pickled_cucumber | canonical_prefix | vegetables | pickled | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 6 | Огурец парниковый | greenhouse_cucumber | canonical_prefix | vegetables | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 7 | Огурец солёный | salted_cucumber | canonical_prefix | vegetables | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |

### капуста

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Борщ из свежей капусты с мясом | fresh_cabbage_borscht_with_meat | db_text_search | soup | ready | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 2 | Брокколи | broccoli | alias_prefix | vegetables | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=alias_prefix |
| 3 | Зразы картофельные с капустой | potato_zrazy_with_cabbage | db_text_search | vegetables | fried | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 4 | Капуста белокочанная | white_cabbage | canonical_prefix | vegetables | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 5 | Капуста белокочанная жареная | fried_white_cabbage | canonical_prefix | vegetables | fried | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 6 | Капуста брюссельская | brussels_sprouts | canonical_prefix | vegetables | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 7 | Капуста брюссельская замороженная | frozen_brussels_sprouts | canonical_prefix | vegetables | frozen | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 8 | Капуста квашеная | sauerkraut | canonical_prefix | vegetables | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 9 | Капуста кольраби | kohlrabi | canonical_prefix | vegetables | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 10 | Капуста краснокочанная | red_cabbage | canonical_prefix | vegetables | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |

### апельсин

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Апельсин | orange | canonical_exact | fruit | fresh | current final sort: source=core; exact display name; popularity=0; observed match=canonical_exact |
| 2 | Апельсин маринованный | pickled_orange | canonical_prefix | fruit | pickled | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 3 | Апельсиновый нектар | orange_nectar | canonical_prefix | nectar | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 4 | Апельсиновый сок | orange_juice | canonical_prefix | juice | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 5 | Варенье из апельсинов | orange_jam | canonical_contains | dessert | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 6 | Джем апельсиновый | orange_jam_2 | alias_prefix | dessert | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=alias_prefix |
| 7 | Желе апельсиновое | orange_jelly | alias_prefix | dessert | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=alias_prefix |
| 8 | Повидло апельсиновое | apelsinovoe_fruit_butter | alias_prefix | dessert | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=alias_prefix |
| 9 | Соус апельсиновый | orange_sauce | alias_prefix | sauce | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=alias_prefix |
| 10 | Торт Постный апельсиновый | vegan_orange_cake | canonical_contains | dessert | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |

### груша

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Груша | pear | canonical_exact | fruit | fresh | current final sort: source=core; exact display name; popularity=0; observed match=canonical_exact |
| 2 | Варенье из груши | pear_jam | db_text_search | dessert | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 3 | Груша консервированная | canned_pear | canonical_prefix | fruit | canned | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 4 | Груши сушёные | dried_pears | db_text_search | dried fruit | dried | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 5 | Торт Медовая фантазия с грушей | honey_fantasy_with_pear_cake | db_text_search | dessert | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 6 | Цукаты из груш | candied_pears | db_text_search | dried fruit | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |

### виноград

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Виноград | grapes | canonical_exact | berry | fresh | current final sort: source=core; exact display name; popularity=0; observed match=canonical_exact |
| 2 | Виноград белый Дамские пальчики | white_lady_finger_grapes | canonical_prefix | berry | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 3 | Виноград белый кишмиш | white_seedless_grapes | canonical_prefix | berry | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 4 | Виноград фиолетовый ранний | early_purple_grapes | canonical_prefix | berry | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 5 | Виноградный компот | grape_compote | canonical_prefix | compote | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 6 | Виноградный сок | grape_juice | canonical_prefix | juice | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 7 | Икра виноградных улиток | snail_caviar | canonical_contains | fish | raw | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 8 | Листья винограда | grape_leaves | canonical_contains | vegetables | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 9 | Листья винограда консервированные | canned_grape_leaves | canonical_contains | vegetables | canned | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 10 | Масло виноградных косточек | grape_seed_oil | canonical_contains | oil | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |

### творожок

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |

### сметана

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Сметана 10% | sour_cream_10 | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 2 | Сметана 12% | sour_cream_12 | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 3 | Сметана 15% | sour_cream_15 | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 4 | Сметана 18% | sour_cream_18 | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 5 | Сметана 20% | sour_cream_20 | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 6 | Сметана 25% | sour_cream_25 | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 7 | Сметана 30% | sour_cream_30 | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 8 | Сметана 40% | sour_cream_40 | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 9 | Соус сметанный | sour_cream_sauce | db_text_search | sauce | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 10 | Соус сметанный с шампиньонами | sour_cream_mushroom_sauce | db_text_search | sauce | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |

### сливки

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Вафли венские со взбитыми сливками | venskie_so_vzbitymi_slivkami_viennese_waffles | db_text_search | dessert | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 2 | Пирожное Корзиночка со сливками и конфитюром | korzinochka_so_slivkami_i_konfityurom_pastry | db_text_search | dessert | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 3 | Сливки 10% | cream_10 | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 4 | Сливки 15% | cream_15 | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 5 | Сливки 20% | cream_20 | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 6 | Сливки 33% | cream_33 | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 7 | Сливки 35% | cream_35 | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 8 | Сливки 9% | cream_9 | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 9 | Сливки взбитые | whipped_cream | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 10 | Сливки сухие | dry_cream | canonical_prefix | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |

### индейка

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Ветчина из индейки обезжиренная | Low_fat_turkey_ham | db_text_search | meat | raw | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 2 | Индейка вареная | boiled_turkey | canonical_prefix | meat | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 3 | Индейка грудка | turkey_breast | canonical_prefix | meat | raw | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 4 | Индейка жареная | roast_turkey | canonical_prefix | meat | fried | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 5 | Индейка желудки | turkey_stomachs | canonical_prefix | meat | raw | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 6 | Индейка крылышки | turkey_wings | canonical_prefix | meat | raw | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 7 | Индейка окорочка | turkey_legs | canonical_prefix | meat | raw | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 8 | Индейка печень | turkey_liver | canonical_prefix | meat | baked | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 9 | Индейка сердце | turkey_heart | canonical_prefix | meat | raw | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 10 | Индейка фарш | ground_turkey | canonical_prefix | meat | raw | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |

### лосось

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Лосось консервированный | canned_salmon | canonical_prefix | fish | canned | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 2 | Лосось солёный | salted_salmon | canonical_prefix | fish | salted | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 3 | Лосось филе слабосоленое | lightly_salted_salmon_fillet | canonical_prefix | fish | salted | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |

### тунец

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Тунец в растительном масле | tuna_in_vegetable_oil | canonical_prefix | fish | raw | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 2 | Тунец в собственном соку | tuna_in_its_own_juice | canonical_prefix | fish | raw | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 3 | Тунец копченый | smoked_tuna | canonical_prefix | fish | smoked | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 4 | Тунец свежий | fresh_tuna | canonical_prefix | fish | raw | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 5 | Тунец соленый | salted_tuna | canonical_prefix | fish | salted | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |

### суп

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Приправа для супа | soup_seasoning | canonical_contains | seasonings | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 2 | Суп гороховый | pea_soup | canonical_prefix | soup | ready | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 3 | Суп грибной | mushroom_soup | canonical_prefix | soup | ready | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 4 | Суп из зелёного горошка | green_pea_soup | canonical_prefix | soup | ready | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 5 | Суп из лука-порея с макаронами | leek_soup_with_pasta | canonical_prefix | soup | ready | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 6 | Суп из помидоров | tomato_soup | canonical_prefix | soup | ready | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 7 | Суп из помидоров с макаронами | tomato_soup_with_pasta | canonical_prefix | soup | ready | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 8 | Суп из помидоров с рисом | tomato_soup_with_rice | canonical_prefix | soup | ready | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 9 | Суп из сельдерея | celery_soup | canonical_prefix | soup | ready | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 10 | Суп из стручковой фасоли | green_bean_soup | canonical_prefix | soup | ready | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |

### борщ

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Борщ из свежей капусты с мясом | fresh_cabbage_borscht_with_meat | canonical_prefix | soup | ready | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 2 | Борщ летний холодный | cold_summer_borscht | canonical_prefix | soup | ready | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 3 | Борщ сибирский | siberian_borscht | canonical_prefix | soup | ready | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 4 | Борщ Сибирский с фрикадельками | siberian_borscht_with_meatballs | canonical_prefix | soup | ready | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 5 | Борщ украинский | ukrainian_borscht | canonical_prefix | soup | ready | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 6 | Приправа для борща | borscht_seasoning | canonical_contains | seasonings | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |

### каша

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Гречневая каша вязкая на воде | viscous_buckwheat_porridge_with_water | canonical_contains | cereal | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 2 | Гречневая каша из крупы ядрица | buckwheat_porridge_from_whole_groats | canonical_contains | cereal | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 3 | Гречневая каша на молоке | buckwheat_porridge_with_milk | canonical_contains | cereal | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 4 | Гречневая каша с маслом | buckwheat_porridge_with_butter | canonical_contains | cereal | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 5 | Льняная каша с кунжутом | flaxseed_porridge_with_sesame | canonical_contains | cereal | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 6 | Манная каша на воде | semolina_porridge_with_water | canonical_contains | cereal | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 7 | Манная каша на молоке | semolina_porridge_with_milk | canonical_contains | cereal | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 8 | Овсяная каша на воде | oatmeal_porridge_with_water | canonical_contains | cereal | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 9 | Овсяная каша на молоке | oatmeal_porridge_with_milk | canonical_contains | cereal | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 10 | Перловая каша на воде | pearl_barley_porridge_with_water | canonical_contains | cereal | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |

### салат

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Кресс-салат | watercress | canonical_contains | vegetables | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 2 | Маш-салат | lambs_lettuce | canonical_contains | vegetables | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 3 | Приправа для салата | salad_seasoning | canonical_contains | seasonings | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 4 | Салат Айсберг | iceberg_lettuce | canonical_prefix | vegetables | fresh | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 5 | Салат Алые паруса | alye_parusa_salad | canonical_prefix | salad | ready | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 6 | Салат Ариран | ariran_salad | canonical_prefix | salad | ready | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 7 | Салат Афинский | athenian_salad | canonical_prefix | salad | ready | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 8 | Салат Берендей | berendey_salad | canonical_prefix | salad | ready | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 9 | Салат Бордо | bordeaux_salad | canonical_prefix | salad | ready | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 10 | Салат Венский | viennese_salad | canonical_prefix | salad | ready | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |

### шоколад

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Шоколад | chocolate | canonical_exact | dessert | unknown | current final sort: source=core; exact display name; popularity=0; observed match=canonical_exact |
| 2 | Горячий шоколад | hot_chocolate | alias_prefix | drinks | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=alias_prefix |
| 3 | Карамель шоколадно-ореховая | chocolate_nut_caramel_candy | canonical_contains | dessert | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 4 | Конфеты шоколадные | chocolate_candies | canonical_contains | dessert | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 5 | Мармелад фруктово-ягодный в шоколаде | chocolate_coated_fruit_and_berry_jelly_candy | canonical_contains | dessert | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 6 | Масло сливочное шоколадное | chocolate_butter | canonical_contains | oil | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 7 | Мороженое молочное шоколадное | milk_chocolate_ice_cream | canonical_contains | dessert | frozen | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 8 | Мороженое пломбир шоколадный | plombir_chocolate_ice_cream | canonical_contains | dessert | frozen | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 9 | Мороженое сливочное шоколадное | cream_chocolate_ice_cream | canonical_contains | dessert | frozen | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |
| 10 | Сыр плавленый шоколадный | chocolate_processed_cheese | canonical_contains | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_contains |

### печенье

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Печенье | cookies | canonical_exact | dessert | unknown | current final sort: source=core; exact display name; popularity=0; observed match=canonical_exact |
| 2 | Баранья печень | lamb_liver | db_text_search | meat | baked | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 3 | Говяжья печень | beef_liver | db_text_search | meat | baked | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 4 | Говяжья печень вареная | boiled_beef_liver | db_text_search | meat | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 5 | Говяжья печень жареная | fried_beef_liver | db_text_search | meat | fried | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 6 | Говяжья печень нежирная | lean_beef_liver | db_text_search | meat | baked | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 7 | Гусиная печень | goose_liver | db_text_search | meat | baked | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 8 | Индейка печень | turkey_liver | db_text_search | meat | baked | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 9 | Кроличья печень | rabbit_liver | db_text_search | meat | baked | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 10 | Кроличья печень вареная | boiled_rabbit_liver | db_text_search | meat | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |

### булочка

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Булочка к чаю | tea_bun | canonical_prefix | bread | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 2 | Булочка Калорийная | calorie_bun | canonical_prefix | bread | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 3 | Булочка отрубная | bran_bun | canonical_prefix | bread | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 4 | Булочка Столичная | stolichnaya_bun | canonical_prefix | bread | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 5 | Булочка Улитка с корицей | cinnamon_swirl_bun | canonical_prefix | bread | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 6 | Булочки Бургундские | burgundy_buns | db_text_search | bread | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 7 | Булочки Бутербродные с кунжутом | sesame_sandwich_buns | db_text_search | bread | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 8 | Булочки для гамбургеров | hamburger_buns | db_text_search | bread | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 9 | Булочки для хот-догов | hot_dog_buns | db_text_search | bread | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 10 | Булочки сдобные | sweet_buns | db_text_search | bread | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |

### творожная запеканка

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Запеканка творожная | cottage_cheese_casserole | alias_exact | milk | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=alias_exact |

### греческий йогурт

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |

### чай зеленый

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Чай зелёный | green_tea | alias_exact | tea | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=alias_exact |
| 2 | Чай зелёный сухой | dry_green_tea | alias_prefix | tea | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=alias_prefix |

### хлеб ржаной

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Хлеб Ржано-пшеничный | rye_wheat_bread | db_text_search | bread | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=db_text_search |
| 2 | Хлеб Ржаной бездрожжевой | yeast_free_rye_bread | canonical_prefix | bread | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 3 | Хлеб Ржаной Золотая Рожь | golden_rye_bread | canonical_prefix | bread | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |
| 4 | Хлеб Ржаной формовой | pan_baked_rye_bread | canonical_prefix | bread | unknown | current final sort: source=core; not exact display name; popularity=0; observed match=canonical_prefix |

### картофель вареный

| rank |name |stable_food_id |match source |category |cooking_state |reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Картофель варёный | boiled_potato | alias_exact | vegetables | boiled | current final sort: source=core; not exact display name; popularity=0; observed match=alias_exact |

## Known Warnings Analysis

### йогурт

- Policy: required
- Exact generic: none
- Exact alias targets: none
- Issues: MISSING_GENERIC_CANONICAL/high: No exact generic canonical row matched the normalized query.

### овсянка

- Policy: manual_selection
- Exact generic: none
- Exact alias targets: none
- Issues: BROAD_QUERY_SHOULD_SHOW_CHOICES/medium: Conversational query can mean flakes, groats, or cooked porridge.; DATA_QUALITY_ISSUE/medium: No candidates returned for a common broad query; likely missing alias or canonical coverage.

### сыр

- Policy: manual_selection
- Exact generic: none
- Exact alias targets: none
- Issues: BROAD_QUERY_SHOULD_SHOW_CHOICES/medium: Cheese nutrition varies too much for one safe universal profile.; SPECIFIC_RESULT_TOO_HIGH/medium: Contains/text-search result "Бамбук побеги" ranks without a safer prefix/exact choice list.

### хлеб

- Policy: manual_selection
- Exact generic: none
- Exact alias targets: none
- Issues: BROAD_QUERY_SHOULD_SHOW_CHOICES/medium: Bread type materially changes nutrition; show choices.; SPECIFIC_RESULT_TOO_HIGH/medium: Contains/text-search result "Джекфрут (плод хлебного дерева)" ranks above stronger prefix/exact candidates.

### чай

- Policy: manual_selection
- Exact generic: none
- Exact alias targets: none
- Issues: BROAD_QUERY_SHOULD_SHOW_CHOICES/medium: Can mean prepared unsweetened drink or dry tea leaves.; SPECIFIC_RESULT_TOO_HIGH/medium: Contains/text-search result "Булочка к чаю" ranks above stronger prefix/exact candidates.

### рыба

- Policy: manual_selection
- Exact generic: none
- Exact alias targets: none
- Issues: BROAD_QUERY_SHOULD_SHOW_CHOICES/medium: Fish species and cooking states vary too much for one profile.; SPECIFIC_RESULT_TOO_HIGH/medium: Contains/text-search result "Икра летучей рыбы" ranks above stronger prefix/exact candidates.

## Ranking v1 Before/After

| query |before top3 |after top3 |change |
| --- | --- | --- | --- |
| йогурт | Пирожное Йогуртовое (alias_prefix); Торт Йогуртовый с клюквой (canonical_contains) | Пирожное Йогуртовое (canonical_contains); Торт Йогуртовый с клюквой (canonical_contains) | changed |
| овсянка | no results | Овсяная крупа (alias_prefix); Овсяные хлопья (alias_prefix); Овсяная каша на воде (alias_prefix) | changed |
| сыр | Бамбук побеги (alias_contains); Блины с ветчиной и сыром (canonical_contains); Блины с сыром (canonical_contains) | Сыр 9% (canonical_prefix); Сыр Бри (canonical_prefix); Сыр Эдам (canonical_prefix) | changed |
| хлеб | Джекфрут (плод хлебного дерева) (canonical_contains); Закваска хлебная ржаная (canonical_contains); Квас хлебный (canonical_contains) | Хлеб соевый (canonical_prefix); Хлеб Донской (canonical_prefix); Хлеб Овсяный (canonical_prefix) | changed |
| чай | Булочка к чаю (db_text_search); Имбирь китайский (крачай) (canonical_contains); Кипрей (Иван-чай) сушеный (canonical_contains) | Чай зелёный (canonical_prefix); Чай каркаде (canonical_prefix); Чай гречишный (canonical_prefix) | changed |
| рыба | Икра летучей рыбы (db_text_search); Ледяная рыба (alias_prefix); Летучая рыба (alias_prefix) | Летучая рыба (alias_prefix); Ледяная рыба (alias_prefix); Масляная рыба (alias_prefix) | changed |

## Severity Classification

| query |issue |severity |detail |
| --- | --- | --- | --- |
| йогурт | MISSING_GENERIC_CANONICAL | high | No exact generic canonical row matched the normalized query. |
| овсянка | BROAD_QUERY_SHOULD_SHOW_CHOICES | medium | Conversational query can mean flakes, groats, or cooked porridge. |
| овсянка | DATA_QUALITY_ISSUE | medium | No candidates returned for a common broad query; likely missing alias or canonical coverage. |
| сыр | BROAD_QUERY_SHOULD_SHOW_CHOICES | medium | Cheese nutrition varies too much for one safe universal profile. |
| сыр | SPECIFIC_RESULT_TOO_HIGH | medium | Contains/text-search result "Бамбук побеги" ranks without a safer prefix/exact choice list. |
| хлеб | BROAD_QUERY_SHOULD_SHOW_CHOICES | medium | Bread type materially changes nutrition; show choices. |
| хлеб | SPECIFIC_RESULT_TOO_HIGH | medium | Contains/text-search result "Джекфрут (плод хлебного дерева)" ranks above stronger prefix/exact candidates. |
| чай | BROAD_QUERY_SHOULD_SHOW_CHOICES | medium | Can mean prepared unsweetened drink or dry tea leaves. |
| чай | SPECIFIC_RESULT_TOO_HIGH | medium | Contains/text-search result "Булочка к чаю" ranks above stronger prefix/exact candidates. |
| рыба | BROAD_QUERY_SHOULD_SHOW_CHOICES | medium | Fish species and cooking states vary too much for one profile. |
| рыба | SPECIFIC_RESULT_TOO_HIGH | medium | Contains/text-search result "Икра летучей рыбы" ranks above stronger prefix/exact candidates. |
| молоко | ACCEPTABLE | low | No blocking issue found for current policy. |
| кефир | MISSING_GENERIC_CANONICAL | high | No exact generic canonical row matched the normalized query. |
| творог | MISSING_GENERIC_CANONICAL | high | No exact generic canonical row matched the normalized query. |
| яйцо | MISSING_GENERIC_CANONICAL | high | No exact generic canonical row matched the normalized query. |
| курица | BROAD_QUERY_SHOULD_SHOW_CHOICES | medium | Chicken parts and cooking states vary; manual selection is safer. |
| говядина | BROAD_QUERY_SHOULD_SHOW_CHOICES | medium | Cuts vary; broad query should show choices. |
| свинина | BROAD_QUERY_SHOULD_SHOW_CHOICES | medium | Cuts vary; broad query should show choices. |
| рис | BROAD_QUERY_SHOULD_SHOW_CHOICES | medium | Raw vs cooked rice must stay separated. |
| рис | SPECIFIC_RESULT_TOO_HIGH | medium | Contains/text-search result "Барбарис" ranks above stronger prefix/exact candidates. |
| гречка | BROAD_QUERY_SHOULD_SHOW_CHOICES | medium | Can mean groats or cooked buckwheat porridge. |
| макароны | BROAD_QUERY_SHOULD_SHOW_CHOICES | medium | Raw vs cooked pasta must stay separated. |
| картофель | BROAD_QUERY_SHOULD_SHOW_CHOICES | medium | Raw, boiled, fried, and baked states differ. |
| яблоко | ACCEPTABLE | low | No blocking issue found for current policy. |
| банан | ACCEPTABLE | low | No blocking issue found for current policy. |
| кофе | BROAD_QUERY_SHOULD_SHOW_CHOICES | medium | Can mean black drink, dry coffee, or milk/sugar variants. |
| вода | ACCEPTABLE | low | No blocking issue found for current policy. |
| масло | BROAD_QUERY_SHOULD_SHOW_CHOICES | medium | Can mean butter or vegetable oils. |
| масло | SPECIFIC_RESULT_TOO_HIGH | medium | Contains/text-search result "Блины с маслом" ranks above stronger prefix/exact candidates. |
| сахар | MISSING_GENERIC_CANONICAL | high | No exact generic canonical row matched the normalized query. |
| соль | MISSING_GENERIC_CANONICAL | high | No exact generic canonical row matched the normalized query. |
| морковь | ACCEPTABLE | low | No blocking issue found for current policy. |
| лук | BROAD_QUERY_SHOULD_SHOW_CHOICES | medium | Can mean onion variants or green onion. |
| лук | SPECIFIC_RESULT_TOO_HIGH | medium | Contains/text-search result "Колбаса полукопченая Закусочная" ranks above stronger prefix/exact candidates. |
| помидор | ACCEPTABLE | low | No blocking issue found for current policy. |
| огурец | ACCEPTABLE | low | No blocking issue found for current policy. |
| капуста | BROAD_QUERY_SHOULD_SHOW_CHOICES | medium | Different cabbage types and states vary. |
| капуста | SPECIFIC_RESULT_TOO_HIGH | medium | Contains/text-search result "Борщ из свежей капусты с мясом" ranks above stronger prefix/exact candidates. |
| апельсин | ACCEPTABLE | low | No blocking issue found for current policy. |
| груша | ACCEPTABLE | low | No blocking issue found for current policy. |
| виноград | ACCEPTABLE | low | No blocking issue found for current policy. |
| творожок | BROAD_QUERY_SHOULD_SHOW_CHOICES | medium | Often branded/sweetened; should not silently map to plain cottage cheese. |
| творожок | DATA_QUALITY_ISSUE | medium | No candidates returned for a common broad query; likely missing alias or canonical coverage. |
| сметана | BROAD_QUERY_SHOULD_SHOW_CHOICES | medium | Fat percentage changes nutrition materially. |
| сливки | BROAD_QUERY_SHOULD_SHOW_CHOICES | medium | Fat percentage changes nutrition materially. |
| сливки | SPECIFIC_RESULT_TOO_HIGH | medium | Contains/text-search result "Вафли венские со взбитыми сливками" ranks above stronger prefix/exact candidates. |
| индейка | BROAD_QUERY_SHOULD_SHOW_CHOICES | medium | Part and cooking state matter. |
| индейка | SPECIFIC_RESULT_TOO_HIGH | medium | Contains/text-search result "Ветчина из индейки обезжиренная" ranks above stronger prefix/exact candidates. |
| лосось | BROAD_QUERY_SHOULD_SHOW_CHOICES | medium | Raw/salted/cooked state matters. |
| тунец | BROAD_QUERY_SHOULD_SHOW_CHOICES | medium | Fresh vs canned varies. |
| суп | BROAD_QUERY_SHOULD_SHOW_CHOICES | medium | Prepared food category too broad. |
| суп | SPECIFIC_RESULT_TOO_HIGH | medium | Contains/text-search result "Приправа для супа" ranks above stronger prefix/exact candidates. |
| борщ | BROAD_QUERY_SHOULD_SHOW_CHOICES | medium | Recipe variants vary; show candidates. |
| каша | BROAD_QUERY_SHOULD_SHOW_CHOICES | medium | Grain type and milk/water differ. |
| каша | SPECIFIC_RESULT_TOO_HIGH | medium | Contains/text-search result "Гречневая каша вязкая на воде" ranks without a safer prefix/exact choice list. |
| салат | BROAD_QUERY_SHOULD_SHOW_CHOICES | medium | Prepared food category too broad. |
| салат | SPECIFIC_RESULT_TOO_HIGH | medium | Contains/text-search result "Кресс-салат" ranks above stronger prefix/exact candidates. |
| шоколад | BROAD_QUERY_SHOULD_SHOW_CHOICES | medium | Type and sugar/filling vary. |
| печенье | BROAD_QUERY_SHOULD_SHOW_CHOICES | medium | Brand/recipe variants vary. |
| булочка | BROAD_QUERY_SHOULD_SHOW_CHOICES | medium | Bakery variants vary. |
| творожная запеканка | BROAD_QUERY_SHOULD_SHOW_CHOICES | medium | Recipe variants vary. |
| греческий йогурт | MISSING_GENERIC_CANONICAL | high | No exact generic canonical row matched the normalized query. |
| чай зеленый | BROAD_QUERY_SHOULD_SHOW_CHOICES | medium | Drink vs dry leaves still matters. |
| хлеб ржаной | MISSING_GENERIC_CANONICAL | high | No exact generic canonical row matched the normalized query. |
| картофель вареный | MISSING_GENERIC_CANONICAL | high | No exact generic canonical row matched the normalized query. |

## Proposed Ranking Contract v1

1. exact canonical normalized_name
2. exact alias
3. canonical prefix
4. alias prefix
5. canonical contains
6. alias contains
7. within equal match level: prefer safe generic/base product only when nutrition semantics are trustworthy
8. prefer core/verified rows over lower-trust sources
9. prefer requested cooking_state when query implies one
10. deterministic tie-breaker: specificity score, popularity, stable_food_id lexical order

Do not force a generic winner for broad/unsafe nutrition categories such as cheese, fish, broad bread, broad tea, and broad meat queries. Those should be manual-selection lists.

## Proposed Data Corrections

### A. New canonical products

- йогурт: consider a canonical only if a trustworthy nutrition profile exists. Risk: false average nutrition if category is broad.
- кефир: consider a canonical only if a trustworthy nutrition profile exists. Risk: false average nutrition if category is broad.
- творог: consider a canonical only if a trustworthy nutrition profile exists. Risk: false average nutrition if category is broad.
- яйцо: consider a canonical only if a trustworthy nutrition profile exists. Risk: false average nutrition if category is broad.
- сахар: consider a canonical only if a trustworthy nutrition profile exists. Risk: false average nutrition if category is broad.
- соль: consider a canonical only if a trustworthy nutrition profile exists. Risk: false average nutrition if category is broad.
- греческий йогурт: consider a canonical only if a trustworthy nutrition profile exists. Risk: false average nutrition if category is broad.
- хлеб ржаной: consider a canonical only if a trustworthy nutrition profile exists. Risk: false average nutrition if category is broad.
- картофель вареный: consider a canonical only if a trustworthy nutrition profile exists. Risk: false average nutrition if category is broad.

### B. Alias corrections

- Reject broad alias: овсянка -> one canonical. Rationale: can mean oat flakes, oat groats, or cooked oatmeal.
- Disambiguation policy: овсянка -> овсяные хлопья; овсяная крупа; каша овсяная; овсяная каша.
- Accepted unambiguous alias proposal: овсяные хлопья -> oat_flakes. Rationale: raw/dried flakes.
- Accepted unambiguous alias proposal: овсяная крупа -> oat_groats. Rationale: raw/dried groats.
- Accepted unambiguous alias proposal: овсяная каша на воде -> oatmeal_porridge_with_water. Rationale: prepared boiled porridge.
- Reject broad alias: чай -> one canonical. Rationale: can mean prepared unsweetened drink, dry leaves, or sweetened/additive tea.
- Disambiguation policy: чай -> чай черный; чай чёрный; чай зеленый; чай зелёный; чай без сахара; чай сухой; чай с сахаром.
- Accepted unambiguous alias proposal: чай зелёный -> green_tea. Rationale: prepared green tea row exists.
- Accepted unambiguous alias proposal: чай зелёный сухой -> dry_green_tea. Rationale: dry leaves row exists.
- Accepted unambiguous alias proposal: чай чёрный без сахара -> unsweetened_black_tea. Rationale: prepared unsweetened black tea row exists.
- Accepted unambiguous alias proposal: чай чёрный байховый сухой -> dry_black_baikhovi_tea. Rationale: dry black tea leaves row exists.
- Reject broad alias: чай с сахаром -> one canonical. Rationale: sugar/lemon/milk variants differ; use exact sweetened variants only.

### C. Ranking changes

- Preserve match source through service results and sort by deterministic match-level before popularity.
- Add specificity/cooking-state tie-breakers after match-level.
- Keep broad manual-selection queries as candidate lists rather than one automatic generic result.

### D. Manual-selection queries

- овсянка
- сыр
- хлеб
- чай
- рыба
- курица
- говядина
- свинина
- рис
- гречка
- макароны
- картофель
- кофе
- масло
- лук
- капуста
- творожок
- сметана
- сливки
- индейка
- лосось
- тунец
- суп
- борщ
- каша
- салат
- шоколад
- печенье
- булочка
- творожная запеканка
- чай зеленый

## Regression Test Matrix

| query |group |generic policy |notes |
| --- | --- | --- | --- |
| йогурт | known_warning | required | A plain yogurt result is useful for ordinary user search. |
| овсянка | known_warning | manual_selection | Conversational query can mean flakes, groats, or cooked porridge. |
| сыр | known_warning | manual_selection | Cheese nutrition varies too much for one safe universal profile. |
| хлеб | known_warning | manual_selection | Bread type materially changes nutrition; show choices. |
| чай | known_warning | manual_selection | Can mean prepared unsweetened drink or dry tea leaves. |
| рыба | known_warning | manual_selection | Fish species and cooking states vary too much for one profile. |
| молоко | dairy | required | Plain milk is a valid generic/base item. |
| кефир | dairy | required | Plain kefir is a valid generic/base item. |
| творог | dairy | required | Plain cottage cheese/curd is a useful base item, fat variants may also appear. |
| яйцо | prepared | required | User expects egg candidates; exact generic or clear forms should rank high. |
| курица | meat | manual_selection | Chicken parts and cooking states vary; manual selection is safer. |
| говядина | meat | manual_selection | Cuts vary; broad query should show choices. |
| свинина | meat | manual_selection | Cuts vary; broad query should show choices. |
| рис | grains | manual_selection | Raw vs cooked rice must stay separated. |
| гречка | grains | manual_selection | Can mean groats or cooked buckwheat porridge. |
| макароны | grains | manual_selection | Raw vs cooked pasta must stay separated. |
| картофель | vegetables | manual_selection | Raw, boiled, fried, and baked states differ. |
| яблоко | fruits | required | Plain apple is a safe generic fruit. |
| банан | fruits | required | Plain banana is a safe generic fruit. |
| кофе | beverages | manual_selection | Can mean black drink, dry coffee, or milk/sugar variants. |
| вода | beverages | required | Plain water is a valid generic zero-macro item. |
| масло | prepared | manual_selection | Can mean butter or vegetable oils. |
| сахар | prepared | required | Plain sugar is a valid generic pantry item. |
| соль | prepared | required | Plain salt is a valid generic pantry item. |
| морковь | vegetables | required | Plain carrot is a useful generic item. |
| лук | vegetables | manual_selection | Can mean onion variants or green onion. |
| помидор | vegetables | required | Plain tomato is a useful generic item. |
| огурец | vegetables | required | Plain cucumber is a useful generic item. |
| капуста | vegetables | manual_selection | Different cabbage types and states vary. |
| апельсин | fruits | required | Plain orange is a safe generic fruit. |
| груша | fruits | required | Plain pear is a safe generic fruit. |
| виноград | fruits | required | Plain grapes are a safe generic fruit. |
| творожок | dairy | manual_selection | Often branded/sweetened; should not silently map to plain cottage cheese. |
| сметана | dairy | manual_selection | Fat percentage changes nutrition materially. |
| сливки | dairy | manual_selection | Fat percentage changes nutrition materially. |
| индейка | meat | manual_selection | Part and cooking state matter. |
| лосось | fish | manual_selection | Raw/salted/cooked state matters. |
| тунец | fish | manual_selection | Fresh vs canned varies. |
| суп | prepared | manual_selection | Prepared food category too broad. |
| борщ | prepared | manual_selection | Recipe variants vary; show candidates. |
| каша | prepared | manual_selection | Grain type and milk/water differ. |
| салат | prepared | manual_selection | Prepared food category too broad. |
| шоколад | prepared | manual_selection | Type and sugar/filling vary. |
| печенье | bread_bakery | manual_selection | Brand/recipe variants vary. |
| булочка | bread_bakery | manual_selection | Bakery variants vary. |
| творожная запеканка | prepared | manual_selection | Recipe variants vary. |
| греческий йогурт | dairy | required | Specific common dairy subtype should resolve if present. |
| чай зеленый | beverages | manual_selection | Drink vs dry leaves still matters. |
| хлеб ржаной | bread_bakery | required | Specific bread subtype is safe enough if present. |
| картофель вареный | vegetables | required | Cooking state explicitly requested. |

## Data Corrections Patch Plan

- Timestamp: 2026-07-11T00:00:00Z
- Mode: read-only candidate audit and offline patch proposal
- Staging foods observed: 2199
- Staging food_aliases observed: 3311
- Food Core apply: not run
- SQL: not executed
- DB writes: no
- Excel changed: no
- Ranking changed in this data-corrections step: no

### Candidate Classification

| query | classification | current state | proposed action | stable_food_id | nutrition source | risk |
| --- | --- | --- | --- | --- | --- | --- |
| йогурт | REJECT | No plain yogurt canonical exists; only yogurt pastry/cake rows were observed. | Do not add until an owner-approved natural/plain yogurt nutrition source is selected. |  | Required before patch; no trustworthy equivalent current row. | high |
| кефир | REJECT | Fat-specific kefir rows exist: `kefir_0`, `kefir_1`, `kefir_1_5`, `kefir_2`, `kefir_2_5`, `kefir_3_2`. | Keep manual selection among fat-specific rows; do not create false generic. |  | Existing Food Core fat-specific kefir rows. | medium |
| творог | REJECT | Many fat-specific cottage cheese rows exist. | Keep manual selection among fat-specific rows; do not create false generic. |  | Existing Food Core fat-specific cottage-cheese rows. | medium |
| яйцо | ALIAS_ONLY | `egg_chicken` exists, but exact alias `яйцо` is absent. | Add exact conversational alias `яйцо -> egg_chicken`. | egg_chicken | Existing `Яйцо куриное`: 143 kcal, P 12.5, F 9.5, C 0.7, fiber NULL. | low |
| сахар | ALIAS_ONLY | `granulated_sugar` exists as `Сахар-песок`; exact alias `сахар` is absent. | Add exact pantry alias `сахар -> granulated_sugar`. | granulated_sugar | Existing `Сахар-песок`: 399 kcal, P 0, F 0, C 99.8, fiber NULL. | low |
| соль | NEW_CANONICAL | Plain salt canonical is missing; current results include substring noise such as `фасоль` plus flavored salts. | Add plain table salt canonical and common aliases. | salt | Table salt pantry identity: no modeled calories/macros/fiber; sodium is not represented in current schema. | low |
| греческий йогурт | REJECT | No Greek yogurt canonical or alias exists. | Do not add until a fat/sugar-specific Greek yogurt nutrition source is approved. |  | Required before patch; no trustworthy equivalent current row. | high |
| хлеб ржаной | ALIAS_ONLY | Rye bread variants exist; closest base row is `pan_baked_rye_bread`. | Add exact alias only if owner accepts `Хлеб Ржаной формовой` as base rye bread. | pan_baked_rye_bread | Existing `Хлеб Ржаной формовой`: 217 kcal, P 5.9, F 1.1, C 44.5, fiber NULL. | medium |
| картофель варёный | EXISTING_CANONICAL | `boiled_potato` exists and both `картофель варёный` / `картофель вареный` aliases are already present. | No data correction needed; retain regression expectation. | boiled_potato | Existing `Картофель варёный`: 82 kcal, P 2, F 0.4, C 16.7, fiber NULL. | low |

### Proposed New Canonical

| field | value |
| --- | --- |
| name | Соль поваренная |
| stable_food_id | salt |
| normalized_name | соль поваренная |
| aliases | соль; поваренная соль; соль поваренная; столовая соль; соль столовая |
| category | seasonings |
| cooking_state | unknown |
| product_scope | generic |
| calories / protein / fat / carbs | 0 / 0 / 0 / 0 |
| fiber | 0 |
| nutrition source | Table salt pantry identity; current schema has no sodium column. |
| confidence | high |

### Proposed Alias Corrections

| source phrase | target stable_food_id | rationale |
| --- | --- | --- |
| яйцо | egg_chicken | Ordinary singular `яйцо` most commonly means chicken egg; other species remain exact-searchable. |
| сахар | granulated_sugar | Ordinary pantry `сахар` maps to granulated white sugar. |
| хлеб ржаной | pan_baked_rye_bread | Specific subtype query needs a stable top result; accepted only if `Хлеб Ржаной формовой` is approved as base rye bread. |
| ржаной хлеб | pan_baked_rye_bread | Word-order synonym for the same accepted base rye-bread row. |

### Rejected Or Deferred Corrections

| query | reason |
| --- | --- |
| йогурт | Missing trustworthy natural/plain yogurt nutrition source; pastry/cake rows must not be reused. |
| греческий йогурт | Missing trustworthy fat/sugar-specific Greek yogurt nutrition source. |
| кефир | Fat percentage materially changes nutrition; current fat-specific rows are safer as manual selection. |
| творог | Fat percentage materially changes nutrition; current fat-specific rows are safer as manual selection. |

### Dry-Run Patch Diff

```text
NEW_CANONICAL foods:
+ stable_food_id=salt
+ name=Соль поваренная
+ normalized_name=соль поваренная
+ category=seasonings
+ cooking_state=unknown
+ product_scope=generic
+ calories=0 protein=0 fat=0 carbs=0 fiber=0

NEW_ALIASES:
+ соль -> salt
+ поваренная соль -> salt
+ соль поваренная -> salt
+ столовая соль -> salt
+ соль столовая -> salt
+ яйцо -> egg_chicken
+ сахар -> granulated_sugar
+ хлеб ржаной -> pan_baked_rye_bread
+ ржаной хлеб -> pan_baked_rye_bread

NO CHANGE:
= картофель варёный / картофель вареный -> boiled_potato already exists

DEFERRED:
- йогурт
- греческий йогурт
- кефир generic
- творог generic
```

### Data-Corrections Regression Expectations

- Broad unsafe dairy terms (`йогурт`, `греческий йогурт`, `кефир`, `творог`) must not be auto-resolved without approved nutrition semantics.
- `яйцо` should resolve to `egg_chicken` after alias apply.
- `сахар` should resolve to `granulated_sugar` after alias apply.
- `соль` should resolve to new canonical `salt`, not substring matches such as `фасоль`.
- `хлеб ржаной` should resolve to `pan_baked_rye_bread` only if that target is accepted as base rye bread.
- `картофель варёный` remains `boiled_potato`; no data patch required.

### Staging Data Corrections Apply

- Timestamp: 2026-07-11T00:00:00Z
- Target: staging project `ozidryfvhkcbtpnulakq`
- Production used: no
- Source changed: `data/food-core/Food_Core_v02_with_aliases.xlsx`
- Runtime ranking changed in this apply step: no
- SQL executed: no
- Diary writes: no

Applied Food Core source changes:

| change | result |
| --- | --- |
| New canonical `salt` | added to Food Core source and inserted into staging |
| Alias `соль -> salt` | inserted |
| Alias `поваренная соль -> salt` | inserted |
| Alias `соль поваренная -> salt` | inserted |
| Alias `столовая соль -> salt` | inserted |
| Alias `соль столовая -> salt` | inserted |
| Alias `яйцо -> egg_chicken` | inserted |
| Alias `сахар -> granulated_sugar` | inserted |
| Alias `хлеб ржаной -> pan_baked_rye_bread` | inserted |
| Alias `ржаной хлеб -> pan_baked_rye_bread` | inserted |
| `boiled_potato` | unchanged; existing canonical and aliases retained |
| `йогурт`, `греческий йогурт`, `кефир`, `творог` | unchanged; rejected/deferred as planned |

Pre-apply importer dry-run:

| metric | result |
| --- | ---: |
| Excel foods | 2200 |
| Excel raw alias rows | 3417 |
| Excel DB-comparable unique aliases | 3320 |
| DB foods before apply | 2199 |
| DB aliases before apply | 3311 |
| Food insert candidates | 1 |
| Alias insert candidates | 9 |
| Stable food id conflicts | 0 |
| Alias conflicts | 0 |
| Alias resolution errors | 0 |
| Verdict | `DRY_RUN_PASS` |

Apply result:

| metric | result |
| --- | ---: |
| Food batches attempted | 1 |
| Foods inserted | 1 |
| Food insert failures | 0 |
| Alias phase started | yes |
| Alias batches attempted | 1 |
| Aliases inserted | 9 |
| Alias insert failures | 0 |
| Verdict | `STAGING_APPLY_WITH_WARNINGS` |

Warnings were the existing optional-column warnings for `foods.is_verified`, `foods.needs_review`, and `foods.is_searchable`; no data conflicts or insert failures were reported.

Alias count contract:

| metric | count |
| --- | ---: |
| Raw Excel alias rows | 3417 |
| Exact unique `normalized_alias` values in Excel | 3417 |
| DB-normalized deduped equivalent aliases | 97 |
| DB-comparable unique aliases represented by Excel | 3320 |
| Staging aliases after apply | 3320 |

The `3417` vs `3320` difference is expected: importer DB-normalization collapses 97 punctuation/decimal spelling equivalents before insertion. The staging table stores the DB-comparable unique alias set, not every raw Excel alias row.

Post-apply idempotency dry-run:

| metric | result |
| --- | ---: |
| DB foods after apply | 2200 |
| DB aliases after apply | 3320 |
| Food insert candidates | 0 |
| Alias insert candidates | 0 |
| Stable food id conflicts | 0 |
| Alias conflicts | 0 |
| Alias resolution errors | 0 |
| Verdict | `DRY_RUN_PASS` |

Post-apply search smoke:

| query | top result | stable_food_id | match |
| --- | --- | --- | --- |
| соль | Соль поваренная | salt | alias exact |
| яйцо | Яйцо куриное | egg_chicken | alias exact |
| сахар | Сахар-песок | granulated_sugar | alias exact |
| хлеб ржаной | Хлеб Ржаной формовой | pan_baked_rye_bread | alias exact |
| ржаной хлеб | Хлеб Ржаной формовой | pan_baked_rye_bread | alias exact |
| картофель варёный | Картофель варёный | boiled_potato | canonical exact |

Post-apply integrity:

| check | result |
| --- | ---: |
| Orphan aliases | 0 |
| Exact duplicate `normalized_alias` | 0 |
| Alias to multiple canonical products conflicts | 0 |
| Duplicate stable_food_id | 0 |
| food_diary_entries count | 0 |

Deferred nutrient-schema gap:

- `salt` is safe in current macro schema as `0/0/0/0` with `fiber = 0`.
- Sodium is nutritionally relevant for salt but is not represented in the current Food Core nutrient schema.
- Add sodium/micronutrient support as a separate schema and product task; do not encode sodium into current macro fields.

## Recommended Implementation Phases

1. Add ranking metadata and deterministic scorer without changing Food Core data.
2. Add alias-only corrections for clear user-language redirects.
3. Add canonical products only where nutrition profile is trustworthy.
4. Re-run staging browser search smoke and diary smoke only if runtime selection contract changes.

## Final Verdict

**SEARCH_QUALITY_MIXED_GAPS**

## Safety

- initial read-only audit observed foods count: 2199
- initial read-only audit observed food_aliases count: 3311
- post-correction staging foods count: 2200
- post-correction staging food_aliases count: 3320
- Food Core apply was later run once for the approved staging-only data corrections: +1 canonical and +9 aliases.
- SQL was not executed.
- Staging DB was changed only by the approved importer apply described above.
- Production was not used.
- Excel was changed only in `data/food-core/Food_Core_v02_with_aliases.xlsx` for approved data corrections.
- Diary, recipes, and favorites were not changed.
