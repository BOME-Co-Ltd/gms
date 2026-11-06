import type React from 'react';
import { loadJourneyNames } from '../../../components/pages/journeyNames.ts';
import { NewsPageView } from '../../../components/pages/NewsPageView.tsx';

export default function NewsEnPage(): React.ReactElement {
  return <NewsPageView locale="en" stepNames={loadJourneyNames('en')} />;
}
