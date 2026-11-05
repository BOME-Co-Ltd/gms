'use client';

import { ArrowLeft, ArrowRight } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

export interface VpdStepItem {
  num: string;
  title: string;
  desc: string;
  chips: string[];
  isLoop?: boolean;
}

export interface VpdStepperProps {
  eyebrow: string;
  title: string;
  lead: string;
  prevLabel: string;
  playLabel: string;
  stopLabel: string;
  nextLabel: string;
  steps: VpdStepItem[];
}

export function VpdStepper({
  eyebrow,
  title,
  lead,
  prevLabel,
  playLabel,
  stopLabel,
  nextLabel,
  steps,
}: VpdStepperProps): React.ReactElement {
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const count = Math.max(1, steps.length);
  const goPrev = () => {
    setPlaying(false);
    setActiveIndex((cur) => (cur - 1 + count) % count);
  };
  const goNext = () => {
    setPlaying(false);
    setActiveIndex((cur) => (cur + 1) % count);
  };
  const togglePlay = () => {
    setPlaying((p) => !p);
  };

  return (
    <section className="section-block" aria-labelledby="vpd-title">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id="vpd-title">{title}</h2>
      <p>{lead}</p>
      <div className="step-controls">
        <button type="button" className="btn btn-outline" onClick={goPrev}>
          <ArrowLeft size={18} aria-hidden="true" focusable="false" /> {prevLabel}
        </button>
        <button type="button" className="btn" aria-pressed={playing} onClick={togglePlay}>
          {playing ? stopLabel : playLabel}
        </button>
        <button type="button" className="btn btn-outline" onClick={goNext}>
          {nextLabel} <ArrowRight size={18} aria-hidden="true" focusable="false" />
        </button>
      </div>
      <ol className="steps">
        {steps.map((s, idx) => {
          const isActive = idx === activeIndex;
          return (
            <li key={s.num} className={`step${isActive ? ' is-active' : ''}${s.isLoop ? ' loop' : ''}`}>
              <button
                type="button"
                className="step-head"
                aria-current={isActive ? 'step' : undefined}
                onClick={() => {
                  setPlaying(false);
                  setActiveIndex(idx);
                }}
              >
                <span className="step-num">{s.num}</span>
                <span className="step-title">{s.title}</span>
              </button>
              <p>{s.desc}</p>
              {s.chips.length > 0 ? (
                <ul className="chips">
                  {s.chips.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
