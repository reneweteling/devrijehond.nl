package nl.devrijehond.app.api.apis

import nl.devrijehond.app.api.infrastructure.CollectionFormats.*
import retrofit2.http.*
import retrofit2.Response
import okhttp3.RequestBody
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

import nl.devrijehond.app.api.models.ApiError
import nl.devrijehond.app.api.models.ReportResponse
import nl.devrijehond.app.api.models.SubmitReportRequest

interface ReportsApi {
    /**
     * POST api/v1/me/reports
     * Report content
     * 
     * Responses:
     *  - 201: Report filed.
     *  - 400: Validation failed.
     *  - 401: Authentication required.
     *  - 404: Not found.
     *
     * @param submitReportRequest  (optional)
     * @return [ReportResponse]
     */
    @POST("api/v1/me/reports")
    suspend fun apiV1MeReportsPost(@Body submitReportRequest: SubmitReportRequest? = null): Response<ReportResponse>

}
