# 将项目提交到 GitHub

## 当前状态

- 本地 Git 已初始化，有提交历史
- 已添加远程：`origin` → `git@github.com:tyone/upload-download-util.git`
- 推送失败原因：**该仓库在 GitHub 上尚不存在**，或用户名/仓库名需调整

## 操作步骤

### 1. 在 GitHub 上创建仓库

1. 打开 [https://github.com/new](https://github.com/new)
2. **Repository name**：`upload-download-util`（或你想要的名称）
3. **Description**（可选）：如 `文件上传下载与分享工具`
4. 选择 **Public**
5. **不要**勾选 "Add a README" / "Add .gitignore"（本地已有）
6. 点击 **Create repository**

### 2. 如仓库名或用户名不同，更新远程地址

```bash
# 格式：git@github.com:<你的用户名>/<仓库名>.git
git remote set-url origin git@github.com:<用户名>/<仓库名>.git
```

### 3. 推送到 GitHub

```bash
cd /Users/tyone/github/upload-download-util
git push -u origin main
```

首次推送会建立 `main` 与 `origin/main` 的跟踪关系，之后可直接 `git push`。

### 4. 使用 HTTPS 时（可选）

若你使用 HTTPS 且未配置凭据：

```bash
git remote set-url origin https://github.com/<用户名>/<仓库名>.git
git push -u origin main
```

按提示登录或使用 Personal Access Token。

## 常用后续命令

```bash
git add .
git commit -m "你的提交说明"
git push
```

## 排查推送失败

- **Permission denied (publickey)**：未配置 SSH 公钥，见 [GitHub SSH 文档](https://docs.github.com/zh/authentication/connecting-to-github-with-ssh)
- **Repository not found**：仓库不存在、名称错误或当前账号无权限
- **Authentication failed**：HTTPS 需配置 Token 或凭据助手
