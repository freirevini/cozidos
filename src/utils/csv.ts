// CSV utility functions for import/export

export interface PlayerExportRow {
  Nickname: string;
  FirstName: string;
  LastName: string;
  Email: string;
  Level: string;
  Position: string;
  ClaimToken: string;
  Status: string;
  CreatedAt: string;
}

export interface ImportResult {
  success: boolean;
  created: number;
  updated: number;
  errors_count: number;
  errors: Array<{
    row: number;
    error: string;
    data?: any;
    candidates?: any[];
  }>;
  results: Array<{
    row: number;
    action: string;
    profile_id: string;
    nickname: string;
    claim_token?: string;
  }>;
}

export interface ClassificationImportResult extends ImportResult {
  rankings_created: number;
  rankings_updated: number;
  profiles_created: number;
}

// Players template
export const PLAYERS_TEMPLATE = `Nickname,Level
felipe,A
joesley,B
lulu,C`;

// Classification template
export const CLASSIFICATION_TEMPLATE = `Nickname,Token,Gols,Assistencias,Vitorias,Empates,Derrotas,Pontos_Totais,Ano
felipe,,10,4,6,2,2,20,2023
,AB12CD34,8,6,5,3,2,18,2023`;

export function generateCSV(headers: string[], rows: any[][]): string {
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      const value = cell?.toString() || '';
      // Escape quotes and wrap in quotes if contains comma
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(','))
  ].join('\n');

  return csvContent;
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadTemplate(type: 'players' | 'classification'): void {
  const content = type === 'players' ? PLAYERS_TEMPLATE : CLASSIFICATION_TEMPLATE;
  const filename = type === 'players' ? 'template_jogadores.csv' : 'template_classificacao.csv';
  downloadCSV(content, filename);
}

export function generateErrorsCSV(errors: Array<{ row: number; error: string; data?: any }>): string {
  const headers = ['Linha', 'Erro', 'Dados_Originais'];
  const rows = errors.map(e => [
    e.row.toString(),
    e.error,
    JSON.stringify(e.data || {})
  ]);
  return generateCSV(headers, rows);
}

export function generateTokensCSV(results: Array<{ nickname: string; claim_token?: string }>): string {
  const headers = ['Nickname', 'ClaimToken'];
  const rows = results
    .filter(r => r.claim_token)
    .map(r => [r.nickname, r.claim_token || '']);
  return generateCSV(headers, rows);
}

export function validatePlayerImportRow(row: any): { valid: boolean; error?: string } {
  const nickname = row?.Nickname || row?.nickname;
  const level = row?.Level || row?.level || row?.Nivel || row?.nivel;

  if (!nickname || !nickname.toString().trim()) {
    return { valid: false, error: 'Nickname é obrigatório' };
  }

  const upperLevel = level?.toString().toUpperCase().trim();
  if (!upperLevel || !['A', 'B', 'C', 'D', 'E'].includes(upperLevel)) {
    return { valid: false, error: 'Level inválido (deve ser A, B, C, D ou E)' };
  }

  return { valid: true };
}

export function validateClassificationImportRow(row: any): { valid: boolean; error?: string } {
  const nickname = row?.Nickname || row?.nickname;
  const token = row?.Token || row?.token || row?.ClaimToken || row?.claim_token;
  const ano = row?.Ano || row?.ano;

  if (!nickname || !nickname.toString().trim()) {
    return { valid: false, error: 'Nickname é obrigatório' };
  }

  if (!token || !token.toString().trim()) {
    return { valid: false, error: 'Token é obrigatório' };
  }

  if (ano) {
    const year = parseInt(ano);
    if (isNaN(year) || year < 2000 || year > 2100) {
      return { valid: false, error: `Ano inválido: ${ano} (deve ser YYYY entre 2000 e 2100)` };
    }
  }

  return { valid: true };
}
