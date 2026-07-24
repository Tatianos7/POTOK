import { supabase } from '../lib/supabaseClient';
import { isOptionalSupabaseResourceMissingError } from '../utils/optionalSupabaseResource';

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
const RECIPE_PHOTOS_BUCKET = 'recipe-photos';
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export interface RecipeImageSaveResult {
  displayUrl: string;
  storagePath: string | null;
  persistence: 'storage' | 'local';
  warning?: string;
}

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

  async saveImage(userId: string, recipeId: string, imageDataUrl: string): Promise<RecipeImageSaveResult> {
    if (!userId || !recipeId) {
      throw new RecipeImageError('Missing user or recipe id', 'Не удалось сохранить фото рецепта');
    }
    if (!imageDataUrl) {
      await this.deleteImage(userId, recipeId);
      return {
        displayUrl: '',
        storagePath: null,
        persistence: 'local',
      };
    }

    const storagePath = this.buildStoragePath(userId, recipeId);

    if (supabase) {
      try {
        await this.uploadStorageImage(storagePath, imageDataUrl);
        await this.updateRecipeImagePath(userId, recipeId, storagePath);
        this.saveLocalImage(userId, recipeId, imageDataUrl);
        return {
          displayUrl: (await this.createSignedUrl(storagePath)) ?? imageDataUrl,
          storagePath,
          persistence: 'storage',
        };
      } catch (error) {
        if (!this.canFallbackToLocal(error)) {
          throw new RecipeImageError(
            error instanceof Error ? error.message : 'Recipe image storage upload failed',
            'Не удалось сохранить фото рецепта в облако. Попробуйте ещё раз.'
          );
        }
      }
    }

    this.saveLocalImage(userId, recipeId, imageDataUrl);
    return {
      displayUrl: imageDataUrl,
      storagePath: null,
      persistence: 'local',
      warning: 'Фото сохранено только на этом устройстве. Облачное хранилище фото рецептов ещё не доступно.',
    };
  }

  async deleteImage(userId: string, recipeId: string, storagePath?: string | null): Promise<void> {
    if (supabase && storagePath && this.isStoragePath(storagePath)) {
      try {
        const { error } = await supabase.storage.from(RECIPE_PHOTOS_BUCKET).remove([storagePath]);
        if (error && !this.canFallbackToLocal(error)) throw error;
        await this.updateRecipeImagePath(userId, recipeId, null);
      } catch (error) {
        if (!this.canFallbackToLocal(error)) {
          throw new RecipeImageError(
            error instanceof Error ? error.message : 'Recipe image storage delete failed',
            'Не удалось удалить фото рецепта из облака'
          );
        }
      }
    }

    const images = this.getLocalStorageImages(userId);
    delete images[recipeId];

    try {
      localStorage.setItem(this.imagesKey(userId), JSON.stringify(images));
    } catch (error) {
      console.error('[recipeImagesService] Error deleting local recipe image:', error);
    }
  }

  async getImageByRecipeId(userId: string, recipeId: string, storagePath?: string | null): Promise<string | null> {
    const storageImage = await this.resolveDisplayUrl(storagePath);
    if (storageImage) return storageImage;
    return this.getLocalStorageImages(userId)[recipeId] || null;
  }

  async getImagesByRecipeIds(
    userId: string,
    recipeIds: string[],
    storagePaths: Record<string, string | null | undefined> = {}
  ): Promise<Record<string, string>> {
    if (recipeIds.length === 0) {
      return {};
    }

    const localImages = this.getLocalStorageImages(userId);
    const result: Record<string, string> = {};

    await Promise.all(
      recipeIds.map(async (recipeId) => {
        const storageImage = await this.resolveDisplayUrl(storagePaths[recipeId]);
        const image = storageImage ?? localImages[recipeId];
        if (image) {
          result[recipeId] = image;
        }
      })
    );

    return result;
  }

  private buildStoragePath(userId: string, recipeId: string): string {
    return `user/${userId}/recipes/${recipeId}/cover.jpg`;
  }

  private isExternalOrDataUrl(value: string): boolean {
    return value.startsWith('data:') || value.startsWith('http://') || value.startsWith('https://');
  }

  private isStoragePath(value: string): boolean {
    return value.startsWith('user/');
  }

  private async resolveDisplayUrl(storagePath?: string | null): Promise<string | null> {
    if (!storagePath) return null;
    if (this.isExternalOrDataUrl(storagePath)) return storagePath;
    if (!this.isStoragePath(storagePath)) return null;
    return this.createSignedUrl(storagePath);
  }

  private async createSignedUrl(storagePath: string): Promise<string | null> {
    if (!supabase) return null;

    const { data, error } = await supabase.storage
      .from(RECIPE_PHOTOS_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      if (!this.canFallbackToLocal(error)) {
        console.error('[recipeImagesService] Error creating recipe image signed URL:', error);
      }
      return null;
    }

    return data.signedUrl;
  }

  private async uploadStorageImage(storagePath: string, imageDataUrl: string): Promise<void> {
    if (!supabase) {
      throw new RecipeImageError('Supabase is not initialized');
    }

    const blob = await this.dataUrlToBlob(imageDataUrl);
    const { error } = await supabase.storage
      .from(RECIPE_PHOTOS_BUCKET)
      .upload(storagePath, blob, {
        upsert: true,
        contentType: blob.type || 'image/jpeg',
      });

    if (error) throw error;
  }

  private async updateRecipeImagePath(userId: string, recipeId: string, storagePath: string | null): Promise<void> {
    if (!supabase) {
      throw new RecipeImageError('Supabase is not initialized');
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user?.id) {
      throw new RecipeImageError('User is not authenticated');
    }

    const { error } = await supabase
      .from('recipes')
      .update({ image: storagePath })
      .eq('id', recipeId)
      .eq('user_id', user.id);

    if (error) throw error;

    if (userId && userId !== user.id) {
      console.warn('[recipeImagesService] Передан userId не совпадает с сессией');
    }
  }

  private canFallbackToLocal(error: unknown): boolean {
    if (!supabase) return true;
    if (isOptionalSupabaseResourceMissingError(error)) return true;
    if (!error || typeof error !== 'object') return false;

    const candidate = error as { statusCode?: string | number; status?: string | number; message?: string };
    const message = candidate.message?.toLowerCase() ?? '';
    return (
      candidate.statusCode === '404' ||
      candidate.status === 404 ||
      message.includes('bucket not found') ||
      message.includes('the resource was not found') ||
      message.includes("could not find the 'image' column") ||
      message.includes("could not find the column 'image'") ||
      message.includes('schema cache')
    );
  }

  private saveLocalImage(userId: string, recipeId: string, imageDataUrl: string): void {
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

  private async dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const response = await fetch(dataUrl);
    return response.blob();
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
