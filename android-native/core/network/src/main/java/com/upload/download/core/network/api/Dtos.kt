package com.upload.download.core.network.api

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class LoginRequestDto(
    val email: String,
    val password: String
)

@Serializable
data class AuthResponseDto(
    val token: String,
    val user: UserDto
)

@Serializable
data class MeResponseDto(
    val user: UserDto
)

@Serializable
data class UserDto(
    val id: String,
    val username: String,
    val email: String
)

@Serializable
data class FilesListResponseDto(
    val files: List<FileDto>
)

@Serializable
data class FileDto(
    val id: String,
    @SerialName("original_filename") val originalFilename: String,
    @SerialName("file_size") val fileSize: Long,
    @SerialName("mime_type") val mimeType: String,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class StorageUsageDto(
    @SerialName("total_size") val totalSize: Long,
    @SerialName("file_count") val fileCount: Long,
    @SerialName("usage_percent") val usagePercent: Double
)

@Serializable
data class UploadResponseDto(
    val file: FileDto
)

@Serializable
data class PreviewStatusDto(
    val status: String,
    val error: String? = null
)

@Serializable
data class ChangePasswordRequestDto(
    @SerialName("current_password") val currentPassword: String,
    @SerialName("new_password") val newPassword: String
)

@Serializable
data class MessageResponseDto(
    val message: String,
    val success: Boolean? = null
)
