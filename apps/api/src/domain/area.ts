// Areas are typed by people, so compare them without caring about case or extra spaces
export function normaliseArea(area: string): string {
  return area.trim().replace(/\s+/g, " ").toLowerCase();
}

export function sameArea(a: string, b: string): boolean {
  return normaliseArea(a) === normaliseArea(b);
}
