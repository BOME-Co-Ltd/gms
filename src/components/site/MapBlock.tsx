'use client';
// Bản đồ tương tác chỉ nạp iframe khi người dùng bấm (không gọi bên thứ ba lúc mở trang).
import type React from 'react';
import { useState } from 'react';
import { Icon } from './icons.tsx';

export function MapBlock({
  locale,
  point,
  linkUrl,
  query,
}: {
  locale: 'vi' | 'en';
  point: string;
  linkUrl: string;
  query: string;
}): React.ReactElement {
  const isVi = locale === 'vi';
  const [open, setOpen] = useState(false);
  const title = isVi ? 'Bản đồ vị trí nhà máy' : 'Plant Location Map';
  const address = isVi ? 'Quốc lộ 39, Bần Yên Nhân, Mỹ Hào, Hưng Yên' : 'National Route 39, Ban Yen Nhan, My Hao, Hung Yen';
  const coords = `${isVi ? 'Toạ độ:' : 'Coordinates:'} ${point} (${address})`;
  const link = (
    <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="btn-sec">
      {isVi ? 'Mở trên Google Maps' : 'Open in Google Maps'}
      <span className="sr-only"> {isVi ? '(mở tab mới)' : '(opens in a new tab)'}</span>
      <Icon name="external-link" size={18} />
    </a>
  );
  return (
    <div className="map" data-testid="map-block">
      <h3>{title}</h3>
      <p>{coords}</p>
      <div className="map-act">
        <button type="button" className="btn-sec" data-testid="map-open" id="btn-map-open" onClick={() => setOpen(true)}>
          {isVi ? 'Hiện bản đồ tương tác' : 'Show interactive map'}
        </button>
      </div>
      <div className="map-frame" data-testid="map-view" id="map-view-container" data-point={point} hidden={!open} style={{ marginTop: 14 }}>
        <div className="map-head">
          <p>
            <strong>{isVi ? 'Nhà máy Xử lý & Tái tạo Tài nguyên GMS Hưng Yên' : 'GMS Hung Yen Waste-to-Resource Plant'}</strong>
          </p>
          <p>{coords}</p>
          <div className="map-act">{link}</div>
        </div>
        {open ? (
          <iframe
            id="map-iframe"
            title={title}
            width="100%"
            height="380"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://maps.google.com/maps?q=${query}&hl=${locale}&z=15&output=embed`}
          />
        ) : null}
      </div>
    </div>
  );
}
