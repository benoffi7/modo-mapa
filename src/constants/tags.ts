export const PREDEFINED_TAGS = [
  { id: 'barato', label: 'Barato', icon: 'AttachMoney' },
  { id: 'apto_celiacos', label: 'Apto celíacos', icon: 'NoFood' },
  { id: 'apto_veganos', label: 'Apto veganos', icon: 'Eco' },
  { id: 'rapido', label: 'Rápido', icon: 'Speed' },
  { id: 'delivery', label: 'Delivery', icon: 'DeliveryDining' },
  { id: 'buena_atencion', label: 'Buena atención', icon: 'ThumbUp' },
] as const;

export const VALID_TAG_IDS: readonly string[] = [
  'barato', 'apto_celiacos', 'apto_veganos',
  'rapido', 'delivery', 'buena_atencion',
];
