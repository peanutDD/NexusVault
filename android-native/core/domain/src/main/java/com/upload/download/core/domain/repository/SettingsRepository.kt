package com.upload.download.core.domain.repository

import com.upload.download.core.common.AppResult
import com.upload.download.core.domain.model.StorageUsage
import com.upload.download.core.domain.model.UserProfile

interface SettingsRepository {
    suspend fun getMe(): AppResult<UserProfile>
    suspend fun getStorageUsage(): AppResult<StorageUsage>
    suspend fun changePassword(currentPassword: String, newPassword: String): AppResult<String>
}
