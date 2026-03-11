package com.upload.download.feature.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.upload.download.core.common.AppResult
import com.upload.download.core.domain.model.StorageUsage
import com.upload.download.core.domain.model.UserProfile
import com.upload.download.core.domain.repository.SettingsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class SettingsUiState(
    val user: UserProfile? = null,
    val usage: StorageUsage? = null,
    val currentPassword: String = "",
    val newPassword: String = "",
    val message: String? = null
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val settingsRepository: SettingsRepository
) : ViewModel() {
    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState = _uiState.asStateFlow()

    init {
        refresh()
    }

    fun updateCurrentPassword(value: String) {
        _uiState.update { it.copy(currentPassword = value) }
    }

    fun updateNewPassword(value: String) {
        _uiState.update { it.copy(newPassword = value) }
    }

    fun refresh() {
        viewModelScope.launch {
            val user = when (val result = settingsRepository.getMe()) {
                is AppResult.Success -> result.data
                else -> null
            }
            val usage = when (val result = settingsRepository.getStorageUsage()) {
                is AppResult.Success -> result.data
                else -> null
            }
            _uiState.update { it.copy(user = user, usage = usage) }
        }
    }

    fun changePassword() {
        viewModelScope.launch {
            val current = _uiState.value
            if (current.currentPassword.isBlank() || current.newPassword.isBlank()) {
                _uiState.update { it.copy(message = "请输入完整密码信息") }
                return@launch
            }
            when (
                val result = settingsRepository.changePassword(
                    current.currentPassword,
                    current.newPassword
                )
            ) {
                is AppResult.Success -> _uiState.update {
                    it.copy(message = result.data, currentPassword = "", newPassword = "")
                }
                is AppResult.Error -> _uiState.update { it.copy(message = result.message) }
                AppResult.Loading -> Unit
            }
        }
    }
}
