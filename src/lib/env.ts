import { z } from "zod";

const Env = z.enum(["dev", "test", "prod"]);
export type DataEnv = z.infer<typeof Env>;

export function getDataEnv(): DataEnv {
  return Env.parse(process.env.DATA_ENV ?? "dev");
}

export function getArtifactRoot(env: DataEnv): string {
  return `/data/${env}`;
}
