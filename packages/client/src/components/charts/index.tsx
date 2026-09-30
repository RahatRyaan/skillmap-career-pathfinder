/**
 * Chart components.
 *
 * Recharts is used for bars, radar, and trends. React Flow is used for the
 * skill map. Both are lazily loaded by the routes that need them, because
 * together they are a large part of the bundle.
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { GapLabel } from '@skillmap/shared';
import { ChartFrame, type ChartDatum } from './ChartFrame';
import { GAP_LABEL_COPY } from '@/lib/utils';

const GAP_FILL: Record<string, string> = {
  strong: '#16a34a',
  developing: '#d97706',
  gap: '#ea580c',
  critical: '#dc2626',
};

interface SkillBarDatum {
  skillName: string;
  currentLevel: number;
  requiredLevel: number;
  label: string;
}

export function SkillBars({ data }: { data: SkillBarDatum[] }) {
  return (
    <ChartFrame
      title="Your skills against this career"
      description="Your current level and the level this career requires."
      data={data.map((d) => ({
        label: d.skillName,
        value: d.currentLevel,
        secondary: `Required ${d.requiredLevel} · ${GAP_LABEL_COPY[d.label]?.label ?? d.label}`,
      }))}
      unit="Level"
    >
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-[rgb(var(--border))]" />
          <XAxis type="number" domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} fontSize={12} />
          <YAxis type="category" dataKey="skillName" width={110} fontSize={12} />
          <Tooltip />
          <Legend />
          <Bar dataKey="currentLevel" name="Your level" fill="#2563eb" radius={[0, 4, 4, 0]} />
          <Bar dataKey="requiredLevel" name="Required level" fill="#d1d5db" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

interface CategoryDatum {
  category: string;
  average: number;
  count: number;
}

export function CategoryRadar({ data }: { data: CategoryDatum[] }) {
  return (
    <ChartFrame
      title="Coverage by category"
      description="How much of each skill category you have covered, as a percentage."
      data={data.map((d) => ({
        label: d.category,
        value: d.average,
        secondary: `${d.count} skills`,
      }))}
      unit="Percent"
    >
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data} outerRadius="70%">
          <PolarGrid stroke="rgb(209 213 219)" />
          <PolarAngleAxis dataKey="category" fontSize={12} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar dataKey="average" stroke="#2563eb" fill="#2563eb" fillOpacity={0.25} />
          <Tooltip />
        </RadarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

interface TrendPoint {
  takenAt: string;
  percent: number;
}

export function AlignmentTrend({ data }: { data: TrendPoint[] }) {
  const formatted = data.map((p) => ({ ...p, date: new Date(p.takenAt).toLocaleDateString() }));

  return (
    <ChartFrame
      title="Alignment over time"
      description="Each point is a snapshot taken when your skills or career changed."
      data={formatted.map((p) => ({ label: p.date, value: p.percent }))}
      unit="Percent"
    >
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={formatted} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(229 231 235)" />
          <XAxis dataKey="date" fontSize={12} tickLine={false} />
          <YAxis domain={[0, 100]} fontSize={12} width={40} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="percent"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 3 }}
            name="Alignment %"
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

interface GapDistributionDatum {
  label: GapLabel;
  count: number;
}

export function GapDistribution({ data }: { data: GapDistributionDatum[] }) {
  return (
    <ChartFrame
      title="Where your gaps are"
      description="How many required skills fall into each gap label."
      data={data.map((d) => ({ label: GAP_LABEL_COPY[d.label]?.label ?? d.label, value: d.count }))}
      unit="Skills"
    >
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(229 231 235)" />
          <XAxis dataKey="label" fontSize={12} tickLine={false} />
          <YAxis allowDecimals={false} fontSize={12} width={32} />
          <Tooltip />
          <Bar dataKey="count" name="Skills" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.label} fill={GAP_FILL[entry.label] ?? '#2563eb'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export { ChartFrame };
export type { ChartDatum };
