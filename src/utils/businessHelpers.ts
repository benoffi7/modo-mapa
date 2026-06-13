import { getBusinessById } from './businessMap';
import { PREDEFINED_TAGS } from '../constants/tags';

export function getBusinessName(id: string): string {
  return getBusinessById(id)?.name ?? id;
}

export function getTagLabel(tagId: string): string {
  return PREDEFINED_TAGS.find((t) => t.id === tagId)?.label ?? tagId;
}
