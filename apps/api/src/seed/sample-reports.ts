import { GHANA_DISTRICTS, unknownDistrictArea } from "@asaase-ani/shared";
import type { GhanaRegion } from "@asaase-ani/shared";
import { Location } from "../domain/location";
import { REFERENCE_ALPHABET, REFERENCE_LENGTH, ReferenceCode } from "../domain/reference-code";
import { Report } from "../domain/report";
import type { Contact } from "../domain/report";

// ~200 clearly labelled SYNTHETIC reports for development, demos and the Requirement 4 privacy check
// (Milestone 1, section 4.1: "about 200 clearly labelled synthetic sample reports ... No real person's details").
//
// - Every description starts with SAMPLE_LABEL.
// - Contact details use reserved test values only: example.com addresses and 0200000xxx numbers.
// - Deterministic: the same seed always gives the same reports, codes and idempotency keys,
//   so seeding twice never creates duplicates.

export const SAMPLE_LABEL = "[SAMPLE]";
export const SAMPLE_COUNT = 200;
export const SAMPLE_KEY_PREFIX = "sample-report-";

// Small, fast, deterministic random numbers (mulberry32)
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;
const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)] as T;
const chance = (rng: Rng, p: number) => rng() < p;

// Mining-affected regions come up far more often, as they would in real use
const REGION_WEIGHTS: [GhanaRegion, number][] = [
  ["Western", 26],
  ["Western North", 14],
  ["Ashanti", 22],
  ["Eastern", 14],
  ["Central", 10],
  ["Ahafo", 6],
  ["Bono", 3],
  ["Upper East", 3],
  ["Savannah", 2],
];

// Rough region centres, only to place sample GPS points somewhere believable (never shown publicly)
const REGION_CENTRES: Partial<Record<GhanaRegion, [number, number]>> = {
  Western: [5.3, -2.0],
  "Western North": [6.2, -2.5],
  Ashanti: [6.6, -1.6],
  Eastern: [6.3, -0.7],
  Central: [5.6, -1.3],
  Ahafo: [7.0, -2.4],
  Bono: [7.5, -2.5],
  "Upper East": [10.8, -0.9],
  Savannah: [9.1, -1.8],
};

// Your development officer works these areas (see DEV_AREAS in server.ts), so the demo list is never empty
const DEMO_AREAS = ["Tarkwa-Nsuaem Municipal", unknownDistrictArea("Western")];

const DESCRIPTIONS: Record<string, readonly string[]> = {
  excavation_site: [
    "Several deep pits dug near the farms, with workers using shovels and a water pump",
    "New diggings appeared this week beside the footpath, with heaps of fresh soil and sand",
    "A group of about ten people digging and washing soil in wooden boxes near the stream",
    "Large open pits left uncovered after digging, filled with muddy water",
  ],
  river_pollution: [
    "The river has turned brown and thick with mud, and the fish seem to have gone",
    "Muddy water flowing into the stream from a washing site upstream",
    "The stream we drink from is now the colour of clay, and there is an oily film on it",
    "River water looks like chocolate after the machines started working upstream",
  ],
  forest_clearing: [
    "Trees cut down inside the forest edge and the ground stripped bare",
    "A cocoa farm was cleared and the soil dug up in several places",
    "Fresh tree stumps and burnt vegetation along the river bank",
    "Part of the forest reserve has been cleared with a bulldozer",
  ],
  machinery_or_equipment: [
    "Two excavators and a changfan machine working close to the river bank",
    "A bulldozer and several water pumps moved onto the land at night",
    "Heavy machines parked near the farms with fuel drums beside them",
    "An excavator digging next to the stream, with a pickup truck waiting",
  ],
  other: [
    "Mercury containers and sacks of sand left near the washing area",
    "Workers' camp and generator set up close to the water source",
    "Strange chemical smell near the stream and dead fish on the bank",
    "Trucks carrying sand and gravel from the river bank every evening",
  ],
};

const CATEGORY_WEIGHTS: [string, number][] = [
  ["river_pollution", 30],
  ["excavation_site", 26],
  ["machinery_or_equipment", 20],
  ["forest_clearing", 16],
  ["other", 8],
];

const LANDMARKS = [
  "near the river bridge",
  "behind the old school",
  "after the cocoa farms",
  "along the footpath to the stream",
  "beside the forest reserve boundary",
  "past the junction on the main road",
  "near the water pump",
  "close to the chief's palace",
];

const QUESTIONS = [
  "Which side of the river is the site on?",
  "About how many machines did you see?",
  "Is the site still active, or did the work stop?",
  "Can you describe a landmark close to the site?",
];

const ANSWERS = [
  "The east bank, about ten minutes walk from the bridge.",
  "Two excavators and three pumps.",
  "They were still working this morning.",
  "It is behind the old school, past the cocoa farms.",
];

