import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import globals from 'globals'

export default defineConfigWithVueTs(
    {
        name: 'app/files-to-lint',
        files: ['**/*.{ts,mts,tsx,vue,js,cjs}'],
    },

    {
        name: 'app/files-to-ignore',
        ignores: [
            '**/dist/**',
            '**/dist-ssr/**',
            '**/coverage/**',
            '**/ios/**',
            '**/android/**',
            '**/node_modules/**',
            '**/App_Backup/**',
            '.idea/**',
            '.vscode/**',
            '.DS_Store'
        ],
    },

    js.configs.recommended,
    ...pluginVue.configs['flat/essential'],
    vueTsConfigs.recommended,

    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
    },

    {
        rules: {
            'no-console': 'off',
            'no-debugger': 'off',
            'vue/no-deprecated-slot-attribute': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': 'warn',
        },
    },
)
