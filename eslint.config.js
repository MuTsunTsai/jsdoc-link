import { createConfig } from "@mutsuntsai/eslint";

export default [
	...createConfig({
		ignores: [
			"out/**",
			"node_modules/**",
		],
		import: {
			files: ["**/*.{ts,tsx}", "eslint.config.js"],
			project: ["src/app"],
		},
		globals: {
			esm: ["./*.{js,ts}"],
		},
	}),
];