const REASONS = {
  verify: [
    "Photos and location match the site visit",
    "Confirmed on patrol with the district team",
    "Satellite image and reporter description agree",
  ],
  reject: [
    "Site visit found a legal quarry with a valid permit",
    "Could not find any activity at the described place",
    "Duplicate of an earlier confirmed report",
  ],
  refer: [
    "Passed to the District Assembly mining task force",
    "Passed to the Minerals Commission regional office",
    "Passed to the Forestry Commission district office",
  ],
  close: ["Enforcement action completed", "No further action needed", ""],
};

const SAMPLE_OFFICERS = ["sample-officer-1", "sample-officer-2", "sample-officer-3"];

function weighted<T>(rng: Rng, items: [T, number][]): T {
  const total = items.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [item, w] of items) {
    roll -= w;
    if (roll < 0) return item;
  }
  return items[items.length - 1]![0];
}

function referenceFrom(rng: Rng): ReferenceCode {
  let raw = "";
  for (let i = 0; i < REFERENCE_LENGTH; i++) raw += pick(rng, REFERENCE_ALPHABET.split(""));
  return ReferenceCode.parse(raw);
}

function sampleContact(rng: Rng, index: number): Contact | undefined {
  if (!chance(rng, 0.35)) return undefined; // most reporters stay anonymous
  const n = String(index).padStart(3, "0");
  return chance(rng, 0.5) ? { phone: `0200000${n}` } : { name: `Sample Reporter ${n}`, email: `sample.reporter.${n}@example.com` };
}

const DAY = 24 * 60 * 60 * 1000;
const at = (base: Date, hours: number) => new Date(base.getTime() + hours * 60 * 60 * 1000);

export interface SampleReport {
  report: Report;
  idempotencyKey: string;
}

// Builds the reports through the real domain rules (Report.create, transitionTo, answerQuestion),
// so every sample is something the API itself could have produced.
export function sampleReports(now: Date, count = SAMPLE_COUNT, seed = 421): SampleReport[] {
  const rng = random(seed);
  const used = new Set<string>();
  const result: SampleReport[] = [];

  for (let i = 0; i < count; i++) {
    let reference = referenceFrom(rng);
    while (used.has(reference.toString())) reference = referenceFrom(rng);
    used.add(reference.toString());

    // 1 in 8 lands in the demo officer's areas
    const region = weighted(rng, REGION_WEIGHTS);
    const districts: readonly string[] = GHANA_DISTRICTS[region];
    const area =
      i % 8 === 0
        ? (DEMO_AREAS[(i / 8) % DEMO_AREAS.length] as string)
        : chance(rng, 0.1)
          ? unknownDistrictArea(region)
          : pick(rng, districts);
    const centre = REGION_CENTRES[region] ?? [6.5, -1.5];
    const withGps = chance(rng, 0.55);

    const category = weighted(rng, CATEGORY_WEIGHTS);
    const createdAt = new Date(now.getTime() - Math.floor(rng() * 120 * DAY) - DAY);
    const observedAt = at(createdAt, -Math.floor(rng() * 48) - 1);

    let report = Report.create(
      {
        reference,
        description: `${SAMPLE_LABEL} ${pick(rng, DESCRIPTIONS[category] ?? DESCRIPTIONS["other"]!)}`,
        category,
        observedAt,
        location: Location.create({
          area,
          latitude: withGps ? Number((centre[0] + (rng() - 0.5) * 0.6).toFixed(5)) : undefined,
          longitude: withGps ? Number((centre[1] + (rng() - 0.5) * 0.6).toFixed(5)) : undefined,
          placeDetails: chance(rng, 0.6) ? pick(rng, LANDMARKS) : undefined,
        }),
        contact: sampleContact(rng, i),
      },
      createdAt,
    );

    // Walk the report through a believable part of its life
    const officer = pick(rng, SAMPLE_OFFICERS);
    const stage = weighted<string>(rng, [
      ["received", 22],
      ["under_review", 18],
      ["asked", 10],
      ["answered", 8],
      ["verified", 12],
      ["rejected", 10],
      ["referred", 10],
      ["closed", 10],
    ]);
    let t = at(createdAt, 3 + Math.floor(rng() * 20));
    const step = () => (t = at(t, 2 + Math.floor(rng() * 30)));

    if (stage !== "received") report = report.transitionTo("under_review", officer, t);
    if (stage === "asked" || stage === "answered") {
      report = report.transitionTo("more_information_requested", officer, step(), pick(rng, QUESTIONS));
      if (stage === "answered") report = report.answerQuestion(pick(rng, ANSWERS), step());
    }
    if (["verified", "referred", "closed"].includes(stage)) {
      report = report.transitionTo("verified", officer, step(), pick(rng, REASONS.verify));
    }
    if (stage === "rejected") report = report.transitionTo("rejected", officer, step(), pick(rng, REASONS.reject));
    if (stage === "referred" || (stage === "closed" && chance(rng, 0.6))) {
      report = report.transitionTo("referred_for_action", officer, step(), pick(rng, REASONS.refer));
    }
    if (stage === "closed") report = report.transitionTo("closed", officer, step(), pick(rng, REASONS.close) || undefined);

    result.push({ report, idempotencyKey: `${SAMPLE_KEY_PREFIX}${String(i).padStart(4, "0")}-${reference.toString()}` });
  }
  return result;
}
