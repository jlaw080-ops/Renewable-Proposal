import "./table.css";

export default function Table({ columns = [], rows = [], rowKey, empty = "표시할 데이터가 없습니다" }) {
  return (
    <div className="tbl__wrap">
      <table className="tbl">
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c.key} className={c.align === "right" ? "tbl--right" : ""}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td className="tbl__empty" colSpan={columns.length}>{empty}</td></tr>
          ) : rows.map(row => (
            <tr key={rowKey(row)}>
              {columns.map(c => (
                <td key={c.key} className={`${c.align === "right" ? "tbl--right" : ""} ${c.mono ? "mono" : ""}`}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
