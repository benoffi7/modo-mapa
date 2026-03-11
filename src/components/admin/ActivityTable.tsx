import type { ReactNode } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

interface Column<T> {
  label: string;
  render: (item: T) => ReactNode;
}

interface ActivityTableProps<T> {
  items: T[];
  columns: Column<T>[];
  emptyMessage?: string;
}

export default function ActivityTable<T>({ items, columns, emptyMessage = 'Sin datos' }: ActivityTableProps<T>) {
  if (items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
        {emptyMessage}
      </Typography>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            {columns.map((col, idx) => (
              <TableCell key={idx}>{col.label}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item, idx) => (
            <TableRow key={idx}>
              {columns.map((col, colIdx) => (
                <TableCell key={colIdx}>{col.render(item)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
