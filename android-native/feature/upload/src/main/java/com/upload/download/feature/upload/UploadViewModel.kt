package com.upload.download.feature.upload

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.work.Data
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.upload.download.core.storage.SessionStore
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class UploadUiState(
    val filePath: String = "",
    val isSubmitting: Boolean = false,
    val message: String? = null
)

@HiltViewModel
class UploadViewModel @Inject constructor(
    private val workManager: WorkManager,
    private val sessionStore: SessionStore
) : ViewModel() {
    private val _uiState = MutableStateFlow(UploadUiState())
    val uiState = _uiState.asStateFlow()

    fun updatePath(path: String) {
        _uiState.update { it.copy(filePath = path) }
    }

    fun enqueueUpload() {
        viewModelScope.launch {
            val filePath = _uiState.value.filePath
            if (filePath.isBlank()) {
                _uiState.update { it.copy(message = "请输入本地文件绝对路径") }
                return@launch
            }
            val token = sessionStore.readToken()
            if (token.isNullOrBlank()) {
                _uiState.update { it.copy(message = "登录失效，请重新登录") }
                return@launch
            }
            _uiState.update { it.copy(isSubmitting = true, message = null) }
            val work = OneTimeWorkRequestBuilder<UploadWorker>()
                .setInputData(
                    Data.Builder()
                        .putString(UploadWorker.KEY_FILE_PATH, filePath)
                        .putString(UploadWorker.KEY_TOKEN, token)
                        .build()
                )
                .build()
            workManager.enqueue(work)
            _uiState.update { it.copy(isSubmitting = false, message = "已加入后台上传队列") }
        }
    }
}
