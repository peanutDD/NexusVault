package com.upload.download.core.storage.di

import com.upload.download.core.network.auth.TokenProvider
import com.upload.download.core.storage.DataStoreTokenProvider
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class StorageModule {
    @Binds
    @Singleton
    abstract fun bindTokenProvider(impl: DataStoreTokenProvider): TokenProvider
}
