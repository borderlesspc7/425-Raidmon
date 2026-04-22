import { Platform, Share } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import type { Batch } from "../types/batch";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateBr(d: Date | undefined | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function buildRomaneioHtml(
  batch: Batch,
  labels: {
    title: string;
    quantity: string;
    workshop: string;
    delivery: string;
    statusColumn: string;
    statusValue: string;
    obs: string;
  }
): string {
  const workshop = escapeHtml(batch.workshopName || "—");
  const statusValue = escapeHtml(labels.statusValue);
  const obs = escapeHtml((batch.observations || "").trim() || "—");
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; color: #111; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .sub { color: #6B7280; font-size: 12px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { text-align: left; padding: 8px 0; border-bottom: 1px solid #E5E7EB; }
    th { color: #6B7280; font-weight: 600; width: 40%; }
    .foot { margin-top: 20px; font-size: 11px; color: #9CA3AF; }
  </style>
</head>
<body>
  <h1>${escapeHtml(labels.title)}</h1>
  <div class="sub">${formatDateBr(batch.createdAt)}</div>
  <table>
    <tr><th>${escapeHtml(labels.quantity)}</th><td><strong>${batch.totalPieces}</strong></td></tr>
    <tr><th>${escapeHtml(labels.workshop)}</th><td>${workshop}</td></tr>
    <tr><th>${escapeHtml(labels.delivery)}</th><td>${formatDateBr(batch.deliveryDate ?? null)}</td></tr>
    <tr><th>${escapeHtml(labels.statusColumn)}</th><td>${statusValue}</td></tr>
    <tr><th>${escapeHtml(labels.obs)}</th><td>${obs}</td></tr>
  </table>
  <p class="foot">Costura Conectada — romaneio gerado no app</p>
</body>
</html>`;
}

/**
 * Gera PDF (nativo) ou compartilha HTML / texto (fallback web).
 */
export async function shareRomaneioForBatch(
  batch: Batch,
  labels: {
    title: string;
    quantity: string;
    workshop: string;
    delivery: string;
    statusColumn: string;
    statusValue: string;
    obs: string;
  }
): Promise<void> {
  const html = buildRomaneioHtml(batch, labels);

  if (Platform.OS === "web") {
    const w = globalThis.window;
    if (w && typeof w.print === "function") {
      const doc = w.document;
      if (doc) {
        const win = w.open("", "_blank");
        if (win?.document) {
          win.document.write(html);
          win.document.close();
          win.focus();
          win.print();
          return;
        }
      }
    }
    await Share.share({
      message: `${batch.name}\n${batch.totalPieces} peças\n${batch.workshopName || ""}`,
      title: labels.title,
    });
    return;
  }

  try {
    const { uri } = await Print.printToFileAsync({ html });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: labels.title,
        UTI: "com.adobe.pdf",
      });
    } else {
      await Share.share({ url: uri, title: batch.name });
    }
  } catch {
    await Share.share({
      message: `${batch.name}\n${batch.totalPieces} peças`,
    });
  }
}
