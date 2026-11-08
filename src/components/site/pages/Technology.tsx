// M4 Công nghệ — wireframe technology.html (green v0.3.8): đầu trang + sơ đồ hai nhánh + nhánh Sàng tuyển + nhánh VPD.
// Bảng so sánh (sec-cmp) ẩn hẳn: chưa có số có nguồn (U16/S33).
import type React from 'react';
import type { LoadedSiteContent, Locale } from '../../../content/loader.ts';
import { Icon } from '../icons.tsx';
import { BoardFigure, CtaSection, Html, pick, SubHero } from '../parts.tsx';

interface Step {
  title: string;
  desc: string;
  chips?: string[];
  loop?: boolean;
}

const VPD_VI: Step[] = [
  {
    title: 'Tiếp nhận và lưu chứa',
    desc: 'Nguyên liệu đầu vào được tập kết trong kho có mái che trước khi lên dây chuyền.',
  },
  { title: 'Mở bao, đánh tơi', desc: 'Bao túi được mở, khối nguyên liệu được đánh tơi để nước tự do thoát bớt.' },
  { title: 'Ép tách nước', desc: 'Máy ép giảm tiếp lượng nước còn lại trong nguyên liệu.' },
  { title: 'Sấy giảm ẩm', desc: 'Nguyên liệu được sấy tuần hoàn tới độ ẩm phù hợp cho công đoạn nhiệt.' },
  {
    title: 'Phân huỷ nhiệt',
    desc: 'Trong buồng kín, nguyên liệu được phân huỷ bằng nhiệt; phần rắn còn lại được thu riêng.',
    chips: ['Than hoạt tính'],
  },
  {
    title: 'Làm sạch và tách dòng khí',
    desc: 'Hỗn hợp khí được làm nguội, lắng bụi rồi tách thành các dòng riêng.',
    chips: ['Dầu tái chế', 'Nước tách ra', 'Syngas'],
  },
  { title: 'Làm khô và lưu chứa khí', desc: 'Syngas được làm khô rồi đưa vào bồn chứa thành phẩm.' },
  { title: 'Vòng hồi lưu', desc: 'Một phần syngas quay lại cấp nhiệt cho buồng phân huỷ.', loop: true },
];
const VPD_EN: Step[] = [
  { title: 'Intake and storage', desc: 'Incoming feedstock is gathered in a covered store before entering the line.' },
  { title: 'Bag opening and loosening', desc: 'Bags are opened and the mass is loosened so free water can drain off.' },
  { title: 'Dewatering press', desc: 'A press removes more of the remaining water.' },
  { title: 'Drying', desc: 'The material is dried in a recirculating dryer to suit the thermal stage.' },
  {
    title: 'Thermal decomposition',
    desc: 'In a closed chamber the material breaks down under heat; the remaining solids are collected separately.',
    chips: ['Activated carbon'],
  },
  {
    title: 'Gas cleaning and separation',
    desc: 'The gas mixture is cooled, cleared of dust and split into separate streams.',
    chips: ['Recycled oil', 'Separated water', 'Syngas'],
  },
  { title: 'Gas drying and storage', desc: 'Syngas is dried and sent to the product storage tank.' },
  { title: 'Return loop', desc: 'Part of the syngas is fed back to heat the decomposition chamber.', loop: true },
];
const SORT_VI: Step[] = [
  { title: 'Cấp liệu', desc: 'Cấp liệu đều lên dây chuyền.' },
  { title: 'Mở bao', desc: 'Mở bao tách rời vật liệu.' },
  {
    title: 'Tuyển phân loại và thu từng dòng',
    desc: 'Lồng tuyển phân loại, thu từng dòng.',
    chips: ['Nilon', 'Mùn hữu cơ', 'RDF'],
  },
];
const SORT_EN: Step[] = [
  { title: 'Feeding', desc: 'Even feeding onto the line.' },
  { title: 'Bag opening', desc: 'Bag opening to separate contents.' },
  {
    title: 'Rotary screening and stream collection',
    desc: 'Rotary screening and collection of each stream.',
    chips: ['Plastic film', 'Organic humus', 'RDF'],
  },
];

