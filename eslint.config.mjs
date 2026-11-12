import { defineConfig, globalIgnores } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
	globalIgnores(["node_modules", "dist", "main.js", "test"]),
	...obsidianmd.configs.recommended,
	{
		languageOptions: {
			parserOptions: { projectService: { allowDefaultProject: ["eslint.config.*"] } },
		},
	},
]);
