import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, mkdirSync } from 'fs'

// 自定义插件：复制 manifest.json 和 icons 到构建输出目录
function copyManifest() {
  return {
    name: 'copy-manifest',
    closeBundle() {
      try {
        const srcDir = resolve(__dirname)
        const distDir = resolve(__dirname, '../chrome-extension-dist')
        const publicDir = resolve(srcDir, 'public')
        
        // 确保 icons 目录存在
        try {
          mkdirSync(resolve(distDir, 'icons'), { recursive: true })
        } catch (e) {
          // 目录可能已存在
        }
        
        // 复制 manifest.json
        copyFileSync(
          resolve(srcDir, 'manifest.json'),
          resolve(distDir, 'manifest.json')
        )
        console.log('✅ manifest.json 已复制到构建目录')
        
        // 复制 icons
        const icons = ['icon16.png', 'icon48.png', 'icon128.png']
        icons.forEach(icon => {
          const srcPath = resolve(publicDir, 'icons', icon)
          const distPath = resolve(distDir, 'icons', icon)
          copyFileSync(srcPath, distPath)
          console.log(`✅ ${icon} 已复制到构建目录`)
        })
      } catch (error) {
        console.error('❌ 复制文件失败:', error)
      }
    }
  }
}

export default defineConfig({
  plugins: [react(), copyManifest()],
  build: {
    outDir: '../chrome-extension-dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        background: resolve(__dirname, 'src/background.ts'),
        content: resolve(__dirname, 'src/content.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || []
          const ext = info[info.length - 1]
          if (ext === 'css') {
            return 'assets/[name][extname]'
          }
          return '[name][extname]'
        },
      },
    },
  },
})
