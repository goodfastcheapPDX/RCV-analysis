Title: Modernize build scripts with yargs for type-safe command line argument parsing

Context

Our current build scripts in the `scripts/` directory use manual command line argument parsing with `process.argv.slice(2)` and string operations like `.find(arg => arg.startsWith('--option='))?.split('=')[1]`. This approach is error-prone, lacks type safety, and provides poor developer experience with no help text or validation.

We want to migrate to yargs (https://www.npmjs.com/package/yargs) to get:
- Type-safe argument parsing with compile-time validation
- Automatic help text generation
- Built-in validation and coercion
- Better error messages
- Standardized CLI interface across all build scripts

Scope

Package Installation

Install yargs and its TypeScript types:
```bash
npm install --save-dev yargs @types/yargs
```

Script Migration

Migrate the following build scripts to use yargs:

1. `scripts/build-data.ts` - CVR ingestion script
2. `scripts/build-pipeline-multi.ts` - Full pipeline runner  
3. `scripts/build-all-districts.ts` - Multi-district processor
4. `scripts/build-first-choice.ts` - First choice breakdown
5. `scripts/build-rank-distribution.ts` - Rank distribution
6. Any other scripts with manual `process.argv` parsing

Type Safety Requirements

For each script, create a TypeScript interface that defines the expected arguments with:
- Required vs optional arguments
- Argument types (string, number, boolean)
- Default values where applicable
- Validation rules where statically determinable

Example interface for build-data.ts:
```typescript
interface BuildDataArgs {
  election?: string;
  contest?: string;
  srcCsv?: string;
  help?: boolean;
}
```

Yargs Configuration

Each script should:
- Use `.scriptName()` to set the script name for help text
- Use `.usage()` to provide a description
- Define options with `.option()` including:
  - Type specification
  - Description text
  - Default values
  - Aliases where helpful (e.g., `-h` for `--help`)
- Use `.help()` to enable automatic help generation
- Use `.version(false)` to disable version flag (unless needed)
- Use `.strict()` to reject unknown options
- Parse with `.parseSync()` for type safety

Example yargs setup:
```typescript
const args = yargs(process.argv.slice(2))
  .scriptName('build-data')
  .usage('Build CVR data for elections')
  .option('election', {
    type: 'string',
    description: 'Election ID override',
    default: electionIdFrom({ jurisdiction: 'portland', date: '2024-11-05', kind: 'gen' })
  })
  .option('contest', {
    type: 'string', 
    description: 'Contest ID override',
    default: contestIdFrom({ districtId: 'd2', seatCount: 3 })
  })
  .option('src-csv', {
    type: 'string',
    description: 'Source CSV file path',
    default: 'data/2024-11/canonical/district-2-cast-vote-record.csv'
  })
  .help()
  .strict()
  .parseSync();
```

Validation Enhancements

Where possible, add static validation:
- File existence checks for CSV paths
- Enum validation for known district IDs
- Range validation for seat counts
- Format validation for election/contest ID patterns

Backward Compatibility

Ensure all existing npm script commands continue to work:
- `npm run build:data`
- `npm run build:data:all` 
- `npm run build:data:firstchoice`
- etc.

Environment variable support should be preserved where currently used.

Guardrails

- Do not change script functionality, only the argument parsing mechanism
- Do not modify any slice computation logic or data processing
- Do not change the contract enforcement or validation patterns
- Focus only on the CLI argument parsing layer
- Maintain all existing default values and behaviors

Testing

After migration:
- Test each script with no arguments (should use defaults)
- Test with --help flag (should show usage)  
- Test with various argument combinations
- Verify all npm scripts still work
- Ensure error messages are helpful for invalid arguments

Done When

- All build scripts use yargs for argument parsing
- Each script has type-safe argument interfaces
- Help text is available with --help for all scripts
- All existing npm scripts continue to work unchanged
- Arguments have proper validation where feasible
- Error messages are clear and helpful
- No functionality changes to core data processing logic

Output

PR diff including:
- Updated package.json with yargs dependency
- Migrated scripts with yargs-based argument parsing
- Type interfaces for each script's arguments
- Improved help text and validation
- All existing functionality preserved