export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportFilename(
  bundle: { productName: string; scenarioName?: string },
  ext: string
): string {
  const base = bundle.scenarioName || bundle.productName;
  const safe = base
    .replace(/[^a-zA-Z0-9\-_ ]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 60);
  const date = new Date().toISOString().slice(0, 10);
  return `pricing-${safe}-${date}.${ext}`;
}
