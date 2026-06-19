import { z } from 'zod';
import { UuidSchema, ReportTargetSchema, ReportReasonSchema, IsoDateTimeSchema } from './common';
import '../registry';

/**
 * Reports — the safety-net. Any authenticated user can report a spot, photo,
 * or review. Reports are write-only for users; only admins read/resolve them.
 */
export const SubmitReportRequestSchema = z
  .object({
    targetType: ReportTargetSchema,
    targetId: UuidSchema.openapi({
      description: 'Id of the spot / photo / review being reported.',
    }),
    reason: ReportReasonSchema,
    note: z.string().max(2000).optional(),
  })
  .openapi('SubmitReportRequest', { description: 'Body for `POST /api/v1/me/reports`.' });
export type SubmitReportRequestDto = z.infer<typeof SubmitReportRequestSchema>;

/** Acknowledgement of a filed report. */
export const ReportResponseSchema = z
  .object({
    id: UuidSchema,
    createdAt: IsoDateTimeSchema,
  })
  .openapi('ReportResponse', { description: 'Acknowledgement that a report was filed.' });
export type ReportResponseDto = z.infer<typeof ReportResponseSchema>;
