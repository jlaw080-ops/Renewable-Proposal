"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getProject, updateProject } from "@/lib/projectStore";
import { REGION_OPTIONS } from "@/lib/regionResolver";
import { 사업형태_OPTIONS, 사업연도_OPTIONS, 용도_OPTIONS, EMPTY_INPUT1, 세대수_OPTIONS } from "@/lib/formOptions";
import Card from "@/components/ui/Card";
import Field from "@/components/ui/Field";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import LocationPicker from "@/components/map/LocationPicker";
import LandInfoCard from "@/components/map/LandInfoCard";
import { useToast } from "@/components/ui/ToastProvider";
import "./info.css";

const toOptions = arr => arr.map(v => ({ value: v, label: v }));
const num = v => (v === "" ? "" : Number(v));

export default function InfoPage() {
  const { id } = useParams();
  const [input1, setInput1] = useState(null);
  const { push } = useToast();

  useEffect(() => {
    const p = getProject(id);
    if (p) setInput1({ ...EMPTY_INPUT1, ...(p.data.input1 ?? {}) });
  }, [id]);

  if (!input1) return null; // 로딩(프로젝트 가드는 WorkspaceShell 담당)

  function apply(patch) {
    const next = { ...input1, ...patch };
    setInput1(next);
    updateProject(id, { data: { input1: next } });
  }

  function applyRow(i, patch) {
    const rows = input1.용도별연면적목록.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    apply({ 용도별연면적목록: rows });
  }

  function handleLocation({ region, address, lat, lng }) {
    apply({ 대지위치: region, 위치정보: { address, lat, lng } });
  }

  function handleLandApply(land) {
    const patch = { 연면적: land.연면적 };                       // 연면적은 항상 채움
    for (const k of ["대지면적", "건축면적", "건폐율", "용적률"]) {
      if (input1[k] === "" || input1[k] == null) patch[k] = land[k] > 0 ? land[k] : "";
    }
    apply(patch);
    push({ message: "현황 건축물 연면적을 반영했습니다", tone: "pass" });
  }

  const 용도합 = input1.용도별연면적목록.reduce((s, r) => s + (Number(r.연면적) || 0), 0);
  const 총연면적 = Number(input1.연면적) || 0;
  const 합계불일치 = 총연면적 > 0 && Math.abs(용도합 - 총연면적) > 0.01;

  return (
    <div className="info">
      <Card title="① 사업정보">
        <div className="info__grid">
          <Select label="사업형태" placeholder="선택하세요" options={toOptions(사업형태_OPTIONS)}
            value={input1.사업형태} onChange={e => apply({ 사업형태: e.target.value })} />
          <Select label="사업연도" placeholder="선택하세요" options={toOptions(사업연도_OPTIONS)}
            value={input1.사업연도} onChange={e => apply({ 사업연도: e.target.value })} />
          <Select label="대지위치 (의무비율 지역)" placeholder="선택하세요" options={toOptions(REGION_OPTIONS)}
            value={input1.대지위치} onChange={e => apply({ 대지위치: e.target.value })} />
          <Field label="총 연면적 (㎡)" type="number" mono value={input1.연면적}
            onChange={e => apply({ 연면적: num(e.target.value) })} />
        </div>
      </Card>

      <Card title="위치 선택 (지도)" actions={<Badge tone="brand">주소·지도·직접 선택 연동</Badge>}>
        <LocationPicker value={input1.위치정보} onResolve={handleLocation} />
      </Card>

      <Card title="토지정보 조회">
        <LandInfoCard address={input1.위치정보?.address ?? null} onApply={handleLandApply} />
      </Card>

      <Card title="용도별 연면적" actions={
        <Button size="sm" variant="ghost"
          onClick={() => apply({ 용도별연면적목록: [...input1.용도별연면적목록, { 용도: "", 연면적: "" }] })}>
          행 추가
        </Button>
      }>
        <div className="info__rows">
          {input1.용도별연면적목록.map((row, i) => (
            <div className="info__rowgroup" key={i}>
              <div className="info__row">
                <Select label="용도" labelHidden={i > 0} placeholder="용도 선택" options={toOptions(용도_OPTIONS)}
                  value={row.용도} onChange={e => applyRow(i, { 용도: e.target.value })} />
                <Field label="연면적 (㎡)" labelHidden={i > 0} type="number" mono value={row.연면적}
                  onChange={e => applyRow(i, { 연면적: num(e.target.value) })} />
                <Button size="sm" variant="danger" disabled={input1.용도별연면적목록.length <= 1}
                  onClick={() => apply({ 용도별연면적목록: input1.용도별연면적목록.filter((_, idx) => idx !== i) })}>
                  삭제
                </Button>
              </div>
              {row.용도 === "공동주택" && (
                <div className="info__seda">
                  <Select label="세대 수 (규모등급 판정용)" placeholder="선택하세요" options={toOptions(세대수_OPTIONS)}
                    value={row.세대수 ?? ""} onChange={e => applyRow(i, { 세대수: e.target.value })} />
                </div>
              )}
            </div>
          ))}
        </div>
        <p className={`info__sum mono ${합계불일치 ? "info__sum--warn" : ""}`}>
          용도별 합계 {용도합.toLocaleString()} ㎡ / 총 연면적 {총연면적.toLocaleString()} ㎡
          {합계불일치 && " — 합계가 총 연면적과 다릅니다"}
        </p>
      </Card>

      <Card title="대지 현황" inner>
        <div className="info__grid">
          <Field label="대지면적 (㎡)" type="number" mono value={input1.대지면적}
            onChange={e => apply({ 대지면적: num(e.target.value) })} />
          <Field label="건축면적 (㎡)" type="number" mono value={input1.건축면적}
            onChange={e => apply({ 건축면적: num(e.target.value) })} />
          <Field label="건폐율 (%)" type="number" mono value={input1.건폐율}
            onChange={e => apply({ 건폐율: num(e.target.value) })} />
          <Field label="용적률 (%)" type="number" mono value={input1.용적률}
            onChange={e => apply({ 용적률: num(e.target.value) })} />
        </div>
      </Card>
    </div>
  );
}
