import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { canonicalMunicipio, manausFirst } from "../src/lib/municipio-order";

function loadEnv() {
  const envPaths = [path.resolve(process.cwd(), ".env"), path.resolve(process.cwd(), ".env.local")];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const [key, ...valParts] = trimmed.split("=");
        if (key && valParts.length > 0 && !process.env[key.trim()]) {
          process.env[key.trim()] = valParts.join("=").trim().replace(/^["']|["']$/g, "");
        }
      }
    }
  }
}
loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Efetivo de 25/10/2026 conforme Página 1 do Relatório Oficial CBMAM
// Colunas: Mun, Serviço (ord), OPAMV 26/10, OPAMV Fase Extra (opam_ref), INC 1 29/10, INC 2 17/11, INC 3 30/10, CBMSP, PREVFOGO, FN, Brig. Mun, Brig. SEMA (brig_semas), Marinha
const rawEfetivoData = [
  // MUNICÍPIOS
  { mun: "Manaus", ord: 135, opamv: 0, opam_ref: 0, inc1: 0, inc2: 0, inc3: 0, cbmsp: 0, prevfogo: 25, fn: 0, brig_mun: 13, brig_semas: 0, marinha: 6 },
  { mun: "Apuí", ord: 2, opamv: 2, opam_ref: 0, inc1: 3, inc2: 2, inc3: 0, cbmsp: 0, prevfogo: 0, fn: 4, brig_mun: 0, brig_semas: 7, marinha: 0 },
  { mun: "Atalaia do Norte", ord: 2, opamv: 0, opam_ref: 0, inc1: 0, inc2: 0, inc3: 0, cbmsp: 0, prevfogo: 0, fn: 5, brig_mun: 0, brig_semas: 0, marinha: 0 },
  { mun: "Autazes", ord: 5, opamv: 2, opam_ref: 0, inc1: 5, inc2: 3, inc3: 0, cbmsp: 0, prevfogo: 0, fn: 38, brig_mun: 4, brig_semas: 6, marinha: 0 },
  { mun: "Barcelos", ord: 2, opamv: 0, opam_ref: 0, inc1: 0, inc2: 0, inc3: 0, cbmsp: 0, prevfogo: 0, fn: 4, brig_mun: 0, brig_semas: 0, marinha: 0 },
  { mun: "Coari", ord: 0, opamv: 2, opam_ref: 1, inc1: 0, inc2: 2, inc3: 1, cbmsp: 0, prevfogo: 0, fn: 8, brig_mun: 6, brig_semas: 0, marinha: 0 },
  { mun: "Envira", ord: 1, opamv: 0, opam_ref: 0, inc1: 0, inc2: 0, inc3: 0, cbmsp: 0, prevfogo: 0, fn: 4, brig_mun: 0, brig_semas: 0, marinha: 0 },
  { mun: "Humaitá", ord: 2, opamv: 4, opam_ref: 0, inc1: 2, inc2: 3, inc3: 0, cbmsp: 0, prevfogo: 0, fn: 0, brig_mun: 0, brig_semas: 8, marinha: 0 },
  { mun: "Iranduba", ord: 7, opamv: 0, opam_ref: 0, inc1: 5, inc2: 3, inc3: 6, cbmsp: 0, prevfogo: 0, fn: 0, brig_mun: 0, brig_semas: 0, marinha: 0 },
  { mun: "Itacoatiara", ord: 4, opamv: 0, opam_ref: 0, inc1: 4, inc2: 3, inc3: 3, cbmsp: 0, prevfogo: 0, fn: 0, brig_mun: 0, brig_semas: 0, marinha: 0 },
  { mun: "Itapiranga", ord: 4, opamv: 0, opam_ref: 0, inc1: 2, inc2: 1, inc3: 0, cbmsp: 0, prevfogo: 0, fn: 4, brig_mun: 0, brig_semas: 0, marinha: 0 },
  { mun: "Jutaí", ord: 1, opamv: 0, opam_ref: 0, inc1: 0, inc2: 0, inc3: 0, cbmsp: 0, prevfogo: 0, fn: 4, brig_mun: 0, brig_semas: 0, marinha: 0 },
  { mun: "Lábrea", ord: 1, opamv: 0, opam_ref: 0, inc1: 3, inc2: 0, inc3: 0, cbmsp: 0, prevfogo: 0, fn: 4, brig_mun: 3, brig_semas: 7, marinha: 0 },
  { mun: "Manaquiri", ord: 2, opamv: 5, opam_ref: 0, inc1: 2, inc2: 2, inc3: 0, cbmsp: 0, prevfogo: 0, fn: 2, brig_mun: 0, brig_semas: 5, marinha: 0 },
  { mun: "Manacapuru", ord: 5, opamv: 0, opam_ref: 0, inc1: 0, inc2: 0, inc3: 0, cbmsp: 0, prevfogo: 0, fn: 6, brig_mun: 0, brig_semas: 0, marinha: 0 },
  { mun: "Manicoré", ord: 4, opamv: 2, opam_ref: 0, inc1: 0, inc2: 3, inc3: 0, cbmsp: 0, prevfogo: 0, fn: 7, brig_mun: 0, brig_semas: 4, marinha: 0 },
  { mun: "Maués", ord: 4, opamv: 2, opam_ref: 0, inc1: 0, inc2: 4, inc3: 0, cbmsp: 0, prevfogo: 0, fn: 14, brig_mun: 4, brig_semas: 0, marinha: 0 },
  { mun: "Nhamundá", ord: 2, opamv: 4, opam_ref: 0, inc1: 0, inc2: 0, inc3: 0, cbmsp: 0, prevfogo: 0, fn: 5, brig_mun: 0, brig_semas: 0, marinha: 0 },
  { mun: "Novo Airão", ord: 3, opamv: 0, opam_ref: 0, inc1: 2, inc2: 2, inc3: 0, cbmsp: 0, prevfogo: 0, fn: 1, brig_mun: 0, brig_semas: 0, marinha: 0 },
  { mun: "Novo Aripuanã", ord: 2, opamv: 4, opam_ref: 0, inc1: 2, inc2: 0, inc3: 0, cbmsp: 0, prevfogo: 0, fn: 0, brig_mun: 0, brig_semas: 6, marinha: 0 },
  { mun: "Parintins", ord: 3, opamv: 0, opam_ref: 0, inc1: 0, inc2: 0, inc3: 0, cbmsp: 0, prevfogo: 0, fn: 8, brig_mun: 0, brig_semas: 0, marinha: 0 },
  { mun: "Presidente Figueiredo", ord: 5, opamv: 0, opam_ref: 0, inc1: 0, inc2: 6, inc3: 3, cbmsp: 0, prevfogo: 0, fn: 1, brig_mun: 0, brig_semas: 0, marinha: 6 },
  { mun: "Rio Preto da Eva", ord: 3, opamv: 0, opam_ref: 0, inc1: 4, inc2: 3, inc3: 2, cbmsp: 0, prevfogo: 0, fn: 1, brig_mun: 0, brig_semas: 0, marinha: 0 },
  { mun: "Tabatinga", ord: 6, opamv: 0, opam_ref: 0, inc1: 0, inc2: 0, inc3: 0, cbmsp: 0, prevfogo: 0, fn: 1, brig_mun: 0, brig_semas: 0, marinha: 0 },
  { mun: "Tapauá", ord: 2, opamv: 2, opam_ref: 0, inc1: 2, inc2: 0, inc3: 0, cbmsp: 0, prevfogo: 0, fn: 2, brig_mun: 0, brig_semas: 6, marinha: 0 },
  { mun: "Tefé", ord: 4, opamv: 0, opam_ref: 0, inc1: 0, inc2: 0, inc3: 0, cbmsp: 0, prevfogo: 0, fn: 2, brig_mun: 0, brig_semas: 0, marinha: 0 },

  // BASES TEMPORÁRIAS
  { mun: "Autazes Posto Km 53", ord: 0, opamv: 3, opam_ref: 0, inc1: 0, inc2: 0, inc3: 2, cbmsp: 0, prevfogo: 0, fn: 0, brig_mun: 0, brig_semas: 6, marinha: 0 },
  { mun: "Anamã", ord: 0, opamv: 0, opam_ref: 0, inc1: 0, inc2: 1, inc3: 1, cbmsp: 0, prevfogo: 0, fn: 0, brig_mun: 0, brig_semas: 0, marinha: 0 },
  { mun: "Boa Vista do Ramos", ord: 0, opamv: 4, opam_ref: 0, inc1: 0, inc2: 0, inc3: 0, cbmsp: 0, prevfogo: 0, fn: 4, brig_mun: 0, brig_semas: 6, marinha: 0 },
  { mun: "Boca do Acre", ord: 0, opamv: 2, opam_ref: 0, inc1: 3, inc2: 2, inc3: 0, cbmsp: 0, prevfogo: 0, fn: 0, brig_mun: 0, brig_semas: 7, marinha: 0 },
  { mun: "Borba", ord: 0, opamv: 2, opam_ref: 0, inc1: 0, inc2: 0, inc3: 0, cbmsp: 0, prevfogo: 0, fn: 20, brig_mun: 0, brig_semas: 5, marinha: 0 },
  { mun: "Caapiranga", ord: 0, opamv: 2, opam_ref: 0, inc1: 0, inc2: 0, inc3: 3, cbmsp: 0, prevfogo: 0, fn: 0, brig_mun: 3, brig_semas: 0, marinha: 0 },
  { mun: "Canutama", ord: 0, opamv: 2, opam_ref: 0, inc1: 0, inc2: 0, inc3: 0, cbmsp: 0, prevfogo: 0, fn: 0, brig_mun: 0, brig_semas: 6, marinha: 0 },
  { mun: "Careiro Castanho", ord: 0, opamv: 5, opam_ref: 0, inc1: 0, inc2: 5, inc3: 2, cbmsp: 0, prevfogo: 0, fn: 6, brig_mun: 0, brig_semas: 4, marinha: 0 },
  { mun: "Careiro da Várzea", ord: 0, opamv: 0, opam_ref: 0, inc1: 0, inc2: 0, inc3: 0, cbmsp: 0, prevfogo: 0, fn: 18, brig_mun: 6, brig_semas: 0, marinha: 0 },
  { mun: "São Sebastião do Uatumã", ord: 0, opamv: 0, opam_ref: 0, inc1: 0, inc2: 0, inc3: 0, cbmsp: 0, prevfogo: 0, fn: 0, brig_mun: 0, brig_semas: 0, marinha: 0 },
  { mun: "Urucurituba", ord: 0, opamv: 1, opam_ref: 0, inc1: 0, inc2: 0, inc3: 0, cbmsp: 0, prevfogo: 0, fn: 0, brig_mun: 6, brig_semas: 0, marinha: 0 },
];

