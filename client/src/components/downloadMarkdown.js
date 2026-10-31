// Small helper shared by the digest and efficiency tabs: trigger a browser download of a markdown string.
export function downloadMarkdown(markdown, filename) {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `report-${Date.now()}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
