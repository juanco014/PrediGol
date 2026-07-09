export async function compartirContenido({ title, text, url }) {
  const shareUrl = url || window.location.href;

  if (navigator.share) {
    await navigator.share({ title, text, url: shareUrl });
    return "shared";
  }

  const clipboardText = [text, shareUrl].filter(Boolean).join("\n");

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(clipboardText);
    return "copied";
  }

  throw new Error("Tu navegador no permite compartir automaticamente.");
}
