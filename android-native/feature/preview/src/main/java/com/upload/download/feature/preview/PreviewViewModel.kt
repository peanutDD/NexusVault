package com.upload.download.feature.preview

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.upload.download.core.common.AppResult
import com.upload.download.core.domain.repository.FileRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class PreviewUiState(
    val fileId: String = "",
    val statusText: String = "请输入文件ID后获取预览状态"
)

@HiltViewModel
class PreviewViewModel @Inject constructor(
    private val fileRepository: FileRepository
) : ViewModel() {
    private val _uiState = MutableStateFlow(PreviewUiState())
    val uiState = _uiState.asStateFlow()

    fun updateFileId(value: String) {
        _uiState.update { it.copy(fileId = value) }
    }

    fun loadPreviewStatus() {
        viewModelScope.launch {
            val fileId = _uiState.value.fileId
            if (fileId.isBlank()) {
                _uiState.update { it.copy(statusText = "文件ID不能为空") }
                return@launch
            }
            when (val result = fileRepository.getVideoPreviewStatus(fileId)) {
                is AppResult.Success -> _uiState.update { it.copy(statusText = "状态：${result.data}") }
                is AppResult.Error -> _uiState.update { it.copy(statusText = "失败：${result.message}") }
                AppResult.Loading -> Unit
            }
        }
    }
}
