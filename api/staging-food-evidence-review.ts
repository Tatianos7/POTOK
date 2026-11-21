import {
  createStagingFoodEvidenceReviewGatewayV1,
  foodEvidenceStagingOriginV1,
} from '../src/server/foodEvidenceReviewGatewayV1.js';

function unavailable(): Response {
  return Response.json({ error: 'FOOD_EVIDENCE_REVIEW_UNAVAILABLE' }, {
    status: 503,
    headers: { 'cache-control': 'no-store' },
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
    const env = process.env;
    if (env.VERCEL_ENV !== 'preview' || env.VITE_POTOK_STAGING_PREVIEW !== 'true'
      || env.VITE_SUPABASE_URL !== foodEvidenceStagingOriginV1
      || env.POTOK_STAGING_FOOD_EVIDENCE_REVIEW_ENABLED !== 'true') {
      return unavailable();
    }

    try {
      const review = createStagingFoodEvidenceReviewGatewayV1({
        supabaseUrl: env.VITE_SUPABASE_URL,
        publishableKey: env.VITE_SUPABASE_ANON_KEY ?? '',
      });
      return await review(request);
    } catch {
      return unavailable();
    }
  },
};
