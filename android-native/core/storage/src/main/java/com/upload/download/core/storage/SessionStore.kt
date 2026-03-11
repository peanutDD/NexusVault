package com.upload.download.core.storage

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.map

private val Context.sessionDataStore by preferencesDataStore(name = "session_store")

@Singleton
class SessionStore @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val tokenKey: Preferences.Key<String> = stringPreferencesKey("access_token")

    val tokenFlow: Flow<String?> = context.sessionDataStore.data.map { it[tokenKey] }

    suspend fun readToken(): String? = tokenFlow.firstOrNull()

    suspend fun saveToken(token: String) {
        context.sessionDataStore.edit {
            it[tokenKey] = token
        }
    }

    suspend fun clearToken() {
        context.sessionDataStore.edit {
            it.remove(tokenKey)
        }
    }
}
