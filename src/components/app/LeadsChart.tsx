import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 200 80% 55%))",
  "hsl(var(--chart-3, 160 60% 45%))",
  "hsl(var(--chart-4, 280 65% 60%))",
  "hsl(var(--chart-5, 30 80% 55%))",
  "hsl(190, 70%, 50%)",
  "hsl(220, 60%, 55%)",
  "hsl(340, 65%, 50%)",
];

interface ChartData {
  name: string;
  value: number;
}

export function LeadsBarChart({ data, title }: { data: ChartData[]; title: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-display font-semibold text-sm mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data.slice(0, 10)} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" angle={-30} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LeadsPieChart({ data, title }: { data: ChartData[]; title: string }) {
  const top = data.slice(0, 8);
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-display font-semibold text-sm mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={top} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
            {top.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
