package com.upload.download.core.domain.model

data class StorageUsage(
    val totalSize: Long,
    val fileCount: Long,
    val usagePercent: Double
)
