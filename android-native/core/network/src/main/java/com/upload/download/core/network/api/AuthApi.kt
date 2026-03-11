package com.upload.download.core.network.api

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface AuthApi {
    @POST("api/auth/login")
    suspend fun login(
        @Body body: LoginRequestDto
    ): AuthResponseDto

    @GET("api/auth/me")
    suspend fun me(): MeResponseDto
}
