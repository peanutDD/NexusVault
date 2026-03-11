package com.upload.download.nativeapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.upload.download.core.designsystem.NativeSpacing
import com.upload.download.core.designsystem.NativeTheme
import com.upload.download.feature.auth.AuthRoute
import com.upload.download.feature.files.FilesRoute
import com.upload.download.feature.preview.PreviewRoute
import com.upload.download.feature.settings.SettingsRoute
import com.upload.download.feature.upload.UploadRoute
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            NativeTheme {
                NativeAppNav()
            }
        }
    }
}

@Composable
private fun NativeAppNav() {
    val navController = rememberNavController()
    NavHost(navController = navController, startDestination = "auth") {
        composable("auth") {
            AuthRoute(
                onLoginSuccess = {
                    navController.navigate("files") {
                        popUpTo("auth") { inclusive = true }
                    }
                }
            )
        }
        composable("files") {
            Column(
                modifier = androidx.compose.ui.Modifier.fillMaxSize()
                    .padding(NativeSpacing.page),
                verticalArrangement = Arrangement.spacedBy(NativeSpacing.section)
            ) {
                Row(
                    modifier = androidx.compose.ui.Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(NativeSpacing.item)
                ) {
                    Button(onClick = { navController.navigate("upload") }) { androidx.compose.material3.Text("上传") }
                    Button(onClick = { navController.navigate("preview") }) { androidx.compose.material3.Text("预览") }
                    Button(onClick = { navController.navigate("settings") }) { androidx.compose.material3.Text("设置") }
                }
                FilesRoute()
            }
        }
        composable("upload") {
            UploadRoute()
        }
        composable("preview") {
            PreviewRoute()
        }
        composable("settings") {
            SettingsRoute()
        }
    }
}
