'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SalesPerformanceChartPoint } from '@/lib/crmPipelineSalesPerformance';

const DASH_SHADOW = 'shadow-[0_2px_4px_rgba(15,23,42,0.12),0_8px_16px_-2px_rgba(15,23,42,0.22)]';
const LIGHT_SURFACE =
  'bg-[var(--theme-light)] dark:bg-[var(--theme-primary)]/15 border border-[var(--theme-primary)]/25';

const CHART_HEIGHT = 300;

type ChartRow = {
  name: string;
  axisLabel: string;
  revenue: number;
  profit: number;
};

function formatBarValue(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '';
  if (v >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)}L`;
  if (v >= 1000) return `₹${Math.round(v / 1000)}k`;
  return `₹${Math.round(v).toLocaleString('en-IN')}`;
}

/** e.g. "Week 3 (16 Mon-22 Sun)" → { name: "W3", axisLabel: "W3\n16–22" } */
function parseWeekChartLabel(fullLabel: string): { name: string; axisLabel: string } {
  const m = fullLabel.match(/^Week\s+(\d+)\s*\(([^)]+)\)/i);
  if (!m) {
    const short = fullLabel.match(/^Week\s+(\d+)/i);
    const name = short ? `W${short[1]}` : fullLabel.slice(0, 10);
    return { name, axisLabel: name };
  }
  const weekNo = m[1];
  const inner = m[2].replace(/\s+/g, ' ').trim();
  const daySpan = inner.match(/(\d+)\s*\w*-?\s*(\d+)/);
  const rangeStr = daySpan ? `${daySpan[1]}–${daySpan[2]}` : inner.replace(/\s+\w+/g, '').slice(0, 14);
  const name = `W${weekNo}`;
  const axisLabel = `${name}\n${rangeStr}`;
  return { name, axisLabel };
}

function buildChartRows(
  series: SalesPerformanceChartPoint[],
  weekOptions: { key: string; label: string }[]
): ChartRow[] {
  const source =
    series.length > 0
      ? series.map((p) => ({ label: p.weekLabel, revenue: p.revenue, profit: p.profit }))
      : weekOptions.map((w) => ({ label: w.label, revenue: 0, profit: 0 }));

  if (source.length > 0) {
    return source.map((p) => {
      const { name, axisLabel } = parseWeekChartLabel(p.label);
      return { name, axisLabel, revenue: p.revenue, profit: p.profit };
    });
  }

  return ['W1', 'W2', 'W3', 'W4', 'W5'].map((name) => ({
    name,
    axisLabel: name,
    revenue: 0,
    profit: 0,
  }));
}

function BarValueLabel(props: {
  x?: number;
  y?: number;
  width?: number;
  value?: number | string;
}) {
  const { x = 0, y = 0, width = 0, value } = props;
  const n = Number(value);
  const text = formatBarValue(n);
  if (!text) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 4}
      fill="#334155"
      fontSize={9}
      fontWeight={600}
      textAnchor="middle"
    >
      {text}
    </text>
  );
}

function WeekAxisTick(props: { x?: number | string; y?: number | string; payload?: { value?: string } }) {
  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const lines = String(props.payload?.value ?? '').split('\n');
  return (
    <g transform={`translate(${x},${y})`}>
      {lines.map((line, i) => (
        <text key={i} x={0} y={i * 13 + 4} textAnchor="middle" fill="#475569" fontSize={9} fontWeight={i === 0 ? 700 : 500}>
          {line}
        </text>
      ))}
    </g>
  );
}

export default function CrmPipelineRevenueProfitChart({
  series,
  weekOptions = [],
}: {
  series: SalesPerformanceChartPoint[];
  weekOptions?: { key: string; label: string }[];
}) {
  const data = useMemo(() => buildChartRows(series, weekOptions), [series, weekOptions]);

  const yMax = useMemo(() => {
    let max = 0;
    for (const row of data) {
      max = Math.max(max, row.revenue, row.profit);
    }
    return Math.max(max * 1.28, 1000);
  }, [data]);

  const hasActual = data.some((d) => d.revenue > 0 || d.profit > 0);

  return (
    <div className={`rounded-xl ${LIGHT_SURFACE} ${DASH_SHADOW} p-3 flex flex-col`}>
      <h3 className="text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-200 mb-2">
        Weekly revenue vs profit
      </h3>
      <div className="w-full" style={{ height: CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <BarChart
            data={data}
            margin={{ top: 28, right: 12, left: 4, bottom: 4 }}
            barCategoryGap="16%"
            barGap={4}
          >
            <CartesianGrid stroke="#cbd5e1" strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey="axisLabel"
              tick={WeekAxisTick}
              axisLine={{ stroke: '#94a3b8' }}
              tickLine={{ stroke: '#94a3b8' }}
              height={56}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#475569' }}
              axisLine={{ stroke: '#94a3b8' }}
              tickLine={{ stroke: '#94a3b8' }}
              domain={[0, yMax]}
              tickFormatter={(v) => {
                const n = Number(v);
                if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
                if (n >= 1000) return `₹${Math.round(n / 1000)}k`;
                return `₹${n}`;
              }}
            />
            <Tooltip
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as ChartRow | undefined;
                if (!row) return '';
                const opt = weekOptions.find((w) => parseWeekChartLabel(w.label).name === row.name);
                return opt?.label ?? row.axisLabel.replace('\n', ' ');
              }}
              formatter={(v) =>
                `₹${Number(v ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
              }
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="revenue" name="Revenue" fill="#b45309" radius={[4, 4, 0, 0]} minPointSize={3}>
              <LabelList dataKey="revenue" content={<BarValueLabel />} />
            </Bar>
            <Bar dataKey="profit" name="Profit" fill="#fbbf24" radius={[4, 4, 0, 0]} minPointSize={3}>
              <LabelList dataKey="profit" content={<BarValueLabel />} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {!hasActual ? (
        <p className="text-[10px] text-slate-500 mt-2 text-center">
          No revenue or profit in this period yet — week bars show at zero until data is recorded.
        </p>
      ) : null}
    </div>
  );
}