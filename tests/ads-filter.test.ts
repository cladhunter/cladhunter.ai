import { describe, expect, it } from 'vitest';
import { adCreatives, getEligibleAds } from '../config/ads';

const adIds = (ads: typeof adCreatives) => ads.map((ad) => ad.id);

describe('ad configuration filtering', () => {
  it('filters ads by country code and sorts by priority', () => {
    const eligible = getEligibleAds('us');
    const ids = adIds(eligible);

    expect(ids[0]).toBe('demo_video_1');
    expect(ids).toContain('tech_app');
    expect(ids).toContain('mobile_gaming');
    expect(ids).not.toContain('crypto_trading');
    expect(ids.indexOf('demo_video_1')).toBeLessThan(ids.indexOf('tech_app'));
    expect(ids.indexOf('tech_app')).toBeLessThan(ids.indexOf('mobile_gaming'));
  });

  it('falls back to full inventory when no country-specific ads are available', () => {
    const eligible = getEligibleAds('jp');
    const ids = adIds(eligible);

    expect(ids).toEqual(['demo_video_1', 'crypto_trading', 'tech_app', 'mobile_gaming']);
  });

  it('handles missing country codes by returning prioritized defaults', () => {
    const eligible = getEligibleAds(null);
    const ids = adIds(eligible);

    expect(ids).toEqual(['demo_video_1', 'crypto_trading', 'tech_app', 'mobile_gaming']);
  });
});
