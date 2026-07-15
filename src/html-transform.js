export function injectLavishSdk(html, key) {
  const params = new URLSearchParams({ key: String(key), t: Date.now().toString(36) });
  const script = `<script src="/sdk.js?${params.toString()}"></script>`;
  if (/<\/body\s*>/i.test(html)) {
    return html.replace(/<\/body\s*>/i, `${script}</body>`);
  }
  return `${html}\n${script}`;
}
