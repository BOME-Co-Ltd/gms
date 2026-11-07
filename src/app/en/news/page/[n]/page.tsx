import type { Metadata } from 'next';
import type React from 'react';
import { lastSegments, SitePage, siteMetadata } from '../../../../../components/site/site.tsx';

const PREFIX = '/en/news/page';
type Props = { params: Promise<{ n: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => lastSegments(PREFIX).map((n) => ({ n }));
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return siteMetadata(`${PREFIX}/${(await params).n}`);
}

export default async function Page({ params }: Props): Promise<React.ReactElement> {
  return <SitePage path={`${PREFIX}/${(await params).n}`} />;
}
