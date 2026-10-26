import fs from "fs";
import path from "path";
import { canonicalMunicipio } from "../src/lib/municipio-order";

const csvPath = path.resolve("supabase/Demonstração · Ocorrências CBMAM.csv");

function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < content.length && content[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else { field += char; }
    } else {
      if (char === '"') { inQuotes = true; }
      else if (char === ',') { row.push(field); field = ""; }
      else if (char === '\n' || char === '\r') {
        if (char === '\r' && i + 1 < content.length && content[i + 1] === '\n') i++;
        row.push(field); field = "";
        if (row.length > 1 || (row.length === 1 && row[0] !== "")) rows.push(row);
        row = [];
      } else { field += char; }
    }
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function parseDate(raw: string): { iso: string; br: string; time: string } {
  if (!raw || raw === "-") return { iso: "", br: "", time: "" };

  const m = raw.match(/([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})(?:\s+@\s+(\d{2}):(\d{2}))?/);
  if (!m) return { iso: "", br: "", time: "" };

  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    fev: "02", mai: "05", ago: "08", set: "09", out: "10", dez: "12"
  };
  const mon = months[m[1].toLowerCase()] || "01";
  const day = m[2].padStart(2, "0");
  const yr = m[3];
  const time = m[4] && m[5] ? `${m[4]}:${m[5]}` : "";

  return {
    iso: `${yr}-${mon}-${day}`,
    br: `${day}/${mon}/${yr}`,
    time,
  };
}

function extractAgua(text: string): number {
  if (!text) return 0;
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*(?:mil\s*)?(?:l(?:itros?)?|h2o)\b/i);
  if (!m) return 0;
  let numStr = m[1].replace(/\./g, "").replace(",", ".");
  let n = parseFloat(numStr);
  if (/mil/i.test(m[0])) n *= 1000;
  return Number.isFinite(n) ? n : 0;
}

function isFire(grupo: string, fim: string, ini: string): boolean {
  const all = `${grupo} ${fim} ${ini}`.toLowerCase();
  const nonFires = [
    "teste de sistema", "teste", "inatividade", "animal", "trânsito", "transito",
    "pré-hospitalar", "pre-hospitalar", "salvamento", "desaparecimento", "obstrução", "vazamento"
  ];
  for (const nf of nonFires) {
    if (all.includes(nf) && !all.includes("incêndio") && !all.includes("incendio") && !all.includes("queimada")) {
      return false;
    }
  }
  return all.includes("incêndio") || all.includes("incendio") || all.includes("queimada") || all.includes("vegetação") || all.includes("vegetacao") || all.includes("florestal") || all.includes("fogo");
}

async function buildDatabase() {
  console.log("Reading CSV...");
  const content = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCSV(content);
  const header = rows[0];

  const colIdx = {
    dataHoraReg: header.indexOf("dataHoraRegistroUTC"),
    protocolo: header.indexOf("nrProtocolo"),
    id: header.indexOf("id"),
    dataFato: header.indexOf("dataFato"),
    dataHoraFato: header.indexOf("dataHoraFato"),
    municipio: header.indexOf("nomeMunicipio"),
    bairro: header.indexOf("bairro"),
    logradouro: header.indexOf("logradouro"),
    coordenadas: header.indexOf("coordenadas"),
    naturezaIni: header.indexOf("naturezaInicialDescricao"),
    naturezaGrupo: header.indexOf("naturezaFinalizacaoObject.nomeGrupoNatureza"),
    naturezaFim: header.indexOf("naturezaFinalizacaoObject.nomeNaturezaFinal"),
    unidadeServico: header.indexOf("filtroNomeUnidadeServico"),
    equipes: header.indexOf("membrosEquipes"),
    narrativa: header.indexOf("narrativa"),
    relato: header.indexOf("relatos.relato"),
    focos: header.indexOf("gruposAdicionais.dados_incendio_florestal_vegetacao.dados_incendio_florestal_vegetacao.numeroFocosCombatidos"),
    area: header.indexOf("gruposAdicionais.dados_incendio_florestal_vegetacao.dados_incendio_florestal_vegetacao.areaQueimadaCombatidaHa"),
  };

  const occurrences: any[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const g = r[colIdx.naturezaGrupo] || "";
    const nf = r[colIdx.naturezaFim] || "";
    const ni = r[colIdx.naturezaIni] || "";

    if (!isFire(g, nf, ni)) continue;

    let dInfo = parseDate(r[colIdx.dataHoraFato]);
    if (!dInfo.iso) dInfo = parseDate(r[colIdx.dataFato]);
    if (!dInfo.iso) dInfo = parseDate(r[colIdx.dataHoraReg]);

    const nat = (nf && nf !== "-" ? nf : ni) || "Incêndio";
    const mun = canonicalMunicipio(r[colIdx.municipio]);

    const enderecoParts = [r[colIdx.logradouro], r[colIdx.bairro]].filter((x) => x && x !== "-");
    const endereco = enderecoParts.join(", ") || "—";

    let focos = parseInt(r[colIdx.focos] || "0", 10) || 0;
    let areaVal = parseFloat((r[colIdx.area] || "0").replace(/\./g, "").replace(",", ".")) || 0;

    const relatoText = `${r[colIdx.relato] || ""} ${r[colIdx.narrativa] || ""}`;
    if (focos === 0) {
      const focMatch = relatoText.match(/(\d+)\s+focos?/i);
      if (focMatch) focos = parseInt(focMatch[1], 10);
    }
    if (areaVal === 0) {
      const areaMatch = relatoText.match(/(\d+(?:[.,]\d+)?)\s*(?:m²|metros\s*quadrados)/i);
      if (areaMatch) {
        areaVal = parseFloat(areaMatch[1].replace(/\./g, "").replace(",", "."));
      }
    }

    const agua = extractAgua(relatoText);

    occurrences.push({
      id: r[colIdx.id] || `inc-${i}`,
      protocolo: r[colIdx.protocolo] || "-",
      data: dInfo.iso,
      dataBr: dInfo.br,
      horario: dInfo.time || "—",
      municipio: mun,
      bairro: r[colIdx.bairro] && r[colIdx.bairro] !== "-" ? r[colIdx.bairro] : "",
      endereco,
      natureza: nat,
      focos,
      area: areaVal,
      agua,
      coordenadas: r[colIdx.coordenadas] && r[colIdx.coordenadas] !== "-" ? r[colIdx.coordenadas] : "",
      unidade: r[colIdx.unidadeServico] && r[colIdx.unidadeServico] !== "-" ? r[colIdx.unidadeServico] : "",
      equipes: r[colIdx.equipes] && r[colIdx.equipes] !== "-" ? r[colIdx.equipes] : "",
      narrativa: r[colIdx.narrativa] && r[colIdx.narrativa] !== "-" ? r[colIdx.narrativa] : "",
      relato: r[colIdx.relato] && r[colIdx.relato] !== "-" ? r[colIdx.relato] : "",
    });
  }

  // Sort by date descending, then time descending
  occurrences.sort((a, b) => b.data.localeCompare(a.data) || b.horario.localeCompare(a.horario));

  console.log(`Processed ${occurrences.length} fire occurrences.`);

  // Write out to src/data/occurrences.json
  const outDir = path.resolve("src/data");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, "occurrences.json");
  fs.writeFileSync(outPath, JSON.stringify(occurrences, null, 2), "utf-8");
  console.log(`Saved database to ${outPath} (${(fs.statSync(outPath).size / 1024 / 1024).toFixed(2)} MB)`);
}

buildDatabase().catch(console.error);
