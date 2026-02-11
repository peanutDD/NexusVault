//! # 缓存服务模块
//!
//! 提供应用级缓存功能，使用 moka 作为高性能内存缓存。
//!
//! ## 缓存策略
//!
//! - 用户信息缓存：5 分钟 TTL
//! - 文件元数据缓存：1 分钟 TTL
//! - 文件夹列表缓存：30 秒 TTL

use moka::sync::Cache;
use std::sync::Arc;
use std::time::Duration;
use uuid::Uuid;

use crate::models::file::File;
use crate::models::folder::Folder;
use crate::models::ugoira::UgoiraCacheEntry;
use crate::models::user::User;

/// 缓存键前缀
const USER_PREFIX: &str = "user:";
const FILE_PREFIX: &str = "file:";
const FOLDER_PREFIX: &str = "folder:";
const FOLDER_LIST_PREFIX: &str = "folder_list:";
const EMAIL_VERIFICATION_PREFIX: &str = "email_verify:";
const OAUTH_STATE_PREFIX: &str = "oauth_state:";
const UGOIRA_DATA_PREFIX: &str = "ugoira:";

/// 应用缓存服务
#[derive(Clone)]
pub struct CacheService {
    /// 用户缓存
    users: Cache<String, Arc<User>>,
    /// 文件元数据缓存
    files: Cache<String, Arc<File>>,
    /// 文件夹缓存
    folders: Cache<String, Arc<Folder>>,
    /// 文件夹列表缓存
    folder_lists: Cache<String, Arc<Vec<Folder>>>,
    /// 邮箱验证码缓存（key: user_id:email, value: 6位验证码，TTL 10 分钟）
    email_verification: Cache<String, String>,
    /// Ugoira 预解压缓存（metadata + 全部帧），命中后零 ZIP 解析
    ugoira_data: Cache<String, Arc<UgoiraCacheEntry>>,
    /// OAuth state 缓存（key: provider:state, value: "1"，TTL 5 分钟，用于 CSRF 防护）
    oauth_states: Cache<String, String>,
}

impl CacheService {
    /// 创建新的缓存服务实例
    pub fn new() -> Self {
        Self {
            users: Cache::builder()
                .max_capacity(10_000)
                .time_to_live(Duration::from_secs(300)) // 5 分钟
                .build(),
            files: Cache::builder()
                .max_capacity(50_000)
                .time_to_live(Duration::from_secs(60)) // 1 分钟
                .build(),
            folders: Cache::builder()
                .max_capacity(20_000)
                .time_to_live(Duration::from_secs(60)) // 1 分钟
                .build(),
            folder_lists: Cache::builder()
                .max_capacity(10_000)
                .time_to_live(Duration::from_secs(30)) // 30 秒
                .build(),
            email_verification: Cache::builder()
                .max_capacity(10_000)
                .time_to_live(Duration::from_secs(600)) // 10 分钟
                .build(),
            ugoira_data: Cache::builder()
                .max_capacity(20)
                .time_to_live(Duration::from_secs(60)) // 1 分钟，同一播放会话内多帧复用
                .build(),
            oauth_states: Cache::builder()
                .max_capacity(10_000)
                .time_to_live(Duration::from_secs(300)) // 5 分钟内有效
                .build(),
        }
    }

    // ========================================================================
    // Ugoira 预解压缓存（按 file_id + user_id，命中后直接取帧，零 ZIP 解析）
    // ========================================================================

    /// 获取已缓存的 Ugoira 预解压结果（metadata + 全部帧）
    pub fn get_ugoira(&self, file_id: Uuid, user_id: Uuid) -> Option<Arc<UgoiraCacheEntry>> {
        let key = format!("{}{}:{}", UGOIRA_DATA_PREFIX, file_id, user_id);
        self.ugoira_data.get(&key)
    }

    /// 写入 Ugoira 预解压结果到缓存
    pub fn set_ugoira(&self, file_id: Uuid, user_id: Uuid, entry: Arc<UgoiraCacheEntry>) {
        let key = format!("{}{}:{}", UGOIRA_DATA_PREFIX, file_id, user_id);
        self.ugoira_data.insert(key, entry);
    }

    // ========================================================================
    // 邮箱验证码
    // ========================================================================

    /// 设置邮箱验证码
    pub fn set_email_verification_code(&self, user_id: Uuid, email: &str, code: &str) {
        let key = format!("{}{}:{}", EMAIL_VERIFICATION_PREFIX, user_id, email);
        self.email_verification.insert(key, code.to_string());
    }

    /// 校验并消费邮箱验证码（验证成功后移除）
    pub fn verify_and_consume_email_code(&self, user_id: Uuid, email: &str, code: &str) -> bool {
        let key = format!("{}{}:{}", EMAIL_VERIFICATION_PREFIX, user_id, email);
        if let Some(stored) = self.email_verification.get(&key) {
            if stored == code {
                self.email_verification.invalidate(&key);
                return true;
            }
        }
        false
    }

    // ========================================================================
    // OAuth state（第三方登录 CSRF 防护）
    // ========================================================================

