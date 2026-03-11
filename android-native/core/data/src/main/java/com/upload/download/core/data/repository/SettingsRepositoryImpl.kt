package com.upload.download.core.data.repository

import com.upload.download.core.common.AppResult
import com.upload.download.core.domain.model.StorageUsage
import com.upload.download.core.domain.model.UserProfile
import com.upload.download.core.domain.repository.SettingsRepository
import com.upload.download.core.network.api.AuthApi
import com.upload.download.core.network.api.ChangePasswordRequestDto
import com.upload.download.core.network.api.FilesApi
import javax.inject.Inject

class SettingsRepositoryImpl @Inject constructor(
    private val authApi: AuthApi,
    private val filesApi: FilesApi
) : SettingsRepository {
    override suspend fun getMe(): AppResult<UserProfile> {
        return runCatching {
            val me = authApi.me().user
            UserProfile(
                id = me.id,
                username = me.username,
                email = me.email
            )
        }.fold(
            onSuccess = { AppResult.Success(it) },
            onFailure = { AppResult.Error(it.message ?: "load profile failed") }
        )
    }

    override suspend fun getStorageUsage(): AppResult<StorageUsage> {
        return runCatching {
            val usage = filesApi.getStorageUsage()
            StorageUsage(
                totalSize = usage.totalSize,
                fileCount = usage.fileCount,
                usagePercent = usage.usagePercent
            )
        }.fold(
            onSuccess = { AppResult.Success(it) },
            onFailure = { AppResult.Error(it.message ?: "load storage failed") }
        )
    }

    override suspend fun changePassword(
        currentPassword: String,
        newPassword: String
    ): AppResult<String> {
        return runCatching {
            filesApi.changePassword(
                ChangePasswordRequestDto(
                    currentPassword = currentPassword,
                    newPassword = newPassword
                )
            ).message
        }.fold(
            onSuccess = { AppResult.Success(it) },
            onFailure = { AppResult.Error(it.message ?: "change password failed") }
        )
    }
}
