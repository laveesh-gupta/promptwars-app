import type { Metadata } from 'next';
import WorkspaceApp from '../workspace';

export const metadata: Metadata = {
  title: 'Sample Brief — VayuManak',
  robots: { index: false, follow: false },
};

export default function Demo() {
  return <WorkspaceApp demo />;
}
