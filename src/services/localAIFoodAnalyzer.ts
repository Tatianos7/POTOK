/**
 * Полностью локальный анализатор еды по фото.
 * Никаких внешних запросов, фото не покидает устройство.
 *
 * Архитектура:
 * - analyzeImageLocal(): основной pipeline
 * - detectObjectsLocal(): детекция ингредиентов (локальная модель / заглушка)
 * - classifyFoodLocal(): классификация блюда
 * - understandRecipeLocal(): уточнение состава по описанию
 * - estimatePortionSize(): эвристика оценки массы порции
 * - mapIngredients(): сопоставление с нашей базой
 * - calculateMacros(): суммарные КБЖУ
 *
 * Все функции сейчас используют локальные эвристики / заглушки.
 * Сюда можно подключить реальные ONNX / TFLite модели (YOLOv8 food detection, Food-101, LLaVA tiny).
 */

import { CATEGORY_DEFAULTS } from '../data/categoryDefaults';
import { Food } from '../types';
import * as ort from 'onnxruntime-web';

export interface LocalIngredient {
  id: string;
  name: string;
  grams?: number;
  caloriesPer100?: number;
  proteinPer100?: number;
  fatPer100?: number;
  carbsPer100?: number;
  category?: keyof typeof CATEGORY_DEFAULTS;
}

export interface LocalAnalysisResult {
  ingredients: LocalIngredient[];
  portionGrams: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

// Базовый словарь для маппинга меток -> продукты + категория
const LABEL_MAP: Record<
  string,
  { name: string; category: keyof typeof CATEGORY_DEFAULTS; macros?: Partial<LocalIngredient> }
> = {
  'bell pepper': { name: 'Перец болгарский', category: 'vegetables' },
  pepper: { name: 'Перец', category: 'vegetables' },
  tomato: { name: 'Помидор', category: 'vegetables' },
  'chicken breast': { name: 'Курица', category: 'meat' },
  chicken: { name: 'Курица', category: 'meat' },
  rice: { name: 'Рис отварной', category: 'grains' },
  salmon: { name: 'Лосось', category: 'fish' },
  beef: { name: 'Говядина', category: 'meat' },
  pork: { name: 'Свинина', category: 'meat' },
  cheese: { name: 'Сыр', category: 'dairy' },
  milk: { name: 'Молоко', category: 'dairy' },
  egg: { name: 'Яйцо куриное', category: 'dairy' },
  bread: { name: 'Хлеб', category: 'grains' },
  apple: { name: 'Яблоко', category: 'fruits' },
  banana: { name: 'Банан', category: 'fruits' },
  orange: { name: 'Апельсин', category: 'fruits' },
  potato: { name: 'Картофель отварной', category: 'vegetables' },
  avocado: { name: 'Авокадо', category: 'fruits' },
  pasta: { name: 'Макароны', category: 'grains' },
  noodles: { name: 'Лапша', category: 'grains' },
  salad: { name: 'Салат', category: 'vegetables' },
  pizza: { name: 'Пицца', category: 'fastfood' },
  burger: { name: 'Бургер', category: 'fastfood' },
};

// Утилита: безопасное число
const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

// Утилита: применить дефолты категории
const withCategoryDefaults = (ing: LocalIngredient): LocalIngredient => {
  const cat = ing.category || 'vegetables';
  const def = CATEGORY_DEFAULTS[cat] || CATEGORY_DEFAULTS.vegetables;
  return {
    ...ing,
    caloriesPer100: num(ing.caloriesPer100, def.calories),
    proteinPer100: num(ing.proteinPer100, def.protein),
    fatPer100: num(ing.fatPer100, def.fat),
    carbsPer100: num(ing.carbsPer100, def.carbs),
  };
};

class LocalAIFoodAnalyzer {
  /**
   * Требуемые файлы (добавить вручную в public):
   * - /public/models/yolo/yolov8-food.onnx
   * - /public/models/yolo/classes.json
   * - /public/models/food101/food101.onnx
   * - /public/models/food101/classes.json
   * - /public/models/llava/llava-tiny.onnx (опционально)
   */

  private yoloSession: ort.InferenceSession | null = null;
  private foodSession: ort.InferenceSession | null = null;
  private llavaSession: ort.InferenceSession | null = null;
  private foodClasses: string[] = [];
  private yoloClasses: string[] = [];
  private yoloLoading = false;
  private foodLoading = false;
  private llavaLoading = false;

