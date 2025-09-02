# Manifest Structure Documentation

This directory contains the contract definitions and manifest loading utilities for the ranked-choice voting analysis platform.

## Manifest Schema

The application uses a manifest-driven architecture where all election and contest metadata is defined in `manifest.json` and validated at runtime through Zod schemas.

### Structure

```typescript
interface Manifest {
  buildId: string;        // Git commit hash or build identifier (min 6 chars)
  elections: Election[];  // Array of elections (must have at least one)
}

interface Election {
  id: string;            // Unique identifier for the election
  name: string;          // Display name for the election
  contests: Contest[];   // Array of contests (must have at least one)
}

interface Contest {
  id: string;           // Unique identifier for the contest
  name: string;         // Display name for the contest
  seats: number;        // Number of available seats (positive integer)
}
```

### Example Manifest

```json
{
  "buildId": "706856c",
  "elections": [
    {
      "id": "portland-2024-general",
      "name": "Portland General Election 2024",
      "contests": [
        {
          "id": "council-district-2",
          "name": "City Council District 2",
          "seats": 3
        }
      ]
    }
  ]
}
```

## URL Structure and Navigation

The application uses the manifest to build hierarchical routes:

- `/e` → Elections index (shows all elections)
- `/e/{electionId}` → Specific election page (shows contests)
- `/e/{electionId}/c/{contestId}` → Specific contest analysis page

### Route Resolution Examples

Using the example manifest above:

- `/e/portland-2024-general` resolves to "Portland General Election 2024"
- `/e/portland-2024-general/c/council-district-2` resolves to "City Council District 2"

### Breadcrumb Generation

The manifest enables automatic breadcrumb generation:

```
Elections › Portland General Election 2024 › City Council District 2
```

Each breadcrumb segment links to its respective page while preserving URL parameters (like `?v=buildId`).

## Loading and Validation

### Server-side Loading

```typescript
import { loadManifestFromFs } from "@/packages/contracts/lib/manifest";

// Load and validate manifest from filesystem
const manifest = await loadManifestFromFs(); // defaults to "manifest.json"
const manifest = await loadManifestFromFs("custom-manifest.json");
```

### Validation

The manifest loader automatically:
1. Reads the JSON file from the filesystem
2. Parses the JSON content
3. Validates against the Zod schema
4. Returns typed manifest data or throws detailed error

### Error Handling

If validation fails, the loader throws a descriptive error:
```
Failed to load manifest from manifest.json: Expected string, received number at "buildId"
```

## Usage in Components

### Finding Elections and Contests

```typescript
// Find a specific election
const election = manifest.elections.find(e => e.id === electionId);

// Find a specific contest within an election
const contest = election?.contests.find(c => c.id === contestId);

// Handle missing data
if (!election) {
  notFound(); // Next.js 404
}
```

### Type Safety

All manifest data is fully typed through Zod inference:

```typescript
import type { ManifestT, Election, Contest } from "@/packages/contracts/lib/manifest";

// All properties are typed and validated
const election: Election = manifest.elections[0];
const contestName: string = contest.name; // TypeScript knows this is a string
const seatCount: number = contest.seats;   // TypeScript knows this is a number
```

This contract-first approach ensures data integrity and prevents runtime errors from malformed manifest data.