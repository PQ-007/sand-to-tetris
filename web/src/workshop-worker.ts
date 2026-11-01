// Runs the learner's code away from the page, so a slow or endless loop in
// it can't freeze anything: the page stops this worker after a timeout.
import { compileWith } from "./compiler";
import { compileTest, loadCompiler, type CmTestCase } from "./compiler-tests";
import {
  loadTranslator,
  translateTest,
  type TrTestCase,
} from "./translator-tests";
import { translateWith } from "./translator";
import {
  assembleWith,
  loadStages,
  runTest,
  type TestCase,
} from "./workshop-tests";

export type WorkerRequest =
  | { kind: "test"; js: string; tests: TestCase[] }
  | { kind: "assemble"; js: string; source: string }
  | { kind: "translator-test"; js: string; tests: TrTestCase[] }
  | { kind: "translate"; js: string; source: string }
  | { kind: "compiler-test"; js: string; tests: CmTestCase[] }
  | { kind: "compile"; js: string; source: string };

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  try {
    switch (req.kind) {
      case "test": {
        const stages = loadStages(req.js);
        postMessage({ results: req.tests.map((t) => runTest(stages, t)) });
        break;
      }
      case "assemble":
        postMessage({ program: assembleWith(loadStages(req.js), req.source) });
        break;
      case "translator-test": {
        const stages = loadTranslator(req.js);
        postMessage({
          outcomes: req.tests.map((t) => translateTest(stages, t)),
        });
        break;
      }
      case "translate":
        postMessage({
          translation: translateWith(loadTranslator(req.js), req.source),
        });
        break;
      case "compiler-test": {
        const stages = loadCompiler(req.js);
        postMessage({ outcomes: req.tests.map((t) => compileTest(stages, t)) });
        break;
      }
      case "compile":
        postMessage({
          compiled: compileWith(loadCompiler(req.js), req.source),
        });
        break;
    }
  } catch (err) {
    const e2 = err as { code?: string; message?: string };
    postMessage({
      error: { code: e2.code ?? "crash", message: String(e2.message ?? err) },
    });
  }
};
