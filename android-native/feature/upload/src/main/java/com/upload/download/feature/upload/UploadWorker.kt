package com.upload.download.feature.upload

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.upload.download.core.network.BuildConfig
import java.io.File
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody

class UploadWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        val filePath = inputData.getString(KEY_FILE_PATH) ?: return Result.failure()
        val token = inputData.getString(KEY_TOKEN) ?: return Result.failure()
        val file = File(filePath)
        if (!file.exists()) return Result.failure()

        val requestBody = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart(
                "file",
                file.name,
                file.asRequestBody("application/octet-stream".toMediaType())
            )
            .build()

        val request = Request.Builder()
            .url("${BuildConfig.BACKEND_BASE_URL.trimEnd('/')}/api/files/upload")
            .addHeader("Authorization", "Bearer $token")
            .post(requestBody)
            .build()

        return runCatching {
            OkHttpClient().newCall(request).execute().use { response ->
                if (response.isSuccessful) Result.success() else Result.retry()
            }
        }.getOrElse { Result.retry() }
    }

    companion object {
        const val KEY_FILE_PATH = "file_path"
        const val KEY_TOKEN = "token"
    }
}
