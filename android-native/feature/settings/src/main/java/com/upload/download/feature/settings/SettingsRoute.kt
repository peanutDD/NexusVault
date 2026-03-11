package com.upload.download.feature.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.upload.download.core.designsystem.NativeSpacing
import com.upload.download.core.designsystem.PrimaryActionButton

@Composable
fun SettingsRoute(viewModel: SettingsViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    Column(
        modifier = Modifier.fillMaxSize().padding(NativeSpacing.page),
        verticalArrangement = Arrangement.spacedBy(NativeSpacing.item)
    ) {
        Text("设置", style = MaterialTheme.typography.headlineSmall)
        Text("用户：${state.user?.username ?: "-"}")
        Text("邮箱：${state.user?.email ?: "-"}")
        Text("存储占用：${state.usage?.usagePercent ?: 0.0}%")

        OutlinedTextField(
            value = state.currentPassword,
            onValueChange = viewModel::updateCurrentPassword,
            label = { Text("当前密码") },
            visualTransformation = PasswordVisualTransformation()
        )
        OutlinedTextField(
            value = state.newPassword,
            onValueChange = viewModel::updateNewPassword,
            label = { Text("新密码") },
            visualTransformation = PasswordVisualTransformation()
        )
        PrimaryActionButton(text = "修改密码", onClick = viewModel::changePassword)
        PrimaryActionButton(text = "刷新设置", onClick = viewModel::refresh)
        if (state.message != null) {
            Text(state.message ?: "")
        }
    }
}