const efetivoFormatted = rawEfetivoData.map((r) => ({
  ...r,
  mun: canonicalMunicipio(r.mun),
  servico: r.ord,
  seg: 0,
  brig: r.brig_mun + r.brig_semas,
}));

// Recursos da Página 2
const rawRecursosData = [
  { mun: "Manaus", abt: 7, atf: 1, abs: 1, dosa: 3, crs: 1, ar: 10, ur: 6, gse: 4, embarcacao: 2, autoarp: 1, helicoptero: 3, aviao: 8, quadriciclo: 1, viaturas: 28, aeronaves: 11, embarcacoes: 2 },
  { mun: "Apuí", atf: 1, ar: 2, viaturas: 3, aeronaves: 0, embarcacoes: 0 },
  { mun: "Atalaia do Norte", atf: 1, viaturas: 1, aeronaves: 0, embarcacoes: 0 },
  { mun: "Autazes", atf: 1, ar: 2, viaturas: 3, aeronaves: 0, embarcacoes: 0 },
  { mun: "Autazes Posto Km 53", abtf: 1, ar: 2, viaturas: 3, aeronaves: 0, embarcacoes: 0 },
  { mun: "Barcelos", atf: 1, ar: 1, viaturas: 2, aeronaves: 0, embarcacoes: 0 },
  { mun: "Boa Vista do Ramos", ar: 1, viaturas: 1, aeronaves: 0, embarcacoes: 0 },
  { mun: "Boca do Acre", atf: 1, ar: 1, viaturas: 2, aeronaves: 0, embarcacoes: 0 },
  { mun: "Borba", abf: 1, viaturas: 1, aeronaves: 0, embarcacoes: 0 },
  { mun: "Caapiranga", abf: 1, viaturas: 1, aeronaves: 0, embarcacoes: 0 },
  { mun: "Canutama", ar: 1, viaturas: 1, aeronaves: 0, embarcacoes: 0 },
  { mun: "Careiro Castanho", atf: 1, ar: 2, viaturas: 3, aeronaves: 0, embarcacoes: 0 },
  { mun: "Careiro da Várzea", abs: 1, ar: 1, viaturas: 2, aeronaves: 0, embarcacoes: 0 },
  { mun: "Coari", abtf: 1, ar: 1, viaturas: 2, aeronaves: 0, embarcacoes: 0 },
  { mun: "Envira", atf: 1, viaturas: 1, aeronaves: 0, embarcacoes: 0 },
  { mun: "Humaitá", atf: 1, abtf: 1, ar: 1, ur: 1, embarcacao: 2, viaturas: 4, aeronaves: 0, embarcacoes: 2 },
  { mun: "Iranduba", abt: 1, atf: 2, ar: 2, ur: 1, mt: 1, viaturas: 7, aeronaves: 0, embarcacoes: 0 },
  { mun: "Itacoatiara", abt: 1, abtf: 1, crs: 1, ar: 1, ur: 1, mt: 2, viaturas: 7, aeronaves: 0, embarcacoes: 0 },
  { mun: "Itapiranga", atf: 1, ar: 1, viaturas: 2, aeronaves: 0, embarcacoes: 0 },
  { mun: "Jutaí", atf: 1, ar: 1, viaturas: 2, aeronaves: 0, embarcacoes: 0 },
  { mun: "Lábrea", atf: 1, ar: 2, viaturas: 3, aeronaves: 0, embarcacoes: 0 },
  { mun: "Manacapuru", abt: 2, ar: 2, ur: 1, gse: 1, embarcacao: 1, jetski: 1, viaturas: 6, aeronaves: 0, embarcacoes: 2 },
  { mun: "Manaquiri", atf: 1, ar: 1, viaturas: 2, aeronaves: 0, embarcacoes: 0 },
  { mun: "Manicoré", atf: 1, ar: 1, mt: 1, viaturas: 3, aeronaves: 0, embarcacoes: 0 },
  { mun: "Maués", atf: 1, ar: 1, viaturas: 2, aeronaves: 0, embarcacoes: 0 },
  { mun: "Nhamundá", viaturas: 0, aeronaves: 0, embarcacoes: 0 },
  { mun: "Novo Airão", abt: 1, at: 2, ar: 1, embarcacao: 1, jetski: 1, viaturas: 4, aeronaves: 0, embarcacoes: 2 },
  { mun: "Novo Aripuanã", atf: 1, ar: 2, mt: 1, viaturas: 4, aeronaves: 0, embarcacoes: 0 },
  { mun: "Parintins", abt: 1, atf: 1, ar: 1, ur: 1, mt: 2, embarcacao: 1, aviao: 1, viaturas: 5, aeronaves: 1, embarcacoes: 1 },
  { mun: "Presidente Figueiredo", abt: 1, atf: 1, ar: 1, ur: 1, mt: 1, embarcacao: 1, viaturas: 5, aeronaves: 0, embarcacoes: 1 },
  { mun: "Rio Preto da Eva", abt: 1, atf: 1, ar: 1, ur: 2, mt: 2, embarcacao: 2, viaturas: 7, aeronaves: 0, embarcacoes: 2 },
  { mun: "Tabatinga", abt: 1, atf: 1, ar: 1, ur: 1, mt: 1, embarcacao: 1, viaturas: 5, aeronaves: 0, embarcacoes: 1 },
  { mun: "Tapauá", atf: 1, ar: 1, viaturas: 2, aeronaves: 0, embarcacoes: 0 },
  { mun: "Tefé", abt: 2, abtf: 1, crs: 1, ar: 1, ur: 1, mt: 2, embarcacao: 1, viaturas: 8, aeronaves: 0, embarcacoes: 1 },
  { mun: "Urucurituba", ar: 1, viaturas: 1, aeronaves: 0, embarcacoes: 0 },
];

