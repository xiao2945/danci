/**
 * 主应用程序类
 * 整合文件处理、规则引擎和用户界面
 */
class WordFilterApp {
    constructor() {
        this.fileUtils = new FileUtils();
        this.ruleEngine = new RuleEngine();
        this.currentWords = [];
        this.filteredWords = [];
        this.currentFile = null;
        this.deletedWords = new Set(); // 存储已删除单词的索引

        this.initializeApp();
    }

    /**
     * 初始化应用程序
     */
    initializeApp() {
        this.bindEvents();
        this.loadSavedRules();
        this.updateRuleSelector();
        this.setupRuleSyncListeners();

        // 调试：检查全局集合加载情况
        console.log('全局集合加载情况:', this.ruleEngine.getGlobalSets());

        this.showMessage('应用程序已就绪', 'info');
    }

    /**
     * 设置规则同步监听器
     */
    setupRuleSyncListeners() {
        // 存储上次检查的规则数据
        this.lastRulesData = localStorage.getItem('wordFilterRules');
        this.lastRuleOrder = localStorage.getItem('ruleOrder');

        // 监听窗口焦点事件（用户切换回主页时刷新）
        window.addEventListener('focus', () => {
            this.checkAndUpdateRules();
        });

        // 监听页面可见性变化
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.checkAndUpdateRules();
            }
        });

        // 定时检查规则变化（每2秒检查一次）
        this.ruleCheckInterval = setInterval(() => {
            this.checkAndUpdateRules();
        }, 2000);
    }

    /**
     * 检查并更新规则
     */
    checkAndUpdateRules() {
        const currentRulesData = localStorage.getItem('wordFilterRules');
        const currentRuleOrder = localStorage.getItem('ruleOrder');

        // 调试信息
        console.log('检查规则更新:', {
            current: currentRulesData ? JSON.parse(currentRulesData) : null,
            last: this.lastRulesData ? JSON.parse(this.lastRulesData) : null,
            changed: currentRulesData !== this.lastRulesData
        });

        if (currentRulesData !== this.lastRulesData || currentRuleOrder !== this.lastRuleOrder) {
            console.log('检测到规则变化，正在更新...');
            this.lastRulesData = currentRulesData;
            this.lastRuleOrder = currentRuleOrder;

            // 清空现有规则
            this.ruleEngine.rules.clear();

            // 重新加载规则
            this.loadSavedRules();
            this.updateRuleSelector();
            this.showMessage('规则已更新', 'success');
        }
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 文件选择
        const fileInput = document.getElementById('wordFile');
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // 规则选择
        const ruleSelect = document.getElementById('ruleSelect');
        ruleSelect.addEventListener('change', (e) => this.handleRuleChange(e));

        // 生成按钮
        const generateBtn = document.getElementById('generateBtn');
        generateBtn.addEventListener('click', () => this.generateResults());

        // 规则管理按钮 - 现在跳转到独立页面
        // 按钮已在HTML中直接设置onclick事件

        // 原有按钮（如果存在）
        const exportRulesBtn = document.getElementById('exportRulesBtn');
        if (exportRulesBtn) {
            exportRulesBtn.addEventListener('click', async () => await this.exportRules());
        }

        const importRulesBtn = document.getElementById('importRulesBtn');
        if (importRulesBtn) {
            importRulesBtn.addEventListener('click', () => this.importRules());
        }

        // 新的按钮（生成区域中的按钮）
        const exportRulesBtn2 = document.getElementById('exportRulesBtn2');
        if (exportRulesBtn2) {
            exportRulesBtn2.addEventListener('click', async () => await this.exportRules());
        }

        const importRulesBtn2 = document.getElementById('importRulesBtn2');
        if (importRulesBtn2) {
            importRulesBtn2.addEventListener('click', () => this.importRules());
        }

        // 帮助按钮（如果存在）
        const helpBtn = document.getElementById('helpBtn');
        if (helpBtn) {
            helpBtn.addEventListener('click', () => this.openHelp());
        }

        // 模态框关闭
        const closeButtons = document.querySelectorAll('.close');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.closeModal(e.target.closest('.modal')));
        });

        // 模态框背景点击关闭
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal);
                }
            });
        });

        // 规则编辑器按钮已移至独立页面

        // 导出按钮
        const exportTxtBtn = document.getElementById('exportTxtBtn');
        exportTxtBtn.addEventListener('click', () => this.exportResults('txt'));

        const exportExcelBtn = document.getElementById('exportExcelBtn');
        exportExcelBtn.addEventListener('click', () => this.exportResults('excel'));

        // 键盘快捷键
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    }

    /**
     * 处理文件选择
     * @param {Event} event - 文件选择事件
     */
    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) {
            this.hideFileInfo();
            return;
        }

        try {
            // 验证文件格式
            if (!this.fileUtils.isSupportedFormat(file)) {
                throw new Error('不支持的文件格式。请选择 .txt、.xlsx 或 .xls 文件。');
            }

            // 验证文件大小
            if (!this.fileUtils.validateFileSize(file, 10)) {
                throw new Error('文件大小超过限制（最大 10MB）。');
            }

            this.showLoading('正在读取文件...');

            // 读取文件
            const fileResult = await this.fileUtils.readFile(file);
            this.currentWords = fileResult.words || fileResult; // 兼容旧格式
            this.currentFile = file;
            this.fileStats = fileResult.invalidCount !== undefined ? fileResult : null;

            // 显示文件信息
            this.showFileInfo(file, this.currentWords.length);

            // 显示预处理信息
            this.showPreprocessingInfo(fileResult);

            // 启用生成按钮
            this.updateGenerateButton();

            // 显示读取结果消息
            let message = `成功读取 ${this.currentWords.length} 个有效单词`;
            if (this.fileStats && this.fileStats.invalidCount > 0) {
                message += `，过滤掉 ${this.fileStats.invalidCount} 个无效单词`;
            }
            this.showMessage(message, 'success');

        } catch (error) {
            console.error('文件读取错误:', error);
            this.showMessage(`文件读取失败: ${error.message}`, 'error');
            this.hideFileInfo();
        } finally {
            this.hideLoading();
        }
    }

    /**
     * 处理规则选择变化
     * @param {Event} event - 选择变化事件
     */
    handleRuleChange(event) {
        const ruleName = event.target.value;
        if (ruleName) {
            this.showRulePreview(ruleName);
        } else {
            this.hideRulePreview();
        }
        this.updateGenerateButton();
    }

    /**
     * 生成筛选结果
     */
    async generateResults() {
        const ruleName = document.getElementById('ruleSelect').value;

        if (!this.currentWords.length) {
            this.showMessage('请先选择单词库文件', 'warning');
            return;
        }

        if (!ruleName) {
            this.showMessage('请选择筛选规则', 'warning');
            return;
        }

        try {
            this.showLoading('正在筛选单词...');

            // 应用规则筛选
            this.filteredWords = this.ruleEngine.applyRule(this.currentWords, ruleName);

            // 重置删除状态
            this.deletedWords.clear();

            // 显示结果
            this.displayResults();

            this.showMessage(`筛选完成，找到 ${this.filteredWords.length} 个匹配的单词`, 'success');

        } catch (error) {
            console.error('筛选错误:', error);
            this.showMessage(`筛选失败: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * 显示文件信息
     * @param {File} file - 文件对象
     * @param {number} wordCount - 单词数量
     */
    showFileInfo(file, wordCount) {
        const fileInfo = this.fileUtils.getFileInfo(file);
        const fileInfoDiv = document.getElementById('fileInfo');

        fileInfoDiv.innerHTML = `
            <strong>文件名:</strong> ${fileInfo.name}<br>
            <strong>文件大小:</strong> ${fileInfo.sizeFormatted}<br>
            <strong>文件类型:</strong> ${fileInfo.extension.toUpperCase()}<br>
            <strong>单词数量:</strong> ${wordCount}<br>
            <strong>最后修改:</strong> ${fileInfo.lastModified}
        `;

        fileInfoDiv.classList.add('show');
    }

    /**
     * 隐藏文件信息
     */
    hideFileInfo() {
        const fileInfoDiv = document.getElementById('fileInfo');
        fileInfoDiv.classList.remove('show');
        this.currentWords = [];
        this.currentFile = null;
        this.updateGenerateButton();
    }

    /**
     * 显示规则预览
     * @param {string} ruleName - 规则名称
     */
    showRulePreview(ruleName) {
        const preview = this.ruleEngine.getRulePreview(ruleName);
        const previewDiv = document.getElementById('rulePreview');

        previewDiv.innerHTML = `
            <h4>规则预览</h4>
            <pre>${preview}</pre>
        `;

        previewDiv.classList.add('show');
    }

    /**
     * 隐藏规则预览
     */
    hideRulePreview() {
        const previewDiv = document.getElementById('rulePreview');
        previewDiv.classList.remove('show');
    }

    /**
     * 更新生成按钮状态
     */
    updateGenerateButton() {
        const generateBtn = document.getElementById('generateBtn');
        const hasFile = this.currentWords.length > 0;
        const hasRule = document.getElementById('ruleSelect').value;

        generateBtn.disabled = !hasFile || !hasRule;
    }

    /**
     * 显示筛选结果
     */
    displayResults() {
        // 更新统计信息
        this.updateResultStats();

        // 显示单词列表
        this.displayWordList();

        // 显示导出选项
        this.showExportOptions();

        // 滚动到结果区域
        document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });
    }

    /**
     * 更新结果统计
     */
    updateResultStats() {
        const totalWords = this.currentWords.length;
        const filteredCount = this.filteredWords.length;
        const deletedCount = this.deletedWords.size;
        const activeCount = filteredCount - deletedCount;
        const filterRate = totalWords > 0 ? ((activeCount / totalWords) * 100).toFixed(1) : 0;

        document.getElementById('totalWords').textContent = totalWords;
        document.getElementById('filteredWords').textContent = `${activeCount}${deletedCount > 0 ? ` (${deletedCount}已删除)` : ''}`;
        document.getElementById('filterRate').textContent = `${filterRate}%`;
    }

    /**
     * 显示单词列表
     */
    displayWordList() {
        const container = document.getElementById('resultContainer');

        if (this.filteredWords.length === 0) {
            container.innerHTML = '<p class="no-results">没有找到匹配的单词</p>';
            return;
        }

        // 按首字母分组
        const groupedWords = this.groupWordsByFirstLetter(this.filteredWords);

        let html = '';
        for (const [letter, words] of Object.entries(groupedWords)) {
            // 计算未删除的单词数量
            const activeWords = words.filter((word, index) => {
                const globalIndex = this.filteredWords.indexOf(word);
                return !this.deletedWords.has(globalIndex);
            });

            html += `
                <div class="word-group">
                    <div class="group-title">${letter.toUpperCase()} (${activeWords.length}/${words.length})</div>
                    <div class="word-list">
                        ${words.map((word, index) => {
                const globalIndex = this.filteredWords.indexOf(word);
                const isDeleted = this.deletedWords.has(globalIndex);
                return `
                                <div class="word-item ${isDeleted ? 'deleted' : ''}" data-index="${globalIndex}">
                                    <span class="word-text">${word}</span>
                                    <button class="delete-btn" onclick="app.toggleWordDelete(${globalIndex})" title="${isDeleted ? '恢复' : '删除'}">
                                        ${isDeleted ? '↶' : '×'}
                                    </button>
                                </div>
                            `;
            }).join('')}
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;

        // 添加批量操作按钮
        this.addBatchOperationButtons(container);
    }

    /**
     * 按首字母分组单词
     * @param {Array} words - 单词数组
     * @returns {Object} 分组结果
     */
    groupWordsByFirstLetter(words) {
        const groups = {};

        words.forEach(word => {
            const firstLetter = word[0].toLowerCase();
            if (!groups[firstLetter]) {
                groups[firstLetter] = [];
            }
            groups[firstLetter].push(word);
        });

        // 按字母顺序排序
        const sortedGroups = {};
        Object.keys(groups).sort().forEach(key => {
            sortedGroups[key] = groups[key].sort();
        });

        return sortedGroups;
    }

    /**
     * 显示导出选项
     */
    showExportOptions() {
        const exportContainer = document.getElementById('exportContainer');
        exportContainer.style.display = this.filteredWords.length > 0 ? 'block' : 'none';
    }

    /**
     * 导出结果
     * @param {string} format - 导出格式 ('txt' 或 'excel')
     */
    async exportResults(format) {
        const activeWords = this.getActiveWords();

        if (activeWords.length === 0) {
            this.showMessage('没有可导出的结果', 'warning');
            return;
        }

        try {
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const ruleName = document.getElementById('ruleSelect').value;
            const filename = `filtered_words_${ruleName}_${timestamp}`;

            // 准备导出信息
            const exportInfo = {
                sourceFile: this.currentFile ? this.currentFile.name : '未知文件',
                totalWords: this.currentWords.length,
                ruleName: this.ruleEngine.getRuleName(ruleName) || ruleName,
                filteredCount: this.filteredWords.length,
                deletedCount: this.deletedWords.size,
                exportedCount: activeWords.length
            };

            if (format === 'txt') {
                await this.fileUtils.exportToText(activeWords, `${filename}.txt`, exportInfo);
            } else if (format === 'excel') {
                await this.fileUtils.exportToExcel(activeWords, `${filename}.xlsx`, exportInfo);
            }

            this.showMessage(`结果已导出为 ${format.toUpperCase()} 文件 (${activeWords.length}个单词)`, 'success');

        } catch (error) {
            if (error.name === 'AbortError') {
                // 用户取消操作，不显示任何消息
                return;
            }
            console.error('导出错误:', error);
            this.showMessage(`导出失败: ${error.message}`, 'error');
        }
    }

    // 规则管理功能已移至独立页面 rule-manager.html

    /**
     * 打开帮助
     */
    openHelp() {
        this.showModal('helpModal');
    }

    /**
     * 显示模态框
     * @param {string} modalId - 模态框ID
     */
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    /**
     * 关闭模态框
     * @param {Element} modal - 模态框元素
     */
    closeModal(modal) {
        modal.classList.remove('show');
        document.body.style.overflow = 'auto';
    }

    // 规则保存和测试功能已移至独立页面

    /**
     * 加载保存的规则
     */
    loadSavedRules() {
        this.ruleEngine.loadSavedRules();
    }

    /**
     * 更新规则选择器
     */
    updateRuleSelector() {
        const ruleSelect = document.getElementById('ruleSelect');
        const ruleNames = this.ruleEngine.getRuleNames();

        // 清空现有选项
        ruleSelect.innerHTML = '<option value="">请选择规则</option>';

        // 添加规则选项
        ruleNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            ruleSelect.appendChild(option);
        });
    }

    // 规则编辑和删除功能已移至独立页面

    /**
     * 处理键盘快捷键
     * @param {KeyboardEvent} event - 键盘事件
     */
    handleKeyboardShortcuts(event) {
        // Ctrl+G: 生成结果
        if (event.ctrlKey && event.key === 'g') {
            event.preventDefault();
            this.generateResults();
        }

        // Ctrl+R: 打开规则管理器（跳转到独立页面）
        if (event.ctrlKey && event.key === 'r') {
            event.preventDefault();
            window.location.href = 'rule-manager.html';
        }

        // F1: 打开帮助
        if (event.key === 'F1') {
            event.preventDefault();
            this.openHelp();
        }

        // Esc: 关闭模态框
        if (event.key === 'Escape') {
            const openModal = document.querySelector('.modal.show');
            if (openModal) {
                this.closeModal(openModal);
            }
        }
    }

    /**
     * 显示加载指示器
     * @param {string} message - 加载消息
     */
    showLoading(message = '加载中...') {
        const loadingDiv = document.getElementById('loadingIndicator');
        const messageP = loadingDiv.querySelector('p');
        messageP.textContent = message;
        loadingDiv.style.display = 'flex';
    }

    /**
     * 隐藏加载指示器
     */
    hideLoading() {
        const loadingDiv = document.getElementById('loadingIndicator');
        loadingDiv.style.display = 'none';
    }

    /**
     * 显示文件预处理信息
     * @param {Object} fileResult - 文件处理结果
     */
    showPreprocessingInfo(fileResult) {
        const section = document.getElementById('preprocessingSection');
        const extractedWordsEl = document.getElementById('extractedWords');
        const validWordsEl = document.getElementById('validWords');
        const duplicateWordsEl = document.getElementById('duplicateWords');
        const invalidWordsEl = document.getElementById('invalidWords');
        const examplesEl = document.getElementById('invalidWordsExamples');

        // 显示统计信息
        extractedWordsEl.textContent = fileResult.totalExtracted || 0;
        validWordsEl.textContent = fileResult.validCount || 0;
        duplicateWordsEl.textContent = fileResult.duplicateCount || 0;
        invalidWordsEl.textContent = fileResult.invalidCount || 0;

        // 显示无效单词示例
        examplesEl.innerHTML = '';
        if (fileResult.invalidWords && fileResult.invalidWords.length > 0) {
            fileResult.invalidWords.forEach(word => {
                const wordSpan = document.createElement('span');
                wordSpan.className = 'invalid-word';
                wordSpan.textContent = word;
                examplesEl.appendChild(wordSpan);
            });
        } else {
            examplesEl.innerHTML = '<span style="color: #2e7d32;">无无效单词</span>';
        }

        // 显示预处理信息区域
        section.style.display = 'block';
    }

    /**
     * 切换单词删除状态
     * @param {number} index - 单词在filteredWords中的索引
     */
    toggleWordDelete(index) {
        if (this.deletedWords.has(index)) {
            this.deletedWords.delete(index);
        } else {
            this.deletedWords.add(index);
        }

        // 更新显示
        this.updateResultStats();
        this.displayWordList();
    }

    /**
     * 添加批量操作按钮
     * @param {HTMLElement} container - 容器元素
     */
    addBatchOperationButtons(container) {
        const batchDiv = document.createElement('div');
        batchDiv.className = 'batch-operations';
        batchDiv.innerHTML = `
            <div class="batch-buttons">
                <button class="btn btn-warning" onclick="app.deleteAllWords()">全部删除</button>
                <button class="btn btn-info" onclick="app.restoreAllWords()">全部恢复</button>
                <button class="btn btn-secondary" onclick="app.clearDeleted()">清除已删除</button>
            </div>
        `;
        container.appendChild(batchDiv);
    }

    /**
     * 删除所有单词
     */
    deleteAllWords() {
        for (let i = 0; i < this.filteredWords.length; i++) {
            this.deletedWords.add(i);
        }
        this.updateResultStats();
        this.displayWordList();
        this.showMessage('已删除所有单词', 'info');
    }

    /**
     * 恢复所有单词
     */
    restoreAllWords() {
        this.deletedWords.clear();
        this.updateResultStats();
        this.displayWordList();
        this.showMessage('已恢复所有单词', 'info');
    }

    /**
     * 清除已删除的单词（从列表中移除）
     */
    clearDeleted() {
        if (this.deletedWords.size === 0) {
            this.showMessage('没有已删除的单词', 'warning');
            return;
        }

        const deletedCount = this.deletedWords.size;

        // 创建新的筛选结果，排除已删除的单词
        this.filteredWords = this.filteredWords.filter((word, index) => !this.deletedWords.has(index));

        // 清空删除记录
        this.deletedWords.clear();

        // 更新显示
        this.updateResultStats();
        this.displayWordList();

        this.showMessage(`已清除 ${deletedCount} 个已删除的单词`, 'success');
    }

    /**
     * 获取有效单词（未删除的单词）
     * @returns {Array} 有效单词数组
     */
    getActiveWords() {
        return this.filteredWords.filter((word, index) => !this.deletedWords.has(index));
    }

    /**
     * 显示消息提示
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型 ('success', 'error', 'warning', 'info')
     */
    showMessage(message, type = 'info') {
        const messageContainer = document.getElementById('messageContainer');

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;

        messageContainer.appendChild(messageDiv);

        // 自动移除消息
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 3000);
    }

    /**
     * 导出规则到文件
     */
    async exportRules() {
        try {
            const success = await this.ruleEngine.exportRulesToFile();
            if (success) {
                this.showMessage('规则导出成功！', 'success');
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                // 用户取消操作，不显示任何消息
                return;
            }
            console.error('导出规则失败:', error);
            this.showMessage('导出规则失败: ' + error.message, 'error');
        }
    }

    /**
     * 从文件导入规则
     */
    importRules() {
        try {
            this.ruleEngine.importRulesFromFile();

            // 监听规则更新事件
            window.addEventListener('rulesUpdated', () => {
                this.updateRuleSelector();
                this.showMessage('规则导入成功！', 'success');
            }, { once: true });
        } catch (error) {
            console.error('导入规则失败:', error);
            this.showMessage('导入规则失败: ' + error.message, 'error');
        }
    }
}

// 初始化应用程序
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new WordFilterApp();
});