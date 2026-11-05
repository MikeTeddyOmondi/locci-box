// Monaco's Monarch grammars ship without type declarations.
declare module 'monaco-editor/languages/definitions/javascript/javascript.js' {
	import type * as Monaco from 'monaco-editor';
	export const conf: Monaco.languages.LanguageConfiguration;
	export const language: Monaco.languages.IMonarchLanguage;
}
