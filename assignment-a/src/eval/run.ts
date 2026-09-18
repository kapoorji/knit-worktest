/**
 * Evaluation harness.
 *
 * Runs the dataset through the assistant and reports, per question:
 *   - routing : did it pick the right calculator (or correctly decline)?
 *   - numbers : do the numbers in the answer match an independent calculation?
 *   - ms      : response time.
 *
 * Runs OFFLINE (keyless) by default. `--live` uses whatever provider is
 * configured (see .env.example); `--json` prints a machine-readable report.
 *
 *   npm run eval
 *   npm run eval -- --json
 *   npm run eval -- --live
 */

import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { ask, containsNumber, criticalNumbers } from "../assistant.js";
import { OfflineClient, getLlmClient, type LlmClient } from "../llm.js";
import { DATASET } from "./dataset.js";

export interface EvalRow {
  id: number;
  question: string;
  expected: "yarn" | "needle" | "tension" | "decline";
  routingOk: boolean;
  numbersOk: boolean | null; // null for decline cases
  latencyMs: number;
  pass: boolean;
  note: string;
}

export interface EvalReport {
  provider: string;
  rows: EvalRow[];
  summary: {
    total: number;
    routingCorrect: number;
    answered: number;
    numbersCorrect: number;
    declineTotal: number;
    declineCorrect: number;
    latency: { minMs: number; avgMs: number; maxMs: number };
    allPass: boolean;
  };
}

export async function runEval(client: LlmClient): Promise<EvalReport> {
  const rows: EvalRow[] = [];

  for (const c of DATASET) {
    const a = await ask(c.question, client);
    let row: EvalRow;

    if (c.expect.type === "decline") {
      const routingOk = a.declined === true;
      // A decline must not contain an invented number.
      const clean = !/\d/.test(a.answer);
      row = {
        id: c.id, question: c.question, expected: "decline",
        routingOk, numbersOk: null, latencyMs: a.latencyMs,
        pass: routingOk && clean,
        note: routingOk ? (clean ? "declined" : "declined but answer has digits") : `did not decline (routed ${a.calculator})`,
      };
    } else {
      const routingOk = !a.declined && a.calculator === c.expect.calculator;
      let numbersOk: boolean | null = null;
      let note = "";
      if (routingOk) {
        const ref = c.expect.reference();
        const inAnswer = ref.every((num) => containsNumber(a.answer, num));
        const resultMatches = JSON.stringify(criticalNumbers(c.expect.calculator, a.result)) === JSON.stringify(ref);
        numbersOk = inAnswer && resultMatches && a.numbersVerified;
        note = numbersOk ? "ok" : !resultMatches ? "computed numbers differ from oracle" : !inAnswer ? "number missing from answer" : "unverified";
      } else {
        numbersOk = false;
        note = a.declined ? "declined unexpectedly" : `wrong calculator (${a.calculator})`;
      }
      row = {
        id: c.id, question: c.question, expected: c.expect.calculator,
        routingOk, numbersOk, latencyMs: a.latencyMs, pass: routingOk && numbersOk === true, note,
      };
    }
    rows.push(row);
  }

  const answeredRows = rows.filter((r) => r.expected !== "decline");
  const declineRows = rows.filter((r) => r.expected === "decline");
  const latencies = rows.map((r) => r.latencyMs);
  const sum = latencies.reduce((a, b) => a + b, 0);

  const summary = {
    total: rows.length,
    routingCorrect: rows.filter((r) => r.routingOk).length,
    answered: answeredRows.length,
    numbersCorrect: answeredRows.filter((r) => r.numbersOk === true).length,
    declineTotal: declineRows.length,
    declineCorrect: declineRows.filter((r) => r.routingOk).length,
    latency: {
      minMs: Math.min(...latencies),
      avgMs: Math.round((sum / latencies.length) * 10) / 10,
      maxMs: Math.max(...latencies),
    },
    allPass: rows.every((r) => r.pass),
  };

  return { provider: client.name, rows, summary };
}

function tick(b: boolean | null): string {
  return b === null ? " – " : b ? " ✓ " : " ✗ ";
}

function printReport(report: EvalReport): void {
  const { rows, summary } = report;
  console.log(`\nKnit assistant evaluation — provider: ${report.provider}\n`);
  console.log("  #  expected  routing  numbers   ms   question");
  console.log("  -  --------  -------  -------  ----  --------");
  for (const r of rows) {
    const q = r.question.length > 52 ? r.question.slice(0, 49) + "..." : r.question;
    console.log(
      `  ${String(r.id).padStart(2)}  ${r.expected.padEnd(8)}  ${tick(r.routingOk)}    ${tick(r.numbersOk)}   ` +
        `${String(r.latencyMs).padStart(4)}  ${r.pass ? "" : "[FAIL] "}${q}`,
    );
  }
  const s = summary;
  console.log("\n  Summary");
  console.log(`    Routing accuracy   ${s.routingCorrect}/${s.total} (${Math.round((s.routingCorrect / s.total) * 100)}%)`);
  console.log(`    Number accuracy    ${s.numbersCorrect}/${s.answered} answered (${Math.round((s.numbersCorrect / s.answered) * 100)}%)`);
  console.log(`    Declined correctly ${s.declineCorrect}/${s.declineTotal}`);
  console.log(`    Latency            avg ${s.latency.avgMs}ms · min ${s.latency.minMs}ms · max ${s.latency.maxMs}ms`);
  console.log(`\n  ${s.allPass ? "PASS — all cases correct" : "FAIL — see [FAIL] rows above"}\n`);
}

async function main(): Promise<number> {
  const { values } = parseArgs({ args: process.argv.slice(2), options: { json: { type: "boolean" }, live: { type: "boolean" } } });
  const client: LlmClient = values.live ? getLlmClient() : new OfflineClient();
  const report = await runEval(client);
  if (values.json) console.log(JSON.stringify(report, null, 2));
  else printReport(report);
  return report.summary.allPass ? 0 : 1;
}

// Only run as a CLI when executed directly (not when imported by tests).
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(await main());
}
