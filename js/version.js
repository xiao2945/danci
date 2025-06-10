/**
 * 版本信息模块
 */
class VersionManager {
    constructor() {
        this.version = 'v1.3.0';
        this.releaseDate = '2025-06-11';
        this.description = '修复排序规则中"!"标志位置验证逻辑，增强规则语法验证，改进用户体验';
    }

    /**
     * 获取版本信息
     */
    getVersionInfo() {
        return {
            version: this.version,
            releaseDate: this.releaseDate,
            description: this.description
        };
    }

    /**
     * 在页面显示版本信息
     */
    displayVersion() {
        // 在页面底部添加版本信息
        const versionElement = document.createElement('div');
        versionElement.className = 'version-info';
        versionElement.innerHTML = `
            <small style="color: #666; font-size: 12px; position: fixed; bottom: 10px; right: 10px; background: rgba(255,255,255,0.9); padding: 5px 10px; border-radius: 3px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                单词筛选工具 ${this.version} (${this.releaseDate})
            </small>
        `;
        document.body.appendChild(versionElement);
    }

    /**
     * 检查是否有新版本（预留接口�?     */
    checkForUpdates() {
        // 预留功能，可以后续实现版本检�?        console.log(`当前版本: ${this.version}`);
    }
}

// 导出版本管理器
window.VersionManager = VersionManager;

// 页面加载完成后显示版本信息
document.addEventListener('DOMContentLoaded', function () {
    const versionManager = new VersionManager();
    versionManager.displayVersion();
});