function Stages({ steps, testId }: { steps: Step[]; testId: string }): React.ReactElement {
  return (
    <ol className="stages">
      {steps.map((s) => (
        <li className={`stage${s.loop ? ' stage-loop' : ''}`} data-testid={testId} key={s.title}>
          {s.loop ? (
            <span className="loop-ico" aria-hidden="true">
              <Icon name="recycle" size={20} />
            </span>
          ) : null}
          <h3>{s.title}</h3>
          <p>{s.desc}</p>
          {s.chips ? (
            <ul className="outs">
              {s.chips.map((c) => (
                <li className="out" key={c}>
                  {c}
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function TechnologyPage({
  content,
  locale,
}: {
  content: LoadedSiteContent;
  locale: Locale;
}): React.ReactElement {
  const isVi = locale === 'vi';
  const L = (vi: string, en: string) => pick(locale, vi, en);
  const customBody = content.pagesBody.technology?.[locale]?.bodyHtml ?? '';
  // Ô ảnh cố định `gms-sorting-line`: ảnh/bản vẽ của GMS, contain, 3:2; ô trống ⇒ ẩn cả khung (V39/V42).
  const drawing = content.imageSlots['gms-sorting-line'];
  const drawingSrc = drawing ? `/img/${drawing.relPath.replace(/^images\//, '')}` : '';
  const pillars = isVi
    ? 'Công nghệ VPD · Sàng tuyển · Tái tạo tài nguyên'
    : 'VPD technology · Sorting · Resource recovery';
  return (
    <>
      <SubHero
        eyebrow={pillars}
        title={L('Công nghệ: từ chất thải đến tài nguyên', 'Technology: from waste to resources')}
        lead={L(
          'GMS xử lý chất thải rắn theo hai nhóm công đoạn: Sàng tuyển để phân tách các dòng vật chất, và công nghệ VPD để chuyển hoá một số dòng nguyên liệu phù hợp thành sản phẩm đầu ra mới. Nhà máy đã đi vào hoạt động; sáu dòng sản phẩm đầu ra vẫn ở mức định hướng.',
          'GMS treats solid waste in two process groups: Sorting to separate material streams, and VPD technology to convert suitable feedstock streams into new output products. The plant is in operation; the six output streams remain a planned direction.',
        )}
        jump={{
          label: L('Trên trang này', 'On this page'),
          items: [
            { href: '#sang-tuyen', text: L('Sàng tuyển', 'Sorting') },
            { href: '#vpd', text: L('Công nghệ VPD', 'VPD technology') },
          ],
        }}
      />

      <section className="sec" id="hai-nhanh" aria-labelledby="h-flow">
        <div className="wrap">
          <div className="sec-head">
            <h2 id="h-flow">
              {L(
                'Một dòng vào, hai nhánh xử lý, sáu dòng tài nguyên',
                'One stream in, two processing branches, six resource streams',
              )}
            </h2>
          </div>
          <BoardFigure content={content} locale={locale} outputsId="tech-diagram" branchesId="tech-branches" anchors />
          {customBody ? <Html className="prose" html={customBody} /> : null}
        </div>
      </section>

      <section className="sec sec-mist" id="sang-tuyen" aria-labelledby="h-sort" data-testid="tech-sorting">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">{L('Nhánh 1', 'Branch 1')}</span>
            <h2 id="h-sort">
              {L('Sàng tuyển: tách đúng dòng trước khi xử lý', 'Sorting: separating the right streams first')}
            </h2>
            <p>
              {L(
                'Sàng tuyển phân tách các dòng vật chất phù hợp để tiếp tục xử lý hoặc khai thác giá trị.',
                'Sorting separates suitable material streams for further processing or value recovery.',
              )}
            </p>
          </div>
          <div className={`branch${drawing ? '' : ' no-fig'}`}>
            <Stages steps={isVi ? SORT_VI : SORT_EN} testId="sorting-stage" />
            {drawing ? (
              <figure className="fig branch-fig" data-testid="tech-drawing">
                <div className="fig-box has-img gms-sorting-line" data-testid="gms-sorting-line">
                  <img src={drawingSrc} alt={drawing.alt[locale]} width={1500} height={1000} loading="lazy" />
                  {drawing.kind === 'anh-dung-ai' ? (
                    <span className="pill" data-testid="photo-label">
                      {L('Phối cảnh dự kiến', "Artist's impression")}
                    </span>
                  ) : null}
                </div>
                <figcaption>
                  <strong>{L('Dây chuyền sàng tuyển của GMS.', 'The GMS sorting line.')}</strong>
                </figcaption>
              </figure>
            ) : null}
          </div>
        </div>
      </section>

      <section className="sec sec-vpd" id="vpd" aria-labelledby="h-vpd" data-testid="tech-vpd">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">{L('Nhánh 2', 'Branch 2')}</span>
            <h2 id="h-vpd">
              {L(
                'Công nghệ VPD: chuyển hoá thành dòng đầu ra mới',
                'VPD technology: converting into new output streams',
              )}
            </h2>
            <p>
              {L(
                'Công nghệ VPD là công nghệ phân huỷ nhiệt, định hướng chuyển hoá một số dòng nguyên liệu phù hợp thành ba dòng đầu ra.',
                'VPD is a thermal decomposition technology that aims to convert suitable feedstock streams into three output streams.',
              )}
            </p>
          </div>
          <div className="branch no-fig">
            <Stages steps={isVi ? VPD_VI : VPD_EN} testId="vpd-stage" />
          </div>
        </div>
      </section>

      <CtaSection content={content} locale={locale} sectionId="hop-tac" contactTestId from="technology" />
    </>
  );
}
