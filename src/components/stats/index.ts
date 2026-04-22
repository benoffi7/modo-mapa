// Eager: solo componentes sin recharts (MUI puro).
// PieChartCard NO se exporta aqui — arrastra recharts (~374KB). Usar React.lazy desde el consumer.
export { default as TopList } from './TopList';
// Tipos OK: solo inferencia, no pesan runtime.
export type { PieChartCardProps } from './PieChartCard';
