package com.upload.download.core.database

import androidx.room.Database
import androidx.room.RoomDatabase
import com.upload.download.core.database.dao.FileDao
import com.upload.download.core.database.entity.FileEntity

@Database(
    entities = [FileEntity::class],
    version = 1,
    exportSchema = true
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun fileDao(): FileDao
}
