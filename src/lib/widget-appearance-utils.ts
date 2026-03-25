import type { WidgetAppearance, WidgetChrome } from "@/types/analytics-pivot";

/** Acepta solo #rgb, #rrggbb o #rrggbbaa (rechaza valores mal formados). */
export function parseSafeHexColor(raw: string | undefined | null): string | undefined {
  if (raw == null || typeof raw !== "string") return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(s)) return s;
  return undefined;
}

/** Normaliza chrome leído de JSON (camelCase o snake_case). */
export function coalesceWidgetChrome(raw: unknown): WidgetChrome | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const sh = o.showHeader ?? o.show_header;
  const title = o.title;
  const out: WidgetChrome = {};
  if (typeof title === "string" && title.trim()) out.title = title.trim();
  if (sh === false) out.showHeader = false;
  else if (sh === true) out.showHeader = true;
  return Object.keys(out).length ? out : undefined;
}

export function boardWidgetChromeShowsHeader(chrome: unknown): boolean {
  const c = coalesceWidgetChrome(chrome);
  return c?.showHeader !== false;
}

export function sanitizeWidgetAppearance(a: WidgetAppearance | undefined | null): WidgetAppearance | undefined {
  if (!a || typeof a !== "object") return undefined;
  const out: WidgetAppearance = {};
  const pc = parseSafeHexColor(a.primaryColor);
  const sc = parseSafeHexColor(a.secondaryColor);
  const bg = parseSafeHexColor(a.backgroundColor);
  if (pc) out.primaryColor = pc;
  if (sc) out.secondaryColor = sc;
  if (bg) out.backgroundColor = bg;
  if (a.accentPalette?.length) {
    const pal = a.accentPalette.map((x) => parseSafeHexColor(x)).filter((x): x is string => !!x);
    if (pal.length) out.accentPalette = pal;
  }
  if (a.borderRadiusPx != null && Number.isFinite(Number(a.borderRadiusPx))) {
    out.borderRadiusPx = Math.max(0, Math.round(Number(a.borderRadiusPx)));
  }
  if (a.showLegend !== undefined) out.showLegend = a.showLegend;
  if (a.showGridLines !== undefined) out.showGridLines = a.showGridLines;
  return Object.keys(out).length ? out : undefined;
}