  private async loadJSON(localPath: string): Promise<any> {
    try {
      const res = await fetch(localPath, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to load ${localPath}`);
      return await res.json();
    } catch (err) {
      console.warn('[local-ai] cannot load JSON', localPath, err);
      return null;
    }
  }

  private async loadYoloModel(): Promise<void> {
    if (this.yoloSession || this.yoloLoading) return;
    this.yoloLoading = true;
    try {
      // загрузим классы
      const classes = await this.loadJSON('/models/yolo/classes.json');
      this.yoloClasses = Array.isArray(classes) ? classes : [];

      const candidates = ['/models/yolo/yolov8-food.onnx', '/models/yolo/yolov8n-food.onnx', '/models/yolo/yolov8n.onnx'];
      let session: ort.InferenceSession | null = null;
      for (const path of candidates) {
        try {
          session = await ort.InferenceSession.create(path, { executionProviders: ['wasm'] });
          break;
        } catch {
          // try next
        }
      }
      this.yoloSession = session;
      if (!this.yoloSession) {
        throw new Error('YOLO model not found in candidates');
      }
    } catch (err) {
      console.warn('[local-ai] YOLO model not loaded. Using fallback.', err);
      this.yoloSession = null;
    } finally {
      this.yoloLoading = false;
    }
  }

  private async loadFood101Model(): Promise<void> {
    if (this.foodSession || this.foodLoading) return;
    this.foodLoading = true;
    try {
      this.foodClasses = (await this.loadJSON('/models/food101/classes.json')) || [];
      this.foodSession = await ort.InferenceSession.create('/models/food101/food101.onnx', {
        executionProviders: ['wasm'],
      });
    } catch (err) {
      console.warn('[local-ai] Food101 model not loaded. Using fallback.', err);
      this.foodSession = null;
    } finally {
      this.foodLoading = false;
    }
  }

  private async loadLLaVaTinyModel(): Promise<void> {
    if (this.llavaSession || this.llavaLoading) return;
    this.llavaLoading = true;
    try {
      // Опциональная модель; если файла нет — работаем без неё.
      this.llavaSession = await ort.InferenceSession.create('/models/llava/llava-tiny.onnx', {
        executionProviders: ['wasm'],
      });
    } catch (err) {
      console.warn('[local-ai] LLaVA tiny model not loaded. Using fallback.', err);
      this.llavaSession = null;
    } finally {
      this.llavaLoading = false;
    }
  }

  /**
   * Основной pipeline анализа изображения — полностью локально.
   */
  async analyzeImageLocal(file: File): Promise<LocalAnalysisResult> {
    if (!file || file.size === 0) {
      throw new Error('Не удалось определить ингредиенты. Попробуйте другое фото.');
    }

    // 1) Пре-просессинг: уменьшаем и чистим EXIF (имитация, без сохранения)
    await this.preprocessImage(file);

    // 2) Детекция ингредиентов (локальная модель / заглушка)
    const detected = await this.detectObjectsLocal(file);

    // 3) Классификация блюда
    const classified = await this.classifyFoodLocal(file, detected);

    // 4) Понимание рецепта (мультимодальная локальная модель / заглушка)
    const understood = await this.understandRecipeLocal(classified, detected);

    // 5) Оценка порции
    const portionGrams = this.estimatePortionSize(understood);

    // 6) Маппинг к нашей базе
    const ingredients = this.mapIngredients(understood);

    // 7) Итоговые макросы
    const { calories, protein, fat, carbs } = this.calculateMacros(ingredients, portionGrams);

    // Очистка ссылок на файл — изображение нигде не сохраняем
    // (в JS GC освободит, ссылку больше не храним)

    return {
      ingredients,
      portionGrams,
      calories,
      protein,
      fat,
      carbs,
    };
  }

  /**
   * Имитация препроцессинга: уменьшение до 1024px, очистка EXIF.
   * Здесь можно подключить Canvas/OffscreenCanvas и чистку EXIF.
   */
  private async preprocessImage(_file: File): Promise<void> {
    // Локальный препроцессинг; не сохраняем результат.
    return;
  }

  /**
   * Преобразование картинки в тензор для моделей.
   */
  private async imageToTensor(file: File, size = 640): Promise<ort.Tensor | null> {
    try {
      const bitmap = await createImageBitmap(file);
      // Жёсткое приведение к size x size (простая ресайз без letterbox)
      const targetW = size;
      const targetH = size;
      const canvas: HTMLCanvasElement | OffscreenCanvas =
        typeof OffscreenCanvas !== 'undefined'
          ? new OffscreenCanvas(targetW, targetH)
          : (() => {
              const c = document.createElement('canvas');
              c.width = targetW;
              c.height = targetH;
              return c;
            })();
      const ctx = (canvas as OffscreenCanvas).getContext
        ? (canvas as OffscreenCanvas).getContext('2d')
        : (canvas as HTMLCanvasElement).getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0, targetW, targetH);
      const imageData = ctx.getImageData(0, 0, targetW, targetH);
      const { data } = imageData;
      const tensorData = new Float32Array(targetW * targetH * 3);
      for (let i = 0; i < targetW * targetH; i++) {
        tensorData[i] = data[i * 4] / 255; // R
        tensorData[targetW * targetH + i] = data[i * 4 + 1] / 255; // G
        tensorData[targetW * targetH * 2 + i] = data[i * 4 + 2] / 255; // B
      }
      return new ort.Tensor('float32', tensorData, [1, 3, targetH, targetW]);
    } catch (err) {
      console.warn('[local-ai] imageToTensor failed', err);
      return null;
    }
  }

  /**
   * Локальная детекция ингредиентов (YOLOv8 food detection).
   */
  private async detectObjectsLocal(file: File): Promise<string[]> {
    await this.loadYoloModel();
    if (!this.yoloSession || this.yoloClasses.length === 0) {
      console.warn('[local-ai] YOLO not available, fallback empty');
      return [];
    }
    const inputTensor = await this.imageToTensor(file, 640);
    if (!inputTensor) return [];
    try {
      const outputs = await this.yoloSession.run({ images: inputTensor });
      const first = outputs[Object.keys(outputs)[0]] as ort.Tensor;
      const data = first.data as Float32Array;
      const dims = (first as any).dims as number[] | undefined; // ожидаем [1, anchors, classes+4] или [1, classes+4, anchors]
      const results: { label: string; score: number; box: [number, number, number, number] }[] = [];
      if (!dims || dims.length !== 3) return [];

      const [, c, a] = dims[0] === 1 ? dims : [1, dims[1], dims[2]];
      let anchors = a;
      let strideC = c;
      let channelFirst = true;

      // Ултраликс: [1, 84, 8400] -> нужно транспонировать
      if (dims[1] < dims[2]) {
        anchors = dims[2];
        strideC = dims[1];
        channelFirst = false;
      }

      const numClasses = strideC - 4;
      const confThresh = 0.25;

      for (let i = 0; i < anchors; i++) {
        const offset = channelFirst ? i : i * strideC;
          const cx = channelFirst ? data[offset] : data[offset];
          const cy = channelFirst ? data[anchors + i] : data[offset + 1];
          const w = channelFirst ? data[anchors * 2 + i] : data[offset + 2];
          const h = channelFirst ? data[anchors * 3 + i] : data[offset + 3];

        let maxScore = -Infinity;
        let clsIdx = -1;
        for (let cIdx = 0; cIdx < numClasses; cIdx++) {
          const val = channelFirst
            ? data[anchors * (4 + cIdx) + i]
            : data[offset + 4 + cIdx];
          if (val > maxScore) {
            maxScore = val;
            clsIdx = cIdx;
          }
        }

        if (maxScore >= confThresh && clsIdx >= 0) {
          // Перевод из (cx, cy, w, h) в xyxy; здесь предполагаем нормализацию под 640
          const x1 = Math.max(0, cx - w / 2);
          const y1 = Math.max(0, cy - h / 2);
          const x2 = Math.min(640, cx + w / 2);
          const y2 = Math.min(640, cy + h / 2);
          const label = this.yoloClasses[clsIdx] || `cls_${clsIdx}`;
          results.push({ label, score: maxScore, box: [x1, y1, x2, y2] });
        }
      }

      // Простая NMS (жадная)
      const nms = (boxes: typeof results, iouThresh = 0.45) => {
        const keep: typeof results = [];
        const sorted = [...boxes].sort((a, b) => b.score - a.score);
        while (sorted.length) {
          const first = sorted.shift()!;
          keep.push(first);
          const rest: typeof results = [];
          for (const b of sorted) {
            const iou = this.iou(first.box, b.box);
            if (iou < iouThresh) rest.push(b);
          }
          sorted.splice(0, sorted.length, ...rest);
        }
        return keep;
      };

      const kept = nms(results);
      return kept.map((r) => r.label);
    } catch (err) {
      console.warn('[local-ai] YOLO inference failed', err);
      return [];
    }
  }

  /**
   * Локальная классификация блюда (Food-101 / заглушка).
   */
  private async classifyFoodLocal(file: File, detected: string[]): Promise<string[]> {
    await this.loadFood101Model();
    if (!this.foodSession) {
      console.warn('[local-ai] Food101 not available, fallback to detected');
      return detected;
    }
    const inputTensor = await this.imageToTensor(file, 224);
    if (!inputTensor) return detected;
    try {
      const outputs = await this.foodSession.run({ input: inputTensor });
      const logits = outputs[Object.keys(outputs)[0]] as ort.Tensor;
      const data = logits.data as Float32Array;
      const topIdx = data.indexOf(Math.max(...data));
      const label = this.foodClasses[topIdx] || `class_${topIdx}`;
      return Array.from(new Set([...detected, label]));
    } catch (err) {
      console.warn('[local-ai] Food101 inference failed', err);
      return detected;
    }
  }

  /**
   * Локальное понимание рецепта (мультимодальная модель / заглушка).
   * Можно подключить LLaVA tiny ONNX, здесь — простая эвристика.
   */
  private async understandRecipeLocal(labels: string[], detected: string[]): Promise<string[]> {
    await this.loadLLaVaTinyModel();
    if (!this.llavaSession) {
      const merged = new Set([...labels, ...detected]);
      return Array.from(merged);
    }
    // TODO: реальная интеграция LLaVA tiny — мультимодальный ввод.
    // Пока возвращаем объединение, чтобы не блокировать работу.
    const merged = new Set([...labels, ...detected]);
    return Array.from(merged);
  }

  /**
   * Эвристика оценки порции на основе кол-ва ингредиентов.
   */
  private estimatePortionSize(ings: string[]): number {
    const base = 300;
    const perIng = 80;
    return Math.min(800, base + perIng * ings.length);
  }

  /**
   * Маппинг меток в наши продукты с макросами.
   */
  private mapIngredients(labels: string[]): LocalIngredient[] {
    return labels.map((label) => {
      const key = label.toLowerCase();
      const mapped = LABEL_MAP[key];
      if (mapped) {
        const base: LocalIngredient = {
          id: `ing_${crypto.randomUUID()}`,
          name: mapped.name,
          category: mapped.category,
          grams: undefined,
        };
        return withCategoryDefaults({ ...base, ...mapped.macros });
      }
      // Если нет в словаре, оставляем исходное имя
      return withCategoryDefaults({
        id: `ing_${crypto.randomUUID()}`,
        name: label,
        category: 'vegetables',
        grams: undefined,
      });
    });
  }

  /**
   * Подсчёт макросов на основе ингредиентов и порции.
   */
  private calculateMacros(ings: LocalIngredient[], portionGrams: number) {
    const totalPer100 = ings.reduce(
      (acc, ing) => {
        acc.calories += num(ing.caloriesPer100);
        acc.protein += num(ing.proteinPer100);
        acc.fat += num(ing.fatPer100);
        acc.carbs += num(ing.carbsPer100);
        return acc;
      },
      { calories: 0, protein: 0, fat: 0, carbs: 0 }
    );

    const k = portionGrams / 100;
    return {
      calories: Math.round(totalPer100.calories * k),
      protein: Math.round(totalPer100.protein * k * 10) / 10,
      fat: Math.round(totalPer100.fat * k * 10) / 10,
      carbs: Math.round(totalPer100.carbs * k * 10) / 10,
    };
  }

  /**
   * Преобразовать ингредиент в Food для добавления в дневник.
   */
  toFood(ing: LocalIngredient): Food {
    const withDefaults = withCategoryDefaults(ing);
    return {
      id: `recipe_${crypto.randomUUID()}`,
      name: withDefaults.name,
      name_original: withDefaults.name,
      calories: withDefaults.caloriesPer100 || 0,
      protein: withDefaults.proteinPer100 || 0,
      fat: withDefaults.fatPer100 || 0,
      carbs: withDefaults.carbsPer100 || 0,
      barcode: null,
      category: withDefaults.category,
      brand: null,
      source: 'manual',
      photo: null,
      aliases: [],
      autoFilled: true,
      popularity: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // IoU для NMS
  private iou(a: [number, number, number, number], b: [number, number, number, number]) {
    const area = (box: [number, number, number, number]) =>
      Math.max(0, box[2] - box[0]) * Math.max(0, box[3] - box[1]);
    const interX1 = Math.max(a[0], b[0]);
    const interY1 = Math.max(a[1], b[1]);
    const interX2 = Math.min(a[2], b[2]);
    const interY2 = Math.min(a[3], b[3]);
    const interArea = Math.max(0, interX2 - interX1) * Math.max(0, interY2 - interY1);
    const union = area(a) + area(b) - interArea;
    return union > 0 ? interArea / union : 0;
  }
}

export const localAIFoodAnalyzer = new LocalAIFoodAnalyzer();

