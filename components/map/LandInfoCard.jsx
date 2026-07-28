"use client";
import { useEffect, useRef, useState } from "react";
import Badge from "@/components/ui/Badge";
import "./locationPicker.css";

export default function LandInfoCard({ address, onApply }) {
  const [state, setState] = useState({ status: "idle", land: null, juso: null });
  const lastApplied = useRef(null);

  useEffect(() => {
    if (!address) return;
    let alive = true;
    setState({ status: "loading", land: null, juso: null });
    fetch("/api/landinfo?address=" + encodeURIComponent(address))
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "조회 실패");
        return data;
      })
      .then(data => {
        if (!alive) return;
        setState({ status: "done", land: data.land, juso: data.juso });
        if (data.land && lastApplied.current !== address) {
          lastApplied.current = address;
          onApply(data.land);
        }
      })
      .catch(err => alive && setState({ status: "error", land: null, juso: null, message: err.message }));
    return () => { alive = false; };
  }, [address]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!address) return <p className="lp__fallback">지도에서 위치를 확정하면 현황 건축물의 토지정보를 조회합니다.</p>;
  if (state.status === "loading") return <p className="lp__fallback">토지정보 조회 중…</p>;
  if (state.status === "error") return <p className="lp__notice" role="status">토지정보 조회 오류: {state.message} — 아래 대지 현황에 직접 입력하세요.</p>;
  if (state.status === "done" && !state.land) {
    return <p className="lp__fallback">조회 결과 없음 (나대지 등) — 아래 대지 현황에 직접 입력하세요.</p>;
  }
  if (state.status !== "done") return null;

  const L = state.land;
  const rows = [
    ["대지면적", L.대지면적, "㎡"], ["건축면적", L.건축면적, "㎡"], ["연면적", L.연면적, "㎡"],
    ["건폐율", L.건폐율, "%"], ["용적률", L.용적률, "%"],
  ];
  return (
    <div className="lic">
      <p className="lic__head">
        <Badge tone="warm">현황 건축물 기준</Badge>
        <span className="lic__addr">{state.juso?.roadAddr ?? address}{L.동수 > 1 ? ` · ${L.동수}개 동 합산` : ""}</span>
      </p>
      <dl className="lic__grid">
        {rows.map(([k, v, unit]) => (
          <div className="lic__item" key={k}>
            <dt>{k}</dt>
            <dd className="mono">{v > 0 ? `${v.toLocaleString()} ${unit}` : "-"}</dd>
          </div>
        ))}
      </dl>
      <p className="lp__fallback">연면적은 사업정보에 자동 반영되었습니다 (신축 검토 시 계획 값으로 수정 가능).</p>
    </div>
  );
}
