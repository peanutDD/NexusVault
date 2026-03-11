package com.upload.download.feature.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.upload.download.core.designsystem.NativeSpacing
import com.upload.download.core.designsystem.PrimaryActionButton

@Composable
fun AuthRoute(
    onLoginSuccess: () -> Unit,
    viewModel: AuthViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    LaunchedEffect(state.isLoggedIn) {
        if (state.isLoggedIn) {
            onLoginSuccess()
        }
    }
    Column(
        modifier = Modifier.fillMaxSize().padding(NativeSpacing.page),
        verticalArrangement = Arrangement.spacedBy(NativeSpacing.section),
        horizontalAlignment = Alignment.Start
    ) {
        Text(
            text = "登录",
            style = MaterialTheme.typography.headlineSmall
        )
        OutlinedTextField(
            value = state.email,
            onValueChange = viewModel::updateEmail,
            modifier = Modifier,
            label = { Text("邮箱") }
        )
        OutlinedTextField(
            value = state.password,
            onValueChange = viewModel::updatePassword,
            visualTransformation = PasswordVisualTransformation(),
            label = { Text("密码") }
        )
        if (state.errorMessage != null) {
            Text(
                text = state.errorMessage ?: "",
                color = MaterialTheme.colorScheme.error
            )
        }
        PrimaryActionButton(
            text = if (state.isLoading) "登录中..." else "登录并进入",
            onClick = viewModel::login
        )
    }
}
