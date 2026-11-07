import type { Metadata } from 'next';
import type React from 'react';
import { SitePage, siteMetadata } from '../components/site/site.tsx';

// 404.html (vi). Bản en: /en/404 (app/en/404/page.tsx → out/en/404.html).
export const generateMetadata = (): Metadata => siteMetadata('/404');

export default function NotFound(): React.ReactElement {
  return <SitePage path="/404" />;
}
