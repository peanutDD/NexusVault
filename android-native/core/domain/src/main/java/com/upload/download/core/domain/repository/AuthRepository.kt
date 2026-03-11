package com.upload.download.core.domain.repository

import com.upload.download.core.common.AppResult
import com.upload.download.core.domain.model.UserProfile
import kotlinx.coroutines.flow.Flow

interface AuthRepository {
    val tokenFlow: Flow<String?>
    suspend fun login(email: String, password: String): AppResult<UserProfile>
    suspend fun logout()
}
