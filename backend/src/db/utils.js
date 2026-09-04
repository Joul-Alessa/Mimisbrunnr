function nowIso() {
  return new Date().toISOString();
}

// Builds "col1 = ?, col2 = ?" plus matching values, restricted to
// `allowedColumns`, from a partial `fields` object. Used by model update()
// functions so callers can pass only the fields they want to change.
function buildSetClause(fields, allowedColumns) {
  const columns = allowedColumns.filter((col) => fields[col] !== undefined);
  const setClause = columns.map((col) => `${col} = ?`).join(', ');
  const values = columns.map((col) => fields[col]);
  return { columns, setClause, values };
}

module.exports = { nowIso, buildSetClause };
