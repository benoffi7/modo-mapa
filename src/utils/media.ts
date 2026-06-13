// Host exacto + segmento canonico /v0/b/<bucket>/o/.
// El ^ ancla el inicio (cierra prefix-bypass y arbitrary-content-before-prefix).
// Bucket generico ([^/]+): un solo segmento de path, sin '/', para no romper
// render de mediaUrl legacy que pudiera apuntar a otro bucket. La autorizacion
// real (ownership) la da la rule de write de Firestore, no este check.
const STORAGE_URL_RE =
  /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\//;

/** Validates that a URL points to a canonical Firebase Storage object */
export const isValidStorageUrl = (url: string | undefined): url is string =>
  typeof url === 'string' && STORAGE_URL_RE.test(url);
