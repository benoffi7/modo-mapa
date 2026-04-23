import { describe, it, expect } from 'vitest';
import { GA4_FEATURE_CATEGORIES } from '../ga4FeatureDefinitions';

describe('GA4_FEATURE_CATEGORIES', () => {
  const allFeatures = GA4_FEATURE_CATEGORIES.flatMap((c) => c.features);

  it('has unique feature keys across all categories', () => {
    const keys = allFeatures.map((f) => f.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it('has no duplicate eventNames across all features', () => {
    const allEventNames = allFeatures.flatMap((f) => f.eventNames);
    const uniqueEventNames = new Set(allEventNames);
    expect(uniqueEventNames.size).toBe(allEventNames.length);
  });

  it('every feature has at least one eventName', () => {
    for (const feature of allFeatures) {
      expect(feature.eventNames.length, `Feature ${feature.key} has no eventNames`).toBeGreaterThanOrEqual(1);
    }
  });

  it('every category has at least one feature', () => {
    for (const category of GA4_FEATURE_CATEGORIES) {
      expect(category.features.length, `Category ${category.id} has no features`).toBeGreaterThanOrEqual(1);
    }
  });

  it('has unique category IDs', () => {
    const ids = GA4_FEATURE_CATEGORIES.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('force_update feature includes app_version_active in eventNames', () => {
    const systemCategory = GA4_FEATURE_CATEGORIES.find((c) => c.id === 'system');
    const forceUpdate = systemCategory?.features.find((f) => f.key === 'force_update');
    expect(forceUpdate?.eventNames).toContain('app_version_active');
  });

  it('every feature has all required fields', () => {
    for (const feature of allFeatures) {
      expect(feature.key, `Feature missing key`).toBeTruthy();
      expect(feature.name, `Feature ${feature.key} missing name`).toBeTruthy();
      expect(feature.eventNames, `Feature ${feature.key} missing eventNames`).toBeDefined();
      expect(feature.color, `Feature ${feature.key} missing color`).toBeTruthy();
      expect(feature.icon, `Feature ${feature.key} missing icon`).toBeDefined();
    }
  });
});