const recursosFormatted = rawRecursosData.map((r) => ({
  ...r,
  mun: canonicalMunicipio(r.mun),
}));

// Incêndios do Dia (Página 3)
const rawIncendiosData = [
  { mun: "Manaus", urb: 5, flor: 1, focos: 1, total_periodo: 6 },
  { mun: "Autazes", urb: 0, flor: 1, focos: 38, total_periodo: 1 },
  { mun: "Itacoatiara", urb: 0, flor: 1, focos: 1, total_periodo: 1 },
  { mun: "Itapiranga", urb: 0, flor: 2, focos: 3, total_periodo: 2 },
];

const incendiosFormatted = rawIncendiosData.map((r) => ({
  ...r,
  mun: canonicalMunicipio(r.mun),
}));

// Incêndios Acumulado (Página 3)
const rawAcumuladoData = [
  { mun: "Manaus", urb: 901, flor: 1188, focos: 4722, sat: 44, area: 1615650 },
  { mun: "Apuí", urb: 4, flor: 32, focos: 150, sat: 1009, area: 36000 },
  { mun: "Atalaia do Norte", urb: 1, flor: 2, focos: 10, sat: 8, area: 650 },
  { mun: "Autazes", urb: 14, flor: 103, focos: 738, sat: 551, area: 1482100 },
  { mun: "Autazes Posto Km 53", urb: 0, flor: 1, focos: 5, sat: 0, area: 450 },
  { mun: "Barcelos", urb: 2, flor: 15, focos: 77, sat: 12, area: 45300 },
  { mun: "Boa Vista do Ramos", urb: 0, flor: 1, focos: 40, sat: 132, area: 200000 },
  { mun: "Boca do Acre", urb: 1, flor: 31, focos: 334, sat: 431, area: 529450 },
  { mun: "Borba", urb: 3, flor: 60, focos: 512, sat: 172, area: 751660 },
  { mun: "Caapiranga", urb: 0, flor: 14, focos: 257, sat: 167, area: 25350 },
  { mun: "Canutama", urb: 1, flor: 6, focos: 28, sat: 142, area: 51600 },
  { mun: "Careiro Castanho", urb: 3, flor: 48, focos: 483, sat: 199, area: 163800 },
  { mun: "Careiro da Várzea", urb: 0, flor: 0, focos: 0, sat: 241, area: 0 },
  { mun: "Coari", urb: 3, flor: 3, focos: 9, sat: 30, area: 100 },
  { mun: "Envira", urb: 0, flor: 0, focos: 0, sat: 55, area: 50 },
  { mun: "Humaitá", urb: 14, flor: 102, focos: 1070, sat: 256, area: 527250 },
  { mun: "Iranduba", urb: 14, flor: 155, focos: 2000, sat: 69, area: 4876510 },
  { mun: "Itacoatiara", urb: 19, flor: 99, focos: 550, sat: 337, area: 616610 },
  { mun: "Itapiranga", urb: 7, flor: 111, focos: 1561, sat: 20, area: 354130 },
  { mun: "Jutaí", urb: 9, flor: 7, focos: 50, sat: 5, area: 5200 },
  { mun: "Lábrea", urb: 4, flor: 55, focos: 360, sat: 782, area: 338900 },
  { mun: "Manacapuru", urb: 20, flor: 173, focos: 4414, sat: 330, area: 2262450 },
  { mun: "Manaquiri", urb: 2, flor: 55, focos: 770, sat: 197, area: 465750 },
  { mun: "Manicoré", urb: 4, flor: 28, focos: 373, sat: 370, area: 32250 },
  { mun: "Maués", urb: 10, flor: 91, focos: 339, sat: 362, area: 218550 },
  { mun: "Nhamundá", urb: 1, flor: 12, focos: 169, sat: 99, area: 14150 },
  { mun: "Novo Airão", urb: 4, flor: 56, focos: 569, sat: 48, area: 794100 },
  { mun: "Novo Aripuanã", urb: 3, flor: 41, focos: 398, sat: 882, area: 327000 },
  { mun: "Parintins", urb: 28, flor: 79, focos: 1126, sat: 89, area: 4047050 },
  { mun: "Presidente Figueiredo", urb: 7, flor: 58, focos: 1010, sat: 69, area: 526350 },
  { mun: "Rio Preto da Eva", urb: 5, flor: 105, focos: 1703, sat: 44, area: 285300 },
  { mun: "Tabatinga", urb: 4, flor: 2, focos: 2, sat: 6, area: 250 },
  { mun: "Tapauá", urb: 1, flor: 9, focos: 36, sat: 65, area: 7150 },
  { mun: "Tefé", urb: 12, flor: 10, focos: 22, sat: 33, area: 350 },
  { mun: "Urucurituba", urb: 0, flor: 16, focos: 342, sat: 181, area: 42250 },
];

