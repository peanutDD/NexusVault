package com.upload.download.core.data.repository

import com.upload.download.core.common.AppResult
import com.upload.download.core.database.dao.FileDao
import com.upload.download.core.database.entity.FileEntity
import com.upload.download.core.domain.model.FileItem
import com.upload.download.core.domain.repository.FileRepository
import com.upload.download.core.network.api.FilesApi
import java.io.File
import javax.inject.Inject
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody

class FileRepositoryImpl @Inject constructor(
    private val filesApi: FilesApi,
    private val fileDao: FileDao
) : FileRepository {
    override fun observeRecentFiles(): Flow<List<FileItem>> {
        return fileDao.observeFiles().map { list ->
            list.map {
                FileItem(
                    id = it.id,
                    name = it.originalFilename,
                    sizeInBytes = it.fileSize,
                    updatedAt = it.updatedAt
                )
            }
        }
    }

    override suspend fun refreshRecentFiles(): AppResult<Unit> {
        return runCatching {
            val remote = filesApi.listFiles().files
            fileDao.upsertAll(
                remote.map {
                    FileEntity(
                        id = it.id,
                        originalFilename = it.originalFilename,
                        fileSize = it.fileSize,
                        mimeType = it.mimeType,
                        updatedAt = it.createdAt
                    )
                }
            )
        }.fold(
            onSuccess = { AppResult.Success(Unit) },
            onFailure = { AppResult.Error(it.message ?: "refresh failed") }
        )
    }

    override suspend fun uploadFile(filePath: String, fileName: String): AppResult<FileItem> {
        return runCatching {
            val file = File(filePath)
            val body = file.asRequestBody("application/octet-stream".toMediaTypeOrNull())
            val multipart = MultipartBody.Part.createFormData("file", fileName, body)
            val response = filesApi.uploadFile(multipart)
            val uploaded = response.file
            FileItem(
                id = uploaded.id,
                name = uploaded.originalFilename,
                sizeInBytes = uploaded.fileSize,
                updatedAt = uploaded.createdAt
            )
        }.fold(
            onSuccess = { AppResult.Success(it) },
            onFailure = { AppResult.Error(it.message ?: "upload failed") }
        )
    }

    override suspend fun getVideoPreviewStatus(fileId: String): AppResult<String> {
        return runCatching {
            filesApi.prepareVideoPreview(fileId)
            filesApi.getVideoPreviewStatus(fileId).status
        }.fold(
            onSuccess = { AppResult.Success(it) },
            onFailure = { AppResult.Error(it.message ?: "preview failed") }
        )
    }
}
