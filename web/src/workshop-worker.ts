// Runs the learner's code away from the page, so a slow or endless loop in
// it can't freeze anything: the page stops this worker after a timeout.
import {
  assembleWith,
  loadStages,
  runTest,
  type TestCase,
} from "./workshop-tests";

export type WorkerRequest =
  | { kind: "test"; js: string; tests: TestCase[] }
  | { kind: "assemble"; js: string; source: string };

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  try {
    const stages = loadStages(req.js);
    if (req.kind === "test")
      postMessage({ results: req.tests.map((t) => runTest(stages, t)) });
    else postMessage({ program: assembleWith(stages, req.source) });
  } catch (err) {
    const e2 = err as { code?: string; message?: string };
    postMessage({
      error: { code: e2.code ?? "crash", message: String(e2.message ?? err) },
    });
  }
};
