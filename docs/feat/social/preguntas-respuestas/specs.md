# Specs: Preguntas y respuestas en comercios

**Feature:** preguntas-respuestas
**Fecha:** 2026-03-20
**PRD:** [prd.md](prd.md)

---

## S1: Sección Q&A reutilizando comentarios

### Data model

Agregar campo opcional `type` a la interfaz `Comment` en `src/types/index.ts`:

```typescript
export interface Comment {
  id: string;
  userId: string;
  userName: string;
  businessId: string;
  text: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  likeCount: number;
  flagged: boolean;
  parentId?: string;
  replyCount?: number;
  type?: 'comment' | 'question'; // nuevo — undefined = 'comment' (backward compat)
}
```

- Comentarios existentes sin `type` se tratan como comentarios normales.
- Una pregunta es un `Comment` con `type: 'question'` y sin `parentId`.
- Una respuesta a una pregunta es un `Comment` con `parentId` apuntando al id de la pregunta. No necesita `type` propio.

### Converter

Actualizar `commentConverter` en `src/config/converters.ts` para incluir `type`:

```typescript
// En toFirestore: incluir type si existe
...(data.type && { type: data.type }),

// En fromFirestore: leer type
type: data.type,
```

### Firestore rules

Actualizar reglas de `comments` para permitir `type` en create:

```javascript
// En la validación de create de comments
// Agregar 'type' a los campos permitidos
// Validar que type sea 'comment' o 'question' si existe
allow create: if ... &&
  (!('type' in request.resource.data) ||
    request.resource.data.type in ['comment', 'question']);
```

No se requieren otros cambios en reglas. El rate limit de 20/día ya aplica a todos los documentos en `comments`.

### Service functions

Agregar a `src/services/comments.ts`:

```typescript
/**
 * Fetches questions for a business, ordered by creation date.
 * Questions are comments with type === 'question' and no parentId.
 */
export async function fetchQuestions(businessId: string): Promise<Comment[]> {
  // Query: where type == 'question', where businessId == businessId,
  //        where parentId == null, orderBy createdAt desc
}

/**
 * Creates a question for a business.
 * Wrapper around comment creation that sets type: 'question'.
 */
export async function createQuestion(
  businessId: string,
  text: string
): Promise<string> {
  // Uses same addDoc logic as createComment but adds type: 'question'
}
```

- `createAnswer`: No se necesita función nueva. Usar `createComment` existente con `parentId` = question id. Las respuestas no llevan `type`.
- `fetchAnswers`: Usar `fetchReplies` existente (busca por `parentId`). Ordenar por `likeCount` desc en el componente para mostrar best answer primero.

### Firestore index

Se necesita un composite index nuevo:

```text
Collection: comments
Fields: businessId ASC, type ASC, createdAt DESC
```

### UI — BusinessQuestions component

Nuevo archivo `src/components/business/BusinessQuestions.tsx`:

- Similar en estructura a `BusinessComments`.
- Muestra lista de preguntas con `replyCount` (cantidad de respuestas) por pregunta.
- Cada pregunta expandible para ver respuestas, ordenadas por `likeCount` desc.
- Best answer (mayor `likeCount`, mínimo 1 like) con badge visual "Mejor respuesta".
- Input para crear nueva pregunta (max 500 caracteres, ver constantes).
- Input para responder una pregunta abierta.

### UI — Toggle tabs en BusinessSheet

En `src/components/business/BusinessSheet.tsx`:

```typescript
// Tabs: "Comentarios" | "Preguntas"
// Usar un estado local o tabs component
const [activeTab, setActiveTab] = useState<'comments' | 'questions'>('comments');
```

- Tab "Comentarios" muestra `BusinessComments` (comportamiento actual).
- Tab "Preguntas" muestra `BusinessQuestions`.
- Mostrar count de cada tipo en el tab si es eficiente (opcional, puede ser mejora futura).

### Constants

Nuevo archivo `src/constants/questions.ts`:

```typescript
export const MAX_QUESTION_LENGTH = 500;
export const BEST_ANSWER_MIN_LIKES = 1;
```

---

## S2: Votación de respuestas

- Reutiliza `commentLikes` collection y la lógica existente de like/unlike.
- En el componente `BusinessQuestions`, las respuestas muestran botón de like (thumbs up) y `likeCount`.
- Las respuestas se ordenan por `likeCount` desc, mostrando la mejor primero.
- La Cloud Function `onCommentUpdated` ya maneja cambios de `likeCount` si es necesario.
- No se necesita nueva colección, nueva Cloud Function, ni nuevas reglas.

---

## S3: Moderación

- Preguntas y respuestas pasan por la misma moderación que comentarios.
- El campo `flagged` aplica igual.
- Los triggers existentes (`onCommentCreated`, `onCommentDeleted`, etc.) funcionan sin cambios ya que operan sobre la misma colección `comments`.
- Si un trigger necesita diferenciar comportamiento por tipo, puede leer `data.type`.
- Rate limit de 20/día es compartido (preguntas + comentarios + respuestas, todo en `comments`).

---

## Analytics

Nuevos eventos en el componente `BusinessQuestions`:

| Evento | Cuando | Params |
|--------|--------|--------|
| `question_created` | Usuario crea pregunta | `businessId` |
| `question_answered` | Usuario responde pregunta | `businessId`, `questionId` |
| `question_viewed` | Usuario expande una pregunta para ver respuestas | `businessId`, `questionId` |

Usar `logEvent` de Firebase Analytics, consistente con eventos existentes.

---

## Tests

### Component test: `BusinessQuestions.test.tsx`

- Renderiza lista de preguntas.
- Muestra reply count por pregunta.
- Expandir pregunta muestra respuestas ordenadas por likes.
- Best answer badge visible cuando `likeCount >= BEST_ANSWER_MIN_LIKES`.
- Crear pregunta llama `createQuestion` con texto correcto.
- Validación de largo máximo (500 chars).

### Service test: `comments.test.ts` (ampliar existente)

- `fetchQuestions` retorna solo docs con `type === 'question'`.
- `createQuestion` crea doc con `type: 'question'`.
- Respuestas a preguntas se crean con `parentId` correcto.

### CF trigger test: `comments.triggers.test.ts` (ampliar existente)

- `onCommentCreated` maneja doc con `type: 'question'` sin errores.
- `onCommentDeleted` para una pregunta actualiza contadores correctamente.

**Cobertura mínima:** >= 80%.
