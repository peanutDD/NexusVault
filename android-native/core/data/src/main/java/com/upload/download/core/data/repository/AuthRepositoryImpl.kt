package com.upload.download.core.data.repository

import com.upload.download.core.common.AppResult
import com.upload.download.core.domain.model.UserProfile
import com.upload.download.core.domain.repository.AuthRepository
import com.upload.download.core.network.api.AuthApi
import com.upload.download.core.network.api.LoginRequestDto
import com.upload.download.core.storage.SessionStore
import javax.inject.Inject
import kotlinx.coroutines.flow.Flow

class AuthRepositoryImpl @Inject constructor(
    private val authApi: AuthApi,
    private val sessionStore: SessionStore
) : AuthRepository {
    override val tokenFlow: Flow<String?> = sessionStore.tokenFlow

    override suspend fun login(email: String, password: String): AppResult<UserProfile> {
        return runCatching {
            val response = authApi.login(
                body = LoginRequestDto(email = email, password = password)
            )
            sessionStore.saveToken(response.token)
            UserProfile(
                id = response.user.id,
                username = response.user.username,
                email = response.user.email
            )
        }.fold(
            onSuccess = { AppResult.Success(it) },
            onFailure = { AppResult.Error(it.message ?: "login failed") }
        )
    }

    override suspend fun logout() {
        sessionStore.clearToken()
    }
}
