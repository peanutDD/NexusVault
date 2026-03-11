package com.upload.download.core.domain.repository

import com.upload.download.core.common.AppResult
import com.upload.download.core.domain.model.FileItem
import kotlinx.coroutines.flow.Flow

interface FileRepository {
    fun observeRecentFiles(): Flow<List<FileItem>>
    suspend fun refreshRecentFiles(): AppResult<Unit>
    suspend fun uploadFile(filePath: String, fileName: String): AppResult<FileItem>
    suspend fun getVideoPreviewStatus(fileId: String): AppResult<String>
}
