const STORAGE_URL_PREFIX = 'https://firebasestorage.googleapis.com/';

/** Validates that a URL points to Firebase Storage */
export const isValidStorageUrl = (url: string | undefined): url is string =>
  typeof url === 'string' && url.startsWith(STORAGE_URL_PREFIX);
