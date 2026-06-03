export interface Skill {
    name: string;
    description: string;
    rules: string[];
    rawContent: string;
}
export declare function loadSkills(cwd?: string): Skill[];
export declare function parseSkillContent(content: string): Skill;
