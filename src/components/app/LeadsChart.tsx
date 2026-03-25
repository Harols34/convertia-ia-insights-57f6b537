import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(190 70% 50%)",
  "hsl(220 60% 55%)",
  "hsl(340 65% 50%)",
];

interface ChartData {
  name: string;
  value: number;
}

export function LeadsBarChart({ data, title }: { data: ChartData[]; title: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
      <h3 className="font-display font-semibold text-sm mb-1">{title}</h3>
      <p className="text-[11px] text-muted-foreground mb-4">{data.length} categorías · Top 10</p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data.slice(0, 10)} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" angle={-35} textAnchor="end" height={65} />
          <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 10,
              fontSize: 12,
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
          />
          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LeadsPieChart({ data, title }: { data: ChartData[]; title: string }) {
  const top = data.slice(0, 8);
  return (
    <div className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
      <h3 className="font-display font-semibold text-sm mb-1">{title}</h3>
      <p className="text-[11px] text-muted-foreground mb-4">{data.length} categorías</p>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={top}
            cx="50%"
            cy="50%"
            outerRadius={95}
            innerRadius={50}
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
            fontSize={10}
            paddingAngle={2}
          >
            {top.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 10,
              fontSize: 12,
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
