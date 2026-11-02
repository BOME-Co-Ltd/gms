import type React from 'react';

export interface HeroSectionProps {
  pillars: string[];
  title: string;
  subtitle: string;
  ctaTechLabel: string;
  ctaTechHref: string;
  ctaContactLabel: string;
  ctaContactHref: string;
  coverSrc: string;
  coverAlt: string;
  photoBadgeLabel: string;
}

export function HeroSection({
  pillars,
  title,
  subtitle,
  ctaTechLabel,
  ctaTechHref,
  ctaContactLabel,
  ctaContactHref,
  coverSrc,
  coverAlt,
  photoBadgeLabel,
}: HeroSectionProps): React.ReactElement {
  return (
    <section className="hero-banner on-dark" data-testid="home-hero">
      <div className="hero-grid">
        <div>
          <ul className="pills">
            {pillars.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <h1>{title}</h1>
          <p>{subtitle}</p>
          <p className="mt-5 flex flex-wrap gap-3">
            <a href={ctaTechHref} className="btn btn-light">
              {ctaTechLabel} →
            </a>
            <a href={ctaContactHref} className="btn btn-ghost" data-testid="cta-contact">
              {ctaContactLabel}
            </a>
          </p>
        </div>
        <figure className="hero-media" data-testid="home-cover">
          <img src={coverSrc} alt={coverAlt} width={1024} height={1024} />
          <figcaption className="photo-badge" data-testid="photo-label">
            {photoBadgeLabel}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
