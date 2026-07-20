export class RecipeImageError extends Error {
  userMessage: string;

  constructor(message: string, userMessage = message) {
    super(message);
    this.name = 'RecipeImageError';
    this.userMessage = userMessage;
  }
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1280;
const JPEG_QUALITY = 0.82;

class RecipeImagesService {
  validateImageFile(file: File): void {
    if (!file.type.startsWith('image/')) {
      throw new RecipeImageError('Invalid recipe image type', 'Пожалуйста, выберите изображение');
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new RecipeImageError(
        'Recipe image is too large',
        'Размер фото не должен превышать 5MB'
      );
    }
  }

  async readFileAsDataUrl(file: File): Promise<string> {
    this.validateImageFile(file);
    const rawDataUrl = await this.fileToDataUrl(file);
    return this.compressDataUrl(rawDataUrl);
  }

  async saveImage(userId: string, recipeId: string, imageDataUrl: string): Promise<void> {
    if (!userId || !recipeId) {
      throw new RecipeImageError('Missing user or recipe id', 'Не удалось сохранить фото рецепта');
    }
    if (!imageDataUrl) {
      await this.deleteImage(userId, recipeId);
      return;
    }

    const images = this.getLocalStorageImages(userId);
    images[recipeId] = imageDataUrl;

    try {
      localStorage.setItem(this.imagesKey(userId), JSON.stringify(images));
    } catch (error) {
      console.error('[recipeImagesService] Error saving local recipe image:', error);
      throw new RecipeImageError(
        'Failed to persist recipe image locally',
        'Рецепт сохранён, но фото не удалось сохранить. Попробуйте выбрать изображение меньшего размера.'
      );
    }
  }

  async deleteImage(userId: string, recipeId: string): Promise<void> {
    const images = this.getLocalStorageImages(userId);
    delete images[recipeId];

    try {
      localStorage.setItem(this.imagesKey(userId), JSON.stringify(images));
    } catch (error) {
      console.error('[recipeImagesService] Error deleting local recipe image:', error);
    }
  }

  async getImageByRecipeId(userId: string, recipeId: string): Promise<string | null> {
    return this.getLocalStorageImages(userId)[recipeId] || null;
  }

  async getImagesByRecipeIds(userId: string, recipeIds: string[]): Promise<Record<string, string>> {
    if (recipeIds.length === 0) {
      return {};
    }

    const images = this.getLocalStorageImages(userId);
    return recipeIds.reduce<Record<string, string>>((result, recipeId) => {
      if (images[recipeId]) {
        result[recipeId] = images[recipeId];
      }
      return result;
    }, {});
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new RecipeImageError('Unable to read recipe image', 'Ошибка при загрузке изображения'));
        }
      };
      reader.onerror = () =>
        reject(new RecipeImageError('Unable to read recipe image', 'Ошибка при загрузке изображения'));
      reader.readAsDataURL(file);
    });
  }

  private compressDataUrl(dataUrl: string): Promise<string> {
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      return Promise.resolve(dataUrl);
    }

    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height));
        if (scale >= 1 && dataUrl.length < MAX_FILE_SIZE_BYTES) {
          resolve(dataUrl);
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      };
      image.onerror = () => resolve(dataUrl);
      image.src = dataUrl;
    });
  }

  private imagesKey(userId: string): string {
    return `potok_recipe_images_${userId}`;
  }

  private getLocalStorageImages(userId: string): Record<string, string> {
    try {
      const stored = localStorage.getItem(this.imagesKey(userId));
      return stored ? (JSON.parse(stored) as Record<string, string>) : {};
    } catch (error) {
      console.error('[recipeImagesService] Error reading local recipe images:', error);
      return {};
    }
  }
}

export const recipeImagesService = new RecipeImagesService();
