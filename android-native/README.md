# Android Native 客户端

该目录是新增的原生 Android 项目，目标是与现有 `frontend`（Web/Tauri）并行维护。

## 设计原则

- 旧端保留，不删除，不改动构建入口。
- 新端采用 Kotlin + Jetpack Compose + Hilt + Clean Architecture。
- 通过统一 API 契约与设计系统保证双端体验一致。

## 模块结构

- `:app` 应用入口与导航容器
- `:core:common` 结果模型与通用能力
- `:core:domain` 领域模型、仓库接口、UseCase
- `:core:network` Retrofit/OkHttp 网络层
- `:core:database` Room 实体、DAO、数据库模块
- `:core:storage` DataStore 会话存储与 token provider
- `:core:data` Repository 实现与 DI 绑定
- `:core:designsystem` 主题、间距、基础组件
- `:feature:auth` 登录流程页面
- `:feature:files` 文件列表流程页面
- `:feature:upload` 后台上传任务页面与 Worker
- `:feature:preview` 文件预览状态页面
- `:feature:settings` 用户与存储设置页面

## 技术选型

- Kotlin 2.x
- AGP 8.8+
- Jetpack Compose + Material 3
- Navigation Compose
- Coroutines + Flow
- Hilt
- Retrofit + OkHttp + Kotlinx Serialization
- Room + DataStore
- WorkManager

## 后端地址配置

- 默认地址：`http://192.168.8.59:3000/`
- 可通过 Gradle 参数覆盖：

```bash
./gradlew :app:assembleDebug -PBACKEND_BASE_URL=http://你的地址:3000/
```

## 下一步

- 对接系统文件选择器，替代手工输入文件路径。
- 增加上传任务持久化、失败原因分类与重试策略扩展。
- 建立 Macrobenchmark 与稳定性监控。
