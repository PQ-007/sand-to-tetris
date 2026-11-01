// Steps of the sand-to-wafer flow. `impurity` is the rough fraction of atoms
// that are not silicon (for the purity meter); undefined for steps where
// purity isn't the point. The text is in the dictionaries (`wafer.<id>.*`).
export interface WaferStep {
  id: string;
  /** Has a `wafer.<id>.temperature` text. */
  heated?: boolean;
  impurity?: number;
  sources: string[];
}

export const WAFER_STEPS: readonly WaferStep[] = [
  {
    id: "sand",
    sources: ["silicon-abundance"],
  },
  {
    id: "furnace",
    heated: true,
    impurity: 1e-2,
    sources: ["mg-silicon"],
  },
  {
    id: "trichlorosilane",
    sources: ["siemens-process"],
  },
  {
    id: "siemens",
    heated: true,
    impurity: 1e-7,
    sources: ["siemens-process"],
  },
  {
    id: "czochralski",
    heated: true,
    impurity: 1e-7,
    sources: ["czochralski"],
  },
  {
    id: "slice",
    sources: [],
  },
];
