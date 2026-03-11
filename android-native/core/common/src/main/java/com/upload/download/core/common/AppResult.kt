package com.upload.download.core.common

sealed interface AppResult<out T> {
    data class Success<T>(val data: T) : AppResult<T>
    data class Error(val message: String, val code: Int? = null) : AppResult<Nothing>
    data object Loading : AppResult<Nothing>
}
