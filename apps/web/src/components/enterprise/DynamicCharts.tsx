'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────

export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'radar';
  title: string;
  data: Array<Record<string, any>>;
  xKey?: string;
  series?: Array<{ key: string; color?: string; label?: string }>;
}

const COLORS = [
  '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

// ── Main Component ────────────────────────────────────────────

export default function DynamicCharts({ charts }: { charts: ChartData[] }) {
  if (!charts || charts.length === 0) return null;

  return (
    <div className="space-y-4 mt-3">
      {charts.map((chart, idx) => (
        <div
          key={idx}
          className="bg-gray-800/40 border border-gray-700/30 rounded-xl p-4"
        >
          <h4 className="text-xs font-semibold text-gray-300 mb-3">{chart.title}</h4>
          <div className="h-52">
            <ChartRenderer chart={chart} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Chart Router ──────────────────────────────────────────────

function ChartRenderer({ chart }: { chart: ChartData }) {
  switch (chart.type) {
    case 'bar':
      return <BarChartView chart={chart} />;
    case 'line':
      return <LineChartView chart={chart} />;
    case 'pie':
      return <PieChartView chart={chart} />;
    case 'radar':
      return <RadarChartView chart={chart} />;
    default:
      return <BarChartView chart={chart} />;
  }
}

// ── Bar Chart ─────────────────────────────────────────────────

function BarChartView({ chart }: { chart: ChartData }) {
  const xKey = chart.xKey || (chart.data[0] ? Object.keys(chart.data[0])[0] : 'name');
  const series = useMemo(() => {
    if (chart.series) return chart.series;
    if (!chart.data[0]) return [];
    return Object.keys(chart.data[0])
      .filter(k => k !== xKey && typeof chart.data[0][k] === 'number')
      .map((k, i) => ({ key: k, color: COLORS[i % COLORS.length], label: k }));
  }, [chart, xKey]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chart.data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey={xKey} tick={{ fill: '#9ca3af', fontSize: 10 }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
        <Tooltip
          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: '#e5e7eb' }}
        />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} />}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} fill={s.color || COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} name={s.label || s.key} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Line Chart ────────────────────────────────────────────────

function LineChartView({ chart }: { chart: ChartData }) {
  const xKey = chart.xKey || (chart.data[0] ? Object.keys(chart.data[0])[0] : 'name');
  const series = useMemo(() => {
    if (chart.series) return chart.series;
    if (!chart.data[0]) return [];
    return Object.keys(chart.data[0])
      .filter(k => k !== xKey && typeof chart.data[0][k] === 'number')
      .map((k, i) => ({ key: k, color: COLORS[i % COLORS.length], label: k }));
  }, [chart, xKey]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chart.data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey={xKey} tick={{ fill: '#9ca3af', fontSize: 10 }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
        <Tooltip
          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: '#e5e7eb' }}
        />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} />}
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            stroke={s.color || COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={{ fill: s.color || COLORS[i % COLORS.length], r: 3 }}
            name={s.label || s.key}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Pie Chart ─────────────────────────────────────────────────

function PieChartView({ chart }: { chart: ChartData }) {
  const nameKey = chart.xKey || (chart.data[0] ? Object.keys(chart.data[0])[0] : 'name');
  const valueKey = useMemo(() => {
    if (chart.series?.[0]) return chart.series[0].key;
    if (!chart.data[0]) return 'value';
    return Object.keys(chart.data[0]).find(k => k !== nameKey && typeof chart.data[0][k] === 'number') || 'value';
  }, [chart, nameKey]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chart.data}
          dataKey={valueKey}
          nameKey={nameKey}
          cx="50%"
          cy="50%"
          outerRadius={70}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={{ stroke: '#6b7280' }}
        >
          {chart.data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── Radar Chart ───────────────────────────────────────────────

function RadarChartView({ chart }: { chart: ChartData }) {
  const subjectKey = chart.xKey || (chart.data[0] ? Object.keys(chart.data[0])[0] : 'subject');
  const series = useMemo(() => {
    if (chart.series) return chart.series;
    if (!chart.data[0]) return [];
    return Object.keys(chart.data[0])
      .filter(k => k !== subjectKey && typeof chart.data[0][k] === 'number')
      .map((k, i) => ({ key: k, color: COLORS[i % COLORS.length], label: k }));
  }, [chart, subjectKey]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chart.data}>
        <PolarGrid stroke="#374151" />
        <PolarAngleAxis dataKey={subjectKey} tick={{ fill: '#9ca3af', fontSize: 9 }} />
        <PolarRadiusAxis tick={{ fill: '#6b7280', fontSize: 9 }} />
        {series.map((s, i) => (
          <Radar
            key={s.key}
            name={s.label || s.key}
            dataKey={s.key}
            stroke={s.color || COLORS[i % COLORS.length]}
            fill={s.color || COLORS[i % COLORS.length]}
            fillOpacity={0.2}
          />
        ))}
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} />}
        <Tooltip
          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
