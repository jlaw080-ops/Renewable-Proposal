"use client";
import Badge from "@/components/ui/Badge";
import { SORT_KEYS, comboSummary } from "@/lib/comboView";
import "./comboTable.css";

const 억 = v => (v > 0 ? `${(v / 1e8).toFixed(1)}억` : "-");
const 만 = v => (v ? `${Math.round(v / 1e4).toLocaleString("ko-KR")}만` : "-");
const SORTABLE = new Set(SORT_KEYS.map(s => s.key));

function SortHeader({ k, label, sortKey, sortDir, onSort, align }) {
  const active = sortKey === k;
  return (
    <th className={align === "right" ? "ct--right" : ""} aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
      {SORTABLE.has(k) ? (
        <button type="button" className={`ct__sort ${active ? "ct__sort--active" : ""}`} onClick={() => onSort(k)}>
          {label}{active ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
        </button>
      ) : label}
    </th>
  );
}

export default function ComboTable({ combos = [], sortKey, sortDir, onSort, onPick, aiBest = null }) {
  return (
    <div className="ct__wrap">
      <table className="ct">
        <thead>
          <tr>
            <th className="ct--right">#</th>
            <th>설비 구성</th>
            <SortHeader k="score" label="점수" align="right" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortHeader k="초기비용" label="초기비용" align="right" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortHeader k="운영순익" label="연간순익" align="right" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortHeader k="의무비율" label="의무비율" align="right" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortHeader k="면적이용" label="면적이용" align="right" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <th>표시</th>
          </tr>
        </thead>
        <tbody>
          {combos.map(c => {
            const t = c.targets ?? {};
            const 의무 = t.법적규제?.의무설치비율;
            const 충족 = t.법적규제?.의무설치비율_충족;
            return (
              <tr key={c.rank} onClick={() => onPick(c.rank)}>
                <td className="ct--right mono">
                  <button type="button" className="ct__pick" onClick={e => { e.stopPropagation(); onPick(c.rank); }}
                    aria-label={`${c.rank}위 조합 상세 보기`}>#{c.rank}</button>
                </td>
                <td className="ct__sys">{comboSummary(c)}</td>
                <td className="ct--right mono">{Math.round((c.score ?? 0) * 100)}</td>
                <td className="ct--right mono">{억(t.초기비용)}</td>
                <td className="ct--right mono">{만(t.운영순익)}</td>
                <td className="ct--right mono">
                  {의무 != null ? `${의무.toFixed(1)}%` : "-"}{충족 === true ? " ✓" : 충족 === false ? " ✕" : ""}
                </td>
                <td className="ct--right mono">{c.면적이용률 != null ? `${Math.round(c.면적이용률)}%` : "-"}</td>
                <td className="ct__badges">
                  {aiBest === c.rank && <Badge tone="warm">⭐ AI</Badge>}
                  {(c.챔피언 ?? []).length > 0 && <Badge tone="brand">★ {c.챔피언.length}</Badge>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