const acumuladoFormatted = rawAcumuladoData.map((r) => ({
  ...r,
  mun: canonicalMunicipio(r.mun),
}));

const headerObj = {
  titulo: "CORPO DE BOMBEIROS MILITAR DO AMAZONAS",
  subtitulo: "RELATÓRIO DE OCORRÊNCIAS 2026",
  periodo: "25 / OUT / 2026 - 8H00",
  proximoPeriodo: "26 / OUT / 2026 - 8H00",
  reuniaoPlanejamento: "25 / OUT / 2026 - 8H15",
  reuniaoBriefing: "25 / OUT / 2026 - 8H30",
  comandante: "CEL QOBM BORGES",
  chefeCapital: "CEL QOBM MENEZES",
  chefeInterior: "CEL QOBM MONTEIRO",
  coordSituacao: "CEL QOBM FERREIRA",
  subcomandante: "CEL QOBM HELYANTHUS FRANK DA SILVA BORGES",
  coordenador: "CEL QOBM CRISTIANO BRAZ FERREIRA",
};

const notesPayload = JSON.stringify({
  header: headerObj,
  incendios_acumulado: acumuladoFormatted,
});

async function main() {
  const shifts: Array<"noturno" | "parcial"> = ["noturno", "parcial"];

  for (const shift of shifts) {
    const payload = {
      report_date: "2026-10-25",
      shift,
      efetivo: manausFirst(efetivoFormatted),
      recursos: manausFirst(recursosFormatted),
      incendios: manausFirst(incendiosFormatted),
      outras: [],
      notes: notesPayload,
    };

    const { data: existing } = await supabase
      .from("daily_reports")
      .select("id")
      .eq("report_date", "2026-10-25")
      .eq("shift", shift)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("daily_reports")
        .update(payload)
        .eq("id", existing.id);
      if (error) {
        console.error(`Erro ao atualizar 2026-10-25 (${shift}):`, error);
      } else {
        console.log(`✅ Relatório 2026-10-25 (${shift}) atualizado com sucesso!`);
      }
    } else {
      const { error } = await supabase.from("daily_reports").insert(payload);
      if (error) {
        console.error(`Erro ao inserir 2026-10-25 (${shift}):`, error);
      } else {
        console.log(`✅ Relatório 2026-10-25 (${shift}) inserido com sucesso!`);
      }
    }
  }
}

main().catch(console.error);
