import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { createSchemaFactory } from '@zenstackhq/zod';
import { z } from 'zod';
import { schema } from '../schema';

// Patch zod with `.openapi()` before constructing any schema (zod 4 snapshots
// prototype methods at construction time).
extendZodWithOpenApi(z);

const factory = createSchemaFactory(schema);

// Model schemas
export const UserSchema = factory.makeModelSchema('User');
export const DogSchema = factory.makeModelSchema('Dog');
export const CategorySchema = factory.makeModelSchema('Category');
export const AmenitySchema = factory.makeModelSchema('Amenity');
export const SpotSchema = factory.makeModelSchema('Spot');
export const SpotPhotoSchema = factory.makeModelSchema('SpotPhoto');
export const VoteSchema = factory.makeModelSchema('Vote');
export const ReviewSchema = factory.makeModelSchema('Review');
export const ReportSchema = factory.makeModelSchema('Report');
export const FeatureRequestSchema = factory.makeModelSchema('FeatureRequest');

// Create-input schemas
export const CreateSpotInput = factory.makeModelCreateSchema('Spot');
export const CreateDogInput = factory.makeModelCreateSchema('Dog');
export const CreateReviewInput = factory.makeModelCreateSchema('Review');
export const CreateVoteInput = factory.makeModelCreateSchema('Vote');
export const CreateReportInput = factory.makeModelCreateSchema('Report');
export const CreateFeatureRequestInput = factory.makeModelCreateSchema('FeatureRequest');

// Update-input schemas
export const UpdateSpotInput = factory.makeModelUpdateSchema('Spot');
export const UpdateDogInput = factory.makeModelUpdateSchema('Dog');
export const UpdateUserInput = factory.makeModelUpdateSchema('User');

// Enum schemas
export const UserRoleSchema = factory.makeEnumSchema('UserRole');
export const SpotTypeSchema = factory.makeEnumSchema('SpotType');
export const SpotStatusSchema = factory.makeEnumSchema('SpotStatus');
export const VoteValueSchema = factory.makeEnumSchema('VoteValue');
export const FeatureStatusSchema = factory.makeEnumSchema('FeatureStatus');
export const ReportReasonSchema = factory.makeEnumSchema('ReportReason');

export { factory as zodFactory };
