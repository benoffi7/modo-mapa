export interface AvatarOption {
  id: string;
  label: string;
  emoji: string;
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: 'cat', label: 'Gato', emoji: '🐱' },
  { id: 'dog', label: 'Perro', emoji: '🐶' },
  { id: 'fox', label: 'Zorro', emoji: '🦊' },
  { id: 'bear', label: 'Oso', emoji: '🐻' },
  { id: 'panda', label: 'Panda', emoji: '🐼' },
  { id: 'koala', label: 'Koala', emoji: '🐨' },
  { id: 'lion', label: 'Leon', emoji: '🦁' },
  { id: 'tiger', label: 'Tigre', emoji: '🐯' },
  { id: 'monkey', label: 'Mono', emoji: '🐵' },
  { id: 'rabbit', label: 'Conejo', emoji: '🐰' },
  { id: 'penguin', label: 'Pinguino', emoji: '🐧' },
  { id: 'owl', label: 'Buho', emoji: '🦉' },
  { id: 'unicorn', label: 'Unicornio', emoji: '🦄' },
  { id: 'dragon', label: 'Dragon', emoji: '🐉' },
  { id: 'octopus', label: 'Pulpo', emoji: '🐙' },
  { id: 'butterfly', label: 'Mariposa', emoji: '🦋' },
  { id: 'turtle', label: 'Tortuga', emoji: '🐢' },
  { id: 'whale', label: 'Ballena', emoji: '🐋' },
  { id: 'eagle', label: 'Aguila', emoji: '🦅' },
  { id: 'wolf', label: 'Lobo', emoji: '🐺' },
];

export function getAvatarById(id: string | undefined): AvatarOption | undefined {
  return AVATAR_OPTIONS.find((a) => a.id === id);
}
