"use client";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { fmtNum } from "@/lib/calcModel";
import "./comboCard.css";

const 억 = v => (v > 0 ? `${(v / 1e8).toFixed(1)}억` : "-");
const 만 = v => (v !== 0 ? `${fmtNum(Math.round(v / 1e4))}만` : "-");

function GradeBar({ label, value }) {   // value: 0~1
  const p = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div className="cc__bar">
      <span className="cc__barlabel">{label}</span>
      <span className="cc__bartrack"><span className="cc__barfill" style={{ width: `${p}%` }} /></span>
      <span className="cc__barval mono">{p}</span>
    </div>
  );
}

export default function ComboCard({ combo, memo, aiBadge, aiReason, onMemoChange, explain, explaining, onExplain }) {
  const t = combo.targets;
  const 프로파일 = t.제약?.프로파일 ?? {};
  return (
    <article className={`cc ${combo.rank === 1 ? "cc--best" : ""}`}>
      <header className="cc__head">
        <span className="cc__rank mono">#{combo.rank}</span>
        <span className="cc__score mono">{Math.round(combo.score * 100)}점</span>
        {combo.rank === 1 && <Badge tone="brand">최적</Badge>}
        {aiBadge && <Badge tone="warm">⭐ AI 최선</Badge>}
      </header>

      <p className="cc__chips">
        {(combo.챔피언 ?? []).map(tag => <span className="cc__chip cc__chip--champ" key={`c-${tag}`}>★ {tag}</span>)}
        {(combo.태그 ?? []).filter(tag => !(combo.챔피언 ?? []).includes(tag))
          .map(tag => <span className="cc__chip" key={tag}>{tag}</span>)}
        {!(combo.태그 ?? []).length && !(combo.챔피언 ?? []).length && <span className="cc__chip cc__chip--muted">균형형</span>}
      </p>

      <ul className="cc__items">
        {(combo.items ?? []).map((it, i) => (
          <li key={i} className="mono">{it.설비?.세부형식 ?? "-"} · {fmtNum(it.용량)} kW</li>
        ))}
      </ul>

      <dl className="cc__targets">
        <div><dt>초기비용</dt><dd className="mono">{억(t.초기비용)}</dd></div>
        <div><dt>연간순익</dt><dd className="mono">{만(t.운영순익)}</dd></div>
        <div><dt>의무비율</dt><dd className="mono">{t.법적규제?.의무설치비율 != null ? `${t.법적규제.의무설치비율.toFixed(1)}%` : "-"}{t.법적규제?.의무설치비율_충족 === false ? " ⚠" : ""}</dd></div>
        {t.법적규제?.전력생산비율 != null && (
          <div><dt>전력생산</dt><dd className="mono">{t.법적규제.전력생산비율.toFixed(1)}%{t.법적규제.전력생산비율_충족 === false ? " ⚠" : ""}</dd></div>
        )}
        {combo.면적이용률 != null && (
          <div><dt>면적이용</dt><dd className="mono">{Math.round(combo.면적이용률)}%</dd></div>
        )}
      </dl>

      <div className="cc__grades">
        <GradeBar label="디자인" value={(t.정성?.디자인 ?? 0) / 5} />
        <GradeBar label="시공성" value={(t.정성?.시공성 ?? 0) / 5} />
        <GradeBar label="ZEB" value={(t.정성?.ZEB기여도 ?? 0) / 5} />
        <GradeBar label="심의적합" value={t.제약?.적합도 ?? 0} />
        <GradeBar label="건물적합" value={t.건물적합?.적합도 ?? 0} />
      </div>

      {Object.keys(프로파일).length > 0 && (
        <details className="cc__fold">
          <summary>법적심의 제약 프로파일</summary>
          <ul className="cc__profile">
            {Object.entries(프로파일).map(([k, v]) => (
              <li key={k}><span>{k}</span><span className="mono">{v.등급} ({v.점수})</span></li>
            ))}
          </ul>
        </details>
      )}

      {aiReason && <p className="cc__reason"><b>AI 추천 근거:</b> {aiReason}</p>}

      {onExplain && (
        <div className="cc__explain">
          <Button size="sm" variant="ghost" onClick={() => onExplain(combo)} disabled={explaining}>
            {explaining ? "AI 설명 생성 중…" : (explain ? "AI 설명 재생성" : "AI 설명 생성")}
          </Button>
          {explain && <p className="cc__explaintext">{explain}</p>}
        </div>
      )}

      <label className="cc__memo">
        <span>조합 메모</span>
        <textarea rows={2} value={memo ?? ""} placeholder="검토 의견·제약사항 메모"
          onChange={e => onMemoChange(combo.rank, e.target.value)} />
      </label>
    </article>
  );
}
