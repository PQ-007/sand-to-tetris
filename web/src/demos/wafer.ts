// Steps of the sand-to-wafer flow. `impurity` is the rough fraction of atoms
// that are not silicon (for the purity meter); undefined for steps where
// purity isn't the point.
export interface WaferStep {
  id: string;
  title: string;
  what: string;
  detail: string;
  temperature?: string;
  impurity?: number;
  sources: string[];
}

export const WAFER_STEPS: readonly WaferStep[] = [
  {
    id: "sand",
    title: "Quartz sand",
    what: "Silicon dioxide (SiO₂): silicon locked up with oxygen.",
    detail:
      "Ordinary beach sand is too impure; industry uses high-purity quartz. Silicon is everywhere in rocks, but always bonded to oxygen.",
    sources: ["silicon-abundance"],
  },
  {
    id: "furnace",
    title: "Arc furnace",
    what: "Carbon pulls the oxygen off the silicon.",
    detail:
      "Quartz and carbon are heated by an electric arc. The carbon grabs the oxygen (leaving as carbon monoxide), and liquid silicon collects at the bottom: metallurgical-grade silicon.",
    temperature: "≈ 1900 °C or more",
    impurity: 1e-2,
    sources: ["mg-silicon"],
  },
  {
    id: "trichlorosilane",
    title: "Make a liquid, then distil it",
    what: "Silicon becomes trichlorosilane (SiHCl₃), which can be distilled.",
    detail:
      "Reacting the silicon with hydrogen chloride turns it into a liquid. Liquids can be purified by distillation, like making very pure alcohol, which removes most remaining impurities.",
    sources: ["siemens-process"],
  },
  {
    id: "siemens",
    title: "Siemens process",
    what: "Pure silicon is deposited back out as polysilicon.",
    detail:
      "The purified trichlorosilane is decomposed onto hot silicon rods. Silicon builds up layer by layer into electronic-grade polysilicon: many small crystals, but extremely pure.",
    temperature: "≈ 1100 °C (the rods)",
    impurity: 1e-7,
    sources: ["siemens-process"],
  },
  {
    id: "czochralski",
    title: "Grow one crystal",
    what: "A seed crystal is pulled slowly from melted silicon.",
    detail:
      "The polysilicon is melted in a quartz crucible, with a carefully measured trace of dopant if the wafer should be p-type or n-type. A tiny seed crystal touches the melt and is slowly pulled up while turning. Atoms line up with the seed, so the whole ingot becomes one single crystal.",
    temperature: "above 1400 °C (silicon melts at about 1414 °C)",
    impurity: 1e-7,
    sources: ["czochralski"],
  },
  {
    id: "slice",
    title: "Slice and polish",
    what: "The ingot is sawn into thin discs and polished mirror-smooth.",
    detail:
      "Wire saws cut the ingot into wafers less than a millimetre thick. Grinding, etching and polishing leave a surface flat enough to print features far smaller than a bacterium.",
    sources: [],
  },
];
