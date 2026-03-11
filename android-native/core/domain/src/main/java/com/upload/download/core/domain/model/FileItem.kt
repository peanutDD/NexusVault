package com.upload.download.core.domain.model

data class FileItem(
    val id: String,
    val name: String,
    val sizeInBytes: Long,
    val updatedAt: String
)
