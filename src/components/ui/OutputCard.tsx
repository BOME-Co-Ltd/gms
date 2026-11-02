import type React from 'react';

export interface OutputCardProps {
  name: string;
  stateLabel: string;
  description: string;
}

export function OutputCard({ name, stateLabel, description }: OutputCardProps): React.ReactElement {
  return (
    <li className="card rounded-2xl border border-[#0F5838]/15 bg-white p-5 shadow-sm" data-testid="output-row">
      <strong className="text-lg font-bold text-[#0F5838]">{name}</strong> —{' '}
      <span className="badge inline-block rounded-full bg-[#0F5838]/10 px-3 py-1 text-sm font-bold text-[#0F5838]">
        {stateLabel}
      </span>
      <p className="mt-2 text-[#40773F]">{description}</p>
    </li>
  );
}
