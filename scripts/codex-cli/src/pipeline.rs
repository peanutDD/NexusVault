use crate::llm::CodexClient;
use crate::skills::{Skill, SkillContext};

/// Skill 编排器：把“解析/决策/修复/审计/反馈”等能力按顺序串起来执行。
///
/// 设计目标是让每个 Skill 都可单测/可复用，而 Pipeline 只负责顺序与上下文传递。
pub struct Pipeline {
    skills: Vec<Box<dyn Skill>>,
}

impl Default for Pipeline {
    fn default() -> Self {
        Self::new()
    }
}

impl Pipeline {
    /// 新建一个空 Pipeline（后续通过 `with_skill` 逐步拼装）。
    pub fn new() -> Self {
        Self { skills: Vec::new() }
    }

    /// 以 builder 风格追加一个 Skill，返回新的 Pipeline。
    pub fn with_skill(mut self, skill: Box<dyn Skill>) -> Self {
        self.skills.push(skill);
        self
    }

    /// 按顺序执行所有 Skill。
    ///
    /// 约定：进度日志走 stderr，避免污染 `pr-auto-fix` 的 stdout JSON。
    pub async fn run(
        &self,
        ctx: &mut SkillContext,
        client: &CodexClient,
    ) -> Result<(), Box<dyn std::error::Error>> {
        for skill in &self.skills {
            eprintln!("🚀 [Skill: {}] 正在执行...", skill.name());
            skill.execute(ctx, client).await?;
        }
        Ok(())
    }
}
