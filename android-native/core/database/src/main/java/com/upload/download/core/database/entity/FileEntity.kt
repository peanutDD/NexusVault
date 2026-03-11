package com.upload.download.core.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "files")
data class FileEntity(
    @PrimaryKey val id: String,
    val originalFilename: String,
    val fileSize: Long,
    val mimeType: String,
    val updatedAt: String
)
