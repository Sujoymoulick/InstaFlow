import 'dotenv/config';
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';

import vercel from '@astrojs/vercel/serverless';

const DEV_PORT = 2121;

export default defineConfig({
	site: process.env.VERCEL_URL
		? `https://${process.env.VERCEL_URL}`
		: (process.env.SITE_URL || 'https://instaflow-weld.vercel.app'),

	output: 'server',
	adapter: vercel(),

	/* Like Vercel, Netlify,… Mimicking for dev. server */
	// trailingSlash: 'always',

	server: {
		/* Dev. server only */
		port: DEV_PORT,
	},

	integrations: [
		//
		sitemap(),
		tailwind(),
	],
});
