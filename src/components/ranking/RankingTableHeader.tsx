import { TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ColumnDef {
  key: string;
  label: string;
  tooltip: string;
  width?: string;
  sticky?: boolean;
}

const columns: ColumnDef[] = [
  { key: "position", label: "#", tooltip: "Posição", width: "w-12", sticky: true },
  { key: "nickname", label: "Jogador", tooltip: "Apelido do jogador", width: "min-w-[140px]", sticky: true },
  { key: "pontos_totais", label: "PT", tooltip: "Pontos Totais", width: "w-16" },
  { key: "gols", label: "G", tooltip: "Gols", width: "w-14" },
  { key: "assistencias", label: "A", tooltip: "Assistências", width: "w-14" },
  { key: "vitorias", label: "V", tooltip: "Vitórias", width: "w-14" },
  { key: "empates", label: "E", tooltip: "Empates", width: "w-14" },
  { key: "derrotas", label: "D", tooltip: "Derrotas", width: "w-14" },
  { key: "presencas", label: "P", tooltip: "Presenças", width: "w-14" },
  { key: "faltas", label: "F", tooltip: "Faltas", width: "w-14" },
  { key: "atrasos", label: "At", tooltip: "Atrasos", width: "w-14" },
  { key: "punicoes", label: "Pn", tooltip: "Punições", width: "w-14" },
  { key: "cartoes_amarelos", label: "🟨", tooltip: "Cartões Amarelos", width: "w-12" },
  { key: "cartoes_azuis", label: "🟦", tooltip: "Cartões Azuis", width: "w-12" },
  { key: "actions", label: "", tooltip: "Ações", width: "w-20" },
];

export { columns };

export default function RankingTableHeader() {
  return (
    <TableHeader className="bg-muted/30 sticky top-0 z-10">
      <TableRow className="border-border hover:bg-transparent">
        <TooltipProvider>
          {columns.map((col) => (
            <Tooltip key={col.key}>
              <TooltipTrigger asChild>
                <TableHead
                  className={cn(
                    "text-primary font-bold text-center whitespace-nowrap",
                    col.width,
                    col.sticky && "sticky left-0 bg-muted/30 z-20"
                  )}
                >
                  {col.label}
                </TableHead>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-sm">{col.tooltip}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </TableRow>
    </TableHeader>
  );
}
