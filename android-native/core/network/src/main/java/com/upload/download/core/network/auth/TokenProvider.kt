package com.upload.download.core.network.auth

interface TokenProvider {
    suspend fun getToken(): String?
}
