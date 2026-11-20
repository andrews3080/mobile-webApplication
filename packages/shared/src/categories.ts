// The API's report categories with plain-language labels (Milestone 1: usability).
// If the API list changes (apps/api domain/report.ts), change this one too.
export const REPORT_CATEGORIES = [
  { value: "excavation_site", label: "Digging or excavation site" },
  { value: "river_pollution", label: "Polluted river or stream" },
  { value: "forest_clearing", label: "Cleared forest or farmland" },
  { value: "machinery_or_equipment", label: "Machinery or equipment" },
  { value: "other", label: "Something else" },
] as const;
