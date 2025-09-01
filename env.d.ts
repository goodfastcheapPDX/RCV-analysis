import { z } from "zod";

// Define the environment variable schema with validation
export const EnvSchema = z.object({
    // Node.js environment
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

    // Data processing environment
    DATA_ENV: z.enum(["dev", "test", "prod"]).default("dev"),

    // File paths and data sources
    SRC_CSV: z.string().optional(),

    // Next.js specific
    NEXT_PUBLIC_BASE_URL: z.string().url().optional(),

    // Build and development flags (keep as strings to match process.env)
    DEBUG: z.enum(["true", "false", "1", "0"]).default("false"),
    VERBOSE: z.enum(["true", "false", "1", "0"]).default("false"),

    // Optional overrides for build scripts
    ELECTION_ID: z.string().optional(),
    CONTEST_ID: z.string().optional(),
    DISTRICT_ID: z.string().optional(),
    SEAT_COUNT: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Validate environment variables at application startup
 * Should be called at entry points after dotenv is loaded
 */
export function validateEnv(): void {
    try {
        EnvSchema.parse(process.env);
    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error("❌ Environment variable validation failed:");
            for (const issue of error.issues) {
                console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
            }
            throw new Error("Invalid environment configuration");
        }
        throw error;
    }
}

/**
 * Helper to check if debug mode is enabled
 */
export function isDebug(): boolean {
    return process.env.DEBUG === "true" || process.env.DEBUG === "1";
}

/**
 * Helper to check if verbose mode is enabled
 */
export function isVerbose(): boolean {
    return process.env.VERBOSE === "true" || process.env.VERBOSE === "1";
}

declare global {
    namespace NodeJS {
        interface ProcessEnv extends Env { }
    }
}
