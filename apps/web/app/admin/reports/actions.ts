'use server';

/**
 * Server actions for the reports page. The actual mutation lives in the shared
 * admin actions (resolveReport: marks resolved + writes an AdminAction log +
 * revalidates). A 'use server' module may only export async functions, not
 * re-export bindings, so we wrap it in a thin async function the table imports.
 */

import { resolveReport as resolveReportShared } from '../actions';

export async function resolveReport(reportId: string): Promise<void> {
  await resolveReportShared(reportId);
}
