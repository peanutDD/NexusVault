package com.upload.download.core.data.di

import com.upload.download.core.data.repository.AuthRepositoryImpl
import com.upload.download.core.data.repository.FileRepositoryImpl
import com.upload.download.core.data.repository.SettingsRepositoryImpl
import com.upload.download.core.domain.repository.AuthRepository
import com.upload.download.core.domain.repository.FileRepository
import com.upload.download.core.domain.repository.SettingsRepository
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class DataModule {
    @Binds
    @Singleton
    abstract fun bindAuthRepository(impl: AuthRepositoryImpl): AuthRepository

    @Binds
    @Singleton
    abstract fun bindFileRepository(impl: FileRepositoryImpl): FileRepository

    @Binds
    @Singleton
    abstract fun bindSettingsRepository(impl: SettingsRepositoryImpl): SettingsRepository
}
