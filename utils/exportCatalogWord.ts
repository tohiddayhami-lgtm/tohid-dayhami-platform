import type { CompanyCatalog } from '../types';
import { buildCatalogDocumentHtml } from './catalogDocumentHtml';

/** Download an editable Word .doc (HTML dialect Word opens natively). */
export function exportCatalogWord(c: CompanyCatalog, filename: string): void {
  const html = buildCatalogDocumentHtml(c, 'word');
  const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith('.doc') ? filename : `${filename}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}
