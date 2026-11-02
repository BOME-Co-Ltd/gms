import type React from 'react';

export interface PillarCardData {
  num: string;
  title: string;
  desc: string;
  chips: string[];
}

export interface PillarsSectionProps {
  eyebrow: string;
  heading: string;
  cards: PillarCardData[];
}

export function PillarsSection({ eyebrow, heading, cards }: PillarsSectionProps): React.ReactElement {
  return (
    <section className="section-block" aria-labelledby="pillars-title">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id="pillars-title">{heading}</h2>
      <ul className="grid-cards">
        {cards.map((card) => (
          <li key={card.num} className="card">
            <span className="card-num" aria-hidden="true">
              {card.num}
            </span>
            <h3>{card.title}</h3>
            <p>{card.desc}</p>
            <ul className="chips">
              {card.chips.map((chip) => (
                <li key={chip}>{chip}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
