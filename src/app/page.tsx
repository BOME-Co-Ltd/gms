import type React from 'react';
import { SitePage, siteMetadata } from '../components/site/site.tsx';

const PATH = '/';
export const generateMetadata = () => siteMetadata(PATH);

export default function HomePage(): React.ReactElement {
  return <SitePage path={PATH} />;
}

// NEXT-1: tên cũ mà tests/unit/all.test.ts còn nhập.
export const HomePageView = HomePage;
