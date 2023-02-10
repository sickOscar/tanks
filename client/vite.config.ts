import {viteStaticCopy} from 'vite-plugin-static-copy'
import {defineConfig} from 'vite'
import path from 'path'

export default defineConfig({
    build: {
      sourcemap: true,
      chunkSizeWarningLimit: 1000,
    },
    plugins: [
        viteStaticCopy({
            targets: [
                {
                    src: path.resolve(__dirname, './auth_config.json'),
                    dest: './',
                },
                {
                    src: path.resolve(__dirname, './assets'),
                    dest: './',
                }
            ],
        }),
    ],

})