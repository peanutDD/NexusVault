-- 查看磁盘路径 uploads/e2e3520f-df62-49a2-8e44-aa4710b04eca 下两个 file_id 是否在库里、归属哪个 user_id
-- 用法: psql $DATABASE_URL -f scripts/check_file_owners.sql

\echo '=== 用户列表 ==='
SELECT id, email FROM users ORDER BY email;

\echo ''
\echo '=== 指定 file_id 在 files 表中的记录（7d4e5d64... / fc134d71...）==='
SELECT id, user_id,
       CASE WHEN user_id::text = 'e2e3520f-df62-49a2-8e44-aa4710b04eca' THEN '与磁盘路径一致' ELSE '其他账号' END AS owner_note,
       file_path, original_filename, created_at
FROM files
WHERE id IN (
  '7d4e5d64-47e8-4d1f-8550-85e4a146bd22',
  'fc134d71-1d84-4e4f-a68d-5d501c5ebc98'
);

\echo ''
\echo '=== 若上面无行，说明这两条是孤儿（无 DB 记录）==='
\echo '=== 用户 e2e3520f-df62-49a2-8e44-aa4710b04eca 名下文件总数 ==='
SELECT COUNT(*) AS file_count FROM files WHERE user_id = 'e2e3520f-df62-49a2-8e44-aa4710b04eca';
