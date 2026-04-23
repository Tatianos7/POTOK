export type ExerciseContent = {
  exercise_id: string;
  exercise_name: string;
  aliases?: string[];
  category: string;
  technique_image_url: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  start_position?: string;
  execution?: string;
  top_position?: string;
  return_phase?: string;
  mistakes?: string[];
  breathing?: string;
  safety?: string;
};

export const exerciseContentMap: Record<string, ExerciseContent> = {
  "standing_barbell_press": {
    "exercise_id": "standing_barbell_press",
    "exercise_name": "Жим штанги стоя (армейский жим)",
    "category": "shoulders",
    "technique_image_url": "/exercises/shoulders/standing_barbell_press.png",
    "primary_muscles": [
      "front_delts",
      "side_delts",
      "triceps",
      "upper_chest"
    ],
    "secondary_muscles": [
      "trapezoid",
      "core_muscles"
    ],
    "start_position": "Встаньте прямо, ноги на ширине плеч. Возьмите штангу хватом чуть шире плеч. Старайтесь держать локти как можно ближе друг к другу на протяжении всего упражнения, это поможет избежать отклонения корпуса назад и лишней нагрузки на поясницу.",
    "execution": "На выдохе поднимайте штангу максимально близко к лицу, голову назад не отклоняйте, иначе будет лишняя нагрузка на поясницу. Как только штанга пройдет ваше лицо, уводите ее чуть назад, чтобы в конечной точке она оказалась над плечами, а голова немного спереди.",
    "top_position": "Задержитесь немного в верхней точке",
    "return_phase": "На вдохе медленно опускайте штангу обратно.",
    "mistakes": [
      "Голова отклонена назад",
      "Слишком широкий хват",
      "Смотреть вверх и  запрокидывать голову назад в верхней точке",
      "Локти направлены в сторон"
    ],
    "breathing": "Жим выполняется на выдохе, опускание — на вдохе",
    "safety": "При проблемах со спиной используйте пояс"
  },
  "seated_barbell_press": {
    "exercise_id": "seated_barbell_press",
    "exercise_name": "Жим штанги сидя",
    "category": "shoulders",
    "technique_image_url": "/exercises/shoulders/seated_barbell_press.png",
    "primary_muscles": [
      "front_delts",
      "side_delts",
      "triceps"
    ],
    "secondary_muscles": [
      "trapezoid",
      "upper_chest"
    ],
    "start_position": "Сядьте на скамью с вертикальной спинкой, плотно прижмитесь спиной и возьмите штангу хватом чуть шире плеч.\nПоясница не должна перенапрягаться, спина должна быть плотно прижата к скамье или иметь естественный прогиб без округления.",
    "execution": "На выдохе мощно выжмите штангу вверх, не выпрямляя локти до конца.",
    "top_position": "Задержитесь немного в верхней точке",
    "return_phase": "На вдохе медленно опустите гриф к верхней части груди",
    "mistakes": [
      "кругление спины",
      "отрыв таза от скамьи",
      "слишком широкий хват",
      "резкие движения (рывки)"
    ],
    "breathing": "Вдох при опускании штанги, выдох при выжимании штанги вверх (на усилии)",
    "safety": "Запрещено задерживать дыхание на весь подход, чтобы избежать скачков давления"
  },
  "standing_dumbbell_press": {
    "exercise_id": "standing_dumbbell_press",
    "exercise_name": "Жим гантелей стоя",
    "category": "shoulders",
    "technique_image_url": "/exercises/shoulders/standing_dumbbell_press.png",
    "primary_muscles": [
      "front_delts",
      "side_delts",
      "triceps"
    ],
    "secondary_muscles": [
      "trapezoid",
      "core_muscles"
    ],
    "start_position": "Встаньте прямо, ноги на ширине плеч. Возьмите гантели и поднимите их к плечам. Локти смотрят вниз или слегка вперед.",
    "execution": "На выдохе мощным, но контролируемым движением выжмите гантели вверх до почти полного выпрямления рук.",
    "top_position": "Вверху гантели можно слегка свести над головой, но не ударять ими.",
    "return_phase": "На вдохе медленно верните гантели в исходное положение к плечам.",
    "mistakes": [
      "Чрезмерный прогиб в пояснице",
      "Использование инерции (читтинг)",
      "Разведение локтей в стороны"
    ],
    "breathing": "Жим выполняется на выдохе, опускание — на вдохе",
    "safety": "Держите пресс напряженным на протяжении всего подхода для защиты поясницы.\nПри проблемах со спиной используйте пояс"
  },
  "seated_dumbbell_press": {
    "exercise_id": "seated_dumbbell_press",
    "exercise_name": "Жим гантелей сидя",
    "category": "shoulders",
    "technique_image_url": "/exercises/shoulders/seated_dumbbell_press.png",
    "primary_muscles": [
      "front_delts",
      "side_delts",
      "triceps",
      "upper_chest"
    ],
    "secondary_muscles": [
      "trapezoid",
      "core_muscles"
    ],
    "start_position": "Поставьте скамью под 75-80 градусом, в не строго вертикально. легкий наклон назад снимет всю нагрузку с поясницы",
    "execution": "На выдохе поднимите гантели над собой.",
    "top_position": "Задержитесь немного в верхней точке",
    "return_phase": "На вдохе медленно опускаете гантели вниз, разводя локти в стороны, но с небольшим углом вперед. Следите, что кисти всегда находились в одной линии с логтями, образуя треугольную траекторию движения гантелей.",
    "mistakes": [
      "Работа с чрезмерным весом",
      "излишний прогиб в пояснице",
      "«втыкание» локтей в верхней точке и сведение гантелей, что снимает нагрузку с дельт"
    ],
    "breathing": "Жим выполняется на выдохе, опускание — на вдохе",
    "safety": "Важно держать спину ровно, не отрывать ее от скамьи, контролировать опускание и держать локти чуть впереди плеч."
  },
  "dumbbell_military_press": {
    "exercise_id": "dumbbell_military_press",
    "exercise_name": "Армейский жим с гантелями",
    "category": "shoulders",
    "technique_image_url": "/exercises/shoulders/dumbbell_military_press.png",
    "primary_muscles": [
      "front_delts",
      "side_delts"
    ],
    "secondary_muscles": [
      "triceps",
      "upper_chest"
    ],
    "start_position": "Сядьте или встаньте прямо, удерживая гантели на уровне плеч. Локти направлены вниз и немного вперёд.",
    "execution": "На выдохе выжмите гантели вверх до полного выпрямления рук.",
    "top_position": "Задержитесь немного в верхней точке",
    "return_phase": "На вдохе медленно опустите гантели обратно к плечам, контролируя движение.",
    "mistakes": [
      "Прогиб в пояснице",
      "Резкое опускание гантелей",
      "Сведение гантелей в верхней точке",
      "Слишком широкий развод локтей"
    ],
    "breathing": "Жим выполняется на выдохе, опускание — на вдохе",
    "safety": "Держите корпус напряжённым, избегайте переразгибания в пояснице. Не используйте чрезмерный вес"
  },
  "front_dumbbell_raises": {
    "exercise_id": "front_dumbbell_raises",
    "exercise_name": "Махи гантелей перед собой",
    "category": "shoulders",
    "technique_image_url": "/exercises/shoulders/front_dumbbell_raises.png",
    "primary_muscles": [
      "front_delts",
      "side_delts"
    ],
    "secondary_muscles": [
      "upper_chest",
      "abs"
    ],
    "start_position": "Встаньте прямо, гантели перед бедрами.",
    "execution": "На выдохе поднимайте гантели перед собой до уровня плеч или чуть выше, слегка согнув руки в локтях.",
    "top_position": "Задержитесь немного в верхней точке",
    "return_phase": "На вдохе опускайте медленно, контролируя движение.",
    "mistakes": [
      "Рывки корпусом",
      "Подъём слишком высоко",
      "Раскачка",
      "Прямые заблокированные локти"
    ],
    "breathing": "Жим выполняется на выдохе, опускание — на вдохе",
    "safety": "Используйте лёгкий или средний вес. Контролируйте движение, не раскачивайтесь."
  },
  "seated_machine_press": {
    "exercise_id": "seated_machine_press",
    "exercise_name": "Жим в тренажёре сидя (плечевой жим)",
    "category": "shoulders",
    "technique_image_url": "/exercises/shoulders/seated_machine_press.png",
    "primary_muscles": [
      "front_delts",
      "side_delts"
    ],
    "secondary_muscles": [
      "triceps"
    ],
    "start_position": "Сядьте в тренажёр, спина прижата к спинке. Возьмитесь за рукояти на уровне плеч.",
    "execution": "На выдохе выжмите рукояти вверх.",
    "top_position": "Задержитесь немного в верхней точке",
    "return_phase": "На вдохе плавно опустите обратно.",
    "mistakes": [
      "Отрыв спины от спинки",
      "Резкие движения",
      "Слишком большой вес"
    ],
    "breathing": "Жим выполняется на выдохе, опускание — на вдохе",
    "safety": "Следите за положением спины. Работайте в контролируемом диапазоне."
  },
  "military_press_with_a_kettlebell": {
    "exercise_id": "military_press_with_a_kettlebell",
    "exercise_name": "Армейский жим с гирей или гантелью (одной рукой)",
    "category": "shoulders",
    "technique_image_url": "/exercises/shoulders/military_press_with_a_kettlebell.png",
    "primary_muscles": [
      "front_delts",
      "side_delts"
    ],
    "secondary_muscles": [
      "upper_chest",
      "abs"
    ],
    "start_position": "Поднимите гирю/гантель на плечо. держите прямым хватом, пальцы смотрят вперед, локоть согнут и чуть выведен вперед.",
    "execution": "На выдохе, за счет усилия передней и средней дельты, мощно выжмите снаряд вверх",
    "top_position": "В верхней точке рука полностью выпрямляется, гиря/гантель фиксируется над плечом",
    "return_phase": "На вдохе подконтрольно опустите вес обратно к плечу.Не «бросайте» вес вниз, чтобы избежать травм плечевого сустава",
    "mistakes": [
      "Наклон в сторону",
      "Потеря контроля",
      "Рывковое движение"
    ],
    "breathing": "Жим выполняется на выдохе, опускание — на вдохе",
    "safety": "Напрягите пресс и ягодицы, чтобы создать жесткую опору для позвоночника.\nДвижение должно быть прямым, без сильного отклонения корпуса."
  },
  "push_press_with_a_barbell": {
    "exercise_id": "push_press_with_a_barbell",
    "exercise_name": "Подъёмы на грудь (Push Press) со штангой или гантелями",
    "category": "shoulders",
    "technique_image_url": "/exercises/shoulders/push_press_with_a_barbell.png",
    "primary_muscles": [
      "front_delts",
      "triceps"
    ],
    "secondary_muscles": [
      "upper_chest",
      "quads",
      "glutes",
      "triceps"
    ],
    "start_position": "Стойка ноги на ширине плеч, штанга лежит на верхней части груди/передних дельтах. Локти выведены вперед, ладони удерживают гриф. Спина прямая, взгляд направлен вперед.",
    "execution": "Сделайте небольшой подсед и мощно выжмите вес вверх, помогая ногами",
    "top_position": "В верхней точке зафиксируйте вес, руки прямые",
    "return_phase": "Контролируемо опустите штангу на грудь",
    "mistakes": [
      "Использование только силы рук без участия ног",
      "Округление спины во время заседа",
      "Отклонение корпуса слишком далеко назад"
    ],
    "breathing": "Жим выполняется на выдохе, опускание — на вдохе",
    "safety": "Контролируйте движение. Не перегружайте поясницу."
  },
  "dumbbell_overhead_press": {
    "exercise_id": "dumbbell_overhead_press",
    "exercise_name": "Жим гантелей за голову",
    "category": "shoulders",
    "technique_image_url": "/exercises/shoulders/dumbbell_overhead_press.png",
    "primary_muscles": [
      "side_delts"
    ],
    "secondary_muscles": [
      "rear_delts",
      "triceps"
    ],
    "start_position": "Сидя, держите гантели на уровне ушей, локти направлены в стороны.",
    "execution": "Выжимайте вверх и слегка вперёд.",
    "top_position": "В верхней точке зафиксируйте вес, руки прямые",
    "return_phase": "На вдохе опускайте обратно.",
    "mistakes": [
      "Чрезмерное разведение локтей",
      "Слишком большой вес",
      "Рывки"
    ],
    "breathing": "Жим выполняется на выдохе, опускание — на вдохе",
    "safety": "Выполняйте с осторожностью. Не рекомендуется при проблемах с плечами."
  },
  "barbell_overhead_press": {
    "exercise_id": "barbell_overhead_press",
    "exercise_name": "Жим штанги за голову (сидя или стоя)",
    "category": "shoulders",
    "technique_image_url": "/exercises/shoulders/barbell_overhead_press.png",
    "primary_muscles": [
      "side_delts",
      "front_delts",
      "trapezoid"
    ],
    "secondary_muscles": [
      "abs",
      "triceps"
    ],
    "start_position": "Штанга за головой на уровне трапеций.",
    "execution": "Выжимайте вверх до выпрямления рук.",
    "top_position": "В верхней точке зафиксируйте вес, руки прямые",
    "return_phase": "Опускайте контролируемо.",
    "mistakes": [
      "Слишком глубокое опускание",
      "Рывки",
      "Потеря контроля"
    ],
    "breathing": "Жим выполняется на выдохе, опускание — на вдохе",
    "safety": "Травмоопасное упражнение. Выполняйте только при хорошей мобильности плеч."
  },
  "barbell_chin-ups": {
    "exercise_id": "barbell_chin-ups",
    "exercise_name": "Тяга штанги к подбородку",
    "category": "shoulders",
    "technique_image_url": "/exercises/shoulders/barbell_chin-ups.png",
    "primary_muscles": [
      "side_delts"
    ],
    "secondary_muscles": [
      "traps_upper",
      "biceps"
    ],
    "start_position": "Встаньте прямо, штанга перед бедрами, хват узкий или средний.",
    "execution": "Тяните штангу вверх вдоль тела, направляя локти вверх и в стороны.",
    "top_position": "В верхней точке штанга находится на уровне груди или чуть выше, локти выше кистей.",
    "return_phase": "Медленно опустите штангу вниз по той же траектории, сохраняя контроль.",
    "mistakes": [
      "Слишком высокий подъём штанги",
      "Рывки корпусом",
      "Слишком узкий хват",
      "Подъём за счёт инерции"
    ],
    "breathing": "Выдох при подъёме, вдох при опускании.",
    "safety": "Не поднимайте штангу выше комфортной амплитуды плеч. При дискомфорте в плечевых суставах уменьшите амплитуду или замените упражнение."
  },
  "dumbbell_lateral_raises": {
    "exercise_id": "dumbbell_lateral_raises",
    "exercise_name": "Разведение гантелей в стороны (стоя или сидя)",
    "category": "shoulders",
    "technique_image_url": "/exercises/shoulders/dumbbell_lateral_raises.png",
    "primary_muscles": [
      "side_delts"
    ],
    "secondary_muscles": [
      "traps_middle"
    ],
    "start_position": "Встаньте или сядьте прямо, гантели опущены вдоль корпуса, локти слегка согнуты.",
    "execution": "Поднимайте руки через стороны до уровня плеч, сохраняя контроль и без раскачки.",
    "top_position": "В верхней точке кисти находятся примерно на уровне плеч, плечи не поднимаются к ушам.",
    "return_phase": "Плавно опустите гантели в исходное положение без рывков.",
    "mistakes": [
      "Раскачка корпусом",
      "Подъём выше уровня плеч",
      "Слишком большой вес",
      "Полностью прямые и зафиксированные локти"
    ],
    "breathing": "Выдох при подъёме, вдох при опускании.",
    "safety": "Используйте умеренный вес и контролируйте траекторию. Не выполняйте движение через боль в плечах."
  },
  "machine_chin-ups": {
    "exercise_id": "machine_chin-ups",
    "exercise_name": "Тяга к подбородку в тренажёре",
    "category": "shoulders",
    "technique_image_url": "/exercises/shoulders/machine_chin-ups.png",
    "primary_muscles": [
      "side_delts"
    ],
    "secondary_muscles": [
      "traps_upper"
    ],
    "start_position": "Встаньте в тренажёре и возьмитесь за рукоять или рукояти, корпус ровный, плечи опущены.",
    "execution": "Тяните рукоять вверх вдоль корпуса до комфортной высоты, направляя локти вверх.",
    "top_position": "В верхней точке рукоять находится на уровне груди, локти выше кистей.",
    "return_phase": "Медленно опустите рукоять обратно, сохраняя натяжение и контроль.",
    "mistakes": [
      "Рывки",
      "Слишком высокий подъём",
      "Компенсация корпусом",
      "Чрезмерный вес"
    ],
    "breathing": "Выдох при тяге вверх, вдох при возврате.",
    "safety": "Работайте в комфортной амплитуде и не поднимайте плечи к ушам. При дискомфорте в плечах сократите диапазон движения."
  },
  "Isolated_arm_raises_on_a_machine": {
    "exercise_id": "Isolated_arm_raises_on_a_machine",
    "exercise_name": "Изолированный подъём рук в тренажёре (махи в стороны)",
    "category": "shoulders",
    "technique_image_url": "/exercises/shoulders/Isolated_arm_raises_on_a_machine.png",
    "primary_muscles": [
      "side_delts"
    ],
    "secondary_muscles": [
      "traps_middle"
    ],
    "start_position": "Сядьте в тренажёр, локти и предплечья расположите на опорах или возьмитесь за рукояти согласно конструкции тренажёра.",
    "execution": "Поднимайте руки в стороны по заданной траектории тренажёра до уровня плеч.",
    "top_position": "В верхней точке руки находятся на уровне плеч, движение остаётся плавным и контролируемым.",
    "return_phase": "Медленно вернитесь в исходное положение, не бросая вес.",
    "mistakes": [
      "Рывки в начале движения",
      "Слишком большой вес",
      "Подъём плеч к ушам",
      "Неполный контроль в негативной фазе"
    ],
    "breathing": "Выдох при подъёме, вдох при возврате.",
    "safety": "Не гонитесь за весом — в этом упражнении важнее чистая техника и контроль средней дельты."
  },
  "bent-over_dumbbell_flyes": {
    "exercise_id": "bent-over_dumbbell_flyes",
    "exercise_name": "Разведение гантелей в наклоне («обратные махи»)",
    "category": "shoulders",
    "technique_image_url": "/exercises/shoulders/bent-over_dumbbell_flyes.png",
    "primary_muscles": [
      "rear_delts"
    ],
    "secondary_muscles": [
      "traps_middle",
      "erectors"
    ],
    "start_position": "Наклонитесь вперёд с ровной спиной, колени слегка согнуты, гантели опущены вниз под плечами.",
    "execution": "Разводите гантели в стороны, сохраняя небольшой сгиб в локтях и фиксированное положение корпуса.",
    "top_position": "В верхней точке локти находятся примерно на уровне плеч, задние дельты сокращены.",
    "return_phase": "Плавно опустите гантели вниз по той же траектории, не раскачивая корпус.",
    "mistakes": [
      "Скругление спины",
      "Рывки корпусом",
      "Подъём за счёт трапеций вместо задних дельт",
      "Слишком тяжёлые гантели"
    ],
    "breathing": "Выдох при разведении, вдох при возврате.",
    "safety": "Держите спину нейтральной и корпус стабильным. Если тяжело удерживать наклон, уменьшите вес."
  },
  "reverse_butterfly": {
    "exercise_id": "reverse_butterfly",
    "exercise_name": "Обратная бабочка (Reverse Pec Deck)",
    "category": "shoulders",
    "technique_image_url": "/exercises/shoulders/reverse_butterfly.png",
    "primary_muscles": [
      "rear_delts"
    ],
    "secondary_muscles": [
      "traps_middle"
    ],
    "start_position": "Сядьте в тренажёр лицом к спинке, возьмитесь за рукояти на уровне плеч, грудь прижата к опоре.",
    "execution": "Разводите руки назад по дуге, сохраняя стабильный корпус и акцент на задние дельты.",
    "top_position": "В крайней точке руки отведены назад, задние дельты максимально сокращены.",
    "return_phase": "Медленно вернитесь в исходное положение, сохраняя контроль веса.",
    "mistakes": [
      "Рывки",
      "Сведение лопаток вместо изоляции плеч",
      "Слишком большой вес",
      "Слишком короткая амплитуда"
    ],
    "breathing": "Выдох при движении назад, вдох при возврате.",
    "safety": "Двигайтесь без инерции и не перерастягивайте плечевые суставы в стартовой позиции."
  },
  "standing_barbell_biceps_curl": {
    "exercise_id": "standing_barbell_biceps_curl",
    "exercise_name": "Подъём штанги на бицепс (стоя)",
    "category": "arms",
    "technique_image_url": "/exercises/arms/standing_barbell_biceps_curl.png",
    "primary_muscles": [
      "biceps"
    ],
    "secondary_muscles": [
      "forearms"
    ],
    "start_position": "Встаньте прямо, стопы на ширине плеч. Держите штангу в опущенных руках, хват чуть шире таза, локти прижаты к корпусу.",
    "execution": "На выдохе сгибайте руки в локтях и поднимайте штангу вверх по дуге к верхней части живота или груди, не раскачивая корпус.",
    "top_position": "В верхней точке бицепсы максимально сокращены, локти остаются близко к телу, плечи не поднимаются вперёд.",
    "return_phase": "На вдохе медленно опустите штангу вниз до почти полного разгибания рук, сохраняя контроль веса.",
    "mistakes": [
      "Раскачка корпусом\n Отрыв локтей от корпуса\n Слишком быстрый негатив\n Чрезмерный вес с потерей техники"
    ],
    "breathing": "Выдох при подъёме, вдох при опускании.",
    "safety": "Держите запястья в нейтральном положении и не бросайте вес вниз. При дискомфорте в локтях уменьшите вес или сократите амплитуду."
  },
  "ez_bar_biceps_curl": {
    "exercise_id": "ez_bar_biceps_curl",
    "exercise_name": "Подъём EZ-штанги на бицепс (стоя или сидя)",
    "category": "arms",
    "technique_image_url": "/exercises/arms/ez_bar_biceps_curl.png",
    "primary_muscles": [
      "biceps"
    ],
    "secondary_muscles": [
      "forearms"
    ],
    "start_position": "Встаньте или сядьте прямо. Возьмите EZ-штангу удобным хватом, руки опущены вниз, локти прижаты к телу.",
    "execution": "На выдохе согните руки и поднимите EZ-штангу вверх, сохраняя стабильное положение плеч.",
    "top_position": "В верхней точке бицепсы напряжены, локти не уходят вперёд, кисти остаются в комфортном положении.",
    "return_phase": "На вдохе медленно опустите штангу вниз, не разгибая локти резко.",
    "mistakes": [
      "Рывки корпусом\n Вынос локтей вперёд\n Слишком большой вес\n Потеря контроля внизу"
    ],
    "breathing": "Выдох при подъёме, вдох при опускании.",
    "safety": "Используйте комфортный хват EZ-грифа, чтобы снизить нагрузку на запястья. Не работайте через боль в локтях."
  },
  "barbell_concentration_curl": {
    "exercise_id": "barbell_concentration_curl",
    "exercise_name": "Концентрированный подъём со штангой",
    "category": "arms",
    "technique_image_url": "/exercises/arms/barbell_concentration_curl.png",
    "primary_muscles": [
      "biceps"
    ],
    "secondary_muscles": [
      "forearms"
    ],
    "start_position": "Сядьте, слегка наклонитесь вперёд и уприте локоть рабочей руки во внутреннюю поверхность бедра. Держите штангу или короткий гриф в опущенной руке.",
    "execution": "На выдохе согните руку в локте и поднимайте вес вверх, сохраняя плечо неподвижным.",
    "top_position": "В верхней точке бицепс максимально сокращён, локоть остаётся зафиксированным.",
    "return_phase": "На вдохе плавно опустите вес вниз до почти полного разгибания руки.",
    "mistakes": [
      "Смещение локтя с бедра\n Рывок в начале движения\n Слишком тяжёлый вес\n Неполная амплитуда"
    ],
    "breathing": "Выдох при подъёме, вдох при опускании.",
    "safety": "Сохраняйте упор локтя и не скручивайте корпус. Используйте умеренный вес для чистой изоляции."
  },
  "dumbbell_biceps_curl": {
    "exercise_id": "dumbbell_biceps_curl",
    "exercise_name": "Подъём гантелей на бицепс (стоя или сидя)",
    "category": "arms",
    "technique_image_url": "/exercises/arms/dumbbell_biceps_curl.png",
    "primary_muscles": [
      "biceps"
    ],
    "secondary_muscles": [
      "forearms"
    ],
    "start_position": "Встаньте или сядьте прямо, гантели опущены вдоль корпуса, ладони смотрят вперёд или нейтрально в стартовой позиции.",
    "execution": "На выдохе поочерёдно или одновременно сгибайте руки в локтях, поднимая гантели вверх.",
    "top_position": "В верхней точке бицепсы сокращены, локти остаются близко к телу, плечи расслаблены.",
    "return_phase": "На вдохе медленно опустите гантели вниз, не теряя контроля.",
    "mistakes": [
      "Раскачка корпусом\n Подъём локтей вперёд\n Слишком быстрый негатив\n Использование инерции"
    ],
    "breathing": "Выдох при подъёме, вдох при опускании.",
    "safety": "Не перегружайте запястья и не помогайте себе корпусом. Лучше меньший вес и полный контроль движения."
  },
  "supinating_dumbbell_curl": {
    "exercise_id": "supinating_dumbbell_curl",
    "exercise_name": "Подъём гантелей с супинацией («молоток → супинация»)",
    "category": "arms",
    "technique_image_url": "/exercises/arms/supinating_dumbbell_curl.png",
    "primary_muscles": [
      "biceps"
    ],
    "secondary_muscles": [
      "forearms"
    ],
    "start_position": "Встаньте или сядьте, гантели в опущенных руках, ладони в нейтральном положении.",
    "execution": "На выдохе поднимайте гантели вверх, одновременно разворачивая кисти так, чтобы кверху ладони смотрели вперёд.",
    "top_position": "В верхней точке бицепс максимально сокращён, кисть полностью супинирована.",
    "return_phase": "На вдохе медленно опустите гантели вниз, разворачивая кисти обратно в нейтральное положение.",
    "mistakes": [
      "Слишком быстрый разворот кисти\n Рывки\n Подключение корпуса\n Избыточный вес"
    ],
    "breathing": "Выдох при подъёме, вдох при опускании.",
    "safety": "Поворачивайте кисть плавно, без рывка. При неприятных ощущениях в запястье уменьшите вес."
  },
  "hammer_dumbbell_curl": {
    "exercise_id": "hammer_dumbbell_curl",
    "exercise_name": "Молотковый подъём гантелей",
    "category": "arms",
    "technique_image_url": "/exercises/arms/hammer_dumbbell_curl.png",
    "primary_muscles": [
      "biceps"
    ],
    "secondary_muscles": [
      "forearms"
    ],
    "start_position": "Встаньте прямо, гантели опущены вдоль корпуса, ладони смотрят друг на друга.",
    "execution": "На выдохе сгибайте руки в локтях и поднимайте гантели вверх нейтральным хватом.",
    "top_position": "В верхней точке руки согнуты, бицепс и предплечья напряжены, локти прижаты к корпусу.",
    "return_phase": "На вдохе медленно опустите гантели вниз, сохраняя нейтральный хват.",
    "mistakes": [
      "Раскачка корпусом\n Отрыв локтей от корпуса\n Слишком большой вес\n Потеря контроля при опускании"
    ],
    "breathing": "Выдох при подъёме, вдох при опускании.",
    "safety": "Сохраняйте нейтральное положение запястий и не бросайте вес в нижней точке."
  },
  "concentration_dumbbell_curl": {
    "exercise_id": "concentration_dumbbell_curl",
    "exercise_name": "Концентрированный подъём гантели (сидя, локоть на бедре)",
    "category": "arms",
    "technique_image_url": "/exercises/arms/concentration_dumbbell_curl.png",
    "primary_muscles": [
      "biceps"
    ],
    "secondary_muscles": [
      "forearms"
    ],
    "start_position": "Сядьте на край скамьи, уприте локоть рабочей руки во внутреннюю поверхность бедра. Гантель в опущенной руке.",
    "execution": "На выдохе согните руку в локте и поднимите гантель вверх без движения плеча.",
    "top_position": "В верхней точке бицепс напряжён, локоть остаётся плотно зафиксированным.",
    "return_phase": "На вдохе медленно опустите гантель вниз до почти полного разгибания руки.",
    "mistakes": [
      "Отрыв локтя от бедра\n Рывки\n Неполная амплитуда\n Чрезмерный вес"
    ],
    "breathing": "Выдох при подъёме, вдох при опускании.",
    "safety": "Не скручивайте корпус и не помогайте плечом. Держите движение изолированным."
  },
  "incline_dumbbell_curl": {
    "exercise_id": "incline_dumbbell_curl",
    "exercise_name": "Подъём гантелей на наклонной скамье («на скамье Скотта» в обратном положении)",
    "category": "arms",
    "technique_image_url": "/exercises/arms/incline_dumbbell_curl.png",
    "primary_muscles": [
      "biceps"
    ],
    "secondary_muscles": [
      "forearms"
    ],
    "start_position": "Сядьте на наклонную скамью, спина плотно прижата. Гантели опущены вниз, руки слегка отведены назад.",
    "execution": "На выдохе сгибайте руки в локтях и поднимайте гантели вверх по дуге, не двигая плечами.",
    "top_position": "В верхней точке бицепсы напряжены, локти остаются направленными вниз.",
    "return_phase": "На вдохе медленно опустите гантели вниз, полностью контролируя растяжение бицепса.",
    "mistakes": [
      "Подъём локтей вперёд\n Раскачка\n Слишком тяжёлый вес\n Сокращённая амплитуда"
    ],
    "breathing": "Выдох при подъёме, вдох при опускании.",
    "safety": "Не перерастягивайте плечевой сустав внизу и не используйте чрезмерный вес."
  },
  "machine_biceps_curl": {
    "exercise_id": "machine_biceps_curl",
    "exercise_name": "Сгибание рук в тренажёре на бицепс",
    "category": "arms",
    "technique_image_url": "/exercises/arms/machine_biceps_curl.png",
    "primary_muscles": [
      "biceps"
    ],
    "secondary_muscles": [
      "forearms"
    ],
    "start_position": "Сядьте в тренажёр, расположите локти и руки согласно конструкции, корпус плотно зафиксирован.",
    "execution": "На выдохе согните руки и поднимайте рукояти вверх по траектории тренажёра.",
    "top_position": "В верхней точке бицепсы сокращены, движение остаётся плавным.",
    "return_phase": "На вдохе медленно верните рукояти в стартовое положение.",
    "mistakes": [
      "Рывки\n Неправильная посадка в тренажёре\n Слишком большой вес\n Бросание рукоятей вниз"
    ],
    "breathing": "Выдох при сгибании, вдох при возврате.",
    "safety": "Отрегулируйте тренажёр под себя и не выводите локти из опоры."
  },
  "cable_biceps_curl": {
    "exercise_id": "cable_biceps_curl",
    "exercise_name": "Сгибание рук в кроссовере (нижний блок, прямая или EZ-рукоять)",
    "category": "arms",
    "technique_image_url": "/exercises/arms/cable_biceps_curl.png",
    "primary_muscles": [
      "biceps"
    ],
    "secondary_muscles": [
      "forearms"
    ],
    "start_position": "Встаньте у нижнего блока, возьмитесь за прямую или EZ-рукоять, локти прижаты к корпусу.",
    "execution": "На выдохе сгибайте руки в локтях, подтягивая рукоять к верхней части живота или груди.",
    "top_position": "В верхней точке бицепсы напряжены, локти остаются у корпуса.",
    "return_phase": "На вдохе медленно опустите рукоять вниз, сохраняя натяжение троса.",
    "mistakes": [
      "Раскачка корпусом\n Отрыв локтей от тела\n Слишком тяжёлый вес\n Резкий возврат рукояти"
    ],
    "breathing": "Выдох при подъёме, вдох при опускании.",
    "safety": "Следите за стабильностью корпуса и не отпускайте рукоять резко."
  },
  "chin_ups_underhand": {
    "exercise_id": "chin_ups_underhand",
    "exercise_name": "Подтягивания обратным хватом (узкие или средние)",
    "category": "arms",
    "technique_image_url": "/exercises/arms/chin_ups_underhand.png",
    "primary_muscles": [
      "biceps"
    ],
    "secondary_muscles": [
      "lats",
      "forearms"
    ],
    "start_position": "Возьмитесь за перекладину обратным хватом, кисти на ширине чуть уже или примерно на ширине плеч. Повисните с контролем корпуса.",
    "execution": "На выдохе подтягивайтесь вверх, сгибая руки и сводя лопатки, пока подбородок не поднимется над перекладиной.",
    "top_position": "В верхней точке подбородок выше перекладины, корпус стабилен, бицепсы и широчайшие напряжены.",
    "return_phase": "На вдохе медленно опуститесь вниз до контролируемого виса, не бросая тело.",
    "mistakes": [
      "Рывки и раскачка\n Неполная амплитуда\n Потеря контроля внизу\n Сильный прогиб корпусом"
    ],
    "breathing": "Выдох при подтягивании, вдох при опускании.",
    "safety": "Избегайте резкого провисания в нижней точке. Если не хватает силы, используйте облегчённый вариант."
  },
  "chin_up_top_hold": {
    "exercise_id": "chin_up_top_hold",
    "exercise_name": "Изометрические удержания в подтягиваниях (в верхней точке)",
    "category": "arms",
    "technique_image_url": "/exercises/arms/chin_up_top_hold.png",
    "primary_muscles": [
      "biceps"
    ],
    "secondary_muscles": [
      "lats",
      "forearms"
    ],
    "start_position": "Поднимитесь в верхнюю точку подтягивания обратным хватом и зафиксируйтесь над перекладиной.",
    "execution": "Удерживайте верхнюю позицию заданное время, сохраняя напряжение рук, спины и корпуса.",
    "top_position": "Подбородок выше перекладины, лопатки стабилизированы, корпус неподвижен.",
    "return_phase": "По завершении удержания медленно опуститесь в контролируемый вис.",
    "mistakes": [
      "Провисание плеч\n Сильная раскачка\n Потеря высоты удержания\n Сброс вниз без контроля"
    ],
    "breathing": "Дышите ровно, не задерживайте дыхание на всё удержание.",
    "safety": "Не выполняйте через резкую боль в локтях или плечах. Прекратите подход при потере контроля."
  },
  "lying_french_press": {
    "exercise_id": "lying_french_press",
    "exercise_name": "Французский жим лёжа (лежа на скамье, штанга над головой)",
    "category": "arms",
    "technique_image_url": "/exercises/arms/lying_french_press.png",
    "primary_muscles": [
      "triceps"
    ],
    "secondary_muscles": [
      "forearms"
    ],
    "start_position": "Лягте на скамью, удерживайте штангу над грудью прямыми руками. Локти направлены вверх.",
    "execution": "На вдохе сгибайте руки в локтях и опускайте штангу за голову или ко лбу, не разводя локти широко.",
    "top_position": "В нижней точке трицепсы растянуты, плечи остаются стабильными.",
    "return_phase": "На выдохе разогните руки и верните штангу вверх в исходное положение.",
    "mistakes": [
      "Разведение локтей в стороны\n Движение плечами вместо локтей\n Слишком большой вес\n Рывок из нижней точки"
    ],
    "breathing": "Вдох при опускании, выдох при разгибании.",
    "safety": "Следите за положением локтей и используйте страховку при большом весе."
  },
  "overhead_french_press": {
    "exercise_id": "overhead_french_press",
    "exercise_name": "Французский жим стоя или сидя (из-за головы)",
    "category": "arms",
    "technique_image_url": "/exercises/arms/overhead_french_press.png",
    "primary_muscles": [
      "triceps"
    ],
    "secondary_muscles": [
      "abs"
    ],
    "start_position": "Сидя или стоя держите вес над головой, локти направлены вверх, плечи стабилизированы.",
    "execution": "На вдохе согните руки в локтях и опустите вес за голову.",
    "top_position": "В нижней точке трицепсы растянуты, локти остаются максимально направленными вверх.",
    "return_phase": "На выдохе разогните руки и поднимите вес обратно вверх.",
    "mistakes": [
      "Разведение локтей\n Прогиб в пояснице\n Слишком тяжёлый вес\n Рывки"
    ],
    "breathing": "Вдох при опускании, выдох при разгибании.",
    "safety": "Держите корпус напряжённым и не переразгибайте поясницу."
  },
  "close_grip_bench_press": {
    "exercise_id": "close_grip_bench_press",
    "exercise_name": "Жим штанги лёжа узким хватом",
    "category": "chest",
    "technique_image_url": "/exercises/chest/close_grip_bench_press.png",
    "primary_muscles": [
      "triceps"
    ],
    "secondary_muscles": [
      "chest",
      "front_delts"
    ],
    "start_position": "Лягте на горизонтальную скамью, сведите лопатки, стопы уприте в пол. Возьмитесь за штангу хватом уже обычного жима, но без экстремально узкого положения кистей.",
    "execution": "На вдохе опустите штангу к нижней части груди или солнечному сплетению, удерживая локти ближе к корпусу. На выдохе выжмите штангу вверх.",
    "top_position": "В верхней точке руки почти выпрямлены, трицепсы напряжены, плечи стабильны.",
    "return_phase": "Медленно верните штангу вниз, не разводя локти слишком широко и не теряя контроля.",
    "mistakes": [
      "Слишком узкий хват\n Разведение локтей в стороны\n Отрыв таза от скамьи\n Слишком большой вес"
    ],
    "breathing": "Вдох при опускании, выдох при жиме вверх.",
    "safety": "Не берите хват настолько узкий, чтобы перегружать запястья. При возможности используйте страховку."
  },
  "two_hand_dumbbell_overhead_extension": {
    "exercise_id": "two_hand_dumbbell_overhead_extension",
    "exercise_name": "Французский жим одной гантелью (из-за головы, двумя руками)",
    "category": "arms",
    "technique_image_url": "/exercises/arms/two_hand_dumbbell_overhead_extension.png",
    "primary_muscles": [
      "triceps"
    ],
    "secondary_muscles": [
      "abs"
    ],
    "start_position": "Сидя или стоя удерживайте одну гантель двумя руками над головой за внутреннюю сторону диска.",
    "execution": "На вдохе согните руки и опустите гантель за голову, удерживая локти направленными вверх.",
    "top_position": "В нижней точке трицепсы растянуты, корпус стабилен.",
    "return_phase": "На выдохе разогните руки и поднимите гантель обратно над головой.",
    "mistakes": [
      "Разведение локтей\n Прогиб в пояснице\n Слишком большой вес\n Резкое опускание"
    ],
    "breathing": "Вдох при опускании, выдох при разгибании.",
    "safety": "Держите пресс напряжённым и не допускайте потери контроля над гантелью."
  },
  "triceps_kickback": {
    "exercise_id": "triceps_kickback",
    "exercise_name": "Разгибание гантели в наклоне (рука вдоль тела, локоть прижат)",
    "category": "arms",
    "technique_image_url": "/exercises/arms/triceps_kickback.png",
    "primary_muscles": [
      "triceps"
    ],
    "secondary_muscles": [
      "rear_delts"
    ],
    "start_position": "Наклонитесь вперёд с ровной спиной, одна рука опирается на скамью или бедро. Рабочая рука согнута, локоть прижат к корпусу.",
    "execution": "На выдохе разогните руку назад, двигая только предплечьем и удерживая локоть неподвижным.",
    "top_position": "В крайней точке рука почти полностью выпрямлена, трицепс максимально напряжён.",
    "return_phase": "На вдохе медленно верните предплечье в исходное положение.",
    "mistakes": [
      "Опускание локтя\n Раскачка корпусом\n Движение плечом вместо локтя\n Слишком тяжёлый вес"
    ],
    "breathing": "Выдох при разгибании, вдох при возврате.",
    "safety": "Фиксируйте локоть и держите спину нейтральной. Не используйте инерцию."
  },
  "overhead_cable_triceps_extension": {
    "exercise_id": "overhead_cable_triceps_extension",
    "exercise_name": "Разгибание рук в блоке сверху («пуловер на трицепс»)",
    "category": "arms",
    "technique_image_url": "/exercises/arms/overhead_cable_triceps_extension.png",
    "primary_muscles": [
      "triceps"
    ],
    "secondary_muscles": [
      "forearms"
    ],
    "start_position": "Встаньте у верхнего блока, возьмитесь за рукоять, локти прижаты к бокам или слегка впереди корпуса в зависимости от варианта.",
    "execution": "На выдохе разогните руки вниз, двигая вес за счёт трицепса.",
    "top_position": "В нижней точке руки почти полностью выпрямлены, трицепсы сокращены.",
    "return_phase": "На вдохе медленно согните руки и верните рукоять вверх, сохраняя контроль.",
    "mistakes": [
      "Разведение локтей\n Рывки корпусом\n Чрезмерный вес\n Неполное разгибание"
    ],
    "breathing": "Выдох при разгибании, вдох при возврате.",
    "safety": "Держите локти под контролем и не бросайте рукоять вверх."
  },
  "single_arm_overhead_dumbbell_extension": {
    "exercise_id": "single_arm_overhead_dumbbell_extension",
    "exercise_name": "Разгибание гантели из-за головы одной рукой",
    "category": "arms",
    "technique_image_url": "/exercises/arms/single_arm_overhead_dumbbell_extension.png",
    "primary_muscles": [
      "triceps"
    ],
    "secondary_muscles": [
      "abs"
    ],
    "start_position": "Сидя или стоя удерживайте гантель одной рукой над головой, локоть направлен вверх.",
    "execution": "На вдохе согните руку и опустите гантель за голову.",
    "top_position": "В нижней точке трицепс растянут, плечо остаётся стабильным.",
    "return_phase": "На выдохе разогните руку и поднимите гантель обратно вверх.",
    "mistakes": [
      "Разведение локтя\n Прогиб в пояснице\n Рывок из нижней точки\n Слишком большой вес"
    ],
    "breathing": "Вдох при опускании, выдох при разгибании.",
    "safety": "Держите корпус напряжённым и не уходите в боковой наклон."
  },
  "straight_bar_pushdown": {
    "exercise_id": "straight_bar_pushdown",
    "exercise_name": "Разгибание с прямой рукоятью в блоке сверху",
    "category": "arms",
    "technique_image_url": "/exercises/arms/straight_bar_pushdown.png",
    "primary_muscles": [
      "triceps"
    ],
    "secondary_muscles": [
      "forearms"
    ],
    "start_position": "Встаньте у верхнего блока, возьмитесь за прямую рукоять, локти прижаты к корпусу.",
    "execution": "На выдохе разогните руки вниз до почти полного выпрямления, не двигая плечами.",
    "top_position": "В нижней точке трицепсы сокращены, локти остаются у корпуса.",
    "return_phase": "На вдохе плавно верните рукоять вверх до контролируемого сгибания в локтях.",
    "mistakes": [
      "Раскачка корпусом\n Разведение локтей\n Слишком тяжёлый вес\n Неполная амплитуда"
    ],
    "breathing": "Выдох при разгибании, вдох при возврате.",
    "safety": "Следите за нейтральным положением запястий и не отпускайте рукоять резко."
  },
  "dip_machine_press": {
    "exercise_id": "dip_machine_press",
    "exercise_name": "Жим в тренажёре на трицепс (например, «Dip Machine»)",
    "category": "arms",
    "technique_image_url": "/exercises/arms/dip_machine_press.png",
    "primary_muscles": [
      "triceps"
    ],
    "secondary_muscles": [
      "chest",
      "front_delts"
    ],
    "start_position": "Сядьте в тренажёр, возьмитесь за рукояти, корпус плотно зафиксирован, плечи опущены.",
    "execution": "На выдохе выжимайте рукояти вниз или вперёд по траектории тренажёра, разгибая руки.",
    "top_position": "В конечной точке руки почти выпрямлены, трицепсы напряжены, движение контролируемое.",
    "return_phase": "На вдохе плавно верните рукояти в исходное положение.",
    "mistakes": [
      "Слишком большой вес\n Рывки\n Потеря контроля в негативной фазе\n Поднятые плечи"
    ],
    "breathing": "Выдох при жиме, вдох при возврате.",
    "safety": "Отрегулируйте сиденье и амплитуду под себя. Не блокируйте локти резко в конце движения."
  },
  "weighted_dips": {
    "exercise_id": "weighted_dips",
    "exercise_name": "Отжимания на брусьях",
    "category": "arms",
    "technique_image_url": "/exercises/arms/weighted_dips.png",
    "primary_muscles": [
      "triceps"
    ],
    "secondary_muscles": [
      "chest",
      "front_delts"
    ],
    "start_position": "Примите упор на брусьях, корпус слегка наклонён вперёд или почти вертикален в зависимости от акцента. Ноги согнуты, корпус стабилен.",
    "execution": "На вдохе согните руки и опуститесь вниз до комфортной глубины, сохраняя контроль плеч.",
    "top_position": "В нижней точке грудь раскрыта, локти согнуты, плечи не проваливаются.",
    "return_phase": "На выдохе разогните руки и вернитесь вверх в упор.",
    "mistakes": [
      "Слишком глубокое опускание\n Рывки\n Провал плеч вниз\n Потеря контроля корпуса"
    ],
    "breathing": "Вдох при опускании, выдох при подъёме.",
    "safety": "Не опускайтесь в болезненную амплитуду. При нестабильности плеч начните с облегчённого варианта."
  },
  "diamond_push_ups": {
    "exercise_id": "diamond_push_ups",
    "exercise_name": "Отжимания узким хватом («алмазные отжимания»)",
    "category": "arms",
    "technique_image_url": "/exercises/arms/diamond_push_ups.png",
    "primary_muscles": [
      "triceps"
    ],
    "secondary_muscles": [
      "chest"
    ],
    "start_position": "Примите упор лёжа, ладони расположите близко друг к другу под грудью, образуя узкую постановку рук.",
    "execution": "На вдохе согните руки и опустите корпус вниз, сохраняя прямую линию тела.",
    "top_position": "В нижней точке грудь близко к ладоням, локти направлены назад и ближе к корпусу.",
    "return_phase": "На выдохе разогните руки и вытолкните корпус вверх.",
    "mistakes": [
      "Провисание таза\n Слишком широкий локоть\n Неполная амплитуда\n Рывки"
    ],
    "breathing": "Вдох при опускании, выдох при подъёме.",
    "safety": "Сохраняйте корпус прямым и не допускайте боли в запястьях. При необходимости упростите вариант."
  },
  "bodyweight_dips": {
    "exercise_id": "bodyweight_dips",
    "exercise_name": "Отжимания на брусьях (без отягощения)",
    "category": "arms",
    "technique_image_url": "/exercises/arms/bodyweight_dips.png",
    "primary_muscles": [
      "triceps"
    ],
    "secondary_muscles": [
      "chest",
      "front_delts"
    ],
    "start_position": "Примите упор на брусьях, руки выпрямлены, корпус стабилен.",
    "execution": "На вдохе согните руки и опуститесь вниз под контролем.",
    "top_position": "В нижней точке локти согнуты, плечи сохраняют устойчивое положение.",
    "return_phase": "На выдохе разогните руки и поднимитесь обратно в упор.",
    "mistakes": [
      "Провал плеч\n Слишком глубокое опускание\n Рывки\n Потеря контроля корпуса"
    ],
    "breathing": "Вдох при опускании, выдох при подъёме.",
    "safety": "Работайте в комфортной амплитуде и избегайте боли в плечах."
  },
  "bench_dips": {
    "exercise_id": "bench_dips",
    "exercise_name": "Отжимания от скамьи (с ногами на полу или вверху)",
    "category": "arms",
    "technique_image_url": "/exercises/arms/bench_dips.png",
    "primary_muscles": [
      "triceps"
    ],
    "secondary_muscles": [
      "front_delts",
      "chest"
    ],
    "start_position": "Руки на краю скамьи за спиной, ноги на полу или на возвышении, таз перед скамьёй.",
    "execution": "На вдохе согните руки в локтях и опустите таз вниз перед скамьёй.",
    "top_position": "В нижней точке локти согнуты, плечи не уходят в болезненное положение.",
    "return_phase": "На выдохе разогните руки и поднимите тело обратно вверх.",
    "mistakes": [
      "Слишком глубокое опускание\n Поднятые плечи\n Рывки\n Сильный сдвиг таза далеко от скамьи"
    ],
    "breathing": "Вдох при опускании, выдох при подъёме.",
    "safety": "Будьте осторожны при чувствительных плечах. Не уходите в слишком глубокую амплитуду."
  },
  "barbell_bench_press_flat": {
    "exercise_id": "barbell_bench_press_flat",
    "exercise_name": "Жим штанги лёжа (горизонтальная скамья)",
    "category": "chest",
    "technique_image_url": "/exercises/chest/barbell_bench_press_flat.png",
    "primary_muscles": [
      "chest"
    ],
    "secondary_muscles": [
      "front_delts",
      "triceps"
    ],
    "start_position": "Лягте на горизонтальную скамью. Лопатки сведены и прижаты к скамье, стопы устойчиво стоят на полу. Возьмитесь за штангу хватом чуть шире плеч и снимите её со стоек, удерживая над серединой груди.",
    "execution": "На вдохе медленно опустите штангу к нижней или средней части груди, сохраняя контроль и угол локтей примерно 30–45° к корпусу. На выдохе выжмите штангу вверх по дуге до исходного положения.",
    "top_position": "В верхней точке руки почти выпрямлены, грудные мышцы напряжены, плечи не поднимаются вперёд, лопатки остаются собранными.",
    "return_phase": "Опускайте штангу вниз плавно и под контролем, не бросая вес на грудь и не теряя напряжение корпуса.",
    "mistakes": [
      "Отрыв таза от скамьи\n Разведение локтей слишком широко\n Удар штангой о грудь\n Слишком короткая амплитуда\n Потеря положения лопаток"
    ],
    "breathing": "Вдох при опускании штанги, выдох при жиме вверх.",
    "safety": "Используйте страховку или силовую раму. Не берите слишком большой вес без контроля техники. Сохраняйте нейтральное положение запястий и стабильную опору стоп."
  },
  "barbell_incline_bench_press": {
    "exercise_id": "barbell_incline_bench_press",
    "exercise_name": "Жим штанги под углом вверх (наклонная скамья, 30–45°)",
    "category": "chest",
    "technique_image_url": "/exercises/chest/barbell_incline_bench_press.png",
    "primary_muscles": [
      "upper_chest"
    ],
    "secondary_muscles": [
      "front_delts",
      "triceps"
    ],
    "start_position": "Установите скамью под углом 30–45°. Лягте на неё, сведите лопатки, упритесь стопами в пол. Возьмитесь за штангу чуть шире плеч и удерживайте её над верхней частью груди.",
    "execution": "На вдохе опустите штангу к верхней части груди, сохраняя контроль и стабильное положение плеч. На выдохе выжмите штангу вверх до почти полного выпрямления рук.",
    "top_position": "В верхней точке вес находится над верхней частью груди и плечевым поясом, верх груди напряжён, корпус устойчив.",
    "return_phase": "Медленно верните штангу вниз по той же траектории, не теряя контроля и не проваливая плечи вперёд.",
    "mistakes": [
      "Слишком большой угол наклона скамьи\n Сведение движения к жиму плечами\n Разведение локтей в стороны\n Рывки и потеря контроля внизу"
    ],
    "breathing": "Вдох при опускании, выдох при жиме вверх.",
    "safety": "Не поднимайте угол скамьи слишком высоко, иначе нагрузка уйдёт в плечи. Держите плечи опущенными и не жмите через боль в передней части плеча."
  },
  "barbell_decline_bench_press": {
    "exercise_id": "barbell_decline_bench_press",
    "exercise_name": "Жим штанги под углом вниз (скамья с отрицательным наклоном)",
    "category": "chest",
    "technique_image_url": "/exercises/chest/barbell_decline_bench_press.png",
    "primary_muscles": [
      "chest"
    ],
    "secondary_muscles": [
      "triceps",
      "front_delts"
    ],
    "start_position": "Лягте на скамью с отрицательным наклоном и зафиксируйте ноги. Лопатки сведены, штанга удерживается над нижней частью груди.",
    "execution": "На вдохе опустите штангу к нижней части груди по контролируемой траектории. На выдохе выжмите её вверх, не теряя напряжения грудных мышц.",
    "top_position": "В верхней точке руки почти выпрямлены, корпус стабилен, грудные мышцы напряжены.",
    "return_phase": "Плавно опустите штангу вниз, сохраняя контроль и не позволяя штанге падать на грудь.",
    "mistakes": [
      "Потеря фиксации ног\n Слишком широкий хват\n Удар штангой о грудь\n Рывок из нижней точки"
    ],
    "breathing": "Вдох при опускании, выдох при жиме вверх.",
    "safety": "Следите за фиксацией тела на скамье. Используйте страховку и не работайте с чрезмерным весом без помощника."
  },
  "dumbbell_bench_press_flat": {
    "exercise_id": "dumbbell_bench_press_flat",
    "exercise_name": "Жим гантелей лёжа (горизонтально)",
    "category": "chest",
    "technique_image_url": "/exercises/chest/dumbbell_bench_press_flat.png",
    "primary_muscles": [
      "chest"
    ],
    "secondary_muscles": [
      "front_delts",
      "triceps"
    ],
    "start_position": "Лягте на горизонтальную скамью, лопатки сведены, стопы упираются в пол. Поднимите гантели над грудью, ладони смотрят вперёд или слегка друг на друга.",
    "execution": "На вдохе опустите гантели вниз и немного в стороны до комфортного растяжения грудных. На выдохе выжмите гантели вверх по дуге.",
    "top_position": "В верхней точке гантели над грудью, руки почти выпрямлены, грудные мышцы сокращены, гантели не сталкиваются.",
    "return_phase": "Плавно опустите гантели вниз, не теряя положения лопаток и не бросая вес.",
    "mistakes": [
      "Слишком глубокое опускание при плохой подвижности плеч\n Рывки\n Удар гантелей друг о друга\n Потеря контроля корпуса"
    ],
    "breathing": "Вдох при опускании, выдох при жиме вверх.",
    "safety": "Не опускайте гантели через боль в плечах. Подбирайте вес, который позволяет сохранять полный контроль на всей амплитуде."
  },
  "dumbbell_incline_press": {
    "exercise_id": "dumbbell_incline_press",
    "exercise_name": "Жим гантелей под углом вверх",
    "category": "chest",
    "technique_image_url": "/exercises/chest/dumbbell_incline_press.png",
    "primary_muscles": [
      "upper_chest"
    ],
    "secondary_muscles": [
      "front_delts",
      "triceps"
    ],
    "start_position": "Установите скамью под углом 30–45°. Лягте, сведите лопатки и удерживайте гантели над верхней частью груди.",
    "execution": "На вдохе опустите гантели вниз и слегка в стороны. На выдохе выжмите их вверх, сохраняя одинаковую траекторию обеих рук.",
    "top_position": "В верхней точке руки почти выпрямлены, верх груди напряжён, плечи стабильны.",
    "return_phase": "Медленно опустите гантели вниз по контролируемой траектории.",
    "mistakes": [
      "Слишком высокий угол скамьи\n Рывки\n Несимметричный жим\n Уход нагрузки в плечи"
    ],
    "breathing": "Вдох вниз, выдох вверх.",
    "safety": "Следите, чтобы плечи не тянулись к ушам. Не жмите вес, который не можете стабилизировать."
  },
  "dumbbell_decline_press": {
    "exercise_id": "dumbbell_decline_press",
    "exercise_name": "Жим гантелей под углом вниз",
    "category": "chest",
    "technique_image_url": "/exercises/chest/dumbbell_decline_press.png",
    "primary_muscles": [
      "chest"
    ],
    "secondary_muscles": [
      "triceps",
      "front_delts"
    ],
    "start_position": "Лягте на скамью с отрицательным наклоном, зафиксируйте ноги, сведите лопатки. Гантели удерживаются над грудью.",
    "execution": "На вдохе опустите гантели вниз по широкой дуге до комфортной глубины. На выдохе выжмите их вверх.",
    "top_position": "В верхней точке грудные мышцы напряжены, руки почти выпрямлены, гантели стабильны.",
    "return_phase": "Плавно опустите гантели вниз, не теряя контроля над траекторией.",
    "mistakes": [
      "Потеря фиксации корпуса\n Рывки\n Слишком глубокая амплитуда\n Сведение гантелей с ударом"
    ],
    "breathing": "Вдох при опускании, выдох при жиме вверх.",
    "safety": "Аккуратно заходите в исходное положение и выходите из него. Используйте умеренный вес."
  },
  "flat_dumbbell_fly": {
    "exercise_id": "flat_dumbbell_fly",
    "exercise_name": "Разведение гантелей лёжа («бабочка с гантелями»)",
    "category": "chest",
    "technique_image_url": "/exercises/chest/flat_dumbbell_fly.png",
    "primary_muscles": [
      "chest"
    ],
    "secondary_muscles": [
      "front_delts"
    ],
    "start_position": "Лягте на горизонтальную скамью, гантели над грудью, руки слегка согнуты в локтях и этот угол сохраняется на всём движении.",
    "execution": "На вдохе разводите руки в стороны по широкой дуге до ощущения растяжения грудных мышц. На выдохе сведите гантели обратно над грудью.",
    "top_position": "В верхней точке гантели над грудью, грудные мышцы сокращены, локти остаются слегка согнутыми.",
    "return_phase": "Медленно и плавно разведите руки обратно вниз, сохраняя один и тот же угол в локтях.",
    "mistakes": [
      "Слишком сильное сгибание рук, превращающее упражнение в жим\n Слишком глубокое опускание\n Рывки\n Чрезмерный вес"
    ],
    "breathing": "Вдох при разведении, выдох при сведении.",
    "safety": "Это изолирующее упражнение, не используйте большой вес. Не опускайте гантели через боль в плечах."
  },
  "incline_dumbbell_fly": {
    "exercise_id": "incline_dumbbell_fly",
    "exercise_name": "Разведение гантелей на наклонной скамье вверх",
    "category": "chest",
    "technique_image_url": "/exercises/chest/incline_dumbbell_fly.png",
    "primary_muscles": [
      "upper_chest"
    ],
    "secondary_muscles": [
      "front_delts"
    ],
    "start_position": "Лягте на наклонную скамью под углом 30–45°, гантели удерживаются над верхней частью груди, руки слегка согнуты.",
    "execution": "На вдохе разводите руки в стороны по дуге до растяжения верхней части груди. На выдохе сведите руки обратно.",
    "top_position": "В верхней точке гантели над верхней частью груди, верх груди напряжён.",
    "return_phase": "Плавно опустите руки вниз по той же дуге, сохраняя контроль.",
    "mistakes": [
      "Слишком высокий угол скамьи\n Излишний вес\n Сгибание рук как в жиме\n Рывки"
    ],
    "breathing": "Вдох при разведении, выдох при сведении.",
    "safety": "Работайте в комфортной амплитуде и не проваливайте плечи вперёд."
  },
  "decline_dumbbell_fly": {
    "exercise_id": "decline_dumbbell_fly",
    "exercise_name": "Разведение гантелей на наклонной скамье вниз",
    "category": "chest",
    "technique_image_url": "/exercises/chest/decline_dumbbell_fly.png",
    "primary_muscles": [
      "chest"
    ],
    "secondary_muscles": [
      "front_delts"
    ],
    "start_position": "Лягте на скамью с отрицательным наклоном, гантели над грудью, руки слегка согнуты в локтях.",
    "execution": "На вдохе разводите руки в стороны по широкой дуге до растяжения грудных мышц. На выдохе сведите руки обратно над грудью.",
    "top_position": "В верхней точке руки почти сведены, грудь напряжена, движение контролируемое.",
    "return_phase": "Медленно разведите руки обратно вниз, не меняя угол в локтях.",
    "mistakes": [
      "Чрезмерное растяжение в нижней точке\n Рывки\n Слишком тяжёлый вес\n Потеря фиксации корпуса"
    ],
    "breathing": "Вдох при разведении, выдох при сведении.",
    "safety": "Не опускайте гантели слишком глубоко. Следите за стабильностью положения на скамье."
  },
  "dumbbell_pullover": {
    "exercise_id": "dumbbell_pullover",
    "exercise_name": "Пулловер с гантелью лёжа (через голову)",
    "category": "chest",
    "technique_image_url": "/exercises/chest/dumbbell_pullover.png",
    "primary_muscles": [
      "chest"
    ],
    "secondary_muscles": [
      "lats"
    ],
    "start_position": "Лягте поперёк или вдоль скамьи, удерживая одну гантель двумя руками над грудью. Локти слегка согнуты, корпус стабилен.",
    "execution": "На вдохе медленно опускайте гантель за голову по дуге, сохраняя лёгкий сгиб локтей. На выдохе верните гантель обратно над грудь.",
    "top_position": "В нижней точке ощущается растяжение грудных мышц и широчайших, плечи остаются под контролем.",
    "return_phase": "Плавно верните гантель назад по той же траектории, не используя рывок.",
    "mistakes": [
      "Чрезмерный прогиб в пояснице\n Слишком большой вес\n Рывковый возврат\n Слишком сильное сгибание рук"
    ],
    "breathing": "Вдох при опускании за голову, выдох при возврате.",
    "safety": "Контролируйте положение поясницы и плеч. Не опускайте вес слишком глубоко, если чувствуете дискомфорт в плечах."
  },
  "machine_chest_press_flat": {
    "exercise_id": "machine_chest_press_flat",
    "exercise_name": "Жим в тренажёре лёжа (грудной тренажёр)",
    "category": "chest",
    "technique_image_url": "/exercises/chest/machine_chest_press_flat.png",
    "primary_muscles": [
      "chest"
    ],
    "secondary_muscles": [
      "front_delts",
      "triceps"
    ],
    "start_position": "Сядьте или лягте в тренажёр согласно конструкции. Плечи опущены, лопатки собраны, рукояти на уровне груди.",
    "execution": "На выдохе выжимайте рукояти вперёд до почти полного выпрямления рук. На вдохе плавно верните их обратно.",
    "top_position": "В конечной точке грудные мышцы сокращены, плечи не уходят вперёд.",
    "return_phase": "Медленно возвращайте рукояти назад, не бросая вес.",
    "mistakes": [
      "Слишком большой вес\n Потеря контроля в негативной фазе\n Поднятые плечи\n Неправильная посадка"
    ],
    "breathing": "Выдох при жиме, вдох при возврате.",
    "safety": "Отрегулируйте сиденье под себя, чтобы рукояти стартовали на уровне груди, а не плеч или шеи."
  },
  "machine_incline_press": {
    "exercise_id": "machine_incline_press",
    "exercise_name": "Жим в тренажёре под углом вверх",
    "category": "chest",
    "technique_image_url": "/exercises/chest/machine_incline_press.png",
    "primary_muscles": [
      "upper_chest"
    ],
    "secondary_muscles": [
      "front_delts",
      "triceps"
    ],
    "start_position": "Сядьте в тренажёр с наклонной траекторией жима, лопатки собраны, рукояти на уровне верхней части груди.",
    "execution": "На выдохе выжимайте рукояти вверх и вперёд по траектории тренажёра. На вдохе медленно возвращайте назад.",
    "top_position": "В верхней точке верх груди напряжён, движение остаётся стабильным и контролируемым.",
    "return_phase": "Плавно верните рукояти в стартовую позицию без рывков.",
    "mistakes": [
      "Поднятые плечи\n Слишком большой вес\n Неполная амплитуда\n Потеря контроля"
    ],
    "breathing": "Выдох при жиме, вдох при возврате.",
    "safety": "Следите, чтобы нагрузка не уходила полностью в плечи. Не сутультесь в тренажёре."
  },
  "machine_decline_press": {
    "exercise_id": "machine_decline_press",
    "exercise_name": "Жим в тренажёре под углом вниз",
    "category": "chest",
    "technique_image_url": "/exercises/chest/machine_decline_press.png",
    "primary_muscles": [
      "chest"
    ],
    "secondary_muscles": [
      "triceps",
      "front_delts"
    ],
    "start_position": "Расположитесь в тренажёре так, чтобы траектория жима шла с акцентом вниз. Лопатки собраны, корпус стабилен.",
    "execution": "На выдохе выжимайте рукояти по траектории тренажёра. На вдохе плавно возвращайте их обратно.",
    "top_position": "В конечной точке грудь напряжена, руки почти выпрямлены, плечи стабильны.",
    "return_phase": "Под контролем верните рукояти назад в исходную позицию.",
    "mistakes": [
      "Слишком большой вес\n Резкий возврат\n Потеря положения лопаток\n Неполная амплитуда"
    ],
    "breathing": "Выдох при жиме, вдох при возврате.",
    "safety": "Сохраняйте плотный контакт со спинкой и работайте в управляемом диапазоне."
  },
  "pec_deck_fly": {
    "exercise_id": "pec_deck_fly",
    "exercise_name": "Бабочка (машина для сведения рук — Pec Deck)",
    "category": "chest",
    "technique_image_url": "/exercises/chest/pec_deck_fly.png",
    "primary_muscles": [
      "chest"
    ],
    "secondary_muscles": [
      "front_delts"
    ],
    "start_position": "Сядьте в тренажёр, спина прижата к спинке, руки расположены на подушках или рукоятях на уровне груди.",
    "execution": "На выдохе сводите руки перед собой, сокращая грудные мышцы. На вдохе медленно разводите обратно до растяжения.",
    "top_position": "В конечной точке грудь максимально напряжена, но руки не ударяются друг о друга.",
    "return_phase": "Плавно разведите руки обратно, сохраняя контроль и натяжение.",
    "mistakes": [
      "Рывки\n Слишком большой вес\n Сведение руками за счёт инерции\n Плечи поднимаются к ушам"
    ],
    "breathing": "Выдох при сведении, вдох при разведении.",
    "safety": "Не перерастягивайте плечи в задней точке и не используйте вес, который заставляет бросать рукояти."
  },
  "pushups_classic": {
    "exercise_id": "pushups_classic",
    "exercise_name": "Отжимания от пола (классические)",
    "category": "chest",
    "technique_image_url": "/exercises/chest/pushups_classic.png",
    "primary_muscles": [
      "chest"
    ],
    "secondary_muscles": [
      "front_delts",
      "triceps"
    ],
    "start_position": "Примите упор лёжа: ладони чуть шире плеч, тело образует прямую линию от головы до пяток, пресс напряжён.",
    "execution": "На вдохе согните руки и опустите корпус вниз до комфортной глубины, сохраняя жёсткий корпус. На выдохе выжмите себя обратно вверх.",
    "top_position": "В нижней точке грудь близко к полу, локти направлены под контролем, таз не провисает.",
    "return_phase": "Разогните руки и вернитесь в исходный упор, сохраняя тело прямым.",
    "mistakes": [
      "Провисание таза\n Слишком широкий локоть\n Неполная амплитуда\n Подъём головы вверх"
    ],
    "breathing": "Вдох при опускании, выдох при подъёме.",
    "safety": "Сохраняйте линию корпуса. При нехватке силы начните с варианта от возвышения."
  },
  "decline_pushups": {
    "exercise_id": "decline_pushups",
    "exercise_name": "Отжимания с ногами на возвышении",
    "category": "chest",
    "technique_image_url": "/exercises/chest/decline_pushups.png",
    "primary_muscles": [
      "upper_chest"
    ],
    "secondary_muscles": [
      "front_delts",
      "triceps"
    ],
    "start_position": "Поставьте ноги на скамью или возвышение, ладони на полу чуть шире плеч. Корпус прямой, пресс напряжён.",
    "execution": "На вдохе опустите корпус вниз, сохраняя контроль корпуса. На выдохе выжмите себя вверх.",
    "top_position": "В нижней точке грудь приближается к полу, верх груди и плечи получают повышенную нагрузку.",
    "return_phase": "Поднимитесь вверх, сохраняя прямую линию тела и устойчивое положение лопаток.",
    "mistakes": [
      "Провисание таза\n Слишком резкое движение вниз\n Сведение локтей наружу\n Потеря стабильности корпуса"
    ],
    "breathing": "Вдох при опускании, выдох при подъёме.",
    "safety": "Используйте устойчивое возвышение для ног и не выполняйте упражнение через боль в плечах."
  },
  "incline_or_deep_pushups": {
    "exercise_id": "incline_or_deep_pushups",
    "exercise_name": "Отжимания с руками на возвышении (или глубокие отжимания)",
    "category": "chest",
    "technique_image_url": "/exercises/chest/incline_or_deep_pushups.png",
    "primary_muscles": [
      "chest"
    ],
    "secondary_muscles": [
      "triceps",
      "front_delts"
    ],
    "start_position": "Поставьте руки на устойчивое возвышение или опоры. Корпус держите прямым, лопатки стабильны.",
    "execution": "На вдохе опустите корпус вниз между опорами или к возвышению. На выдохе выжмите себя обратно вверх.",
    "top_position": "В нижней точке грудные мышцы растягиваются сильнее, чем в обычных отжиманиях, корпус остаётся под контролем.",
    "return_phase": "Поднимитесь вверх плавно, не помогая себе инерцией.",
    "mistakes": [
      "Слишком глубокое опускание без контроля\n Провисание корпуса\n Рывки\n Неустойчивые опоры"
    ],
    "breathing": "Вдох при опускании, выдох при подъёме.",
    "safety": "Используйте только устойчивые опоры. Не углубляйте амплитуду, если это вызывает дискомфорт в плечах."
  },
  "ring_pushups": {
    "exercise_id": "ring_pushups",
    "exercise_name": "Отжимания на кольцах или нестабильной поверхности",
    "category": "chest",
    "technique_image_url": "/exercises/chest/ring_pushups.png",
    "primary_muscles": [
      "chest"
    ],
    "secondary_muscles": [
      "front_delts",
      "triceps",
      "abs"
    ],
    "start_position": "Примите упор на кольцах или нестабильных рукоятях. Корпус жёсткий, плечи опущены, пресс напряжён.",
    "execution": "На вдохе опуститесь вниз, удерживая баланс и контролируя кольца. На выдохе выжмите себя вверх, сохраняя устойчивость.",
    "top_position": "В нижней точке грудные мышцы напряжены, кольца или рукояти не расходятся бесконтрольно.",
    "return_phase": "Поднимитесь вверх под контролем, не теряя нейтрального положения корпуса.",
    "mistakes": [
      "Потеря баланса\n Разъезжание рук\n Провисание таза\n Слишком большая амплитуда без контроля"
    ],
    "breathing": "Вдох при опускании, выдох при подъёме.",
    "safety": "Это продвинутый вариант. Используйте его только при хорошем контроле плечевого пояса и корпуса."
  },
  "clap_pushups": {
    "exercise_id": "clap_pushups",
    "exercise_name": "Отжимания с хлопком (плиометрические)",
    "category": "chest",
    "technique_image_url": "/exercises/chest/clap_pushups.png",
    "primary_muscles": [
      "chest"
    ],
    "secondary_muscles": [
      "triceps",
      "front_delts"
    ],
    "start_position": "Примите упор лёжа, руки чуть шире плеч, корпус напряжён и стабилен.",
    "execution": "Опуститесь вниз и затем мощно выжмите себя вверх так, чтобы руки оторвались от пола. Выполните хлопок и мягко приземлитесь обратно.",
    "top_position": "В фазе отрыва корпуса от пола движение взрывное, грудные и трицепсы работают максимально интенсивно.",
    "return_phase": "После приземления сразу амортизируйте и переходите к следующему повторению под контролем.",
    "mistakes": [
      "Провисание корпуса\n Жёсткое приземление на прямые локти\n Недостаточный контроль при касании пола\n Потеря техники ради скорости"
    ],
    "breathing": "Вдох при опускании, резкий выдох в момент взрывного жима.",
    "safety": "Выполняйте только после хорошей разминки и при достаточной силовой базе. Не делайте на скользкой поверхности."
  },
  "crossover_mid": {
    "exercise_id": "crossover_mid",
    "exercise_name": "Кроссовер (сведение рук в кроссовере на высоте груди)",
    "category": "chest",
    "technique_image_url": "/exercises/chest/crossover_mid.png",
    "primary_muscles": [
      "chest"
    ],
    "secondary_muscles": [
      "front_delts"
    ],
    "start_position": "Встаньте между блоками, рукояти установлены на уровне груди. Сделайте шаг вперёд, корпус слегка наклонён, руки разведены в стороны.",
    "execution": "На выдохе сведите руки перед собой по дуге, как будто обнимаете большое дерево. На вдохе медленно разведите обратно.",
    "top_position": "В точке сведения грудные мышцы максимально сокращены, кисти встречаются перед грудью.",
    "return_phase": "Плавно разведите руки обратно до растяжения грудных, сохраняя лёгкий сгиб в локтях.",
    "mistakes": [
      "Сильное сгибание рук в локтях\n Рывки корпусом\n Слишком большой вес\n Потеря натяжения в негативной фазе"
    ],
    "breathing": "Выдох при сведении, вдох при разведении.",
    "safety": "Не превращайте упражнение в жим. Держите плечи опущенными и работайте в контролируемой амплитуде."
  },
  "crossover_high_to_low": {
    "exercise_id": "crossover_high_to_low",
    "exercise_name": "Кроссовер — сведение рук сверху вниз («нижний кроссовер»)",
    "category": "chest",
    "technique_image_url": "/exercises/chest/crossover_high_to_low.png",
    "primary_muscles": [
      "chest"
    ],
    "secondary_muscles": [
      "triceps"
    ],
    "start_position": "Встаньте между верхними блоками, возьмитесь за рукояти и сделайте шаг вперёд. Руки разведены и направлены немного вниз.",
    "execution": "На выдохе сведите руки по дуге сверху вниз к нижней части груди или к области перед прессом.",
    "top_position": "В нижней точке грудные мышцы напряжены, акцент смещается на нижнюю/общую часть груди.",
    "return_phase": "На вдохе плавно верните руки в исходное положение, сохраняя контроль троса.",
    "mistakes": [
      "Слишком тяжёлый вес\n Рывки\n Излишнее сгибание в локтях\n Потеря контроля корпуса"
    ],
    "breathing": "Выдох при сведении, вдох при разведении.",
    "safety": "Сохраняйте устойчивую стойку и не позволяйте тросам тянуть корпус назад."
  },
  "crossover_low_to_high": {
    "exercise_id": "crossover_low_to_high",
    "exercise_name": "Кроссовер — сведение снизу вверх",
    "category": "chest",
    "technique_image_url": "/exercises/chest/crossover_low_to_high.png",
    "primary_muscles": [
      "upper_chest"
    ],
    "secondary_muscles": [
      "front_delts"
    ],
    "start_position": "Встаньте между нижними блоками, возьмитесь за рукояти, корпус слегка наклоните вперёд, руки разведены вниз и в стороны.",
    "execution": "На выдохе сведите руки по дуге снизу вверх к уровню верхней части груди или лица, сохраняя лёгкий сгиб в локтях.",
    "top_position": "В верхней точке верх груди напряжён, кисти сведены выше уровня груди.",
    "return_phase": "На вдохе медленно разведите руки обратно вниз и в стороны, сохраняя натяжение троса.",
    "mistakes": [
      "Подъём за счёт корпуса\n Слишком тяжёлый вес\n Рывки\n Чрезмерное сгибание локтей"
    ],
    "breathing": "Выдох при сведении, вдох при разведении.",
    "safety": "Не задирайте плечи к ушам и не используйте инерцию для подъёма рукоятей."
  },
  "barbell_row": {
    "exercise_id": "barbell_row",
    "exercise_name": "Тяга штанги в наклоне",
    "category": "back",
    "technique_image_url": "/exercises/back/barbell_row.png",
    "primary_muscles": [
      "lats"
    ],
    "secondary_muscles": [
      "rear_delts",
      "erectors",
      "biceps"
    ],
    "start_position": "Встаньте со штангой, наклоните корпус вперёд примерно до 30–45°, колени слегка согнуты, спина ровная, штанга в опущенных руках.",
    "execution": "На выдохе тяните штангу к поясу или нижней части живота, направляя локти назад и сводя лопатки.",
    "top_position": "Штанга у корпуса, лопатки сведены, широчайшие и средняя часть спины напряжены.",
    "return_phase": "На вдохе медленно опустите штангу вниз до полного контролируемого растяжения мышц спины.",
    "mistakes": [
      "Круглая спина\n Рывки корпусом\n Тяга к груди вместо пояса\n Слишком тяжёлый вес"
    ],
    "breathing": "Выдох при тяге вверх, вдох при опускании.",
    "safety": "Держите поясницу нейтральной и не жертвуйте положением корпуса ради веса."
  },
  "deadlift_classic": {
    "exercise_id": "deadlift_classic",
    "exercise_name": "Становая тяга (классическая)",
    "category": "back",
    "technique_image_url": "/exercises/back/deadlift_classic.png",
    "primary_muscles": [
      "erectors",
      "glutes"
    ],
    "secondary_muscles": [
      "hamstrings",
      "lats",
      "forearms_back"
    ],
    "start_position": "Подойдите к штанге так, чтобы гриф находился над серединой стопы. Возьмитесь за гриф, расправьте грудь, зафиксируйте нейтральную спину и натяните штангу.",
    "execution": "На выдохе начните подъём штанги, одновременно разгибая колени и таз. Штанга идёт максимально близко к ногам, корпус остаётся жёстким.",
    "top_position": "В верхней точке корпус прямой, таз полностью разогнут, ягодицы и разгибатели спины напряжены, но без переразгибания поясницы.",
    "return_phase": "На вдохе сначала отведите таз назад и ведите штангу вниз вдоль ног, затем сгибайте колени после прохождения линии колен.",
    "mistakes": [
      "Круглая спина\n Рывок штанги от пола\n Слишком раннее выпрямление коленей\n Переразгибание вверху"
    ],
    "breathing": "Выдох в силовой фазе подъёма, вдох перед началом следующего повторения.",
    "safety": "Сохраняйте жёсткий корпус и не тяните штангу рывком. При сомнениях уменьшите вес и отработайте механику движения."
  },
  "romanian_deadlift": {
    "exercise_id": "romanian_deadlift",
    "exercise_name": "Румынская становая тяга",
    "category": "back",
    "technique_image_url": "/exercises/back/romanian_deadlift.png",
    "primary_muscles": [
      "hamstrings",
      "glutes"
    ],
    "secondary_muscles": [
      "erectors",
      "lats"
    ],
    "start_position": "Встаньте прямо со штангой в руках, стопы на ширине таза, колени слегка согнуты, лопатки собраны, спина нейтральна.",
    "execution": "На вдохе отводите таз назад и ведите штангу вниз вдоль бёдер и голеней, сохраняя почти неизменный угол в коленях.",
    "top_position": "В нижней точке ощущается сильное растяжение задней поверхности бедра, штанга близко к ногам, спина остаётся ровной.",
    "return_phase": "На выдохе разгибайте таз и возвращайтесь в вертикальное положение, сокращая ягодицы и заднюю поверхность бедра.",
    "mistakes": [
      "Сильное сгибание коленей как в приседе\n Круглая спина\n Штанга далеко от ног\n Рывковое возвращение вверх"
    ],
    "breathing": "Вдох при опускании, выдох при подъёме.",
    "safety": "Не опускайте штангу ниже уровня, где можете удерживать нейтральную спину. Движение идёт из таза, а не из поясницы."
  },
  "barbell_shrug": {
    "exercise_id": "barbell_shrug",
    "exercise_name": "Шраги со штангой",
    "category": "back",
    "technique_image_url": "/exercises/back/barbell_shrug.png",
    "primary_muscles": [
      "traps_upper"
    ],
    "secondary_muscles": [
      "forearms_back"
    ],
    "start_position": "Встаньте прямо, штанга в опущенных руках перед бёдрами, руки прямые, плечи расслаблены, корпус нейтрален.",
    "execution": "На выдохе поднимайте плечи строго вверх к ушам, не сгибая руки и не наклоняя корпус.",
    "top_position": "В верхней точке трапеции максимально сокращены, возможна короткая пауза.",
    "return_phase": "На вдохе медленно опустите плечи вниз, сохраняя контроль движения.",
    "mistakes": [
      "Круговые движения плечами\n Рывки корпусом\n Сгибание рук\n Слишком большой вес"
    ],
    "breathing": "Выдох при подъёме плеч, вдох при опускании.",
    "safety": "Двигайтесь строго вверх-вниз. Не вращайте плечами по кругу — это перегружает суставы."
  },
  "one_arm_dumbbell_row": {
    "exercise_id": "one_arm_dumbbell_row",
    "exercise_name": "Тяга гантели в наклоне одной рукой",
    "category": "back",
    "technique_image_url": "/exercises/back/one_arm_dumbbell_row.png",
    "primary_muscles": [
      "lats"
    ],
    "secondary_muscles": [
      "rear_delts",
      "biceps",
      "traps_middle"
    ],
    "start_position": "Поставьте одно колено и одноимённую руку на скамью, вторая нога стоит на полу. Спина ровная, гантель в свободной руке свисает вниз.",
    "execution": "На выдохе тяните гантель к тазу или нижней части корпуса, ведя локоть вдоль тела и сводя лопатку.",
    "top_position": "Гантель у корпуса, лопатка сведена, широчайшая мышца напряжена.",
    "return_phase": "На вдохе плавно опустите гантель вниз, позволяя мышцам спины растянуться под контролем.",
    "mistakes": [
      "Разворот корпуса\n Рывок вверх\n Тяга к груди вместо таза\n Потеря нейтрали спины"
    ],
    "breathing": "Выдох при тяге вверх, вдох при опускании.",
    "safety": "Не раскачивайте корпус и не поднимайте плечо к уху. Сохраняйте опорную позицию стабильной."
  },
  "double_dumbbell_row": {
    "exercise_id": "double_dumbbell_row",
    "exercise_name": "Тяга двух гантелей в наклоне",
    "category": "back",
    "technique_image_url": "/exercises/back/double_dumbbell_row.png",
    "primary_muscles": [
      "lats"
    ],
    "secondary_muscles": [
      "rear_delts",
      "erectors",
      "biceps",
      "traps_middle"
    ],
    "start_position": "Наклоните корпус вперёд с ровной спиной, колени слегка согнуты, гантели в опущенных руках.",
    "execution": "На выдохе тяните обе гантели к поясу, направляя локти назад и сводя лопатки.",
    "top_position": "Гантели у корпуса, лопатки сведены, мышцы спины максимально напряжены.",
    "return_phase": "На вдохе медленно опустите гантели вниз до полного контролируемого растяжения.",
    "mistakes": [
      "Сутулость\n Рывки корпусом\n Поднятые плечи\n Слишком тяжёлый вес"
    ],
    "breathing": "Выдох при тяге, вдох при возврате.",
    "safety": "Сохраняйте нейтральную поясницу и одинаковую траекторию обеих рук."
  },
  "dumbbell_shrug": {
    "exercise_id": "dumbbell_shrug",
    "exercise_name": "Шраги с гантелями",
    "category": "back",
    "technique_image_url": "/exercises/back/dumbbell_shrug.png",
    "primary_muscles": [
      "traps_upper"
    ],
    "secondary_muscles": [
      "forearms_back"
    ],
    "start_position": "Встаньте прямо, гантели опущены вдоль корпуса, руки прямые, плечи расслаблены.",
    "execution": "На выдохе поднимайте плечи строго вверх, удерживая руки прямыми и корпус неподвижным.",
    "top_position": "В верхней точке трапеции напряжены максимально, можно сделать короткую паузу.",
    "return_phase": "На вдохе медленно опустите плечи вниз.",
    "mistakes": [
      "Вращение плечами\n Рывки\n Наклон корпуса\n Слишком большой вес"
    ],
    "breathing": "Выдох при подъёме, вдох при опускании.",
    "safety": "Не вращайте плечами и не используйте инерцию. Работайте в чёткой вертикальной траектории."
  },
  "dumbbell_pullover_back": {
    "exercise_id": "dumbbell_pullover_back",
    "exercise_name": "Пуловер с гантелью лёжа",
    "category": "back",
    "technique_image_url": "/exercises/back/dumbbell_pullover_back.png",
    "primary_muscles": [
      "lats"
    ],
    "secondary_muscles": [
      "chest",
      "triceps"
    ],
    "start_position": "Лягте на скамью, удерживайте одну гантель двумя руками над грудью, локти слегка согнуты, корпус стабилен.",
    "execution": "На вдохе опускайте гантель за голову по дуге, растягивая широчайшие и грудные мышцы. На выдохе верните гантель обратно над грудь.",
    "top_position": "В нижней точке ощущается растяжение широчайших, плечи остаются под контролем, локти не сгибаются слишком сильно.",
    "return_phase": "Плавно поднимите гантель обратно по той же дуге без рывка.",
    "mistakes": [
      "Переразгибание поясницы\n Слишком большой вес\n Рывок из нижней точки\n Сильное сгибание рук"
    ],
    "breathing": "Вдох при опускании за голову, выдох при возврате.",
    "safety": "Не опускайте вес слишком глубоко, если есть дискомфорт в плечах. Сохраняйте контроль корпуса."
  },
  "lat_pulldown_wide_grip": {
    "exercise_id": "lat_pulldown_wide_grip",
    "exercise_name": "Вертикальная тяга (Lat Pulldown) — широкий хват",
    "category": "back",
    "technique_image_url": "/exercises/back/lat_pulldown_wide_grip.png",
    "primary_muscles": [
      "lats"
    ],
    "secondary_muscles": [
      "teres_major",
      "biceps",
      "forearms_back"
    ],
    "start_position": "Сядьте в тренажёр и зафиксируйте бёдра под валиками. Возьмитесь за широкую рукоять хватом сверху, корпус слегка отклонён назад, плечи опущены.",
    "execution": "На выдохе тяните рукоять вниз к верхней части груди, ведя локти вниз и в стороны. Движение начинается с опускания лопаток, а не с рывка руками.",
    "top_position": "Рукоять у верхней части груди, лопатки сведены и опущены, широчайшие максимально сокращены.",
    "return_phase": "На вдохе медленно отпустите рукоять вверх, полностью контролируя растяжение широчайших и не теряя положения корпуса.",
    "mistakes": [
      "Тяга за голову\n Рывок корпусом назад\n Подъём плеч к ушам\n Неполная амплитуда"
    ],
    "breathing": "Выдох при тяге вниз, вдох при возврате вверх.",
    "safety": "Не тяните рукоять за голову — это перегружает плечевые суставы. Сохраняйте умеренный наклон корпуса и контроль лопаток."
  },
  "lat_pulldown_close_or_underhand": {
    "exercise_id": "lat_pulldown_close_or_underhand",
    "exercise_name": "Вертикальная тяга — узкий хват / обратный хват",
    "category": "back",
    "technique_image_url": "/exercises/back/lat_pulldown_close_or_underhand.png",
    "primary_muscles": [
      "lats"
    ],
    "secondary_muscles": [
      "biceps",
      "teres_major",
      "forearms_back"
    ],
    "start_position": "Сядьте в тренажёр, зафиксируйте бёдра, возьмитесь за узкую рукоять или используйте обратный хват. Грудь раскрыта, плечи опущены.",
    "execution": "На выдохе тяните рукоять вниз к верхней части груди или к грудино-ключичной области, ведя локти вниз и ближе к корпусу.",
    "top_position": "В нижней точке рукоять у груди, локти направлены вниз, широчайшие и бицепсы напряжены.",
    "return_phase": "На вдохе плавно выпрямите руки вверх, не позволяя весу резко вытянуть плечи.",
    "mistakes": [
      "Избыточный наклон корпуса\n Рывок руками без включения спины\n Неполное растяжение вверху\n Поднятые плечи"
    ],
    "breathing": "Выдох при тяге, вдох при возврате.",
    "safety": "Не заваливайтесь назад и не выполняйте движение за счёт инерции. Контролируйте положение плечевых суставов."
  },
  "seated_cable_row": {
    "exercise_id": "seated_cable_row",
    "exercise_name": "Горизонтальная тяга сидя (Seated Cable Row)",
    "category": "back",
    "technique_image_url": "/exercises/back/seated_cable_row.png",
    "primary_muscles": [
      "lats"
    ],
    "secondary_muscles": [
      "traps_middle",
      "rear_delts",
      "biceps"
    ],
    "start_position": "Сядьте у нижнего блока, упритесь стопами в платформу, возьмитесь за рукоять. Спина ровная, грудь раскрыта, плечи опущены.",
    "execution": "На выдохе тяните рукоять к поясу или к нижней части живота, сводя лопатки и ведя локти вдоль корпуса.",
    "top_position": "Рукоять у пояса, лопатки сведены, корпус остаётся стабильным без сильного отклонения назад.",
    "return_phase": "На вдохе медленно выпрямите руки вперёд, сохраняя контроль и растяжение мышц спины.",
    "mistakes": [
      "Круглая спина\n Сильная раскачка корпусом\n Тяга к груди вместо пояса\n Бросание веса вперёд"
    ],
    "breathing": "Выдох при тяге к поясу, вдох при возврате.",
    "safety": "Держите поясницу нейтральной и не превращайте упражнение в маятник корпусом."
  },
  "chest_supported_row": {
    "exercise_id": "chest_supported_row",
    "exercise_name": "Горизонтальная тяга в тренажёре (Chest-Supported Row)",
    "category": "back",
    "technique_image_url": "/exercises/back/chest_supported_row.png",
    "primary_muscles": [
      "lats"
    ],
    "secondary_muscles": [
      "traps_middle",
      "rear_delts",
      "biceps"
    ],
    "start_position": "Лягте грудью на опору тренажёра или прижмитесь к подушке, возьмитесь за рукояти. Ноги устойчиво стоят, плечи опущены.",
    "execution": "На выдохе тяните рукояти к корпусу, сводя лопатки и сохраняя грудь прижатой к опоре.",
    "top_position": "Рукояти у корпуса, лопатки сведены, мышцы спины максимально напряжены.",
    "return_phase": "На вдохе плавно верните рукояти вперёд до полного растяжения мышц спины.",
    "mistakes": [
      "Поднятие плеч\n Неполная амплитуда\n Слишком большой вес\n Рывки"
    ],
    "breathing": "Выдох при тяге, вдох при возврате.",
    "safety": "Не отрывайте грудь от опоры и не пытайтесь помогать корпусом. Сосредоточьтесь на работе спины."
  },
  "upper_block_row_to_chest": {
    "exercise_id": "upper_block_row_to_chest",
    "exercise_name": "Тяга верхнего блока к груди",
    "category": "back",
    "technique_image_url": "/exercises/back/upper_block_row_to_chest.png",
    "primary_muscles": [
      "lats"
    ],
    "secondary_muscles": [
      "teres_major",
      "biceps",
      "rear_delts"
    ],
    "start_position": "Сядьте в тренажёр верхнего блока, зафиксируйте бёдра, возьмитесь за рукоять, плечи опущены, грудь раскрыта.",
    "execution": "На выдохе тяните рукоять вниз к груди, начиная движение с опускания лопаток и затем сгибая руки.",
    "top_position": "Рукоять касается или приближается к верхней части груди, локти направлены вниз, спина напряжена.",
    "return_phase": "На вдохе медленно выпрямите руки вверх, сохраняя контроль и растяжение широчайших.",
    "mistakes": [
      "Тяга за голову\n Рывки корпусом\n Поднятые плечи\n Неполная амплитуда"
    ],
    "breathing": "Выдох при тяге вниз, вдох при возврате.",
    "safety": "Сохраняйте стабильный корпус и не тяните рукоять за голову."
  },
  "single_arm_low_cable_row": {
    "exercise_id": "single_arm_low_cable_row",
    "exercise_name": "Тяга нижнего блока одной рукой",
    "category": "back",
    "technique_image_url": "/exercises/back/single_arm_low_cable_row.png",
    "primary_muscles": [
      "lats"
    ],
    "secondary_muscles": [
      "traps_middle",
      "rear_delts",
      "biceps"
    ],
    "start_position": "Сядьте у нижнего блока, возьмитесь одной рукой за рукоять, корпус ровный, свободная рука помогает удерживать положение.",
    "execution": "На выдохе тяните рукоять к поясу одной рукой, сводя лопатку и не разворачивая корпус чрезмерно.",
    "top_position": "Рукоять у пояса, лопатка сведена, широчайшая мышца напряжена.",
    "return_phase": "На вдохе плавно выпрямите руку вперёд, позволяя мышцам спины растянуться под контролем.",
    "mistakes": [
      "Скручивание корпуса\n Рывки\n Поднятое плечо\n Бросание веса вперёд"
    ],
    "breathing": "Выдох при тяге, вдох при возврате.",
    "safety": "Не уводите корпус в сильный разворот. Контролируйте положение плеча и поясницы."
  },
  "machine_hyperextension": {
    "exercise_id": "machine_hyperextension",
    "exercise_name": "Гиперэкстензия в тренажёре",
    "category": "back",
    "technique_image_url": "/exercises/back/machine_hyperextension.png",
    "primary_muscles": [
      "erectors"
    ],
    "secondary_muscles": [
      "glutes",
      "hamstrings"
    ],
    "start_position": "Расположитесь в тренажёре так, чтобы опора приходилась на верхнюю часть бёдер, а таз был свободен. Руки на груди или за головой, спина нейтральна.",
    "execution": "Опускайте корпус вниз, сохраняя нейтральное положение позвоночника, затем на выдохе разгибайте тазобедренные суставы и поднимайтесь вверх до линии тела.",
    "top_position": "Корпус и ноги образуют одну линию, поясница не переразогнута, ягодицы и разгибатели спины напряжены.",
    "return_phase": "На вдохе плавно опустите корпус вниз до комфортного диапазона.",
    "mistakes": [
      "Переразгибание поясницы вверху\n Рывок корпусом\n Слишком большая амплитуда\n Круглая спина"
    ],
    "breathing": "Выдох при подъёме, вдох при опускании.",
    "safety": "Поднимайтесь только до нейтральной линии тела. Не ломайте поясницу в верхней точке."
  },
  "reverse_hyperextension": {
    "exercise_id": "reverse_hyperextension",
    "exercise_name": "Обратная гиперэкстензия (на скамье или в тренажёре)",
    "category": "back",
    "technique_image_url": "/exercises/back/reverse_hyperextension.png",
    "primary_muscles": [
      "glutes"
    ],
    "secondary_muscles": [
      "hamstrings",
      "lower_back"
    ],
    "start_position": "Лягте животом на опору, ноги свободно свисают вниз. Удерживайтесь руками за ручки или края опоры, корпус стабилен.",
    "execution": "На выдохе поднимайте ноги назад и вверх за счёт ягодиц и задней поверхности бедра, не раскачивая корпус.",
    "top_position": "Ноги подняты до линии тела или чуть выше, ягодицы максимально напряжены, поясница не переразогнута.",
    "return_phase": "На вдохе медленно опустите ноги вниз под контролем.",
    "mistakes": [
      "Рывки ногами\n Переразгибание поясницы\n Слишком высокая амплитуда\n Раскачка корпуса"
    ],
    "breathing": "Выдох при подъёме ног, вдох при опускании.",
    "safety": "Не выбрасывайте ноги вверх инерцией. Движение должно идти из таза и ягодиц, а не из поясницы."
  },
  "pull_ups_wide_grip": {
    "exercise_id": "pull_ups_wide_grip",
    "exercise_name": "Подтягивания широким хватом",
    "category": "back",
    "technique_image_url": "/exercises/back/pull_ups_wide_grip.png",
    "primary_muscles": [
      "lats"
    ],
    "secondary_muscles": [
      "teres_major",
      "biceps",
      "forearms_back"
    ],
    "start_position": "Повисните на перекладине широким хватом сверху. Плечи опущены, корпус стабилен, ноги можно слегка согнуть.",
    "execution": "На выдохе подтягивайтесь вверх, направляя локти вниз и в стороны, сводя лопатки и поднимая грудь к перекладине.",
    "top_position": "Подбородок или верх груди приближаются к перекладине, широчайшие максимально напряжены.",
    "return_phase": "На вдохе медленно опуститесь вниз в контролируемый вис, не падая на плечевые суставы.",
    "mistakes": [
      "Рывки и раскачка\n Неполная амплитуда\n Поднятые плечи\n Сутулость в верхней точке"
    ],
    "breathing": "Выдох при подтягивании, вдох при опускании.",
    "safety": "Не провисайте резко внизу. При нехватке силы используйте резину или тренажёр с поддержкой."
  },
  "pull_ups_medium_grip": {
    "exercise_id": "pull_ups_medium_grip",
    "exercise_name": "Подтягивания средним хватом",
    "category": "back",
    "technique_image_url": "/exercises/back/pull_ups_medium_grip.png",
    "primary_muscles": [
      "lats"
    ],
    "secondary_muscles": [
      "biceps",
      "teres_major",
      "forearms_back"
    ],
    "start_position": "Повисните на перекладине хватом чуть шире или на ширине плеч, плечи опущены, корпус стабилен.",
    "execution": "На выдохе подтягивайтесь вверх, ведя локти вниз и назад, сохраняя контроль лопаток.",
    "top_position": "Подбородок выше перекладины, спина и руки напряжены, движение контролируемое.",
    "return_phase": "На вдохе плавно опуститесь вниз до контролируемого виса.",
    "mistakes": [
      "Рывки\n Неполная амплитуда\n Раскачка ногами\n Поднятые плечи"
    ],
    "breathing": "Выдох при подъёме, вдох при опускании.",
    "safety": "Сохраняйте контроль корпуса и не опускайтесь резко в нижнюю точку."
  },
  "chin_ups_underhand_back": {
    "exercise_id": "chin_ups_underhand_back",
    "exercise_name": "Подтягивания обратным хватом («chin-ups»)",
    "category": "back",
    "technique_image_url": "/exercises/back/chin_ups_underhand_back.png",
    "primary_muscles": [
      "lats"
    ],
    "secondary_muscles": [
      "biceps",
      "forearms_back"
    ],
    "start_position": "Повисните на перекладине обратным хватом, кисти на ширине плеч или чуть уже, корпус стабилен.",
    "execution": "На выдохе подтягивайтесь вверх, ведя локти вниз и ближе к корпусу. Грудь тянется к перекладине.",
    "top_position": "Подбородок выше перекладины, широчайшие и бицепсы напряжены, плечи опущены.",
    "return_phase": "На вдохе опуститесь вниз медленно и под контролем.",
    "mistakes": [
      "Рывок из нижней точки\n Раскачка\n Поднятые плечи\n Неполная амплитуда"
    ],
    "breathing": "Выдох при подтягивании, вдох при опускании.",
    "safety": "Не провисайте резко внизу и не выполняйте движение через боль в локтях или плечах."
  },
  "australian_pull_ups": {
    "exercise_id": "australian_pull_ups",
    "exercise_name": "Австралийские подтягивания (тяга в наклоне на брусьях или баре)",
    "category": "back",
    "technique_image_url": "/exercises/back/australian_pull_ups.png",
    "primary_muscles": [
      "lats"
    ],
    "secondary_muscles": [
      "traps_middle",
      "rear_delts",
      "biceps"
    ],
    "start_position": "Расположитесь под низкой перекладиной или на тренажёре, тело вытянуто в линию, пятки на полу, руки держат перекладину.",
    "execution": "На выдохе подтяните грудь к перекладине, сводя лопатки и сохраняя корпус прямым.",
    "top_position": "Грудь близко к перекладине, лопатки сведены, корпус остаётся жёстким.",
    "return_phase": "На вдохе медленно выпрямите руки и вернитесь в стартовое положение.",
    "mistakes": [
      "Провисание таза\n Рывки\n Неполная амплитуда\n Поднятые плечи"
    ],
    "breathing": "Выдох при тяге вверх, вдох при возврате.",
    "safety": "Держите тело прямым и не компенсируйте движение за счёт прогиба в пояснице."
  },
  "bench_or_ball_hyperextension": {
    "exercise_id": "bench_or_ball_hyperextension",
    "exercise_name": "Гиперэкстензия на скамье или фитболе",
    "category": "back",
    "technique_image_url": "/exercises/back/bench_or_ball_hyperextension.png",
    "primary_muscles": [
      "erectors"
    ],
    "secondary_muscles": [
      "glutes",
      "hamstrings"
    ],
    "start_position": "Расположитесь на скамье или фитболе так, чтобы таз был опорой, а корпус мог свободно двигаться. Спина нейтральна, руки на груди или за головой.",
    "execution": "На выдохе поднимайте корпус вверх за счёт разгибания в тазобедренных суставах, сохраняя нейтральную спину.",
    "top_position": "Корпус и ноги образуют одну линию, ягодицы и разгибатели спины напряжены.",
    "return_phase": "На вдохе плавно опустите корпус вниз до комфортной точки.",
    "mistakes": [
      "Переразгибание поясницы\n Рывки\n Круглая спина\n Слишком быстрый темп"
    ],
    "breathing": "Выдох при подъёме, вдох при опускании.",
    "safety": "Не поднимайтесь выше линии тела и не теряйте контроль корпуса на нестабильной поверхности."
  },
  "superman_hold": {
    "exercise_id": "superman_hold",
    "exercise_name": "«Супермен» (статическое удержание лёжа)",
    "category": "back",
    "technique_image_url": "/exercises/back/superman_hold.png",
    "primary_muscles": [
      "erectors"
    ],
    "secondary_muscles": [
      "glutes",
      "rear_delts"
    ],
    "start_position": "Лягте на живот, руки вытянуты вперёд или вдоль корпуса, ноги прямые. Шея в нейтральном положении.",
    "execution": "Поднимите руки, грудь и ноги от пола и удерживайте позицию заданное время, сохраняя мягкое напряжение всей задней цепи.",
    "top_position": "Корпус слегка оторван от пола, мышцы спины, ягодицы и задние дельты напряжены, дыхание сохраняется ровным.",
    "return_phase": "Медленно опуститесь обратно на пол и расслабьтесь перед следующим повторением.",
    "mistakes": [
      "Резкое переразгибание шеи\n Слишком высокая амплитуда\n Задержка дыхания\n Рывок при подъёме"
    ],
    "breathing": "Дышите спокойно и равномерно на протяжении удержания.",
    "safety": "Не поднимайтесь слишком высоко. При дискомфорте в пояснице уменьшите амплитуду или время удержания."
  },
  "t_bar_row": {
    "exercise_id": "t_bar_row",
    "exercise_name": "Тяга Т-грифа (T-Bar Row)",
    "category": "back",
    "technique_image_url": "/exercises/back/t_bar_row.png",
    "primary_muscles": [
      "lats"
    ],
    "secondary_muscles": [
      "traps_middle",
      "rear_delts",
      "biceps",
      "erectors"
    ],
    "start_position": "Встаньте в исходное положение у Т-грифа, корпус наклонён, спина нейтральна, рукоять удерживается обеими руками.",
    "execution": "На выдохе тяните рукоять к нижней части груди или к поясу, сводя лопатки и удерживая корпус стабильно.",
    "top_position": "В верхней точке рукоять близко к корпусу, лопатки сведены, мышцы спины напряжены.",
    "return_phase": "На вдохе медленно опустите рукоять вниз, сохраняя контроль амплитуды.",
    "mistakes": [
      "Круглая спина\n Рывки корпусом\n Слишком большой вес\n Поднятые плечи"
    ],
    "breathing": "Выдох при тяге, вдох при возврате.",
    "safety": "Держите нейтральную поясницу и не превращайте упражнение в рывок всем телом."
  },
  "inverted_row_machine": {
    "exercise_id": "inverted_row_machine",
    "exercise_name": "Тяга в тренажёре «Горка» (Inverted Row Machine)",
    "category": "back",
    "technique_image_url": "/exercises/back/inverted_row_machine.png",
    "primary_muscles": [
      "lats"
    ],
    "secondary_muscles": [
      "traps_middle",
      "rear_delts",
      "biceps"
    ],
    "start_position": "Возьмитесь за рукояти тренажёра, тело вытянуто в линию или в заданной траектории тренажёра, плечи опущены.",
    "execution": "На выдохе тяните корпус или рукояти по траектории тренажёра, сводя лопатки и ведя локти назад.",
    "top_position": "В верхней точке грудь приближается к рукоятям, спина напряжена, корпус остаётся стабильным.",
    "return_phase": "На вдохе плавно вернитесь в исходное положение без потери контроля.",
    "mistakes": [
      "Провисание корпуса\n Рывки\n Неполная амплитуда\n Поднятые плечи"
    ],
    "breathing": "Выдох при тяге, вдох при возврате.",
    "safety": "Сохраняйте жёсткую линию тела и контролируйте лопатки на всём движении."
  },
  "rope_row_bent_over": {
    "exercise_id": "rope_row_bent_over",
    "exercise_name": "Тяга каната к поясу в наклоне",
    "category": "back",
    "technique_image_url": "/exercises/back/rope_row_bent_over.png",
    "primary_muscles": [
      "lats"
    ],
    "secondary_muscles": [
      "traps_middle",
      "rear_delts",
      "biceps"
    ],
    "start_position": "Возьмитесь за канат нижнего блока, отойдите назад и наклоните корпус вперёд с ровной спиной. Колени слегка согнуты.",
    "execution": "На выдохе тяните канат к поясу, разводя концы каната и сводя лопатки.",
    "top_position": "Кисти у пояса или нижней части живота, лопатки сведены, мышцы спины напряжены.",
    "return_phase": "На вдохе плавно выпрямите руки вперёд, сохраняя натяжение и контроль каната.",
    "mistakes": [
      "Рывок корпусом\n Круглая спина\n Тяга к груди вместо пояса\n Слишком тяжёлый вес"
    ],
    "breathing": "Выдох при тяге, вдох при возврате.",
    "safety": "Не теряйте нейтральное положение спины и не позволяйте блоку утягивать корпус вперёд."
  },
  "barbell_back_squat": {
    "exercise_id": "barbell_back_squat",
    "exercise_name": "Приседания со штангой на плечах",
    "category": "legs",
    "technique_image_url": "/exercises/legs/barbell_back_squat.png",
    "primary_muscles": [
      "quads"
    ],
    "secondary_muscles": [
      "glutes",
      "hamstrings",
      "erectors",
      "adductors"
    ],
    "start_position": "Установите штангу на верхнюю часть трапеций, сведите лопатки, стопы поставьте на ширине плеч, носки слегка разведите. Корпус напряжён, взгляд направлен вперёд.",
    "execution": "На вдохе отведите таз назад и вниз, одновременно сгибая колени. Опускайтесь под контролем, сохраняя спину нейтральной и равномерно распределяя вес по стопе.",
    "top_position": "В нижней точке бёдра как минимум параллельны полу или ниже, колени направлены по линии носков, пятки не отрываются.",
    "return_phase": "На выдохе разгибайте колени и таз, возвращаясь вверх через всю стопу.",
    "mistakes": [
      "Сведение коленей внутрь\n Круглая спина\n Смещение веса на носки\n Недостаточная глубина без контроля\n Переразгибание поясницы вверху"
    ],
    "breathing": "Вдох при опускании, выдох при подъёме.",
    "safety": "Перед рабочими подходами разомните тазобедренные и голеностоп. Не увеличивайте вес ценой потери нейтральной спины."
  },
  "front_squat": {
    "exercise_id": "front_squat",
    "exercise_name": "Приседания со штангой спереди",
    "category": "legs",
    "technique_image_url": "/exercises/legs/front_squat.png",
    "primary_muscles": [
      "quads"
    ],
    "secondary_muscles": [
      "glutes",
      "erectors",
      "abs",
      "adductors"
    ],
    "start_position": "Разместите штангу на передней поверхности плеч, локти направьте вперёд и вверх. Стопы на ширине таза или плеч, грудь раскрыта, корпус жёсткий.",
    "execution": "На вдохе опускайтесь вниз, сохраняя вертикальный корпус и высокий локоть. Колени движутся вперёд по линии носков, таз опускается между стоп.",
    "top_position": "В нижней точке таз находится ниже или на уровне колен, штанга остаётся на плечах, локти не опускаются вниз.",
    "return_phase": "На выдохе поднимайтесь вверх, сохраняя высокие локти и нейтральную спину.",
    "mistakes": [
      "Падение локтей вниз\n Сутулость грудного отдела\n Сведение коленей внутрь\n Смещение штанги вперёд\n Отрыв пяток"
    ],
    "breathing": "Вдох при опускании, выдох при подъёме.",
    "safety": "Следите за подвижностью голеностопа и грудного отдела. Если не можете удерживать локти высоко, уменьшите вес."
  },
  "stiff_leg_deadlift": {
    "exercise_id": "stiff_leg_deadlift",
    "exercise_name": "Становая тяга на прямых ногах («становая тяга» классическая)",
    "category": "legs",
    "technique_image_url": "/exercises/legs/stiff_leg_deadlift.png",
    "primary_muscles": [
      "hamstrings"
    ],
    "secondary_muscles": [
      "glutes",
      "erectors",
      "lats"
    ],
    "start_position": "Встаньте прямо со штангой в руках, стопы на ширине таза, колени слегка мягкие, лопатки собраны. Штанга касается бёдер.",
    "execution": "На вдохе отведите таз назад и ведите штангу вниз вдоль ног, сохраняя почти прямые ноги и нейтральную спину. Движение идёт из тазобедренных суставов.",
    "top_position": "В нижней точке ощущается сильное растяжение задней поверхности бедра, штанга близко к ногам, поясница стабильна.",
    "return_phase": "На выдохе разгибайте таз, поднимая корпус вверх и сокращая ягодицы и заднюю поверхность бедра.",
    "mistakes": [
      "Круглая спина\n Увод штанги далеко от ног\n Слишком жёстко заблокированные колени\n Рывковый подъём"
    ],
    "breathing": "Вдох при опускании, выдох при подъёме.",
    "safety": "Не опускайте штангу ниже точки, где можете удерживать нейтральную спину."
  },
  "barbell_lunge": {
    "exercise_id": "barbell_lunge",
    "exercise_name": "Выпады со штангой",
    "category": "legs",
    "technique_image_url": "/exercises/legs/barbell_lunge.png",
    "primary_muscles": [
      "quads"
    ],
    "secondary_muscles": [
      "glutes",
      "hamstrings",
      "adductors",
      "erectors"
    ],
    "start_position": "Штанга лежит на верхней части спины, стопы на ширине таза, корпус прямой. Напрягите пресс и стабилизируйте таз.",
    "execution": "Сделайте шаг вперёд или назад и опуститесь вниз, пока оба колена не будут согнуты примерно под 90 градусов. Передняя нога несёт основную нагрузку.",
    "top_position": "В нижней точке переднее колено смотрит по линии носка, заднее колено направлено вниз, корпус остаётся вертикальным.",
    "return_phase": "Через пятку передней ноги вернитесь в исходную стойку и повторите на другую сторону.",
    "mistakes": [
      "Завал колена внутрь\n Слишком короткий шаг\n Наклон корпуса вперёд\n Потеря баланса"
    ],
    "breathing": "Вдох при опускании, выдох при возвращении.",
    "safety": "Начинайте с умеренного веса, пока не освоите баланс и стабилизацию таза."
  },
  "hack_squat": {
    "exercise_id": "hack_squat",
    "exercise_name": "Гакк-присед (если используется штанга в специальном станке)",
    "category": "legs",
    "technique_image_url": "/exercises/legs/hack_squat.png",
    "primary_muscles": [
      "quads"
    ],
    "secondary_muscles": [
      "glutes",
      "hamstrings",
      "adductors"
    ],
    "start_position": "Встаньте в тренажёр гакк-приседа, спина и таз плотно прижаты к опоре, стопы расположены на платформе немного впереди корпуса.",
    "execution": "На вдохе опускайтесь вниз по траектории тренажёра, сгибая колени и тазобедренные суставы.",
    "top_position": "В нижней точке бёдра опускаются до комфортной глубины без отрыва таза и поясницы от опоры.",
    "return_phase": "На выдохе выжмите платформу вверх, сохраняя опору на всю стопу и не блокируя колени.",
    "mistakes": [
      "Отрыв поясницы от опоры\n Завал коленей внутрь\n Слишком узкая постановка стоп\n Полная блокировка коленей"
    ],
    "breathing": "Вдох при опускании, выдох при подъёме.",
    "safety": "Подберите положение стоп так, чтобы не было дискомфорта в коленях. Не работайте в чрезмерно глубокой амплитуде."
  },
  "dumbbell_lunge_variations": {
    "exercise_id": "dumbbell_lunge_variations",
    "exercise_name": "Выпады с гантелями (вперёд, назад, в стороны)",
    "category": "legs",
    "technique_image_url": "/exercises/legs/dumbbell_lunge_variations.png",
    "primary_muscles": [
      "quads"
    ],
    "secondary_muscles": [
      "glutes",
      "hamstrings",
      "adductors",
      "abductors"
    ],
    "start_position": "Встаньте прямо, гантели удерживайте вдоль тела, плечи опущены, корпус стабилен. Стопы на ширине таза.",
    "execution": "Для выпада вперёд или назад сделайте шаг и опуститесь вниз, сохраняя контроль колена и таза. Для бокового выпада уводите таз назад и переносите вес на рабочую ногу.",
    "top_position": "В нижней точке рабочая нога принимает основную нагрузку, колено направлено по линии стопы, таз остаётся под контролем.",
    "return_phase": "Через пятку рабочей ноги вернитесь в исходную стойку и повторите нужное направление.",
    "mistakes": [
      "Потеря баланса\n Сведение колена внутрь\n Слишком короткий шаг\n Провал корпуса вперёд"
    ],
    "breathing": "Вдох при опускании, выдох при возвращении.",
    "safety": "Начинайте с небольшого веса и отрабатывайте стабильность. Для боковых выпадов следите за коленом особенно внимательно."
  },
  "dumbbell_bulgarian_split_squat": {
    "exercise_id": "dumbbell_bulgarian_split_squat",
    "exercise_name": "Болгарские сплит-приседания с гантелями",
    "category": "legs",
    "technique_image_url": "/exercises/legs/dumbbell_bulgarian_split_squat.png",
    "primary_muscles": [
      "quads"
    ],
    "secondary_muscles": [
      "glutes",
      "hamstrings",
      "adductors"
    ],
    "start_position": "Поставьте заднюю ногу на скамью, переднюю — на комфортное расстояние вперёд. Гантели держите вдоль тела, корпус слегка наклонён вперёд, таз стабилен.",
    "execution": "На вдохе опускайтесь вниз на передней ноге, сгибая колено и тазобедренный сустав. Задняя нога служит опорой.",
    "top_position": "В нижней точке переднее бедро близко к параллели, колено не заваливается внутрь, таз остаётся ровным.",
    "return_phase": "На выдохе оттолкнитесь пяткой передней ноги и вернитесь в исходное положение.",
    "mistakes": [
      "Слишком близкая постановка передней ноги\n Потеря баланса\n Завал колена внутрь\n Чрезмерный прогиб в пояснице"
    ],
    "breathing": "Вдох при опускании, выдох при подъёме.",
    "safety": "Не ставьте переднюю стопу слишком близко к скамье. Сначала отработайте движение без большого веса."
  },
  "goblet_squat": {
    "exercise_id": "goblet_squat",
    "exercise_name": "Приседания с гантелью («гантель у груди»)",
    "category": "legs",
    "technique_image_url": "/exercises/legs/goblet_squat.png",
    "primary_muscles": [
      "quads"
    ],
    "secondary_muscles": [
      "glutes",
      "adductors",
      "abs",
      "erectors"
    ],
    "start_position": "Держите одну гантель вертикально у груди обеими руками. Стопы на ширине плеч, грудь раскрыта, локти направлены вниз.",
    "execution": "На вдохе опускайтесь вниз, удерживая гантель у груди и сохраняя корпус максимально вертикальным.",
    "top_position": "В нижней точке таз опускается глубоко между стоп, локти могут касаться внутренней поверхности бёдер, спина остаётся нейтральной.",
    "return_phase": "На выдохе поднимайтесь вверх, сохраняя положение гантели и напряжение корпуса.",
    "mistakes": [
      "Завал коленей внутрь\n Потеря вертикали корпуса\n Отрыв пяток\n Слишком быстрый темп"
    ],
    "breathing": "Вдох при опускании, выдох при подъёме.",
    "safety": "Не позволяйте гантели уводить корпус вперёд. Работайте в глубине, которую можете контролировать."
  },
  "single_leg_rdl": {
    "exercise_id": "single_leg_rdl",
    "exercise_name": "Становая тяга на одной ноге с гантелью («пуловер на одной ноге»)",
    "category": "legs",
    "technique_image_url": "/exercises/legs/single_leg_rdl.png",
    "primary_muscles": [
      "hamstrings"
    ],
    "secondary_muscles": [
      "glutes",
      "erectors",
      "abductors"
    ],
    "start_position": "Встаньте на одну ногу, в свободной руке или двух руках держите гантель. Опорное колено слегка согнуто, таз ровный, спина нейтральна.",
    "execution": "На вдохе отведите таз назад и наклоните корпус вперёд, одновременно отводя свободную ногу назад. Гантель движется вниз близко к опорной ноге.",
    "top_position": "В нижней точке корпус и свободная нога образуют почти прямую линию, таз не разворачивается в сторону.",
    "return_phase": "На выдохе разгибайте таз и возвращайтесь в вертикальное положение, удерживая баланс.",
    "mistakes": [
      "Разворот таза\n Круглая спина\n Потеря баланса из-за рывка\n Слишком глубокий наклон без контроля"
    ],
    "breathing": "Вдох при наклоне, выдох при подъёме.",
    "safety": "Начинайте с лёгкой гантели или без веса. Важнее стабильность таза и баланс, чем большая нагрузка."
  },
  "kettlebell_swing": {
    "exercise_id": "kettlebell_swing",
    "exercise_name": "Махи гирей (kettlebell swing)",
    "category": "legs",
    "technique_image_url": "/exercises/legs/kettlebell_swing.png",
    "primary_muscles": [
      "glutes"
    ],
    "secondary_muscles": [
      "hamstrings",
      "erectors",
      "abs"
    ],
    "start_position": "Встаньте чуть шире плеч, гиря перед вами. Возьмитесь двумя руками, отведите плечи вниз, спина нейтральна.",
    "execution": "Отведите гирю между ног за счёт сгибания в тазобедренном суставе, затем взрывно разогните таз и отправьте гирю вперёд и вверх до уровня груди.",
    "top_position": "В верхней точке гиря поднимается инерцией от работы таза, ягодицы напряжены, корпус прямой, руки лишь направляют движение.",
    "return_phase": "Позвольте гире вернуться вниз, снова отведите таз назад и примите нагрузку задней цепью.",
    "mistakes": [
      "Подъём гири руками вместо работы тазом\n Присед вместо hinge-движения\n Круглая спина\n Переразгибание поясницы"
    ],
    "breathing": "Короткий выдох в момент взрывного разгибания таза, вдох при возврате гири вниз.",
    "safety": "Не поднимайте гирю плечами. Движение должно идти из таза. Начинайте с умеренного веса и чёткой техники."
  },
  "dumbbell_calf_raise": {
    "exercise_id": "dumbbell_calf_raise",
    "exercise_name": "Подъёмы на носки с гантелями",
    "category": "legs",
    "technique_image_url": "/exercises/legs/dumbbell_calf_raise.png",
    "primary_muscles": [
      "calves"
    ],
    "secondary_muscles": [
      "calves_front"
    ],
    "start_position": "Встаньте прямо, гантели в руках вдоль тела, носки на полу или на небольшом возвышении, пятки свободны.",
    "execution": "Поднимайтесь на носки максимально высоко, перенося вес на подушечки стоп. В верхней точке сделайте короткую паузу.",
    "top_position": "Пятки высоко подняты, икроножные мышцы максимально сокращены, корпус стабилен.",
    "return_phase": "Медленно опустите пятки вниз до полного растяжения икр, если используете возвышение.",
    "mistakes": [
      "Рывки\n Короткая амплитуда\n Смещение веса на внешнюю или внутреннюю часть стопы\n Слишком быстрый темп"
    ],
    "breathing": "Выдох при подъёме на носки, вдох при опускании.",
    "safety": "Держите движение плавным и не раскачивайтесь корпусом. При проблемах с ахиллом избегайте резких опусканий."
  },
  "leg_press": {
    "exercise_id": "leg_press",
    "exercise_name": "Жим ногами (Leg Press)",
    "category": "legs",
    "technique_image_url": "/exercises/legs/leg_press.png",
    "primary_muscles": [
      "quads"
    ],
    "secondary_muscles": [
      "glutes",
      "hamstrings"
    ],
    "start_position": "Сядьте в тренажёр, стопы поставьте на платформу на ширине плеч, спина и таз плотно прижаты к спинке.",
    "execution": "На вдохе опустите платформу, сгибая колени до комфортной глубины. На выдохе выжмите платформу вверх, сохраняя опору на всю стопу.",
    "top_position": "В нижней точке колени согнуты под контролем, поясница не отрывается от спинки, таз стабилен.",
    "return_phase": "Поднимайте платформу вверх без рывка, не блокируя колени в конце движения.",
    "mistakes": [
      "Отрыв поясницы от спинки\n Полная блокировка коленей\n Слишком глубокое опускание без контроля\n Завал коленей внутрь"
    ],
    "breathing": "Вдох при опускании, выдох при жиме вверх.",
    "safety": "Не отрывайте таз от спинки. Работайте в диапазоне, где сохраняете нейтральное положение поясницы."
  },
  "lying_leg_curl": {
    "exercise_id": "lying_leg_curl",
    "exercise_name": "Сгибание ног лёжа",
    "category": "legs",
    "technique_image_url": "/exercises/legs/lying_leg_curl.png",
    "primary_muscles": [
      "hamstrings"
    ],
    "secondary_muscles": [
      "calves"
    ],
    "start_position": "Лягте в тренажёр лицом вниз, колени совпадают с осью вращения, валик расположен над ахиллами. Таз прижат к опоре.",
    "execution": "На выдохе согните ноги в коленях, подтягивая валик к ягодицам без отрыва таза.",
    "top_position": "В верхней точке задняя поверхность бедра максимально напряжена, таз остаётся прижатым к скамье.",
    "return_phase": "На вдохе плавно опустите валик вниз до почти полного разгибания ног.",
    "mistakes": [
      "Отрыв таза\n Рывки\n Слишком короткая амплитуда\n Чрезмерный вес"
    ],
    "breathing": "Выдох при сгибании, вдох при опускании.",
    "safety": "Следите за положением коленей относительно оси тренажёра и не бросайте вес вниз."
  },
  "seated_leg_extension": {
    "exercise_id": "seated_leg_extension",
    "exercise_name": "Разгибание ног сидя",
    "category": "legs",
    "technique_image_url": "/exercises/legs/seated_leg_extension.png",
    "primary_muscles": [
      "quads"
    ],
    "secondary_muscles": [
      "calves_front"
    ],
    "start_position": "Сядьте в тренажёр, спина прижата к спинке, валик расположен над голеностопом, колени совпадают с осью вращения.",
    "execution": "На выдохе разогните ноги в коленях, поднимая валик вверх до почти полного выпрямления.",
    "top_position": "В верхней точке квадрицепсы напряжены, колени почти выпрямлены без жёсткой блокировки.",
    "return_phase": "На вдохе медленно согните ноги обратно до исходного положения.",
    "mistakes": [
      "Резкая блокировка коленей\n Слишком тяжёлый вес\n Рывки\n Отрыв таза от сиденья"
    ],
    "breathing": "Выдох при разгибании, вдох при возврате.",
    "safety": "Не разгибайте колени с рывком. Подбирайте вес, при котором можно контролировать движение без боли в суставах."
  },
  "machine_leg_kickback": {
    "exercise_id": "machine_leg_kickback",
    "exercise_name": "Тяга ног назад в тренажёре",
    "category": "legs",
    "technique_image_url": "/exercises/legs/machine_leg_kickback.png",
    "primary_muscles": [
      "glutes"
    ],
    "secondary_muscles": [
      "hamstrings"
    ],
    "start_position": "Установите ногу на платформу или валик тренажёра, корпус стабилен, таз ровный, опорная нога слегка согнута.",
    "execution": "На выдохе отведите рабочую ногу назад, разгибая тазобедренный сустав и сокращая ягодицу.",
    "top_position": "В конечной точке ягодичная мышца напряжена, корпус не прогибается в пояснице.",
    "return_phase": "На вдохе плавно верните ногу в исходное положение под контролем.",
    "mistakes": [
      "Разворот таза\n Прогиб в пояснице\n Рывки ногой\n Слишком высокая амплитуда"
    ],
    "breathing": "Выдох при отведении назад, вдох при возврате.",
    "safety": "Движение должно идти из ягодицы, а не из поясницы. Сохраняйте таз неподвижным."
  },
  "machine_glute_kickback": {
    "exercise_id": "machine_glute_kickback",
    "exercise_name": "Отведение ног назад (в тренажёре)",
    "category": "legs",
    "technique_image_url": "/exercises/legs/machine_glute_kickback.png",
    "primary_muscles": [
      "glutes"
    ],
    "secondary_muscles": [
      "hamstrings"
    ],
    "start_position": "Расположитесь в тренажёре, зафиксируйте корпус, установите рабочую ногу на упор. Таз ровный, пресс напряжён.",
    "execution": "На выдохе отведите ногу назад по траектории тренажёра, сохраняя контроль таза.",
    "top_position": "В верхней точке ягодица сокращена, корпус не уходит в прогиб.",
    "return_phase": "На вдохе плавно верните ногу вперёд в стартовую позицию.",
    "mistakes": [
      "Прогиб в пояснице\n Рывок\n Разворот таза\n Слишком быстрый возврат"
    ],
    "breathing": "Выдох при отведении, вдох при возврате.",
    "safety": "Сохраняйте нейтральное положение корпуса. Не пытайтесь увеличить амплитуду за счёт поясницы."
  },
  "machine_hip_abduction": {
    "exercise_id": "machine_hip_abduction",
    "exercise_name": "Отведение ног в стороны (в тренажёре)",
    "category": "legs",
    "technique_image_url": "/exercises/legs/machine_hip_abduction.png",
    "primary_muscles": [
      "abductors"
    ],
    "secondary_muscles": [
      "glutes"
    ],
    "start_position": "Сядьте в тренажёр для отведения бёдер, плотно прижмитесь к спинке, стопы поставьте на платформы, колени упираются в подушки.",
    "execution": "На выдохе разведите колени в стороны, преодолевая сопротивление тренажёра.",
    "top_position": "В крайней точке мышцы внешней поверхности бедра и ягодицы напряжены, таз остаётся неподвижным.",
    "return_phase": "На вдохе плавно сведите ноги обратно, сохраняя контроль веса.",
    "mistakes": [
      "Рывки\n Слишком быстрый возврат\n Отклонение корпуса назад\n Чрезмерный вес"
    ],
    "breathing": "Выдох при разведении, вдох при возврате.",
    "safety": "Не помогайте себе корпусом. Держите движение плавным и контролируемым."
  },
  "machine_hip_adduction": {
    "exercise_id": "machine_hip_adduction",
    "exercise_name": "Приведение ног (в тренажёре)",
    "category": "legs",
    "technique_image_url": "/exercises/legs/machine_hip_adduction.png",
    "primary_muscles": [
      "adductors"
    ],
    "secondary_muscles": [
      "glutes"
    ],
    "start_position": "Сядьте в тренажёр для приведения бёдер, спина прижата к спинке, ноги разведены и опираются на подушки.",
    "execution": "На выдохе сведите ноги к центру, сокращая внутреннюю поверхность бедра.",
    "top_position": "В конечной точке приводящие мышцы максимально напряжены, таз остаётся стабилен.",
    "return_phase": "На вдохе плавно разведите ноги обратно до контролируемого растяжения.",
    "mistakes": [
      "Рывки\n Чрезмерный вес\n Потеря контроля в негативной фазе\n Отклонение корпуса"
    ],
    "breathing": "Выдох при сведении, вдох при разведении.",
    "safety": "Не бросайте вес и не доводите движение до болезненного растяжения паховой области."
  },
  "calf_raise_variations": {
    "exercise_id": "calf_raise_variations",
    "exercise_name": "Подъёмы на носки сидя или стоя",
    "category": "legs",
    "technique_image_url": "/exercises/legs/calf_raise_variations.png",
    "primary_muscles": [
      "calves"
    ],
    "secondary_muscles": [
      "calves_front"
    ],
    "start_position": "Примите положение для сидячего или стоячего подъёма на носки, стопы установите на платформу или пол, пятки свободны.",
    "execution": "Поднимитесь на носки максимально высоко, сокращая икроножные мышцы. Сделайте короткую паузу наверху.",
    "top_position": "В верхней точке икры напряжены, вес распределён на подушечки стоп.",
    "return_phase": "Медленно опустите пятки вниз до комфортного растяжения.",
    "mistakes": [
      "Рывки\n Короткая амплитуда\n Быстрый темп без паузы\n Смещение стоп"
    ],
    "breathing": "Выдох при подъёме, вдох при опускании.",
    "safety": "Используйте полную, но контролируемую амплитуду. Не опускайте пятки резко вниз."
  },
  "bodyweight_squat": {
    "exercise_id": "bodyweight_squat",
    "exercise_name": "Приседания (классические)",
    "category": "legs",
    "technique_image_url": "/exercises/legs/bodyweight_squat.png",
    "primary_muscles": [
      "quads",
      "glutes"
    ],
    "secondary_muscles": [
      "adductors",
      "erectors"
    ],
    "start_position": "Встаньте прямо, стопы на ширине плеч или чуть шире, носки слегка разведены, корпус собран.",
    "execution": "На вдохе отведите таз назад и вниз, сгибая колени и удерживая грудную клетку раскрытой.",
    "top_position": "В нижней точке пятки прижаты к полу, колени идут по линии стоп, спина сохраняет нейтраль.",
    "return_phase": "На выдохе разгибайте ноги и таз, возвращаясь в исходное положение.",
    "mistakes": [
      "Сведение коленей внутрь\n Сутулость\n Смещение на носки\n Недостаточная глубина"
    ],
    "breathing": "Вдох при опускании, выдох при подъёме.",
    "safety": "Даже без веса сохраняйте контроль коленей и устойчивость стоп."
  },
  "bodyweight_lunges": {
    "exercise_id": "bodyweight_lunges",
    "exercise_name": "Выпады (вперёд, назад, в стороны)",
    "category": "legs",
    "technique_image_url": "/exercises/legs/bodyweight_lunges.png",
    "primary_muscles": [
      "quads",
      "glutes"
    ],
    "secondary_muscles": [
      "hamstrings",
      "adductors"
    ],
    "start_position": "Встаньте прямо, стопы на ширине таза, руки на поясе или перед собой для баланса.",
    "execution": "Сделайте шаг в нужном направлении и опуститесь вниз, сохраняя контроль таза и корпуса.",
    "top_position": "В нижней точке рабочая нога принимает основную нагрузку, колено стабильно, корпус не заваливается.",
    "return_phase": "На выдохе вернитесь в исходное положение за счёт усилия рабочей ноги.",
    "mistakes": [
      "Слишком короткий шаг\n Колено внутрь\n Потеря равновесия\n Наклон корпуса вперёд"
    ],
    "breathing": "Вдох при опускании, выдох при возврате.",
    "safety": "Не спешите между повторениями. Стабильность важнее темпа."
  },
  "bulgarian_split_squat_bodyweight": {
    "exercise_id": "bulgarian_split_squat_bodyweight",
    "exercise_name": "Болгарские сплит-приседания (нога на скамье)",
    "category": "legs",
    "technique_image_url": "/exercises/legs/bulgarian_split_squat_bodyweight.png",
    "primary_muscles": [
      "quads",
      "glutes"
    ],
    "secondary_muscles": [
      "hamstrings",
      "adductors"
    ],
    "start_position": "Поставьте заднюю ногу на скамью, передняя стопа устойчиво впереди. Корпус ровный, таз направлен вперёд.",
    "execution": "На вдохе опускайтесь вниз, сгибая переднюю ногу и контролируя положение таза.",
    "top_position": "В нижней точке переднее бедро близко к параллели, колено стабильно, задняя нога служит опорой.",
    "return_phase": "На выдохе поднимайтесь вверх за счёт передней ноги.",
    "mistakes": [
      "Слишком близкая постановка передней ноги\n Потеря баланса\n Завал колена внутрь\n Сильный наклон корпуса"
    ],
    "breathing": "Вдох при опускании, выдох при подъёме.",
    "safety": "Подберите длину шага до подхода. Не проваливайтесь вниз без контроля."
  },
  "glute_bridge": {
    "exercise_id": "glute_bridge",
    "exercise_name": "Мостик (ягодичный мост)",
    "category": "glutes",
    "technique_image_url": "/exercises/glutes/glute_bridge.png",
    "primary_muscles": [
      "glutes"
    ],
    "secondary_muscles": [
      "hamstrings",
      "abs"
    ],
    "start_position": "Лягте на спину, согните ноги, стопы на полу на ширине таза. Руки вдоль корпуса, таз нейтрален.",
    "execution": "На выдохе поднимайте таз вверх, отталкиваясь пятками и сокращая ягодицы.",
    "top_position": "В верхней точке корпус от плеч до коленей образует линию, ягодицы напряжены, поясница не переразогнута.",
    "return_phase": "На вдохе плавно опустите таз вниз под контролем.",
    "mistakes": [
      "Подъём за счёт поясницы\n Опора на носки вместо пяток\n Слишком широкая постановка стоп\n Отсутствие паузы вверху"
    ],
    "breathing": "Выдох при подъёме, вдох при опускании.",
    "safety": "Фокусируйтесь на сокращении ягодиц, а не на высоте моста."
  },
  "single_leg_glute_bridge": {
    "exercise_id": "single_leg_glute_bridge",
    "exercise_name": "Мостик с одной ногой",
    "category": "glutes",
    "technique_image_url": "/exercises/glutes/single_leg_glute_bridge.png",
    "primary_muscles": [
      "glutes"
    ],
    "secondary_muscles": [
      "hamstrings",
      "abs",
      "abductors"
    ],
    "start_position": "Лягте на спину, одна стопа на полу, другая нога поднята. Таз ровный, корпус стабилен.",
    "execution": "На выдохе поднимайте таз вверх за счёт опорной ноги, не разворачивая таз.",
    "top_position": "В верхней точке ягодица опорной ноги максимально напряжена, таз остаётся симметричным.",
    "return_phase": "На вдохе плавно опустите таз вниз, сохраняя контроль.",
    "mistakes": [
      "Провал таза в сторону\n Толчок носком\n Переразгибание поясницы\n Слишком быстрый темп"
    ],
    "breathing": "Выдох при подъёме, вдох при опускании.",
    "safety": "Если таз уходит в сторону, уменьшите амплитуду или вернитесь к варианту на двух ногах."
  },
  "wall_calf_raise": {
    "exercise_id": "wall_calf_raise",
    "exercise_name": "Подъёмы на носки у стены",
    "category": "legs",
    "technique_image_url": "/exercises/legs/wall_calf_raise.png",
    "primary_muscles": [
      "calves"
    ],
    "secondary_muscles": [
      "calves_front"
    ],
    "start_position": "Встаньте лицом к стене, слегка упритесь руками для равновесия. Стопы на ширине таза.",
    "execution": "На выдохе поднимайтесь на носки как можно выше, сохраняя давление через переднюю часть стопы.",
    "top_position": "В верхней точке икры напряжены, пятки высоко подняты, пауза короткая.",
    "return_phase": "На вдохе медленно опустите пятки вниз до растяжения икр.",
    "mistakes": [
      "Пружинящее выполнение\n Короткая амплитуда\n Смещение веса на наружный край стопы\n Слишком быстрый темп"
    ],
    "breathing": "Выдох при подъёме, вдох при опускании.",
    "safety": "Не раскачивайтесь вперёд-назад. При необходимости используйте небольшую опору под носки."
  },
  "wall_sit": {
    "exercise_id": "wall_sit",
    "exercise_name": "«Стульчик» у стены (статическое удержание)",
    "category": "legs",
    "technique_image_url": "/exercises/legs/wall_sit.png",
    "primary_muscles": [
      "quads"
    ],
    "secondary_muscles": [
      "glutes",
      "abs"
    ],
    "start_position": "Прижмитесь спиной к стене и сползите вниз, пока колени не будут примерно под углом 90 градусов. Стопы стоят чуть впереди коленей.",
    "execution": "Удерживайте положение заданное время, сохраняя плотный контакт спины со стеной и напряжение ног.",
    "top_position": "Работа статическая: квадрицепсы и ягодицы напряжены, колени стабильны, таз не смещается.",
    "return_phase": "Для завершения аккуратно поднимитесь вверх по стене или выпрямите ноги без рывка.",
    "mistakes": [
      "Колени уходят внутрь\n Слишком высокая или низкая посадка\n Отрыв спины от стены\n Задержка дыхания"
    ],
    "breathing": "Дышите ровно и спокойно в течение удержания.",
    "safety": "Не опускайтесь ниже диапазона, который можете удерживать без боли в коленях."
  },
  "jump_squat": {
    "exercise_id": "jump_squat",
    "exercise_name": "Прыжки в приседе (плиометрика)",
    "category": "legs",
    "technique_image_url": "/exercises/legs/jump_squat.png",
    "primary_muscles": [
      "quads",
      "glutes"
    ],
    "secondary_muscles": [
      "hamstrings",
      "calves"
    ],
    "start_position": "Встаньте в стойку для приседа, стопы на ширине плеч, корпус собран, руки помогают движению.",
    "execution": "Опуститесь в неглубокий присед и затем резко выпрямитесь, выполняя взрывной прыжок вверх.",
    "top_position": "В фазе полёта тело собрано, таз и колени под контролем, стопы готовы к мягкому приземлению.",
    "return_phase": "Приземлитесь мягко в полуприсед и сразу амортизируйте движение.",
    "mistakes": [
      "Жёсткое приземление на прямые ноги\n Колени внутрь\n Слишком глубокий присед перед прыжком\n Потеря корпуса"
    ],
    "breathing": "Короткий выдох в момент прыжка, вдох при амортизации.",
    "safety": "Выполняйте только после разминки. Следите за мягким приземлением и контролем коленей."
  },
  "run_sprint_bike": {
    "exercise_id": "run_sprint_bike",
    "exercise_name": "Бег, спринт, велотренажёр",
    "category": "cardio",
    "technique_image_url": "/exercises/cardio/run_sprint_bike.png",
    "primary_muscles": [
      "quads",
      "glutes"
    ],
    "secondary_muscles": [
      "hamstrings",
      "calves",
      "hip_flexors"
    ],
    "start_position": "Займите стартовую позицию на дорожке, на улице или на велотренажёре. Корпус собран, дыхание под контролем.",
    "execution": "Поддерживайте выбранный темп или интервальный режим. В беге толчок идёт из стопы и таза, в велотренажёре — через круговое давление в педаль.",
    "top_position": "В интенсивной фазе ноги работают ритмично, корпус стабилен, плечи расслаблены.",
    "return_phase": "Для завершения нагрузки плавно снизьте темп до шага, лёгкого бега или мягкого вращения педалей.",
    "mistakes": [
      "Сутулость\n Слишком длинный шаг в беге\n Жёсткая постановка стопы\n Резкий старт без разминки"
    ],
    "breathing": "Ритмичное дыхание по темпу нагрузки.",
    "safety": "Перед спринтами и интервалами обязательно разминайтесь. На велотренажёре настройте седло по высоте."
  },
  "stairs_or_stepups": {
    "exercise_id": "stairs_or_stepups",
    "exercise_name": "Ходьба по лестнице / степ-апы",
    "category": "legs",
    "technique_image_url": "/exercises/legs/stairs_or_stepups.png",
    "primary_muscles": [
      "glutes",
      "quads"
    ],
    "secondary_muscles": [
      "hamstrings",
      "calves"
    ],
    "start_position": "Встаньте перед ступенью, платформой или лестницей. Корпус прямой, рабочая нога готова к подъёму.",
    "execution": "Поставьте рабочую ногу на ступень и поднимитесь вверх за счёт её усилия, не отталкиваясь сильно второй ногой.",
    "top_position": "В верхней точке таз находится над опорной ногой, ягодица и квадрицепс рабочей ноги напряжены.",
    "return_phase": "Медленно спуститесь вниз под контролем и повторите на другую сторону при необходимости.",
    "mistakes": [
      "Толчок второй ногой\n Провал колена внутрь\n Рывок корпусом вверх\n Слишком высокая ступень"
    ],
    "breathing": "Выдох при подъёме, вдох при спуске.",
    "safety": "Выбирайте высоту платформы, которую можете контролировать без завала корпуса и колена."
  },
  "side_lunge": {
    "exercise_id": "side_lunge",
    "exercise_name": "Боковые выпады",
    "category": "legs",
    "technique_image_url": "/exercises/legs/side_lunge.png",
    "primary_muscles": [
      "adductors",
      "glutes"
    ],
    "secondary_muscles": [
      "quads",
      "hamstrings"
    ],
    "start_position": "Встаньте прямо, стопы на ширине таза, корпус собран. Подготовьтесь к широкому шагу в сторону.",
    "execution": "Сделайте шаг в сторону и перенесите вес на рабочую ногу, сгибая её в колене и отводя таз назад.",
    "top_position": "Нерабочая нога остаётся почти прямой, приводящие мышцы растягиваются, таз стабилен, грудь раскрыта.",
    "return_phase": "На выдохе оттолкнитесь рабочей ногой и вернитесь в исходную стойку.",
    "mistakes": [
      "Провал колена внутрь\n Округление спины\n Слишком короткий шаг\n Смещение веса вперёд"
    ],
    "breathing": "Вдох при уходе в выпад, выдох при возврате.",
    "safety": "Контролируйте глубину по подвижности приводящих мышц. Не ускоряйте движение без устойчивости."
  },
  "quadruped_side_leg_raise": {
    "exercise_id": "quadruped_side_leg_raise",
    "exercise_name": "Махи ногой в сторону на четвереньках",
    "category": "glutes",
    "technique_image_url": "/exercises/glutes/quadruped_side_leg_raise.png",
    "primary_muscles": [
      "abductors",
      "glutes"
    ],
    "secondary_muscles": [
      "abs"
    ],
    "start_position": "Встаньте на четвереньки: ладони под плечами, колени под тазом, спина нейтральна, пресс слегка напряжён.",
    "execution": "На выдохе отведите согнутую или прямую ногу в сторону, сохраняя таз максимально неподвижным.",
    "top_position": "В верхней точке средняя ягодичная и отводящие мышцы напряжены, корпус не заваливается в сторону.",
    "return_phase": "На вдохе верните ногу под контроль в исходное положение.",
    "mistakes": [
      "Разворот таза\n Провал поясницы\n Слишком высокий мах за счёт корпуса\n Рывки"
    ],
    "breathing": "Выдох при отведении, вдох при возврате.",
    "safety": "Держите живот подтянутым и не допускайте смещения веса в одну руку."
  },
  "quadruped_kickback": {
    "exercise_id": "quadruped_kickback",
    "exercise_name": "Махи ногой назад на четвереньках",
    "category": "glutes",
    "technique_image_url": "/exercises/glutes/quadruped_kickback.png",
    "primary_muscles": [
      "glutes"
    ],
    "secondary_muscles": [
      "hamstrings",
      "abs"
    ],
    "start_position": "Положение на четвереньках: ладони под плечами, колени под тазом, спина нейтральна.",
    "execution": "На выдохе вытолкните рабочую ногу назад и вверх в линии с тазом, не разворачивая корпус.",
    "top_position": "В верхней точке ягодица максимально напряжена, поясница не переразгибается, таз ровный.",
    "return_phase": "На вдохе плавно верните колено под таз, не бросая ногу вниз.",
    "mistakes": [
      "Разворот таза\n Подъём ноги за счёт поясницы\n Рывок\n Потеря стабилизации плеч"
    ],
    "breathing": "Выдох при махе назад, вдох при возврате.",
    "safety": "Не поднимайте ногу выше диапазона, в котором сохраняется контроль поясницы и таза."
  },
  "crunch": {
    "exercise_id": "crunch",
    "exercise_name": "Скручивания",
    "category": "abs",
    "technique_image_url": "/exercises/abs/crunch.png",
    "primary_muscles": [
      "abs"
    ],
    "secondary_muscles": [
      "obliques"
    ],
    "start_position": "Лягте на спину, колени согнуты, стопы на полу. Руки у висков или скрещены на груди, поясница в нейтральном контакте с полом.",
    "execution": "На выдохе приподнимите голову, плечи и верх лопаток от пола, сокращая прямую мышцу живота. Движение короткое и контролируемое.",
    "top_position": "В верхней точке пресс напряжён, шея остаётся длинной, поясница не отрывается от пола.",
    "return_phase": "На вдохе медленно верните лопатки вниз, сохраняя напряжение до полного касания.",
    "mistakes": [
      "Тянуть голову руками\n Слишком большая амплитуда за счёт поясницы\n Рывки\n Задержка дыхания"
    ],
    "breathing": "Выдох при скручивании, вдох при возврате.",
    "safety": "Смотрите вверх, а не на колени, чтобы не перегружать шею. Не тяните голову руками."
  },
  "reverse_crunch": {
    "exercise_id": "reverse_crunch",
    "exercise_name": "Обратные скручивания (подъём таза лёжа)",
    "category": "abs",
    "technique_image_url": "/exercises/abs/reverse_crunch.png",
    "primary_muscles": [
      "abs"
    ],
    "secondary_muscles": [
      "hip_flexors"
    ],
    "start_position": "Лягте на спину, руки вдоль тела или в упоре за голову, ноги согнуты и подняты так, чтобы бёдра были перпендикулярны полу.",
    "execution": "На выдохе подкрутите таз вверх, слегка отрывая его от пола, подтягивая колени к груди за счёт пресса.",
    "top_position": "В верхней точке таз приподнят, нижняя часть пресса напряжена, движение идёт без инерции.",
    "return_phase": "На вдохе медленно опустите таз обратно и вернитесь в стартовую позицию ног.",
    "mistakes": [
      "Размах ногами\n Рывок тазом\n Слишком сильное движение из бёдер\n Потеря контроля поясницы"
    ],
    "breathing": "Выдох при подъёме таза, вдох при возврате.",
    "safety": "Движение должно быть коротким и подконтрольным. Не забрасывайте ноги инерцией."
  },
  "lying_leg_raise": {
    "exercise_id": "lying_leg_raise",
    "exercise_name": "Подъём ног лёжа",
    "category": "abs",
    "technique_image_url": "/exercises/abs/lying_leg_raise.png",
    "primary_muscles": [
      "abs"
    ],
    "secondary_muscles": [
      "hip_flexors"
    ],
    "start_position": "Лягте на спину, руки вдоль тела или под тазом для поддержки, ноги выпрямлены.",
    "execution": "На выдохе поднимайте прямые или слегка согнутые ноги вверх до комфортного угла, удерживая поясницу подконтрольной.",
    "top_position": "В верхней точке ноги подняты, пресс напряжён, поясница не теряет контроль.",
    "return_phase": "На вдохе медленно опустите ноги вниз, не позволяя пояснице резко оторваться от пола.",
    "mistakes": [
      "Рывки ногами\n Чрезмерный прогиб в пояснице\n Слишком быстрый негатив\n Подъём шеи"
    ],
    "breathing": "Выдох при подъёме ног, вдох при опускании.",
    "safety": "Если тяжело сохранять поясницу, уменьшите амплитуду или согните колени."
  },
  "bicycle_crunch": {
    "exercise_id": "bicycle_crunch",
    "exercise_name": "«Велосипед»",
    "category": "abs",
    "technique_image_url": "/exercises/abs/bicycle_crunch.png",
    "primary_muscles": [
      "abs"
    ],
    "secondary_muscles": [
      "obliques",
      "hip_flexors"
    ],
    "start_position": "Лягте на спину, руки у висков, ноги подняты, колени согнуты под 90 градусов.",
    "execution": "Поочерёдно подтягивайте одно колено к груди и разворачивайте корпус так, чтобы противоположный локоть тянулся к нему, одновременно выпрямляя другую ногу.",
    "top_position": "В каждом повторении корпус слегка скручен, пресс и косые напряжены, движение остаётся контролируемым.",
    "return_phase": "Плавно меняйте стороны без рывка и без полного расслабления между повторениями.",
    "mistakes": [
      "Тянуть голову руками\n Слишком быстрый темп\n Недостаточное скручивание корпуса\n Потеря контроля ног"
    ],
    "breathing": "Выдыхайте на каждое активное скручивание, вдыхайте при смене стороны.",
    "safety": "Сохраняйте длину шеи и не ускоряйтесь ценой потери техники."
  },
  "plank": {
    "exercise_id": "plank",
    "exercise_name": "Планка",
    "category": "abs",
    "technique_image_url": "/exercises/abs/plank.png",
    "primary_muscles": [
      "abs"
    ],
    "secondary_muscles": [
      "glutes",
      "front_delts"
    ],
    "start_position": "Упритесь на предплечья и носки, локти под плечами. Тело образует прямую линию от головы до пяток.",
    "execution": "Удерживайте корпус неподвижно, напрягая пресс, ягодицы и переднюю поверхность плеч.",
    "top_position": "Таз не провисает и не поднимается, поясница нейтральна, шея продолжает линию позвоночника.",
    "return_phase": "По завершении удержания плавно опуститесь на пол или колени.",
    "mistakes": [
      "Провисание таза\n Поднятый таз\n Поднятые плечи\n Задержка дыхания"
    ],
    "breathing": "Дышите ровно и спокойно всё удержание.",
    "safety": "Если не можете сохранить линию тела, сократите время или выполните вариант с колен."
  },
  "side_plank": {
    "exercise_id": "side_plank",
    "exercise_name": "Боковая планка",
    "category": "abs",
    "technique_image_url": "/exercises/abs/side_plank.png",
    "primary_muscles": [
      "obliques"
    ],
    "secondary_muscles": [
      "abs",
      "abductors",
      "front_delts"
    ],
    "start_position": "Лягте на бок и поднимитесь на предплечье или прямую руку, стопы одна на другой или в шахматном порядке. Тело вытянуто в прямую линию.",
    "execution": "Удерживайте таз поднятым, напрягая косые мышцы живота и боковую поверхность таза.",
    "top_position": "Корпус прямой, таз не провисает, опорное плечо стабильно, шея нейтральна.",
    "return_phase": "Плавно опустите таз вниз и завершите подход, затем смените сторону.",
    "mistakes": [
      "Провисание таза\n Выведение плеча вперёд\n Скручивание корпуса\n Задержка дыхания"
    ],
    "breathing": "Ровное дыхание на протяжении удержания.",
    "safety": "Не допускайте боли в опорном плече. При необходимости начните с варианта на колене."
  },
  "russian_twist_bodyweight": {
    "exercise_id": "russian_twist_bodyweight",
    "exercise_name": "Русские скручивания — без веса",
    "category": "abs",
    "technique_image_url": "/exercises/abs/russian_twist_bodyweight.png",
    "primary_muscles": [
      "obliques"
    ],
    "secondary_muscles": [
      "abs",
      "hip_flexors"
    ],
    "start_position": "Сядьте на пол, слегка отклоните корпус назад, колени согнуты, стопы на полу или приподняты. Руки перед собой.",
    "execution": "Поворачивайте корпус влево и вправо, сохраняя контроль таза и напряжение пресса.",
    "top_position": "В крайней точке поворота косые мышцы живота напряжены, движение идёт из корпуса, а не только из рук.",
    "return_phase": "Плавно переводите корпус через центр в другую сторону без потери контроля.",
    "mistakes": [
      "Сутулость\n Слишком быстрый темп\n Движение только руками\n Потеря стабильности таза"
    ],
    "breathing": "Выдох на активном повороте, вдох при переходе через центр.",
    "safety": "Не заваливайтесь слишком назад, если не можете держать нейтральную спину."
  },
  "flutter_kicks": {
    "exercise_id": "flutter_kicks",
    "exercise_name": "«Ножницы» ногами лёжа",
    "category": "abs",
    "technique_image_url": "/exercises/abs/flutter_kicks.png",
    "primary_muscles": [
      "abs"
    ],
    "secondary_muscles": [
      "hip_flexors"
    ],
    "start_position": "Лягте на спину, руки вдоль тела или под тазом, ноги выпрямлены и слегка приподняты над полом.",
    "execution": "Выполняйте попеременные небольшие махи ногами вверх-вниз, сохраняя поясницу под контролем.",
    "top_position": "Во время всего движения пресс напряжён, ноги не поднимаются слишком высоко, корпус остаётся стабильным.",
    "return_phase": "По окончании серии плавно опустите ноги на пол.",
    "mistakes": [
      "Отрыв поясницы\n Слишком большая амплитуда\n Рывки ногами\n Подъём головы"
    ],
    "breathing": "Дышите ритмично и не задерживайте дыхание.",
    "safety": "Если поясница начинает отрываться, сократите амплитуду или согните колени."
  },
  "plank_knee_tuck": {
    "exercise_id": "plank_knee_tuck",
    "exercise_name": "«Планка с подтягиванием колен»",
    "category": "abs",
    "technique_image_url": "/exercises/abs/plank_knee_tuck.png",
    "primary_muscles": [
      "abs"
    ],
    "secondary_muscles": [
      "hip_flexors",
      "front_delts"
    ],
    "start_position": "Примите положение планки на прямых руках или предплечьях, корпус вытянут в прямую линию.",
    "execution": "Поочерёдно подтягивайте одно колено к груди, сохраняя стабильный таз и жёсткий корпус.",
    "top_position": "В момент подтягивания колена пресс активно сокращён, таз не вращается и не провисает.",
    "return_phase": "Верните ногу назад в планку и повторите на другую сторону.",
    "mistakes": [
      "Провисание таза\n Скручивание корпуса\n Слишком быстрый темп\n Потеря контроля плеч"
    ],
    "breathing": "Выдох при подтягивании колена, вдох при возврате в планку.",
    "safety": "Держите руки строго под плечами и не проваливайтесь в пояснице."
  },
  "bridge_for_core_stability": {
    "exercise_id": "bridge_for_core_stability",
    "exercise_name": "«Мостик» — для включения нижнего пресса в стабилизацию",
    "category": "abs",
    "technique_image_url": "/exercises/abs/bridge_for_core_stability.png",
    "primary_muscles": [
      "abs"
    ],
    "secondary_muscles": [
      "glutes",
      "hamstrings"
    ],
    "start_position": "Лягте на спину, ноги согнуты, стопы на полу, таз в нейтрали. Руки вдоль тела.",
    "execution": "Поднимите таз в положение мостика и удерживайте, одновременно сохраняя лёгкое втяжение нижней части живота и стабильный таз.",
    "top_position": "Тело образует прямую линию от колен до плеч, ягодицы напряжены, нижняя часть живота стабилизирует таз.",
    "return_phase": "Медленно опустите таз вниз, не теряя контроля над поясницей.",
    "mistakes": [
      "Переразгибание поясницы\n Сведение коленей внутрь\n Подъём таза рывком\n Потеря контроля живота"
    ],
    "breathing": "Выдох при подъёме таза, вдох при опускании или спокойное дыхание при удержании.",
    "safety": "Не поднимайте таз выше нейтральной линии тела. Удерживайте таз ровным."
  },
  "weighted_russian_twist": {
    "exercise_id": "weighted_russian_twist",
    "exercise_name": "Русские скручивания с медболом или гантелью",
    "category": "abs",
    "technique_image_url": "/exercises/abs/weighted_russian_twist.png",
    "primary_muscles": [
      "obliques"
    ],
    "secondary_muscles": [
      "abs",
      "hip_flexors"
    ],
    "start_position": "Сядьте на пол, слегка отклоните корпус назад, удерживайте медбол или гантель перед собой, колени согнуты.",
    "execution": "Поворачивайте корпус влево и вправо, перемещая вес за счёт поворота грудного отдела и напряжения косых мышц живота.",
    "top_position": "В крайней точке поворота косые мышцы напряжены, таз остаётся максимально стабильным.",
    "return_phase": "Плавно переводите вес через центр в другую сторону без рывка.",
    "mistakes": [
      "Слишком тяжёлый вес\n Скручивание только руками\n Сутулость\n Потеря баланса"
    ],
    "breathing": "Выдох на активном повороте, вдох при возвращении через центр.",
    "safety": "Выбирайте вес, который не ломает технику. Не форсируйте амплитуду за счёт поясницы."
  },
  "weighted_leg_raise": {
    "exercise_id": "weighted_leg_raise",
    "exercise_name": "Подъём ног с утяжелителем между стоп",
    "category": "abs",
    "technique_image_url": "/exercises/abs/weighted_leg_raise.png",
    "primary_muscles": [
      "abs"
    ],
    "secondary_muscles": [
      "hip_flexors",
      "adductors"
    ],
    "start_position": "Лягте на спину, удерживайте утяжелитель между стопами, руки вдоль тела или под тазом, ноги выпрямлены.",
    "execution": "На выдохе поднимайте ноги вверх до комфортного угла, удерживая вес между стопами и сохраняя контроль пресса.",
    "top_position": "В верхней точке пресс напряжён, таз остаётся под контролем, вес надёжно зафиксирован.",
    "return_phase": "На вдохе плавно опустите ноги вниз без потери контроля поясницы.",
    "mistakes": [
      "Рывки ногами\n Отрыв поясницы\n Слишком быстрый негатив\n Потеря фиксации утяжелителя"
    ],
    "breathing": "Выдох при подъёме, вдох при опускании.",
    "safety": "Используйте только безопасный и надёжный утяжелитель. Если поясница теряет контроль — уменьшите вес или амплитуду."
  },
  "weighted_crunch_behind_head": {
    "exercise_id": "weighted_crunch_behind_head",
    "exercise_name": "Скручивания с гантелью за головой",
    "category": "abs",
    "technique_image_url": "/exercises/abs/weighted_crunch_behind_head.png",
    "primary_muscles": [
      "abs"
    ],
    "secondary_muscles": [
      "obliques"
    ],
    "start_position": "Лягте на спину, колени согнуты, гантель удерживайте обеими руками за головой или над грудью, в зависимости от контролируемого варианта.",
    "execution": "На выдохе выполняйте короткое скручивание, поднимая голову, плечи и верх лопаток от пола за счёт пресса.",
    "top_position": "В верхней точке пресс сокращён, шея не перенапрягается, поясница остаётся стабильно прижатой.",
    "return_phase": "На вдохе медленно опуститесь обратно вниз.",
    "mistakes": [
      "Тянуть голову весом\n Слишком большая амплитуда\n Рывок корпусом\n Чрезмерный вес"
    ],
    "breathing": "Выдох при скручивании, вдох при опускании.",
    "safety": "Используйте только лёгкий вес и не перегружайте шею. При дискомфорте держите вес ближе к груди."
  },
  "dumbbell_side_bend": {
    "exercise_id": "dumbbell_side_bend",
    "exercise_name": "Боковые наклоны с гантелью",
    "category": "abs",
    "technique_image_url": "/exercises/abs/dumbbell_side_bend.png",
    "primary_muscles": [
      "obliques"
    ],
    "secondary_muscles": [
      "erectors"
    ],
    "start_position": "Встаньте прямо, гантель в одной руке, вторая рука за головой или на поясе. Стопы на ширине таза, корпус вытянут.",
    "execution": "Наклоняйтесь в сторону с гантелью под контролем, затем возвращайтесь в вертикаль за счёт косых мышц противоположной стороны.",
    "top_position": "В нижней точке ощущается растяжение боковой поверхности корпуса, таз остаётся стабильным.",
    "return_phase": "Поднимитесь обратно в нейтральное положение без рывка.",
    "mistakes": [
      "Скручивание корпуса вперёд или назад\n Слишком тяжёлый вес\n Рывки\n Смещение таза"
    ],
    "breathing": "Вдох при наклоне, выдох при возвращении.",
    "safety": "Не превращайте наклон в вращение корпуса. Работайте в плавной боковой амплитуде."
  },
  "machine_crunch": {
    "exercise_id": "machine_crunch",
    "exercise_name": "Скручивания в тренажёре на пресс",
    "category": "abs",
    "technique_image_url": "/exercises/abs/machine_crunch.png",
    "primary_muscles": [
      "abs"
    ],
    "secondary_muscles": [
      "obliques"
    ],
    "start_position": "Сядьте в тренажёр, отрегулируйте упоры под свой рост. Поясница и таз стабильно расположены, руки держат рукояти или подушки.",
    "execution": "На выдохе скрутите корпус вперёд за счёт пресса, не тяните движение руками.",
    "top_position": "В нижней точке пресс максимально сокращён, корпус слегка скруглён в грудном отделе, таз стабилен.",
    "return_phase": "На вдохе плавно вернитесь в исходное положение, не бросая вес.",
    "mistakes": [
      "Движение руками вместо пресса\n Слишком большой вес\n Рывки\n Потеря контроля в негативной фазе"
    ],
    "breathing": "Выдох при скручивании, вдох при возврате.",
    "safety": "Подберите вес, при котором можете чувствовать пресс, а не только давление от тренажёра."
  },
  "hanging_leg_raise": {
    "exercise_id": "hanging_leg_raise",
    "exercise_name": "Подъём ног в висе на турнике",
    "category": "abs",
    "technique_image_url": "/exercises/abs/hanging_leg_raise.png",
    "primary_muscles": [
      "abs"
    ],
    "secondary_muscles": [
      "hip_flexors",
      "forearms_back"
    ],
    "start_position": "Повисните на перекладине, плечи опущены, корпус стабилен, ноги вместе.",
    "execution": "На выдохе поднимайте ноги вперёд до уровня, который можете контролировать, не раскачиваясь.",
    "top_position": "В верхней точке пресс напряжён, таз подкручен, ноги подняты до комфортной высоты.",
    "return_phase": "На вдохе медленно опустите ноги вниз, не позволяя корпусу раскачиваться.",
    "mistakes": [
      "Сильная раскачка\n Подъём за счёт инерции\n Провисание плеч\n Слишком быстрый негатив"
    ],
    "breathing": "Выдох при подъёме ног, вдох при опускании.",
    "safety": "Сначала отработайте вариант со сгибанием коленей, если прямые ноги пока трудно контролировать."
  },
  "rope_to_knee_rotation": {
    "exercise_id": "rope_to_knee_rotation",
    "exercise_name": "Тяга каната к колену в кроссовере (стоя в повороте)",
    "category": "abs",
    "technique_image_url": "/exercises/abs/rope_to_knee_rotation.png",
    "primary_muscles": [
      "obliques"
    ],
    "secondary_muscles": [
      "abs",
      "hip_flexors"
    ],
    "start_position": "Встаньте боком к блоку, возьмитесь за канат двумя руками. Корпус стабилен, ноги слегка согнуты.",
    "execution": "На выдохе тяните канат по диагонали вниз к противоположному колену, одновременно слегка скручивая корпус.",
    "top_position": "В нижней точке косые мышцы живота максимально напряжены, таз остаётся относительно стабильным.",
    "return_phase": "На вдохе плавно верните канат обратно вверх по диагонали, сопротивляясь весу.",
    "mistakes": [
      "Рывок руками без работы корпуса\n Проворот таза вместе с корпусом\n Слишком большой вес\n Потеря баланса"
    ],
    "breathing": "Выдох при тяге вниз, вдох при возврате.",
    "safety": "Сохраняйте устойчивую стойку и контролируйте скручивание из корпуса, а не из поясницы."
  },
  "standing_cable_crunch": {
    "exercise_id": "standing_cable_crunch",
    "exercise_name": "Кабельные скручивания (стоя, трос сверху)",
    "category": "abs",
    "technique_image_url": "/exercises/abs/standing_cable_crunch.png",
    "primary_muscles": [
      "abs"
    ],
    "secondary_muscles": [
      "obliques"
    ],
    "start_position": "Встаньте на колени или стоя лицом к верхнему блоку, возьмитесь за канат у головы, таз стабилен.",
    "execution": "На выдохе выполняйте скручивание корпуса вниз за счёт пресса, приближая рёбра к тазу.",
    "top_position": "В нижней точке пресс сокращён, шея остаётся расслабленной, таз не смещается назад.",
    "return_phase": "На вдохе плавно раскрутитесь обратно вверх, сопротивляясь тяге блока.",
    "mistakes": [
      "Тяга руками вместо пресса\n Сильный наклон тазом назад\n Слишком большой вес\n Рывки"
    ],
    "breathing": "Выдох при скручивании вниз, вдох при возврате.",
    "safety": "Не позволяйте блоку вытягивать вас вверх резко. Контролируйте движение и не зажимайте шею."
  },
  "ab_wheel_rollout": {
    "exercise_id": "ab_wheel_rollout",
    "exercise_name": "Планка на ролике — с колен или стоя",
    "category": "abs",
    "technique_image_url": "/exercises/abs/ab_wheel_rollout.png",
    "primary_muscles": [
      "abs"
    ],
    "secondary_muscles": [
      "front_delts",
      "lats",
      "hip_flexors"
    ],
    "start_position": "Встаньте на колени или в стойку, возьмитесь за ролик двумя руками, таз и рёбра собраны, спина нейтральна.",
    "execution": "Плавно выкатывайте ролик вперёд, удлиняя корпус и сохраняя контроль пресса. Затем на выдохе подтяните ролик обратно к себе за счёт силы корпуса.",
    "top_position": "В дальней точке пресс и широчайшие напряжены, поясница не провисает, корпус образует длинную линию.",
    "return_phase": "Возвращайтесь обратно под контролем, сохраняя собранный таз и рёбра.",
    "mistakes": [
      "Провисание поясницы\n Слишком дальний выкат без контроля\n Рывок при возврате\n Поднятые плечи"
    ],
    "breathing": "Вдох при выкатывании, выдох при возвращении.",
    "safety": "Начинайте с колен. Не выкатывайтесь дальше, чем можете удержать без прогиба в пояснице."
  },
  "plank_with_board": {
    "exercise_id": "plank_with_board",
    "exercise_name": "«Планка с доской»",
    "category": "abs",
    "technique_image_url": "/exercises/abs/plank_with_board.png",
    "primary_muscles": [
      "abs"
    ],
    "secondary_muscles": [
      "glutes",
      "front_delts",
      "obliques"
    ],
    "start_position": "Примите положение планки на предплечьях или прямых руках. Дополнительный снаряд или нестабильная опора используется для усиления контроля корпуса.",
    "execution": "Удерживайте планку, сопротивляясь смещению корпуса и сохраняя таз в нейтрали.",
    "top_position": "Тело образует прямую линию, пресс и косые напряжены, плечевой пояс стабилен.",
    "return_phase": "По завершении удержания аккуратно выйдите из планки без потери контроля.",
    "mistakes": [
      "Провисание таза\n Поднятый таз\n Потеря контроля на нестабильной опоре\n Задержка дыхания"
    ],
    "breathing": "Ровное дыхание на протяжении удержания.",
    "safety": "Используйте только устойчивую опору и не усложняйте вариант, если не можете удерживать нейтральную спину."
  },
  "mountain_climber": {
    "exercise_id": "mountain_climber",
    "exercise_name": "«Альпинист»",
    "category": "abs",
    "technique_image_url": "/exercises/abs/mountain_climber.png",
    "primary_muscles": [
      "abs"
    ],
    "secondary_muscles": [
      "hip_flexors",
      "front_delts"
    ],
    "start_position": "Примите положение планки на прямых руках, ладони под плечами, тело вытянуто в линию.",
    "execution": "Поочерёдно подтягивайте колени к груди в контролируемом или быстром темпе, сохраняя стабильный корпус.",
    "top_position": "В момент подтягивания колена пресс напряжён, таз не провисает, плечи остаются над руками.",
    "return_phase": "Верните ногу назад и сразу переходите к другой стороне без потери линии корпуса.",
    "mistakes": [
      "Раскачка таза\n Провисание корпуса\n Слишком быстрый темп без контроля\n Поднятые плечи"
    ],
    "breathing": "Ритмичное дыхание, выдох на активном подтягивании колена.",
    "safety": "Сначала освойте медленный вариант. Не теряйте качество планки ради скорости."
  },
  "superman_dynamic": {
    "exercise_id": "superman_dynamic",
    "exercise_name": "«Супермен» (лёжа, подъём рук и ног)",
    "category": "abs",
    "technique_image_url": "/exercises/abs/superman_dynamic.png",
    "primary_muscles": [
      "erectors"
    ],
    "secondary_muscles": [
      "glutes",
      "rear_delts"
    ],
    "start_position": "Лягте на живот, руки вытянуты вперёд, ноги прямые, шея нейтральна.",
    "execution": "На выдохе одновременно поднимите руки, грудь и ноги от пола, удерживая напряжение задней поверхности тела.",
    "top_position": "В верхней точке мышцы спины, ягодицы и задние дельты напряжены, шея остаётся продолжением позвоночника.",
    "return_phase": "На вдохе плавно опуститесь обратно на пол.",
    "mistakes": [
      "Резкое задирание головы\n Слишком большая амплитуда\n Рывок вверх\n Потеря контроля поясницы"
    ],
    "breathing": "Выдох при подъёме, вдох при опускании.",
    "safety": "Не поднимайтесь слишком высоко. Работайте в диапазоне, где можете контролировать поясницу."
  },
  "dead_bug": {
    "exercise_id": "dead_bug",
    "exercise_name": "«Мертвец и ангел»",
    "category": "abs",
    "technique_image_url": "/exercises/abs/dead_bug.png",
    "primary_muscles": [
      "abs"
    ],
    "secondary_muscles": [
      "hip_flexors",
      "obliques"
    ],
    "start_position": "Лягте на спину, руки вытянуты вверх, ноги подняты и согнуты под 90 градусов. Поясница мягко прижата к полу.",
    "execution": "Одновременно выпрямляйте противоположные руку и ногу, не теряя контакта поясницы с полом. Вернитесь в центр и смените стороны.",
    "top_position": "В вытянутой позиции корпус остаётся стабильным, пресс удерживает таз и поясницу от прогиба.",
    "return_phase": "Плавно верните руку и ногу в стартовое положение и выполните другую сторону.",
    "mistakes": [
      "Отрыв поясницы от пола\n Слишком быстрая смена сторон\n Поднятые плечи\n Потеря контроля таза"
    ],
    "breathing": "Выдох при вытяжении конечностей, вдох при возвращении в центр.",
    "safety": "Работайте только в той амплитуде, где можете удержать поясницу прижатой к полу."
  },
  "bird_dog": {
    "exercise_id": "bird_dog",
    "exercise_name": "«Птица-собака»",
    "category": "abs",
    "technique_image_url": "/exercises/abs/bird_dog.png",
    "primary_muscles": [
      "erectors"
    ],
    "secondary_muscles": [
      "glutes",
      "abs",
      "rear_delts"
    ],
    "start_position": "Встаньте на четвереньки: ладони под плечами, колени под тазом, спина нейтральна.",
    "execution": "Одновременно вытяните вперёд одну руку и назад противоположную ногу, удерживая таз и корпус неподвижными.",
    "top_position": "В вытянутой позиции корпус стабилен, таз не разворачивается, рука и нога образуют длинную линию.",
    "return_phase": "Плавно вернитесь в исходное положение и смените сторону.",
    "mistakes": [
      "Разворот таза\n Прогиб в пояснице\n Рывок конечностями\n Потеря равновесия"
    ],
    "breathing": "Выдох при вытяжении, вдох при возврате.",
    "safety": "Не поднимайте ногу слишком высоко. Главное — стабильность корпуса, а не амплитуда."
  },
  "boat_pose_hold": {
    "exercise_id": "boat_pose_hold",
    "exercise_name": "«Лодочка»",
    "category": "abs",
    "technique_image_url": "/exercises/abs/boat_pose_hold.png",
    "primary_muscles": [
      "abs"
    ],
    "secondary_muscles": [
      "hip_flexors",
      "erectors"
    ],
    "start_position": "Сядьте на пол, слегка отклоните корпус назад, поднимите ноги и удерживайте баланс на седалищных костях. Руки вытяните вперёд.",
    "execution": "Удерживайте позицию, сохраняя длинную спину, напряжённый пресс и стабильный таз.",
    "top_position": "В удержании голени или прямые ноги подняты, грудь раскрыта, пресс и сгибатели бедра работают изометрически.",
    "return_phase": "Плавно опустите ноги и корпус вниз, не теряя контроля.",
    "mistakes": [
      "Сутулость\n Задержка дыхания\n Слишком высокий подъём ног с потерей поясницы\n Рывковый вход в положение"
    ],
    "breathing": "Ровное дыхание в течение удержания.",
    "safety": "Если спина округляется, согните колени и укоротите рычаг. Не держите позу через боль в пояснице."
  }
};
