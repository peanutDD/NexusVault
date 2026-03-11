package com.upload.download.feature.files

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.upload.download.core.common.AppResult
import com.upload.download.core.designsystem.NativeSpacing

@Composable
fun FilesRoute(viewModel: FilesViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    Column(
        modifier = Modifier.fillMaxSize().padding(NativeSpacing.page),
        verticalArrangement = Arrangement.spacedBy(NativeSpacing.section)
    ) {
        Text("文件列表", style = MaterialTheme.typography.headlineSmall)
        when (val result = state.files) {
            is AppResult.Loading -> Text("加载中")
            is AppResult.Error -> Text("加载失败：${result.message}")
            is AppResult.Success -> {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(NativeSpacing.item)) {
                    items(result.data, key = { it.id }) { file ->
                        Text("${file.name} · ${file.sizeInBytes} bytes")
                    }
                }
            }
        }
    }
}
