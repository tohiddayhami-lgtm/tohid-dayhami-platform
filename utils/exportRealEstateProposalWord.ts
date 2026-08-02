import type { RealEstateProposal } from '../types';
import { buildRealEstateProposalDocumentHtml } from './realEstateProposalDocumentHtml';

/** Download an editable Word .doc (HTML dialect Word opens natively). */
export function exportRealEstateProposalWord(p: RealEstateProposal, filename: string): void {
  const html = buildRealEstateProposalDocumentHtml(p, 'word');
  const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith('.doc') ? filename : `${filename}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}
