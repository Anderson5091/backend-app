import { prisma } from "../../config/database";
import { ENV } from "../../config/env";

const FALLBACK_RATES: Record<string, Record<string, number>> = {
  USDT: { USD: 1, HTG: 135.25, MXN: 17.5, NGN: 1550, PHP: 56.2 },
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class FxService {
  async getRate(from: string, to: string): Promise<number> {
    if (from === to) return 1;

    // 1. Check DB cache
    const cached = await prisma.fxRate.findUnique({
      where: { fromCurrency_toCurrency: { fromCurrency: from, toCurrency: to } },
    });

    if (cached) {
      const age = Date.now() - cached.updatedAt.getTime();
      if (age < CACHE_TTL_MS) return Number(cached.rate);
    }

    // 2. Fetch from AllRatesToday API
    try {
      const rate = await this.fetchRate(from, to);
      if (rate > 0) {
        await prisma.fxRate.upsert({
          where: { fromCurrency_toCurrency: { fromCurrency: from, toCurrency: to } },
          update: { rate, source: "allratestoday" },
          create: { fromCurrency: from, toCurrency: to, rate, source: "allratestoday" },
        });
        return rate;
      }
    } catch {
      // API failed — use cached if stale, or fallback
      if (cached) return Number(cached.rate);
    }

    // 3. Fallback to hardcoded rates
    return FALLBACK_RATES[from]?.[to] || 1;
  }

  private async fetchRate(from: string, to: string): Promise<number> {
    const url = `https://allratestoday.com/api/v1/rates?source=${from}&target=${to}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${ENV.ART_API_KEY}` },
    });

    if (!res.ok) {
      throw new Error(`AllRatesToday API error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { rate: number };
    return data.rate;
  }
}

export const fxService = new FxService();
