package com.upload.download.core.network.api

import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.PUT
import retrofit2.http.Query
import retrofit2.http.Streaming

interface FilesApi {
  @GET("api/files/")
  suspend fun listFiles(
    @Query("limit") limit: Int = 50
  ): FilesListResponseDto

  @GET("api/files/storage-usage")
  suspend fun getStorageUsage(): StorageUsageDto

  @Multipart
  @POST("api/files/upload")
  suspend fun uploadFile(
    @Part file: MultipartBody.Part,
    @Part("folder_id") folderId: RequestBody? = null
  ): UploadResponseDto

  @POST("api/files/{id}/preview/video/prepare")
  suspend fun prepareVideoPreview(
    @Path("id") fileId: String
  ): PreviewStatusDto

  @GET("api/files/{id}/preview/video/status")
  suspend fun getVideoPreviewStatus(
    @Path("id") fileId: String
  ): PreviewStatusDto

  @PUT("api/auth/change-password")
  suspend fun changePassword(
    @Body body: ChangePasswordRequestDto
  ): MessageResponseDto

  @Streaming
  @GET("api/files/{id}/preview")
  suspend fun fetchPreview(
    @Path("id") fileId: String
  ): Response<ResponseBody>
}
