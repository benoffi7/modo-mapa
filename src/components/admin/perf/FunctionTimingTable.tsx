import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import type { FunctionTiming } from './perfHelpers';

interface Props {
  functions: Record<string, FunctionTiming>;
}

export default function FunctionTimingTable({ functions }: Props) {
  const entries = Object.entries(functions);

  if (entries.length === 0) {
    return <Alert severity="info">No hay datos de timing de funciones. Se agregan con el dailyMetrics diario.</Alert>;
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Function</TableCell>
            <TableCell align="right">p50</TableCell>
            <TableCell align="right">p95</TableCell>
            <TableCell align="right">Invocaciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {entries.map(([name, timing]) => (
            <TableRow key={name}>
              <TableCell>{name}</TableCell>
              <TableCell align="right">{Math.round(timing.p50)} ms</TableCell>
              <TableCell align="right">{Math.round(timing.p95)} ms</TableCell>
              <TableCell align="right">{timing.count}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
