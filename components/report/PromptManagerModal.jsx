"use client";
import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Field from "@/components/ui/Field";
import { getPrompts, addPrompt, updatePrompt, deletePrompt } from "@/public/review/reviewPromptManager.js";

export default function PromptManagerModal({ open, onClose, onChanged }) {
  const [prompts, setPrompts] = useState([]);
  const [sel, setSel] = useState("");
  const [body, setBody] = useState("");
  const [newName, setNewName] = useState("");
  const [msg, setMsg] = useState(null);

  useEffect(() => { if (open) reload(); }, [open]);

  function reload(keep) {
    const list = getPrompts();
    setPrompts(list);
    const name = keep && list.some(p => p.name === keep) ? keep : list[0]?.name ?? "";
    setSel(name);
    setBody(list.find(p => p.name === name)?.body ?? "");
    setMsg(null);
  }

  function pick(name) {
    setSel(name);
    setBody(prompts.find(p => p.name === name)?.body ?? "");
  }

  function act(fn, keep) {
    try { fn(); reload(keep); onChanged(); }
    catch (e) { setMsg(e.message); }
  }

  const isDefault = sel === prompts[0]?.name;

  return (
    <Modal open={open} onClose={onClose} title="검토 프롬프트 관리">
      <div className="pm">
        <Select label="프롬프트 선택" options={prompts.map(p => ({ value: p.name, label: p.name }))}
          value={sel} onChange={e => pick(e.target.value)} />
        <label className="pm__editor">
          <span>내용</span>
          <textarea rows={12} value={body} onChange={e => setBody(e.target.value)} />
        </label>
        <div className="pm__row">
          <Field label="새 프롬프트 이름" value={newName} onChange={e => setNewName(e.target.value)} placeholder="예: 간략 검토" />
          <Button size="sm" variant="ghost" disabled={!newName.trim()}
            onClick={() => act(() => addPrompt(newName.trim(), body), newName.trim())}>새로 만들기</Button>
        </div>
        <div className="pm__row">
          <Button size="sm" onClick={() => act(() => updatePrompt(sel, body), sel)} disabled={!sel}>저장</Button>
          <Button size="sm" variant="danger" disabled={!sel || isDefault}
            onClick={() => act(() => deletePrompt(sel))}>삭제</Button>
          <Button size="sm" variant="ghost" onClick={onClose}>닫기</Button>
        </div>
        {msg && <p className="rv__error" role="status">{msg}</p>}
        {isDefault && <p className="rv__hint">기본 프롬프트는 삭제할 수 없습니다 (수정 후 저장은 가능).</p>}
      </div>
    </Modal>
  );
}
