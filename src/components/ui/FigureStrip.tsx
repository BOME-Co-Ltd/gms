import type React from 'react';

export interface FigureItem {
  key: string;
  value: string;
  unit: string;
  label: string;
  source: string;
}

export interface FigureStripProps {
  eyebrow: string;
  title: string;
  ariaLabel: string;
  figures: FigureItem[];
}

export function FigureStrip({ eyebrow, title, ariaLabel, figures }: FigureStripProps): React.ReactElement | null {
  if (figures.length === 0) return null;
  return (
    <section
      className="section-block my-7 rounded-2xl border border-[#0F5838]/15 bg-white p-6 shadow-sm"
      data-testid="figures-strip"
      aria-label={ariaLabel}
    >
      <p className="eyebrow text-xs font-bold uppercase tracking-wider text-[#27673C]">{eyebrow}</p>
      <h2 className="mb-4 text-2xl font-extrabold text-[#0F5838]">{title}</h2>
      <ul className="grid-cards grid gap-4 md:grid-cols-3">
        {figures.map((f) => (
          <li key={f.key} className="stat-card rounded-lg border border-l-4 border-[#0F5838]/15 border-l-[#9FB43B] p-4">
            <strong className="stat-value block text-3xl font-extrabold text-[#0F5838]">
              {f.value} {f.unit}
            </strong>
            <span className="text-[#40773F]">{f.label}</span> <small className="text-[#40773F]">({f.source})</small>
          </li>
        ))}
      </ul>
    </section>
  );
}
