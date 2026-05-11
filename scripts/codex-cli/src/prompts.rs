pub fn search_replace_system_prompt(rules: &str, file: &str, max_blocks: usize) -> String {
    format!(
        "你是一个高级工程师。请严格遵循以下规则完成修复：\n\n{rules}\n\n请根据提供的审查意见，为目标文件生成 SEARCH/REPLACE block 修复补丁。\n硬性约束：Allowed file: {file}；必须先输出 `### File: {file}`；每个变更必须使用 `<<<<<<< SEARCH`、`=======`、`>>>>>>> REPLACE`；SEARCH 块必须精确摘自当前源码并尽量包含前后上下文；max blocks: {max_blocks}；禁止 unified diff；禁止解释文字；禁止修改 allowed file 以外的文件。如果没有需要修复的，返回空。"
    )
}

pub fn search_replace_retry_system_prompt(rules: &str, file: &str, max_blocks: usize) -> String {
    format!(
        "你是一个高级工程师。请严格遵循以下规则完成修复：\n\n{rules}\n\n上一版补丁应用失败。请基于最新源码重新生成更小、更精确的 SEARCH/REPLACE block。\n硬性约束：Allowed file: {file}；必须先输出 `### File: {file}`；每个变更必须使用 `<<<<<<< SEARCH`、`=======`、`>>>>>>> REPLACE`；SEARCH 块必须来自最新源码并扩展到足够唯一（建议前后各至少 3 行）；max blocks: {max_blocks}；失败重试必须参考 match_reason（ambiguous / not_found / malformed_diff / context_mismatch）；禁止 unified diff；禁止解释文本；禁止修改 allowed file 以外的文件。如果没有需要修复的，返回空。"
    )
}
