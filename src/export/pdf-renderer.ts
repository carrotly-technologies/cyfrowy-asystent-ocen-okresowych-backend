import { join, resolve } from 'node:path';
import pdfmake from 'pdfmake';

export type TDocumentDefinitions = Parameters<typeof pdfmake.createPdf>[0];

/** Font family used by every generated document. */
export const DOCUMENT_FONT = 'LiberationSerif';

/**
 * Renders pdfmake documents on the server (pdfmake/pdfkit, MIT). Documents use
 * Liberation Serif (SIL OFL 1.1, metric-compatible with Times New Roman, the
 * typeface of the official forms; covers Polish letters), bundled in
 * `assets/fonts/LiberationSerif` with its licence. No browser, no network:
 * images and URLs are refused.
 */
const fontsDir = resolve(
  import.meta.dirname,
  '../../assets/fonts/LiberationSerif',
);

let configured = false;
function configure(): void {
  if (configured) return;
  pdfmake.setFonts({
    [DOCUMENT_FONT]: {
      normal: join(fontsDir, 'LiberationSerif-Regular.ttf'),
      bold: join(fontsDir, 'LiberationSerif-Bold.ttf'),
      italics: join(fontsDir, 'LiberationSerif-Italic.ttf'),
      bolditalics: join(fontsDir, 'LiberationSerif-BoldItalic.ttf'),
    },
  });
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy((path) => path.startsWith(fontsDir));
  configured = true;
}

export async function renderPdf(doc: TDocumentDefinitions): Promise<Buffer> {
  configure();
  return pdfmake.createPdf(doc).getBuffer();
}