    /// 记录 OAuth state（按 provider 区分）
    pub fn set_oauth_state(&self, provider: &str, state: &str) {
        let key = format!("{}{}:{}", OAUTH_STATE_PREFIX, provider, state);
        self.oauth_states.insert(key, "1".to_string());
    }

    /// 校验并消费 OAuth state，成功返回 true
    pub fn verify_and_consume_oauth_state(&self, provider: &str, state: &str) -> bool {
        let key = format!("{}{}:{}", OAUTH_STATE_PREFIX, provider, state);
        if self.oauth_states.get(&key).is_some() {
            self.oauth_states.invalidate(&key);
            return true;
        }
        false
    }

    // ========================================================================
    // 用户缓存
    // ========================================================================

    /// 获取用户缓存
    pub fn get_user(&self, user_id: Uuid) -> Option<Arc<User>> {
        let key = format!("{}{}", USER_PREFIX, user_id);
        self.users.get(&key)
    }

    /// 设置用户缓存
    pub fn set_user(&self, user: User) {
        let key = format!("{}{}", USER_PREFIX, user.id);
        self.users.insert(key, Arc::new(user));
    }

    /// 使用户缓存失效
    pub fn invalidate_user(&self, user_id: Uuid) {
        let key = format!("{}{}", USER_PREFIX, user_id);
        self.users.invalidate(&key);
    }

    // ========================================================================
    // 文件缓存
    // ========================================================================

    /// 获取文件缓存
    pub fn get_file(&self, file_id: Uuid) -> Option<Arc<File>> {
        let key = format!("{}{}", FILE_PREFIX, file_id);
        self.files.get(&key)
    }

    /// 设置文件缓存
    pub fn set_file(&self, file: File) {
        let key = format!("{}{}", FILE_PREFIX, file.id);
        self.files.insert(key, Arc::new(file));
    }

    /// 使文件缓存失效
    pub fn invalidate_file(&self, file_id: Uuid) {
        let key = format!("{}{}", FILE_PREFIX, file_id);
        self.files.invalidate(&key);
    }

    /// 批量使文件缓存失效
    pub fn invalidate_files(&self, file_ids: &[Uuid]) {
        for id in file_ids {
            self.invalidate_file(*id);
        }
    }

    // ========================================================================
    // 文件夹缓存
    // ========================================================================

    /// 获取文件夹缓存
    pub fn get_folder(&self, folder_id: Uuid) -> Option<Arc<Folder>> {
        let key = format!("{}{}", FOLDER_PREFIX, folder_id);
        self.folders.get(&key)
    }

    /// 设置文件夹缓存
    pub fn set_folder(&self, folder: Folder) {
        let key = format!("{}{}", FOLDER_PREFIX, folder.id);
        self.folders.insert(key, Arc::new(folder));
    }

    /// 使文件夹缓存失效
    pub fn invalidate_folder(&self, folder_id: Uuid) {
        let key = format!("{}{}", FOLDER_PREFIX, folder_id);
        self.folders.invalidate(&key);
    }

    // ========================================================================
    // 文件夹列表缓存
    // ========================================================================

    /// 获取文件夹列表缓存
    pub fn get_folder_list(&self, user_id: Uuid, parent_id: Option<Uuid>) -> Option<Arc<Vec<Folder>>> {
        let key = format!("{}{}:{:?}", FOLDER_LIST_PREFIX, user_id, parent_id);
        self.folder_lists.get(&key)
    }

    /// 设置文件夹列表缓存
    pub fn set_folder_list(&self, user_id: Uuid, parent_id: Option<Uuid>, folders: Vec<Folder>) {
        let key = format!("{}{}:{:?}", FOLDER_LIST_PREFIX, user_id, parent_id);
        self.folder_lists.insert(key, Arc::new(folders));
    }

    /// 使用户的所有文件夹列表缓存失效
    pub fn invalidate_folder_lists_for_user(&self, _user_id: Uuid) {
        // moka 不支持按前缀删除，这里使用 run_pending_tasks 来触发过期清理
        // 在实际应用中，可以使用 Redis 的 SCAN + DEL 来实现
        // 或者维护一个用户到缓存键的映射
        self.folder_lists.run_pending_tasks();
    }

    // ========================================================================
    // 统计信息
    // ========================================================================

    /// 获取缓存统计信息
    pub fn stats(&self) -> CacheStats {
        CacheStats {
            users_count: self.users.entry_count(),
            files_count: self.files.entry_count(),
            folders_count: self.folders.entry_count(),
            folder_lists_count: self.folder_lists.entry_count(),
            ugoira_data_count: self.ugoira_data.entry_count(),
        }
    }
}

impl Default for CacheService {
    fn default() -> Self {
        Self::new()
    }
}

/// 缓存统计信息
#[derive(Debug, Clone)]
pub struct CacheStats {
    pub users_count: u64,
    pub files_count: u64,
    pub folders_count: u64,
    pub folder_lists_count: u64,
    pub ugoira_data_count: u64,
}
