/**
 * Skill Loader — Dynamically loads skill files and injects them into agent context.
 *
 * Skills live in src/lib/skills/<skill-name>/ with:
 *   - SKILL.md        — The main instruction document (workflow, phases, rules)
 *   - references/      — Supporting docs (field maps, lookup tables, etc.)
 *   - template/        — Template files (Excel workbooks, PDFs, etc.)
 *   - scripts/         — Helper scripts (Python, etc.) — informational only
 *
 * The loader reads SKILL.md + all reference files and returns them as a single
 * context string that gets appended to the agent's system prompt. This way the
 * agent knows HOW to execute the skill using generic tools — no hard-coding needed.
 */

import * as fs from "fs";
import * as path from "path";

export type SkillManifest = {
  name: string;
  description: string;
  skillDoc: string;         // Full SKILL.md content
  references: { name: string; content: string }[];
  templateFiles: string[];  // Filenames of templates available
  templateDir: string;      // Absolute path to template directory
};

// Map of agent role → skill names that agent can use
const agentSkills: Record<string, string[]> = {
  income_tax: ["1040-tax-return"],
  // Add more as new skills are created:
  // payroll_manager: ["payroll-processing"],
  // sales_tax: ["sales-tax-filing"],
  // bookkeeper: ["monthly-close"],
};

function getSkillsDir(): string {
  // Try multiple paths for Vercel compatibility
  const candidates = [
    path.join(process.cwd(), "src/lib/skills"),
    path.join(__dirname, "../../skills"),
    path.join(__dirname, "../skills"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[0]; // fallback
}

export function loadSkill(skillName: string): SkillManifest | null {
  const skillsDir = getSkillsDir();
  const skillDir = path.join(skillsDir, skillName);

  if (!fs.existsSync(skillDir)) return null;

  // Read SKILL.md
  const skillMdPath = path.join(skillDir, "SKILL.md");
  if (!fs.existsSync(skillMdPath)) return null;
  const skillDoc = fs.readFileSync(skillMdPath, "utf-8");

  // Extract name/description from YAML frontmatter
  let name = skillName;
  let description = "";
  const frontmatterMatch = skillDoc.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const fm = frontmatterMatch[1];
    const nameMatch = fm.match(/name:\s*(.+)/);
    const descMatch = fm.match(/description:\s*>\s*\n([\s\S]*?)(?=\n\w|\n---)/);
    if (nameMatch) name = nameMatch[1].trim();
    if (descMatch) description = descMatch[1].trim().replace(/\n\s+/g, " ");
  }

  // Read reference files
  const references: { name: string; content: string }[] = [];
  const refsDir = path.join(skillDir, "references");
  if (fs.existsSync(refsDir)) {
    const refFiles = fs.readdirSync(refsDir).filter((f) => f.endsWith(".md") || f.endsWith(".txt") || f.endsWith(".json"));
    for (const refFile of refFiles) {
      const content = fs.readFileSync(path.join(refsDir, refFile), "utf-8");
      references.push({ name: refFile, content });
    }
  }

  // List template files
  const templateDir = path.join(skillDir, "template");
  let templateFiles: string[] = [];
  if (fs.existsSync(templateDir)) {
    templateFiles = fs.readdirSync(templateDir).filter((f) => !f.startsWith("."));
  }

  return { name, description, skillDoc, references, templateFiles, templateDir };
}

export function getSkillsForAgent(agentRole: string): SkillManifest[] {
  const skillNames = agentSkills[agentRole] ?? [];
  const skills: SkillManifest[] = [];
  for (const name of skillNames) {
    const skill = loadSkill(name);
    if (skill) skills.push(skill);
  }
  return skills;
}

/**
 * Builds a context string from all loaded skills that can be appended to the system prompt.
 * Includes the full SKILL.md workflow + all reference documents.
 */
export function buildSkillContext(agentRole: string): string {
  const skills = getSkillsForAgent(agentRole);
  if (skills.length === 0) return "";

  const parts: string[] = [
    "\n\n========================================",
    "LOADED SKILLS",
    "========================================",
    "",
    "You have the following skills loaded. When a user request matches a skill's trigger conditions,",
    "follow that skill's workflow using the generic Excel tools (download_excel, read_excel_cells,",
    "write_excel_cells, upload_excel) and other available tools.",
    "",
  ];

  for (const skill of skills) {
    parts.push(`--- SKILL: ${skill.name} ---`);
    parts.push(skill.skillDoc);
    parts.push("");

    if (skill.references.length > 0) {
      parts.push("--- REFERENCE DOCUMENTS ---");
      for (const ref of skill.references) {
        parts.push(`\n[${ref.name}]`);
        parts.push(ref.content);
      }
      parts.push("");
    }

    if (skill.templateFiles.length > 0) {
      parts.push("--- AVAILABLE TEMPLATES ---");
      parts.push(`Template directory contains: ${skill.templateFiles.join(", ")}`);
      parts.push(`Use the copy_skill_template tool with skill_name="${skill.name}" to copy a template to a client's OneDrive folder.`);
      parts.push("");
    }

    parts.push("--- END SKILL ---\n");
  }

  return parts.join("\n");
}

/**
 * Get the absolute path to a skill's template file.
 * Returns null if not found.
 */
export function getSkillTemplatePath(skillName: string, fileName: string): string | null {
  const skill = loadSkill(skillName);
  if (!skill) return null;
  const templatePath = path.join(skill.templateDir, fileName);
  if (fs.existsSync(templatePath)) return templatePath;
  // Fallback: check public/templates
  const publicPath = path.join(process.cwd(), "public/templates", fileName);
  if (fs.existsSync(publicPath)) return publicPath;
  return null;
}
