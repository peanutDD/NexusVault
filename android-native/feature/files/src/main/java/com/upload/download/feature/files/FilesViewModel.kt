package com.upload.download.feature.files

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.upload.download.core.common.AppResult
import com.upload.download.core.domain.model.FileItem
import com.upload.download.core.domain.usecase.GetRecentFilesUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class FilesUiState(
    val files: AppResult<List<FileItem>> = AppResult.Loading
)

@HiltViewModel
class FilesViewModel @Inject constructor(
    private val getRecentFilesUseCase: GetRecentFilesUseCase
) : ViewModel() {
    private val loadingState = MutableStateFlow(false)

    val uiState = getRecentFilesUseCase()
        .map { files ->
            if (loadingState.value && files.isEmpty()) {
                FilesUiState(files = AppResult.Loading)
            } else {
                FilesUiState(files = AppResult.Success(files))
            }
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000),
            initialValue = FilesUiState(files = AppResult.Loading)
        )

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            loadingState.update { true }
            getRecentFilesUseCase.refresh()
            loadingState.update { false }
        }
    }
}
