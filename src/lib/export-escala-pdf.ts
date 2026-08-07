import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CBMAM_LOGO_BASE64 } from "./cbmam-logo";

export type Operator = {
  id: string;
  rank: string;
  name: string;
  phone: string;
  active: boolean;
  profile_id: string | null;
};

export type Shift = {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  operator_id: string;
  notes: string | null;
};

function toISOLocal(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function addDaysISO(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toISOLocal(d);
}

function trimHM(t: string) {
  return t ? t.slice(0, 5) : "";
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const DAY_NAMES_BR = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

export function exportEscalaPdf({
  currentMonth,
  operators,
  shifts,
}: {
  currentMonth: Date;
  operators: Operator[];
  shifts: Shift[];
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth(); // ~841.89 pt
  const pageH = doc.internal.pageSize.getHeight(); // ~595.28 pt

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const monthName = MONTH_NAMES[month];
  const monthTitle = `${monthName.toUpperCase()} DE ${year}`;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const endOffset = 6 - lastDay.getDay();

  const rangeFrom = addDaysISO(toISOLocal(firstDay), -startOffset);
  const rangeTo = addDaysISO(toISOLocal(lastDay), endOffset);

  const opsById = new Map<string, Operator>();
  for (const o of operators) opsById.set(o.id, o);

  const shiftsByDate = new Map<string, Shift[]>();
  for (const s of shifts) {
    const list = shiftsByDate.get(s.shift_date) ?? [];
    list.push(s);
    shiftsByDate.set(s.shift_date, list);
  }

  // --- CABEÇALHO INSTITUCIONAL ---
  if (CBMAM_LOGO_BASE64) {
    try {
      doc.addImage(CBMAM_LOGO_BASE64, "PNG", 20, 15, 45, 45);
    } catch {
      // fallback sem imagem
    }
  }

  doc.setTextColor(16, 78, 46); // Verde CBMAM
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("CORPO DE BOMBEIROS MILITAR DO ESTADO DO AMAZONAS", 75, 28);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("COMANDO OPERACIONAL DA SALA DE SITUAÇÃO — AMAZONAS + VERDE", 75, 42);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`ESCALA MENSAL DE SERVIÇO DA SALA DE SITUAÇÃO — ${monthTitle}`, 75, 54);

  // Linha separadora
  doc.setDrawColor(16, 78, 46);
  doc.setLineWidth(1.5);
  doc.line(20, 62, pageW - 20, 62);

  // --- CONSTRUÇÃO DO CALENDÁRIO GRID ---
  // Monta as semanas
  const weeks: { date: string; inMonth: boolean }[][] = [];
  let currIso = rangeFrom;
  while (currIso <= rangeTo) {
    const week: { date: string; inMonth: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const dObj = new Date(currIso + "T00:00:00");
      week.push({
        date: currIso,
        inMonth: dObj.getMonth() === month,
      });
      currIso = addDaysISO(currIso, 1);
    }
    weeks.push(week);
  }

  const tableHead = [["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"]];
  const tableBody = weeks.map((week) => {
    return week.map((day) => {
      if (!day.inMonth) return "";
      const dNum = new Date(day.date + "T00:00:00").getDate();
      const list = shiftsByDate.get(day.date) ?? [];

      if (list.length === 0) {
        return `[ ${dNum} ]\n— Sem Serviço —`;
      }

      const lines = list.map((s) => {
        const op = opsById.get(s.operator_id);
        const name = op ? `${op.rank ? op.rank + " " : ""}${op.name}` : "Operador";
        const phone = op?.phone ? ` (${op.phone})` : "";
        const time = `${trimHM(s.start_time)}–${trimHM(s.end_time)}`;
        return `${name}${phone}\nHorário: ${time}`;
      });

      return `[ ${dNum} ]\n${lines.join("\n\n")}`;
    });
  });

  autoTable(doc, {
    startY: 70,
    margin: { left: 20, right: 20 },
    head: tableHead,
    body: tableBody,
    styles: {
      fontSize: 7.5,
      cellPadding: 4,
      valign: "top",
      lineColor: [203, 213, 225],
      lineWidth: 0.5,
      minCellHeight: 50,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [16, 78, 46],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      fontSize: 8.5,
    },
    columnStyles: {
      0: { cellWidth: (pageW - 40) / 7 },
      1: { cellWidth: (pageW - 40) / 7 },
      2: { cellWidth: (pageW - 40) / 7 },
      3: { cellWidth: (pageW - 40) / 7 },
      4: { cellWidth: (pageW - 40) / 7 },
      5: { cellWidth: (pageW - 40) / 7 },
      6: { cellWidth: (pageW - 40) / 7 },
    },
    didParseCell: (data) => {
      if (data.section === "body") {
        const text = String(data.cell.raw || "");
        if (text.includes("Sem Serviço")) {
          data.cell.styles.textColor = [148, 163, 184];
        } else if (text) {
          data.cell.styles.fillColor = [240, 253, 244]; // Fundo levemente esverdeado para dias escalados
        }
      }
    },
  });

  // --- SEGUNDA PÁGINA: LISTAGEM DETALHADA DOS ESCALADOS ---
  doc.addPage("a4", "landscape");

  doc.setTextColor(16, 78, 46);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`RELAÇÃO DETALHADA DOS MILITARES ESCALADOS — ${monthTitle}`, 20, 30);

  // Filtra serviços do mês vigente
  const monthShifts: { date: string; shift: Shift; op?: Operator }[] = [];
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const list = shiftsByDate.get(iso) ?? [];
    for (const s of list) {
      monthShifts.push({
        date: iso,
        shift: s,
        op: opsById.get(s.operator_id),
      });
    }
  }

  const detailHead = [["#", "DATA", "DIA DA SEMANA", "HORÁRIO DE SERVIÇO", "MILITAR ESCALADO", "CONTATO / TELEFONE", "OBSERVAÇÕES"]];
  const detailBody = monthShifts.map((item, idx) => {
    const [y, m, dNum] = item.date.split("-");
    const dObj = new Date(item.date + "T12:00:00");
    const dayName = DAY_NAMES_BR[dObj.getDay()];
    const dateFormatted = `${dNum}/${m}/${y}`;
    const op = item.op;
    const militarName = op ? `${op.rank ? op.rank + " " : ""}${op.name}` : "—";
    const phone = op?.phone || "—";
    const horario = `${trimHM(item.shift.start_time)} às ${trimHM(item.shift.end_time)}`;
    const obs = item.shift.notes || "—";

    return [idx + 1, dateFormatted, dayName, horario, militarName, phone, obs];
  });

  autoTable(doc, {
    startY: 40,
    margin: { left: 20, right: 20 },
    head: detailHead,
    body: detailBody.length > 0 ? detailBody : [["—", "—", "—", "—", "Nenhum militar escalado neste mês", "—", "—"]],
    styles: {
      fontSize: 8.5,
      cellPadding: 4,
      valign: "middle",
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [16, 78, 46],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 25 },
      1: { halign: "center", cellWidth: 70 },
      2: { halign: "center", cellWidth: 90 },
      3: { halign: "center", cellWidth: 120 },
      4: { fontStyle: "bold", cellWidth: 200 },
      5: { halign: "center", cellWidth: 100 },
      6: { cellWidth: "auto" },
    },
  });

  // --- BLOCO DE ASSINATURA NO FINAL DA ÚLTIMA PÁGINA ---
  const finalY = (doc as any).lastAutoTable.finalY + 45;
  const signY = Math.min(finalY, pageH - 50);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);

  doc.line(pageW / 2 - 140, signY, pageW / 2 + 140, signY);
  doc.setFont("helvetica", "bold");
  doc.text("COORDENADOR DA SALA DE SITUAÇÃO", pageW / 2, signY + 12, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text("Corpo de Bombeiros Militar do Estado do Amazonas", pageW / 2, signY + 24, { align: "center" });

  // Nome do arquivo PDF
  const filename = `escala-sala-de-situacao-${monthName.toLowerCase()}-${year}.pdf`;
  doc.save(filename);
}
