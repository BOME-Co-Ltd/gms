import type React from 'react';
import { SitePage, siteMetadata } from '../../components/site/site.tsx';

const PATH = '/tin-tuc';
export const generateMetadata = () => siteMetadata(PATH);

export default function Page(): React.ReactElement {
  return <SitePage path={PATH} />;
}
