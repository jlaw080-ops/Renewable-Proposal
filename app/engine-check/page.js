"use client";
import { useEffect, useState } from "react";
import { useEngineReady } from "@/lib/useEngineReady";

export default function EngineCheck() {
  const { ready, error } = useEngineReady();
  const [result, setResult] = useState(null);
  const [runError, setRunError] = useState(null);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      try {
        const [{ runCalculation }, input1, input2] = await Promise.all([
          import("@/engine/index.js"),
          fetch("/fixtures/Input1-사업정보.json").then(r => r.json()),
          fetch("/fixtures/Input2-시나리오정보.json").then(r => r.json()),
        ]);
        setResult(await runCalculation(input1, input2, "가"));
      } catch (e) { setRunError(e.message); }
    })();
  }, [ready]);

  if (error || runError) return <pre data-testid="engine-error">ERROR: {error || runError}</pre>;
  if (!result) return <p>엔진 로딩 중…</p>;
  return <pre data-testid="engine-result">{JSON.stringify(result, null, 2)}</pre>;
}
