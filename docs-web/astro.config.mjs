// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightClientMermaid from '@pasqal-io/starlight-client-mermaid';
import { createStarlightTypeDocPlugin } from 'starlight-typedoc';
import sitemap from '@astrojs/sitemap';
import starlightThemeGalaxy from 'starlight-theme-galaxy';

const [coreTypeDoc, coreTypeDocSidebar] = createStarlightTypeDocPlugin();
const [clientTypeDoc, clientTypeDocSidebar] = createStarlightTypeDocPlugin();

export default defineConfig({
	site: 'https://eugenioenko.github.io',
	base: '/oidc-js',
	integrations: [
		sitemap(),
		starlight({
			title: 'oidc-js',
			description: 'Zero-dependency OIDC client library for JavaScript & TypeScript',
			favicon: '/favicon.svg',
			logo: {
				src: './src/assets/logo.svg',
			},
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/eugenioenko/oidc-js' },
			],
			editLink: {
				baseUrl: 'https://github.com/eugenioenko/oidc-js/edit/main/docs-web/',
			},
			plugins: [
				starlightThemeGalaxy(),
				starlightClientMermaid(),
				coreTypeDoc({
					entryPoints: ['../packages/core/src/index.ts'],
					tsconfig: '../packages/core/tsconfig.json',
					output: 'api/core',
					sidebar: {
						label: 'API Reference (Core)',
						collapsed: true,
					},
					typeDoc: {
						excludePrivate: true,
						excludeInternal: true,
					},
				}),
				clientTypeDoc({
					entryPoints: ['../packages/client/src/index.ts'],
					tsconfig: '../packages/client/tsconfig.typedoc.json',
					output: 'api/client',
					sidebar: {
						label: 'API Reference (Client)',
						collapsed: true,
					},
					typeDoc: {
						excludePrivate: true,
						excludeInternal: true,
					},
				}),
			],
			sidebar: [
				{ label: 'Introduction', link: '/' },
				{
					label: 'Getting Started',
					items: [
						{ label: 'Installation', link: '/getting-started/installation/' },
						{ label: 'Quickstart', link: '/getting-started/quickstart/' },
					],
				},
				{
					label: 'Guides',
					items: [
						{ label: 'Login & Logout', link: '/guides/login-logout/' },
						{ label: 'Protected Routes', link: '/guides/protected-routes/' },
						{ label: 'Token Refresh', link: '/guides/token-refresh/' },
						{ label: 'User Profile', link: '/guides/user-profile/' },
					],
				},
				{
					label: 'React',
					items: [
						{ label: 'AuthProvider', link: '/react/auth-provider/' },
						{ label: 'useAuth', link: '/react/use-auth/' },
						{ label: 'RequireAuth', link: '/react/require-auth/' },
					],
				},
				{
					label: 'Vue',
					items: [
						{ label: 'Plugin', link: '/vue/plugin/' },
						{ label: 'useAuth', link: '/vue/use-auth/' },
						{ label: 'RequireAuth', link: '/vue/require-auth/' },
					],
				},
				{
					label: 'Svelte',
					items: [
						{ label: 'AuthProvider', link: '/svelte/auth-provider/' },
						{ label: 'getAuthContext', link: '/svelte/get-auth-context/' },
						{ label: 'RequireAuth', link: '/svelte/require-auth/' },
					],
				},
				{
					label: 'Angular',
					items: [
						{ label: 'provideAuth', link: '/angular/provide-auth/' },
						{ label: 'AuthService', link: '/angular/auth-service/' },
						{ label: 'authGuard', link: '/angular/auth-guard/' },
					],
				},
				{
					label: 'Solid',
					items: [
						{ label: 'AuthProvider', link: '/solid/auth-provider/' },
						{ label: 'useAuth', link: '/solid/use-auth/' },
						{ label: 'RequireAuth', link: '/solid/require-auth/' },
					],
				},
				{
					label: 'Preact',
					items: [
						{ label: 'AuthProvider', link: '/preact/auth-provider/' },
						{ label: 'useAuth', link: '/preact/use-auth/' },
						{ label: 'RequireAuth', link: '/preact/require-auth/' },
					],
				},
				{
					label: 'Lit',
					items: [
						{ label: 'AuthController', link: '/lit/auth-controller/' },
						{ label: 'RequireAuth', link: '/lit/require-auth/' },
					],
				},
				{
					label: 'Core API',
					items: [
						{ label: 'Overview', link: '/core/overview/' },
						{ label: 'Discovery', link: '/core/discovery/' },
						{ label: 'Authorization', link: '/core/authorize/' },
						{ label: 'Token', link: '/core/token/' },
						{ label: 'UserInfo', link: '/core/userinfo/' },
						{ label: 'Types', link: '/core/types/' },
					],
				},
				{
					label: 'Concepts',
					items: [
						{ label: 'Authorization Code + PKCE', link: '/concepts/pkce-flow/' },
						{ label: 'Architecture', link: '/concepts/architecture/' },
					],
				},
				coreTypeDocSidebar,
				clientTypeDocSidebar,
			],
			customCss: ['./src/styles/custom.css'],
		}),
	],
});
