import type { LegalContract } from '../types';
import { buildContractDocumentHtml } from './contractDocumentHtml';

/** Download an editable Word .doc (HTML dialect Word opens natively). */
export function exportContractWord(c: LegalContract, filename: string): void {
  const html = buildContractDocumentHtml(c, 'word');
  const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith('.doc') ? filename : `${filename}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}
