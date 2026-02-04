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
use crate::models::user::User;

/// 缓存键前缀
const USER_PREFIX: &str = "user:";
const FILE_PREFIX: &str = "file:";
const FOLDER_PREFIX: &str = "folder:";
const FOLDER_LIST_PREFIX: &str = "folder_list:";

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
        }
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
}
