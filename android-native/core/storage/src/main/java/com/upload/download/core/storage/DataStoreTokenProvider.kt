package com.upload.download.core.storage

import com.upload.download.core.network.auth.TokenProvider
import javax.inject.Inject

class DataStoreTokenProvider @Inject constructor(
    private val sessionStore: SessionStore
) : TokenProvider {
    override suspend fun getToken(): String? = sessionStore.readToken()
}
