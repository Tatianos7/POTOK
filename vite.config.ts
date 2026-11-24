import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Separate preview hosting uses root-relative paths; GitHub Pages keeps its existing base.
  base: mode === 'staging-preview' ? '/' : mode === 'production' ? '/POTOK/' : '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: './index.html',
        ...(mode === 'staging-preview' ? {
          stagingGenerationCheck: './staging-generator-check.html',
          stagingCatalogAccessCheck: './staging-catalog-access-check.html',
          stagingFourFoodReview: './staging-four-food-review.html',
          stagingVegetableIdentity: './staging-vegetable-identity.html',
          stagingVegetableNutrition: './staging-vegetable-nutrition.html',
        } : {}),
      },
    },
  },
}))
