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
      <div className="grid gap-8 lg:grid-cols-12 items-center">
        <div className="lg:col-span-7">
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#0f5838] mb-4">{heading}</h2>
          <p className="text-base leading-relaxed text-[#1b4332] mb-6">{description}</p>
          <p className="m-0">
            <a href={newsHref} className="btn btn-outline inline-flex items-center gap-2">
              {btnLabel} →
            </a>
          </p>
        </div>
        <div className="lg:col-span-5">
          <figure className="m-0 overflow-hidden rounded-2xl border border-[#0f5838]/20 shadow-lg bg-white">
            <img
              src="/img/plant-journey.jpg"
              alt={heading}
              width={640}
              height={400}
              className="w-full h-64 md:h-72 object-cover transition-transform duration-500 hover:scale-105"
              loading="lazy"
            />
            <figcaption className="p-3 text-xs text-center text-[#1b4332] font-semibold bg-[#f8faf7] border-t border-[#0f5838]/10">
              Lộ trình hiện đại hoá & lắp đặt dây chuyền công nghệ GMS Hưng Yên
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
