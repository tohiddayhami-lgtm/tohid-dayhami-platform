import type { CommercialProposal } from '../types';
import { buildProposalDocumentHtml } from './proposalDocumentHtml';

/** Download an editable Word .doc (HTML dialect Word opens natively). */
export function exportProposalWord(p: CommercialProposal, filename: string): void {
  const html = buildProposalDocumentHtml(p, 'word');
  // BOM so Word detects UTF-8 and Persian characters stay intact.
  const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith('.doc') ? filename : `${filename}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}
