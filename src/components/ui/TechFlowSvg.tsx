import type React from 'react';

export interface TechFlowSvgProps {
  locale: 'vi' | 'en';
  ariaLabel: string;
}

export function TechFlowSvg({ locale, ariaLabel }: TechFlowSvgProps): React.ReactElement {
  const isVi = locale === 'vi';
  return (
    <section className="diagram-box" data-testid="tech-diagram" aria-label={ariaLabel}>
      {/* Desktop Wide SVG (>= 768px) */}
      <svg className="flow-svg flow-wide" viewBox="0 0 1000 380" role="img" aria-label={ariaLabel}>
        <defs>
          <marker id="ah-w" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0L10 5L0 10z" fill="#368F3D" />
          </marker>
          <marker id="ah-wb" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0L10 5L0 10z" fill="#1D6FB6" />
          </marker>
        </defs>
        <g>
          <path className="wire" d="M190 190 C240 190 240 90 286 90" markerEnd="url(#ah-w)" />
          <path className="wire blue" d="M190 190 C240 190 240 290 286 290" markerEnd="url(#ah-wb)" />
          <path className="wire" d="M480 90 C525 90 525 44 566 44" markerEnd="url(#ah-w)" />
          <path className="wire" d="M480 90 C525 90 525 96 566 96" markerEnd="url(#ah-w)" />
          <path className="wire" d="M480 90 C525 90 525 148 566 148" markerEnd="url(#ah-w)" />
          <path className="wire blue" d="M480 290 C525 290 525 232 566 232" markerEnd="url(#ah-wb)" />
          <path className="wire blue" d="M480 290 C525 290 525 284 566 284" markerEnd="url(#ah-wb)" />
          <path className="wire blue" d="M480 290 C525 290 525 336 566 336" markerEnd="url(#ah-wb)" />
          <path className="wire" d="M750 44 C795 44 795 190 826 190" />
          <path className="wire" d="M750 96 C795 96 795 190 826 190" />
          <path className="wire" d="M750 148 C795 148 795 190 826 190" />
          <path className="wire blue" d="M750 232 C795 232 795 190 826 190" />
          <path className="wire blue" d="M750 284 C795 284 795 190 826 190" />
          <path className="wire blue" d="M750 336 C795 336 795 190 826 190" />
        </g>
        <g className="node dark">
          <rect x="20" y="160" width="170" height="60" rx="12" />
          <text x="105" y="190" textAnchor="middle" dominantBaseline="central">
            {isVi ? 'Chất thải đầu vào' : 'Incoming waste'}
          </text>
        </g>
        <g className="node green">
          <rect x="290" y="60" width="190" height="60" rx="12" />
          <text x="385" y="90" textAnchor="middle" dominantBaseline="central">
            {isVi ? 'Sàng tuyển' : 'Sorting'}
          </text>
        </g>
        <g className="node blue">
          <rect x="290" y="260" width="190" height="60" rx="12" />
          <text x="385" y="290" textAnchor="middle" dominantBaseline="central">
            {isVi ? 'Công nghệ VPD' : 'VPD technology'}
          </text>
        </g>
        <g className="node out">
          <rect x="570" y="22" width="180" height="44" rx="22" />
          <text x="660" y="44" textAnchor="middle" dominantBaseline="central">
            {isVi ? 'Nilon' : 'Plastic film'}
          </text>
        </g>
        <g className="node out">
          <rect x="570" y="74" width="180" height="44" rx="22" />
          <text x="660" y="96" textAnchor="middle" dominantBaseline="central">
            {isVi ? 'Mùn hữu cơ' : 'Organic humus'}
          </text>
        </g>
        <g className="node out">
          <rect x="570" y="126" width="180" height="44" rx="22" />
          <text x="660" y="148" textAnchor="middle" dominantBaseline="central">
            RDF
          </text>
        </g>
        <g className="node out vpd">
          <rect x="570" y="210" width="180" height="44" rx="22" />
          <text x="660" y="232" textAnchor="middle" dominantBaseline="central">
            Syngas
          </text>
        </g>
        <g className="node out vpd">
          <rect x="570" y="262" width="180" height="44" rx="22" />
          <text x="660" y="284" textAnchor="middle" dominantBaseline="central">
            {isVi ? 'Than hoạt tính' : 'Activated carbon'}
          </text>
        </g>
        <g className="node out vpd">
          <rect x="570" y="314" width="180" height="44" rx="22" />
          <text x="660" y="336" textAnchor="middle" dominantBaseline="central">
            {isVi ? 'Dầu tái chế' : 'Recycled oil'}
          </text>
        </g>
        <g className="node dark">
          <rect x="830" y="146" width="150" height="88" rx="14" />
          <text x="905" y="178" textAnchor="middle" dominantBaseline="central">
            {isVi ? 'Tài nguyên' : 'Resources back'}
          </text>
          <text x="905" y="202" textAnchor="middle" dominantBaseline="central">
            {isVi ? 'quay lại chu trình' : 'into use'}
          </text>
        </g>
        <circle className="dot" cx="826" cy="190" r="5" />
      </svg>

      {/* Mobile Tall SVG (< 768px) */}
      <svg className="flow-svg flow-tall" viewBox="0 0 360 500" role="img" aria-label={ariaLabel}>
        <defs>
          <marker id="ah-t" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0L10 5L0 10z" fill="#368F3D" />
          </marker>
          <marker id="ah-tb" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0L10 5L0 10z" fill="#1D6FB6" />
          </marker>
        </defs>
        <path className="wire" d="M180 68 C180 94 94 90 94 114" markerEnd="url(#ah-t)" />
        <path className="wire blue" d="M180 68 C180 94 266 90 266 114" markerEnd="url(#ah-tb)" />
        <path className="wire" d="M94 172 L94 356" />
        <path className="wire blue" d="M266 172 L266 356" />
        <path className="wire" d="M94 356 C94 396 180 392 180 420" markerEnd="url(#ah-t)" />
        <path className="wire blue" d="M266 356 C266 396 180 392 180 420" markerEnd="url(#ah-tb)" />
        <g className="node dark">
          <rect x="80" y="16" width="200" height="52" rx="12" />
          <text x="180" y="42" textAnchor="middle" dominantBaseline="central">
            {isVi ? 'Chất thải đầu vào' : 'Incoming waste'}
          </text>
        </g>
        <g className="node green">
          <rect x="16" y="120" width="156" height="52" rx="12" />
          <text x="94" y="146" textAnchor="middle" dominantBaseline="central">
            {isVi ? 'Sàng tuyển' : 'Sorting'}
          </text>
        </g>
        <g className="node blue">
          <rect x="188" y="120" width="156" height="52" rx="12" />
          <text x="266" y="146" textAnchor="middle" dominantBaseline="central">
            {isVi ? 'Công nghệ VPD' : 'VPD technology'}
          </text>
        </g>
        <g className="node out">
          <rect x="24" y="210" width="140" height="40" rx="20" />
          <text x="94" y="230" textAnchor="middle" dominantBaseline="central">
            {isVi ? 'Nilon' : 'Plastic film'}
          </text>
        </g>
        <g className="node out">
          <rect x="24" y="262" width="140" height="40" rx="20" />
          <text x="94" y="282" textAnchor="middle" dominantBaseline="central">
            {isVi ? 'Mùn hữu cơ' : 'Organic humus'}
          </text>
        </g>
        <g className="node out">
          <rect x="24" y="314" width="140" height="40" rx="20" />
          <text x="94" y="334" textAnchor="middle" dominantBaseline="central">
            RDF
          </text>
        </g>
        <g className="node out vpd">
          <rect x="196" y="210" width="140" height="40" rx="20" />
          <text x="266" y="230" textAnchor="middle" dominantBaseline="central">
            Syngas
          </text>
        </g>
        <g className="node out vpd">
          <rect x="196" y="262" width="140" height="40" rx="20" />
          <text x="266" y="282" textAnchor="middle" dominantBaseline="central">
            {isVi ? 'Than hoạt tính' : 'Activated carbon'}
          </text>
        </g>
        <g className="node out vpd">
          <rect x="196" y="314" width="140" height="40" rx="20" />
          <text x="266" y="334" textAnchor="middle" dominantBaseline="central">
            {isVi ? 'Dầu tái chế' : 'Recycled oil'}
          </text>
        </g>
        <g className="node dark">
          <rect x="40" y="426" width="280" height="56" rx="14" />
          <text x="180" y="454" textAnchor="middle" dominantBaseline="central">
            {isVi ? 'Tài nguyên quay lại chu trình' : 'Resources back into use'}
          </text>
        </g>
      </svg>

      <div className="grid-cards mt-5">
        <div className="card" data-branch="screening">
          <h3>{isVi ? 'Nhánh 1: Sàng tuyển' : 'Branch 1: Sorting (Screening)'}</h3>
          <ul>
            <li data-stage="feeding" style={{ fontSize: 16 }}>
              {isVi ? '1. Cấp liệu đều lên dây chuyền' : '1. Even feeding onto the line'}
            </li>
            <li data-stage="bag-opening" style={{ fontSize: 16 }}>
              {isVi ? '2. Mở bao tách rời vật liệu' : '2. Bag opening to separate contents'}
            </li>
            <li data-stage="rotary-screening" style={{ fontSize: 16 }}>
              {isVi
                ? '3. Lồng tuyển phân loại & thu từng dòng (Nilon, Mùn hữu cơ, RDF)'
                : '3. Rotary screening & stream collection (Plastic film, Organic humus, RDF)'}
            </li>
          </ul>
        </div>
        <div className="card" data-branch="vpd">
          <h3>{isVi ? 'Nhánh 2: Công nghệ VPD' : 'Branch 2: VPD Technology'}</h3>
          <ul>
            <li data-stage="pretreatment" style={{ fontSize: 16 }}>
              {isVi
                ? '1. Tiếp nhận, mở bao, ép tách nước & sấy giảm ẩm'
                : '1. Intake, bag opening, dewatering press & drying'}
            </li>
            <li data-stage="thermal-decomposition" style={{ fontSize: 16 }}>
              {isVi
                ? '2. Phân huỷ nhiệt trong buồng kín thu than hoạt tính'
                : '2. Closed-chamber thermal decomposition recovering activated carbon'}
            </li>
            <li data-stage="gas-cleaning-loop" style={{ fontSize: 16 }}>
              {isVi
                ? '3. Làm sạch tách dòng khí (dầu tái chế, syngas) & vòng hồi lưu nhiệt'
                : '3. Gas cleaning & separation (recycled oil, syngas) & thermal return loop'}
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
