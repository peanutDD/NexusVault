package com.upload.download.core.domain.usecase

import com.upload.download.core.domain.repository.FileRepository
import javax.inject.Inject

class GetRecentFilesUseCase @Inject constructor(
    private val repository: FileRepository
) {
    operator fun invoke() = repository.observeRecentFiles()

    suspend fun refresh() = repository.refreshRecentFiles()
}
