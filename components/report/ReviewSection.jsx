"use client";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import PromptManagerModal from "./PromptManagerModal";
import { generateReview } from "@/public/review/reviewGenerator.js";
import { getPrompts } from "@/public/review/reviewPromptManager.js";
import "./report.css";

const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export default function ReviewSection({ calcData, review, onSave }) {
  const [prompts, setPrompts] = useState([]);
  const [sel, setSel] = useState("");
  const [text, setText] = useState(review?.text ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [manageOpen, setManageOpen] = useState(false);

  useEffect(() => { reloadPrompts(); }, []);
  useEffect(() => { setText(review?.text ?? ""); }, [review?.text]);

  function reloadPrompts() {
    const list = getPrompts();
    setPrompts(list);
    setSel(prev => (list.some(p => p.name === prev) ? prev : list[0]?.name ?? ""));
  }

  async function run() {
    if (!calcData) return;
    const prompt = prompts.find(p => p.name === sel);
    if (!prompt) return;
    setBusy(true); setError(null); setText("");
    let acc = "";
    try {
      await generateReview(prompt.body, calcData, {
        onToken: t => { acc += t; setText(acc); },
        onDone: () => { onSave(acc); },
        onError: e => { setError(e.message); },
      });
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="rv">
      <div className="rv__bar">
        <Select label="검토 프롬프트" options={prompts.map(p => ({ value: p.name, label: p.name }))}
          value={sel} onChange={e => setSel(e.target.value)} />
        <Button variant="ghost" size="sm" onClick={() => setManageOpen(true)}>프롬프트 관리</Button>
        <Button onClick={run} disabled={busy || !calcData}>{busy ? "생성 중…" : "검토의견 생성"}</Button>
      </div>
      {!calcData && <p className="rv__hint">①·② 입력을 완료하면 검토의견을 생성할 수 있습니다.</p>}
      {error && <p className="rv__error" role="status">검토의견 생성 오류: {error}</p>}
      {text
        ? <div className="rv__output" dangerouslySetInnerHTML={{ __html: esc(text).replace(/\n/g, "<br>") }} />
        : <p className="rv__hint">아직 생성된 검토의견이 없습니다.</p>}
      <PromptManagerModal open={manageOpen} onClose={() => setManageOpen(false)} onChanged={reloadPrompts} />
    </div>
  );
}
