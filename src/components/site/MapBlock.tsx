// V29: iframe loading="lazy" luôn có trong DOM (trình duyệt tự nạp khi cuộn gần tới); không còn nút "Hiện bản đồ".
import type React from 'react';
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
  const title = isVi ? 'Bản đồ vị trí nhà máy' : 'Plant Location Map';
  const address = isVi
    ? 'Quốc lộ 39, Phường Bần Yên Nhân, Thị xã Mỹ Hào, Tỉnh Hưng Yên'
    : 'National Route 39, Ban Yen Nhan Ward, My Hao Town, Hung Yen Province';
  const coords = `${isVi ? 'Toạ độ:' : 'Coordinates:'} ${point} (${address})`;
  return (
    <div className="map" data-testid="map-block">
      <h3>{title}</h3>
      <p>{coords}</p>
      <div className="map-frame" data-testid="map-view" data-point={point}>
        <iframe
          id="map-iframe"
          title={`${isVi ? 'Bản đồ' : 'Map'}: ${address}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={`https://www.google.com/maps?q=${query}&hl=${locale}&z=15&output=embed`}
        />
      </div>
      <div className="map-act">
        <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="btn-sec">
          {isVi ? 'Mở bản đồ' : 'Open map'}
          <span className="sr-only"> {isVi ? '(mở tab mới)' : '(opens in a new tab)'}</span>
          <Icon name="external-link" size={18} />
        </a>
      </div>
    </div>
  );
}
