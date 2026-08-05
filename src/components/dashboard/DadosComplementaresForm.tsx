import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Flame, ShieldAlert, Trees, Clock, HelpCircle } from "lucide-react";

export type DadosComplementaresState = {
  areaQueimadaCombatidaHa?: number | null;
  numeroFocosCombatidos?: number | null;
  tipoVegetacaoPredominante?: string;
  riscoPropagacao?: string;
  proximidadeEdificacoes?: string;
  riscoRedeEletrica?: string;
  ameacaPatrimonio?: string;
  atingiuAreaProtegida?: string;
  causaProvavel?: string;
  fonteCausaProvavel?: string[];
  aceiroRealizado?: string;
  apoioAereo?: string;
  apoioMaquinas?: string;
  tempoCombateMinutos?: number | null;
  observacoesOperacionais?: string;
};

interface Props {
  value: DadosComplementaresState;
  onChange: (val: DadosComplementaresState) => void;
  canEdit: boolean;
}

export function DadosComplementaresForm({ value, onChange, canEdit }: Props) {
  const patch = (updates: Partial<DadosComplementaresState>) => {
    onChange({ ...value, ...updates });
  };

  const toggleFonte = (val: string) => {
    const current = value.fonteCausaProvavel ?? [];
    const next = current.includes(val)
      ? current.filter((item) => item !== val)
      : [...current, val];
    patch({ fonteCausaProvavel: next });
  };

  const fontesOpcoes = [
    { valor: "observacao_em_campo", rotulo: "Observação em Campo" },
    { valor: "relato_de_populares", rotulo: "Relato de Populares" },
    { valor: "relato_do_solicitante", rotulo: "Relato do Solicitante" },
    { valor: "vestigios_no_local", rotulo: "Vestígios no Local" },
    { valor: "informacao_orgao_ambiental", rotulo: "Informação de Órgão Ambiental" },
    { valor: "imagem_monitoramento", rotulo: "Imagem de Satélite/Drone/Monitoramento" },
    { valor: "nao_determinada", rotulo: "Não Determinada" },
  ];

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="bg-muted/30 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-emerald-700" />
            <CardTitle className="text-lg font-bold">
              Dados Complementares (Incêndio Florestal & Vegetação)
            </CardTitle>
          </div>
          <Badge variant="outline" className="border-emerald-700 text-emerald-800 bg-emerald-50">
            Schema API CBMAM
          </Badge>
        </div>
        <CardDescription>
          Informações adicionais detalhadas requeridas para o registro operacional de ocorrências de incêndio em cobertura vegetal.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Área Queimada Combatida (ha) */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1 font-semibold">
            Área Queimada Combatida (ha) <span className="text-red-500">*</span>
          </Label>
          <Input
            type="number"
            step="any"
            min="0"
            placeholder="Ex.: 12.5"
            disabled={!canEdit}
            value={value.areaQueimadaCombatidaHa ?? ""}
            onChange={(e) =>
              patch({
                areaQueimadaCombatidaHa: e.target.value !== "" ? Number(e.target.value) : null,
              })
            }
          />
          <p className="text-[11px] text-muted-foreground">Área queimada combatida em hectares.</p>
        </div>

        {/* Número de Focos Combatidos */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1 font-semibold">
            Número de Focos Combatidos <span className="text-red-500">*</span>
          </Label>
          <Input
            type="number"
            min="0"
            placeholder="Ex.: 4"
            disabled={!canEdit}
            value={value.numeroFocosCombatidos ?? ""}
            onChange={(e) =>
              patch({
                numeroFocosCombatidos: e.target.value !== "" ? Number(e.target.value) : null,
              })
            }
          />
          <p className="text-[11px] text-muted-foreground">Quantidade de focos combatidos na ocorrência.</p>
        </div>

        {/* Tipo de Vegetação Predominante */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1 font-semibold">
            Tipo de Vegetação Predominante <span className="text-red-500">*</span>
          </Label>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            disabled={!canEdit}
            value={value.tipoVegetacaoPredominante ?? ""}
            onChange={(e) => patch({ tipoVegetacaoPredominante: e.target.value })}
          >
            <option value="" disabled>Selecione...</option>
            <option value="pastagem">Pastagem</option>
            <option value="capoeira">Capoeira</option>
            <option value="mato_baixo">Mato Baixo</option>
            <option value="vegetacao_urbana">Vegetação Urbana</option>
            <option value="terreno_baldio">Terreno Baldio</option>
            <option value="floresta_nativa">Floresta Nativa</option>
            <option value="floresta_plantada">Floresta Plantada</option>
            <option value="mata_ciliar">Mata Ciliar</option>
            <option value="area_preservacao">Área de Preservação</option>
            <option value="lixao_aterro">Lixão/Aterro</option>
            <option value="outros">Outros</option>
          </select>
          <p className="text-[11px] text-muted-foreground">Tipo predominante de vegetação atingida.</p>
        </div>

        {/* Risco de Propagação */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1 font-semibold">
            Risco de Propagação <span className="text-red-500">*</span>
          </Label>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            disabled={!canEdit}
            value={value.riscoPropagacao ?? ""}
            onChange={(e) => patch({ riscoPropagacao: e.target.value })}
          >
            <option value="" disabled>Selecione...</option>
            <option value="baixo">Baixo</option>
            <option value="medio">Médio</option>
            <option value="alto">Alto</option>
            <option value="critico">Crítico</option>
          </select>
          <p className="text-[11px] text-muted-foreground">Nível de risco de propagação do fogo.</p>
        </div>

        {/* Proximidade com Edificações */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1 font-semibold">
            Há Proximidade com Edificações? <span className="text-red-500">*</span>
          </Label>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            disabled={!canEdit}
            value={value.proximidadeEdificacoes ?? ""}
            onChange={(e) => patch({ proximidadeEdificacoes: e.target.value })}
          >
            <option value="" disabled>Selecione...</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
          <p className="text-[11px] text-muted-foreground">Risco para residências, comércios ou edificações.</p>
        </div>

        {/* Risco à Rede Elétrica */}
        <div className="space-y-2">
          <Label className="font-semibold">Há Risco à Rede Elétrica?</Label>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            disabled={!canEdit}
            value={value.riscoRedeEletrica ?? ""}
            onChange={(e) => patch({ riscoRedeEletrica: e.target.value })}
          >
            <option value="">Não informado</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
          <p className="text-[11px] text-muted-foreground">Proximidade com rede elétrica.</p>
        </div>

        {/* Ameaça a Patrimônio */}
        <div className="space-y-2">
          <Label className="font-semibold">Houve Ameaça a Patrimônio?</Label>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            disabled={!canEdit}
            value={value.ameacaPatrimonio ?? ""}
            onChange={(e) => patch({ ameacaPatrimonio: e.target.value })}
          >
            <option value="">Não informado</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
          <p className="text-[11px] text-muted-foreground">Ameaça a bens públicos ou privados.</p>
        </div>

        {/* Atingiu Área Protegida */}
        <div className="space-y-2">
          <Label className="font-semibold">Atingiu Área Protegida?</Label>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            disabled={!canEdit}
            value={value.atingiuAreaProtegida ?? ""}
            onChange={(e) => patch({ atingiuAreaProtegida: e.target.value })}
          >
            <option value="">Não informado</option>
            <option value="nao">Não</option>
            <option value="unidade_conservacao">Unidade de Conservação</option>
            <option value="terra_indigena">Terra Indígena</option>
            <option value="area_militar">Área Militar</option>
            <option value="assentamento">Assentamento Rural</option>
            <option value="mais_de_uma">Mais de uma categoria</option>
          </select>
          <p className="text-[11px] text-muted-foreground">Área legalmente protegida atingida.</p>
        </div>

        {/* Causa Provável */}
        <div className="space-y-2">
          <Label className="font-semibold">Causa Provável</Label>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            disabled={!canEdit}
            value={value.causaProvavel ?? ""}
            onChange={(e) => patch({ causaProvavel: e.target.value })}
          >
            <option value="">Não informada</option>
            <option value="queima_controlada_perdida">Queima Controlada Perdida</option>
            <option value="limpeza_terreno">Limpeza de Terreno</option>
            <option value="acao_criminosa">Ação Criminosa</option>
            <option value="fenomeno_natural">Fenômeno Natural</option>
            <option value="indeterminada">Indeterminada</option>
          </select>
          <p className="text-[11px] text-muted-foreground">Causa provável do incêndio.</p>
        </div>

        {/* Aceiro Realizado */}
        <div className="space-y-2">
          <Label className="font-semibold">Aceiro Realizado?</Label>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            disabled={!canEdit}
            value={value.aceiroRealizado ?? ""}
            onChange={(e) => patch({ aceiroRealizado: e.target.value })}
          >
            <option value="">Não informado</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
        </div>

        {/* Apoio Aéreo */}
        <div className="space-y-2">
          <Label className="font-semibold">Houve Apoio Aéreo?</Label>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            disabled={!canEdit}
            value={value.apoioAereo ?? ""}
            onChange={(e) => patch({ apoioAereo: e.target.value })}
          >
            <option value="">Não informado</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
        </div>

        {/* Apoio de Máquinas */}
        <div className="space-y-2">
          <Label className="font-semibold">Emprego de Máquinas?</Label>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            disabled={!canEdit}
            value={value.apoioMaquinas ?? ""}
            onChange={(e) => patch({ apoioMaquinas: e.target.value })}
          >
            <option value="">Não informado</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
        </div>

        {/* Tempo de Combate (minutos) */}
        <div className="space-y-2 md:col-span-2 lg:col-span-1">
          <Label className="font-semibold">Tempo de Combate (minutos)</Label>
          <Input
            type="number"
            min="0"
            placeholder="Ex.: 180"
            disabled={!canEdit}
            value={value.tempoCombateMinutos ?? ""}
            onChange={(e) =>
              patch({
                tempoCombateMinutos: e.target.value !== "" ? Number(e.target.value) : null,
              })
            }
          />
          <p className="text-[11px] text-muted-foreground">Tempo estimado em minutos nas ações de combate.</p>
        </div>

        {/* Origem da Informação da Causa Provável (Multi-select Pills) */}
        <div className="space-y-2 md:col-span-2 lg:col-span-3">
          <Label className="font-semibold">Origem da Informação da Causa Provável</Label>
          <div className="flex flex-wrap gap-2 pt-1">
            {fontesOpcoes.map((f) => {
              const selected = (value.fonteCausaProvavel ?? []).includes(f.valor);
              return (
                <button
                  key={f.valor}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => toggleFonte(f.valor)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                    selected
                      ? "bg-emerald-700 text-white border-emerald-800 shadow-sm"
                      : "bg-muted/50 text-foreground border-border hover:bg-muted"
                  }`}
                >
                  {f.rotulo}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">Selecione uma ou mais fontes de informação para a causa provável.</p>
        </div>

        {/* Observações Operacionais */}
        <div className="space-y-2 md:col-span-2 lg:col-span-3">
          <Label className="font-semibold">Observações Operacionais</Label>
          <Textarea
            placeholder="Registre aqui informações adicionais relevantes da ocorrência..."
            rows={3}
            disabled={!canEdit}
            value={value.observacoesOperacionais ?? ""}
            onChange={(e) => patch({ observacoesOperacionais: e.target.value })}
          />
        </div>

      </CardContent>
    </Card>
  );
}
