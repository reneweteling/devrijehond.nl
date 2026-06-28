package nl.devrijehond.app.api.apis

import nl.devrijehond.app.api.infrastructure.CollectionFormats.*
import retrofit2.http.*
import retrofit2.Response
import okhttp3.RequestBody
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

import nl.devrijehond.app.api.models.ApiError
import nl.devrijehond.app.api.models.CreateDogRequest
import nl.devrijehond.app.api.models.Dog
import nl.devrijehond.app.api.models.DogsResponse
import nl.devrijehond.app.api.models.UpdateDogRequest

interface DogsApi {
    /**
     * GET api/v1/me/dogs
     * List my dogs
     * 
     * Responses:
     *  - 200: My dogs.
     *  - 401: Authentication required.
     *
     * @return [DogsResponse]
     */
    @GET("api/v1/me/dogs")
    suspend fun apiV1MeDogsGet(): Response<DogsResponse>

    /**
     * DELETE api/v1/me/dogs/{id}
     * Delete a dog
     * 
     * Responses:
     *  - 204: Deleted.
     *  - 400: Validation failed.
     *  - 401: Authentication required.
     *  - 404: Not found.
     *
     * @param id 
     * @return [Unit]
     */
    @DELETE("api/v1/me/dogs/{id}")
    suspend fun apiV1MeDogsIdDelete(@Path("id") id: kotlin.String): Response<Unit>

    /**
     * PATCH api/v1/me/dogs/{id}
     * Update a dog
     * 
     * Responses:
     *  - 200: Updated dog.
     *  - 400: Validation failed.
     *  - 401: Authentication required.
     *  - 404: Not found.
     *
     * @param id 
     * @param updateDogRequest  (optional)
     * @return [Dog]
     */
    @PATCH("api/v1/me/dogs/{id}")
    suspend fun apiV1MeDogsIdPatch(@Path("id") id: kotlin.String, @Body updateDogRequest: UpdateDogRequest? = null): Response<Dog>

    /**
     * POST api/v1/me/dogs
     * Add a dog
     * 
     * Responses:
     *  - 201: Created dog.
     *  - 400: Validation failed.
     *  - 401: Authentication required.
     *  - 404: Not found.
     *
     * @param createDogRequest  (optional)
     * @return [Dog]
     */
    @POST("api/v1/me/dogs")
    suspend fun apiV1MeDogsPost(@Body createDogRequest: CreateDogRequest? = null): Response<Dog>

}
