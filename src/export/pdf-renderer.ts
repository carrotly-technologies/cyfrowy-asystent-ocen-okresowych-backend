import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import pdfmake from 'pdfmake';

export type TDocumentDefinitions = Parameters<typeof pdfmake.createPdf>[0];

/**
 * Renders pdfmake documents on the server (pdfmake/pdfkit, MIT; Roboto font,
 * Apache-2.0, bundled with pdfmake, covers Polish letters). No browser, no
 * network: images and URLs are refused.
 */
const fontsDir = join(
  dirname(createRequire(import.meta.url).resolve('pdfmake/package.json')),
  'fonts',
  'Roboto',
);

let configured = false;
function configure(): void {
  if (configured) return;
  pdfmake.setFonts({
    Roboto: {
      normal: join(fontsDir, 'Roboto-Regular.ttf'),
      bold: join(fontsDir, 'Roboto-Medium.ttf'),
      italics: join(fontsDir, 'Roboto-Italic.ttf'),
      bolditalics: join(fontsDir, 'Roboto-MediumItalic.ttf'),
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
