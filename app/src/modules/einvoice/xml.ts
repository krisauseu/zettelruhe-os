/** XML-Helfer für UBL/CII-Renderer (kein Lib-Lock-in). */

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function isoToCiiDate(iso: string): string {
  return iso.replace(/-/g, "").slice(0, 8);
}

export function xmlEl(
  name: string,
  value: string,
  attrs?: Record<string, string>,
): string {
  const a = attrs
    ? Object.entries(attrs)
        .map(([k, v]) => ` ${k}="${xmlEscape(v)}"`)
        .join("")
    : "";
  return `<${name}${a}>${xmlEscape(value)}</${name}>`;
}
