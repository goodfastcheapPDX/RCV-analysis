import type {
  StvMetaOutput,
  StvRoundsOutput,
  StvRoundsStats,
} from "@/packages/contracts/slices/stv_rounds/index.contract";

export interface StvData {
  roundsData: StvRoundsOutput[];
  metaData: StvMetaOutput[];
  stats: StvRoundsStats;
}
