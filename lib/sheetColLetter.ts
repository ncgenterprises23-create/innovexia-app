/** Spreadsheet column index → A1 notation letter(s), e.g. 0 → A, 26 → AA */
export function sheetColLetter(index: number): string {
  let n = index;
  let letter = '';
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

export function sheetNewId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
