import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { type Hcp, type Insight } from "@/lib/insight-board-schema";

type ReportInput = {
  generatedFor: string;
  rangeLabel: string;
  totalInsights: number;
  deltaLabel: string;
  averagePipelineDays: number;
  mostActiveHcp: string;
  stageRows: { label: string; count: number; conversion: string }[];
  insights: Insight[];
  categoryLookup: Record<string, string>;
  hcpLookup: Record<string, Hcp>;
  drugAppendix: { drugName: string; reactions: string[] }[];
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function exportInsightBoardReport(input: ReportInput) {
  const timestamp = new Date().toLocaleString();
  const pages = input.insights.reduce<string[][]>(
    (pagesAccumulator, insight, index) => {
      const pageIndex = Math.floor(index / 25);
      if (!pagesAccumulator[pageIndex]) {
        pagesAccumulator[pageIndex] = [];
      }

      const hcp = insight.hcpId ? input.hcpLookup[insight.hcpId] : null;
      const category = insight.categoryId
        ? input.categoryLookup[insight.categoryId]
        : "Unassigned";

      pagesAccumulator[pageIndex].push(`
      <tr>
        <td>${escapeHtml(insight.title)}</td>
        <td>${escapeHtml(hcp?.name ?? "Unknown")}</td>
        <td>${escapeHtml(insight.priority)}</td>
        <td>${escapeHtml(category)}</td>
        <td>${escapeHtml(insight.stage)}</td>
        <td>${escapeHtml(new Date(insight.createdAt).toLocaleDateString())}</td>
      </tr>
    `);

      return pagesAccumulator;
    },
    [],
  );

  const html = `
    <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #263238; padding: 28px; }
          h1, h2 { color: #303F9F; }
          .cover { min-height: 90vh; display: flex; flex-direction: column; justify-content: center; }
          .kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 20px 0; }
          .kpi { border: 1px solid #CFD8DC; border-radius: 16px; padding: 14px; background: #FAFAFA; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #CFD8DC; padding: 8px; font-size: 12px; text-align: left; }
          th { background: #E8EAF6; }
          .page-break { page-break-before: always; }
          ul { padding-left: 18px; }
        </style>
      </head>
      <body>
        <section class="cover">
          <h1>InsightBoard Report</h1>
          <p>Date range: ${escapeHtml(input.rangeLabel)}</p>
          <p>User: ${escapeHtml(input.generatedFor)}</p>
          <p>Generated: ${escapeHtml(timestamp)}</p>
        </section>

        <section class="page-break">
          <h2>KPI Summary</h2>
          <div class="kpi-grid">
            <div class="kpi"><strong>Total insights</strong><br/>${input.totalInsights}</div>
            <div class="kpi"><strong>Delta vs previous window</strong><br/>${escapeHtml(input.deltaLabel)}</div>
            <div class="kpi"><strong>Average pipeline time</strong><br/>${input.averagePipelineDays.toFixed(1)} days</div>
            <div class="kpi"><strong>Most active HCP</strong><br/>${escapeHtml(input.mostActiveHcp)}</div>
          </div>
        </section>

        <section class="page-break">
          <h2>Pipeline Funnel</h2>
          <table>
            <thead>
              <tr><th>Stage</th><th>Count</th><th>Conversion</th></tr>
            </thead>
            <tbody>
              ${input.stageRows
                .map(
                  (row) => `
                    <tr>
                      <td>${escapeHtml(row.label)}</td>
                      <td>${row.count}</td>
                      <td>${escapeHtml(row.conversion)}</td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>
        </section>

        ${pages
          .map(
            (rows, index) => `
              <section class="page-break">
                <h2>Insight Table ${pages.length > 1 ? `Page ${index + 1}` : ""}</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>HCP</th>
                      <th>Priority</th>
                      <th>Category</th>
                      <th>Stage</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows.join("")}
                  </tbody>
                </table>
              </section>
            `,
          )
          .join("")}

        ${
          input.drugAppendix.length
            ? `
              <section class="page-break">
                <h2>Drug Appendix</h2>
                ${input.drugAppendix
                  .map(
                    (drug) => `
                      <h3>${escapeHtml(drug.drugName)}</h3>
                      <ul>
                        ${drug.reactions
                          .map((reaction) => `<li>${escapeHtml(reaction)}</li>`)
                          .join("")}
                      </ul>
                    `,
                  )
                  .join("")}
              </section>
            `
            : ""
        }
      </body>
    </html>
  `;

  const file = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri);
  }

  return file.uri;
}
