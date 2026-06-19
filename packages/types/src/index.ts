/**
 * `@devrijehond/types`, the typed contract between the De Vrije Hond API
 * (apps/web) and the Expo mobile app (via the Orval-generated
 * `@devrijehond/api-client`).
 *
 * Three surfaces:
 *   1. **Generated Zod schemas** re-exported from `@devrijehond/db` (model +
 *      create/update + enum schemas). Web server actions / route handlers
 *      validate against these before hitting `authDb`.
 *   2. **DTO wrappers** (`./dto/**`) that compose the generated schemas into
 *      API request/response shapes, each annotated with OpenAPI metadata.
 *   3. **OpenAPI registry** (`./registry.ts`) compiled into an OAS 3.1 document
 *      served at `/api/v1/openapi.json` and consumed by Orval.
 *
 * `apps/web` imports from here. `apps/mobile` must NOT import from
 * `@devrijehond/types`, it imports exclusively from `@devrijehond/api-client`.
 */

// 1. Generated model + input + enum schemas (re-export from @devrijehond/db),
//    aliased with a `Db` prefix so they don't collide with the DTO wrappers of
//    the same name (`CategorySchema`, `SpotPhotoSchema`, `VoteSchema`, …). The
//    DTO wrappers in `./dto/*` are the API contract; these raw model schemas
//    are for server-side validation in `apps/web` before hitting `authDb`.
export {
  // Model schemas
  UserSchema as DbUserSchema,
  DogSchema as DbDogSchema,
  CategorySchema as DbCategorySchema,
  AmenitySchema as DbAmenitySchema,
  SpotSchema as DbSpotSchema,
  SpotPhotoSchema as DbSpotPhotoSchema,
  VoteSchema as DbVoteSchema,
  ReviewSchema as DbReviewSchema,
  ReportSchema as DbReportSchema,
  FeatureRequestSchema as DbFeatureRequestSchema,
  // Create-input schemas
  CreateSpotInput,
  CreateDogInput,
  CreateReviewInput,
  CreateVoteInput,
  CreateReportInput,
  CreateFeatureRequestInput,
  // Update-input schemas
  UpdateSpotInput,
  UpdateDogInput,
  UpdateUserInput,
} from '@devrijehond/db/zod';

// 2. OpenAPI-annotated DTO wrappers.
export * from './dto/index';

// 3. OpenAPI registry.
export { registry, buildOpenApiDocument, type OpenApiVersion } from './registry';

// 4. Side-effect: register shared component schemas + every API path. MUST be
//    last, it imports from `./dto/*` and depends on the DTO schemas being
//    fully evaluated.
import './paths';
