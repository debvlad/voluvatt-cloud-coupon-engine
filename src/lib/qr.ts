import QRCode from 'qrcode';

export async function makeQrDataUrl(text: string, size = 420): Promise<string> {
  return QRCode.toDataURL(text, {
    width: size,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#151E50',
      light: '#FFFFFF'
    }
  });
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
