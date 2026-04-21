use crate::llm::CodexClient;
use crate::skills::{Skill, SkillContext};

pub struct Pipeline {
    skills: Vec<Box<dyn Skill>>,
}

impl Default for Pipeline {
    fn default() -> Self {
        Self::new()
    }
}

impl Pipeline {
    pub fn new() -> Self {
        Self { skills: Vec::new() }
    }

    pub fn with_skill(mut self, skill: Box<dyn Skill>) -> Self {
        self.skills.push(skill);
        self
    }

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
