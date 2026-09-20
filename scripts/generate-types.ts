import { PGlite } from "@electric-sql/pglite";
import { writeFile } from "node:fs/promises";
import { migrate } from "./database";
const db = new PGlite();
await migrate(db);
const { rows } = await db.query<{
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}>(
  `select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' order by table_name,ordinal_position`,
);
const tsType = (t: string) =>
  ["integer", "bigint", "numeric", "smallint"].includes(t)
    ? "number"
    : t === "boolean"
      ? "boolean"
      : t === "jsonb"
        ? "Json"
        : "string";
const tables = [...new Set(rows.map((x) => x.table_name))].map((name) => {
  const cols = rows.filter((x) => x.table_name === name);
  return `${name}: { Row: {${cols.map((c) => `${c.column_name}: ${tsType(c.data_type)}${c.is_nullable === "YES" ? " | null" : ""}`).join(";")}}; Insert: {${cols.map((c) => `${c.column_name}${c.is_nullable === "YES" || c.column_default ? "?" : ""}: ${tsType(c.data_type)}${c.is_nullable === "YES" ? " | null" : ""}`).join(";")}}; Update: Partial<Database['public']['Tables']['${name}']['Insert']>; Relationships: [] }`;
});
const funcs = await db.query<{ proname: string; pronargs: number }>(
  `select proname,pronargs from pg_proc join pg_namespace on pg_namespace.oid=pronamespace where nspname='public' order by proname`,
);
await writeFile(
  "src/lib/database.types.ts",
  `// Generated from migration-applied PostgreSQL catalog by pnpm db:types. Do not edit.\nexport type Json = string | number | boolean | null | { [key:string]: Json | undefined } | Json[];\nexport type Database={public:{Tables:{${tables.join(";\n")}};Views:Record<string,never>;Functions:{${funcs.rows.map((f) => `${f.proname}:{Args:${f.pronargs ? "{p:Json}" : "Record<string,never>"};Returns:Json}`).join(";")}};Enums:Record<string,never>;CompositeTypes:Record<string,never>}};\n`,
);
await db.close();
console.log("Database types generated from PostgreSQL");
