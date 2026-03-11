import { allBusinesses } from '../hooks/useBusinesses';
import { PREDEFINED_TAGS } from '../types';

export function getBusinessName(id: string): string {
  return allBusinesses.find((b) => b.id === id)?.name ?? id;
}

export function getTagLabel(tagId: string): string {
  return PREDEFINED_TAGS.find((t) => t.id === tagId)?.label ?? tagId;
}
