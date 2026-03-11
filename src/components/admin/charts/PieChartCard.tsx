import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#1976d2', '#388e3c', '#f57c00', '#d32f2f', '#7b1fa2', '#0097a7', '#455a64', '#c2185b'];

interface PieChartCardProps {
  title: string;
  data: Array<{ name: string; value: number }>;
}

export default function PieChartCard({ title, data }: PieChartCardProps) {
  const hasData = data.some((d) => d.value > 0);

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        {!hasData ? (
          <Typography variant="body2" color="text.secondary">
            Sin datos
          </Typography>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {data.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
