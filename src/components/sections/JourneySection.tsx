import type React from 'react';

export interface JourneySectionProps {
  eyebrow: string;
  heading: string;
  description: string;
  newsHref: string;
  btnLabel: string;
}

export function JourneySection({
  eyebrow,
  heading,
  description,
  newsHref,
  btnLabel,
}: JourneySectionProps): React.ReactElement {
  return (
    <section className="section-block section-alt" data-testid="home-journey">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{heading}</h2>
      <p>{description}</p>
      <p>
        <a href={newsHref} className="btn btn-outline">
          {btnLabel}
        </a>
      </p>
    </section>
  );
}
