import { useState, useCallback } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface LineConfig {
  dataKey: string;
  color: string;
  label: string;
}

interface LineChartCardProps {
  title: string;
  data: Array<Record<string, string | number>>;
  lines: LineConfig[];
  xAxisKey?: string;
}

export default function LineChartCard({ title, data, lines, xAxisKey = 'date' }: LineChartCardProps) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const handleLegendClick = useCallback((entry: { dataKey?: string | number }) => {
    const key = String(entry.dataKey ?? '');
    if (!key) return;
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        {data.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Sin datos
          </Typography>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxisKey} fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend
                onClick={handleLegendClick}
                wrapperStyle={{ cursor: 'pointer' }}
                formatter={(value: string, entry) => (
                  <span style={{ color: hidden.has(String(entry.dataKey ?? '')) ? '#ccc' : entry.color }}>
                    {value}
                  </span>
                )}
              />
              {lines.map((line) => (
                <Line
                  key={line.dataKey}
                  type="monotone"
                  dataKey={line.dataKey}
                  name={line.label}
                  stroke={line.color}
                  strokeWidth={2}
                  dot={false}
                  hide={hidden.has(line.dataKey)}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
