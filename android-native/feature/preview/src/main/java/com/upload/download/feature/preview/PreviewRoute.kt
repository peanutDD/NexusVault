package com.upload.download.feature.preview

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
fun PreviewRoute(viewModel: PreviewViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    Column(
        modifier = Modifier.fillMaxSize().padding(NativeSpacing.page),
        verticalArrangement = Arrangement.spacedBy(NativeSpacing.section)
    ) {
        Text("预览状态", style = MaterialTheme.typography.headlineSmall)
        OutlinedTextField(
            value = state.fileId,
            onValueChange = viewModel::updateFileId,
            label = { Text("文件ID") }
        )
        PrimaryActionButton(
            text = "拉取视频预览状态",
            onClick = viewModel::loadPreviewStatus
        )
        Text(state.statusText)
    }
}
