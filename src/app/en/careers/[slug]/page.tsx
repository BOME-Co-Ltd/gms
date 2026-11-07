import type { Metadata } from 'next';
import type React from 'react';
import { lastSegments, SitePage, siteMetadata } from '../../../../components/site/site.tsx';

const PREFIX = '/en/careers';
type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => lastSegments(PREFIX).map((slug) => ({ slug }));
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return siteMetadata(`${PREFIX}/${(await params).slug}`);
}

export default async function Page({ params }: Props): Promise<React.ReactElement> {
  return <SitePage path={`${PREFIX}/${(await params).slug}`} />;
}
