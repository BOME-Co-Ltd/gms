import type React from 'react';
import { SitePage, siteMetadata } from '../../components/site/site.tsx';

const PATH = '/san-pham-dau-ra';
export const generateMetadata = () => siteMetadata(PATH);

export default function Page(): React.ReactElement {
  return <SitePage path={PATH} />;
}
