# Architecture (Concise)

## Structure & Core Tech

- **Expo Router**: Navigation and modal flows
- **React Native Paper**: Material Design 3 UI
- **Supabase**: GraphQL board data, Realtime sync
- **OpenFDA**: Drug context lookups
- **Provider Pattern**: Central state in `insight-board-provider.tsx`
- **Typed Schema**: Shared types in `lib/insight-board-schema.ts`

## Main Routes

- Board: `app/(tabs)/index.tsx`
- Analytics: `app/(tabs)/analytics.tsx`
- Setup: `app/(tabs)/setup.tsx`

## State & Data Flow

- Provider manages paged insights, counts, filters, activity, presence, and collaboration
- Supabase GraphQL for reads/writes; Realtime for sync
- Analytics via SQL function in `insight-board-analytics.ts`
- OpenFDA lookups via `openfda.ts` and `use-drug-context.ts`

## Utilities & Reference

- Shared schema, helpers: `lib/insight-board-schema.ts`, `insight-utils.ts`

## Charts & Export

- Custom React Native charts (no third-party lib)
- PDF export: `report-export.ts` + `expo-print`/`expo-sharing`

## Known Limits

- Speech recognition: dev/standalone only
- OpenFDA: empty for fake drugs
- Conflict resolution: basic UX

## Next Steps

1. Add provider/tests for state, GraphQL, export
2. Improve conflict resolution UX
