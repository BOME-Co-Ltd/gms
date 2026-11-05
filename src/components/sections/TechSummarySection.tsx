import { ArrowRight } from 'lucide-react';
import type React from 'react';

export interface TechSummarySectionProps {
  locale: 'vi' | 'en';
  eyebrow: string;
  heading: string;
  lead: string;
  btnLabel: string;
  techHref: string;
}

export function TechSummarySection({
  locale,
  eyebrow,
  heading,
  lead,
  btnLabel,
  techHref,
}: TechSummarySectionProps): React.ReactElement {
  const isVi = locale === 'vi';
  const diagramAria = isVi
    ? 'Sơ đồ: chất thải đầu vào chia hai nhánh. Sàng tuyển ra nilon, mùn hữu cơ, RDF. Công nghệ VPD ra syngas, than hoạt tính, dầu tái chế.'
    : 'Diagram: incoming waste splits into two branches. Sorting yields plastic film, organic humus and RDF. VPD technology yields syngas, activated carbon and recycled oil.';

  return (
    <section className="section-block section-dark on-dark" data-testid="home-branches">
      <div className="split">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{heading}</h2>
          <p>{lead}</p>
          <p>
            <a className="btn btn-light" href={techHref}>
              {btnLabel} <ArrowRight size={18} aria-hidden="true" focusable="false" />
            </a>
          </p>
        </div>
        <div className="mini-flow" role="img" aria-label={diagramAria}>
          <div className="mf-node mf-in">{isVi ? 'Chất thải đầu vào' : 'Incoming waste'}</div>
          <div className="mf-branches">
            <div className="mf-branch">
              <div className="mf-node">{isVi ? 'Sàng tuyển' : 'Sorting'}</div>
              <ul className="mf-out">
                <li>{isVi ? 'Nilon' : 'Plastic film'}</li>
                <li>{isVi ? 'Mùn hữu cơ' : 'Organic humus'}</li>
                <li>RDF</li>
              </ul>
            </div>
            <div className="mf-branch">
              <div className="mf-node">{isVi ? 'Công nghệ VPD' : 'VPD technology'}</div>
              <ul className="mf-out">
                <li>Syngas</li>
                <li>{isVi ? 'Than hoạt tính' : 'Activated carbon'}</li>
                <li>{isVi ? 'Dầu tái chế' : 'Recycled oil'}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
