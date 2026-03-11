package com.upload.download.feature.upload

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
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.upload.download.core.designsystem.NativeSpacing
import com.upload.download.core.designsystem.PrimaryActionButton

@Composable
fun UploadRoute(viewModel: UploadViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(NativeSpacing.page),
        verticalArrangement = Arrangement.spacedBy(NativeSpacing.section)
    ) {
        Text("上传任务", style = MaterialTheme.typography.headlineSmall)
        OutlinedTextField(
            value = state.filePath,
            onValueChange = viewModel::updatePath,
            label = { Text("本地文件绝对路径") }
        )
        PrimaryActionButton(
            text = if (state.isSubmitting) "提交中..." else "加入后台上传",
            onClick = viewModel::enqueueUpload
        )
        if (state.message != null) {
            Text(text = state.message ?: "")
        }
    }
}
