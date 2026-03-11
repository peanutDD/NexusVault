# 原生 Android 架构与技术选型

## 1. 并行维护策略

- `frontend` 与 `frontend/src-tauri` 继续作为当前可用端。
- `android-native` 作为新增原生端独立演进。
- 后端 API 与业务规则保持一致，避免双端语义漂移。

## 2. 分层架构

- UI Layer：Compose + ViewModel + UDF 状态流。
- Domain Layer：UseCase + Repository Interface + Domain Model。
- Data Layer：Repository 实现、网络数据源、后续本地缓存。

## 3. 模块依赖规则

- Feature 仅依赖 Domain 接口与 DesignSystem。
- Data 实现 Domain 接口并依赖 Network。
- App 仅负责装配与导航，不承载业务实现。

## 4. 主流技术选型

- 语言与构建：Kotlin、Gradle Kotlin DSL、Version Catalog
- UI：Compose + Material 3 + Navigation Compose
- 架构：MVVM + Clean Architecture + UDF
- DI：Hilt
- 数据：Retrofit、OkHttp、Kotlinx Serialization
- 并发：Coroutines + Flow
- 本地能力：Room、DataStore、WorkManager（下一阶段）
- 质量保障：JUnit、Compose UI Test、Lint、detekt（下一阶段）

## 5. 可优化方向

- 启动：延迟初始化非关键模块 + Baseline Profile。
- 列表：Paging3、稳定 key、骨架屏。
- 网络：超时、重试退避、弱网降级。
- 上传：断点续传与后台任务托管。
- 体验：完整状态反馈与可访问性基线。
