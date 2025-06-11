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
        this.currentRule = null; // 当前活动规则
        this.deletedWords = new Set(); // 存储已删除单词的索引
        this.searchTerm = '';
        this.showDeleted = false;
        this.searchHistory = [];

        this.initializeApp();
    }

    /**
     * 初始化应用程序
     */
    initializeApp() {
        this.bindEvents();
        this.loadSavedRules();
        this.ruleEngine.loadSavedRules(); // 确保规则引擎也加载了规则
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

        // 移除定时检查，改为点击时检查
        // this.ruleCheckInterval = setInterval(() => {
        //     this.checkAndUpdateRules();
        // }, 2000);
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

        // 在点击规则选择框时刷新规则列表
        ruleSelect.addEventListener('click', () => {
            this.checkAndUpdateRules();
        });

        // 在规则选择框获得焦点时刷新规则列表
        ruleSelect.addEventListener('focus', () => {
            this.checkAndUpdateRules();
        });

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

        // 绑定搜索框事件
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value.toLowerCase();
                this.displayWordList();
                this.updateResultStats();
            });

            // 添加搜索历史功能
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && this.searchTerm.trim()) {
                    this.addToSearchHistory(this.searchTerm.trim());
                }
            });
        }

        // 绑定显示已删除单词复选框事件
        const showDeletedCheckbox = document.getElementById('showDeletedCheckbox');
        if (showDeletedCheckbox) {
            showDeletedCheckbox.addEventListener('change', (e) => {
                this.showDeleted = e.target.checked;
                this.displayWordList();
                this.updateResultStats();
            });
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

        // 选中后 select 框显示的内容也做截断
        ruleSelect.addEventListener('change', function () {
            const selectedOption = ruleSelect.options[ruleSelect.selectedIndex];
            if (selectedOption) {
                ruleSelect.title = selectedOption.title; // 鼠标悬停显示完整内容
            }
        });
    }

    /**
     * 处理文件选择
     * @param {Event} event - 文件选择事件
     */
    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) {
            this.hideFileInfo();
            this.hidePreprocessingInfo();
            return;
        }

        try {
            // 在开始处理新文件前，先隐藏之前的预处理信息
            this.hidePreprocessingInfo();

            // 验证文件格式
            if (!this.fileUtils.isSupportedFormat(file)) {
                throw new Error('不支持的文件格式。请选择 .txt、.xlsx、.xls 或 .csv 文件。');
            }

            // 验证文件大小
            if (!this.fileUtils.validateFileSize(file, 10)) {
                throw new Error('文件大小超过限制（最大 10MB）。');
            }

            this.showLoading('正在读取文件...');

            // 读取文件
            const fileResult = await this.fileUtils.readFile(file);

            // 调试信息
            console.log('文件读取结果:', fileResult);

            // 确保 currentWords 被正确设置
            this.currentWords = Array.isArray(fileResult.words) ? fileResult.words : [];
            this.currentFile = file;
            this.fileStats = fileResult.invalidCount !== undefined ? fileResult : null;

            // 加载删除状态
            this.loadDeletedWordsState();

            // 加载搜索历史
            this.loadSearchHistory();

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

            // 调试信息
            console.log('文件选择后的状态:', {
                currentWords: this.currentWords,
                currentFile: this.currentFile,
                fileStats: this.fileStats
            });

        } catch (error) {
            console.error('文件读取错误:', error);
            this.showMessage(`文件读取失败: ${error.message}`, 'error');
            this.hideFileInfo();
            this.hidePreprocessingInfo();
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

        // 调试信息
        console.log('规则选择变化:', ruleName);

        if (ruleName) {
            // 确保规则存在
            const rule = this.ruleEngine.getRule(ruleName);
            if (rule) {
                this.showRulePreview(ruleName);
                // 滚动到规则区域
                document.querySelector('.rule-section').scrollIntoView({ behavior: 'smooth' });
            } else {
                this.hideRulePreview();
                this.showMessage('规则不存在', 'error');
                // 重置选择器
                event.target.value = '';
            }
        } else {
            this.hideRulePreview();
        }

        // 更新生成按钮状态
        this.updateGenerateButton();

        // 调试信息
        console.log('规则选择变化后的按钮状态:', {
            hasFile: this.currentWords && this.currentWords.length > 0,
            ruleName: ruleName,
            hasRule: ruleName && this.ruleEngine.getRule(ruleName)
        });
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

            // 设置当前活动规则
            this.currentRule = this.ruleEngine.getRule(ruleName);

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
        // 重新加载全局集合以确保同步
        this.ruleEngine.loadSavedGlobalSets();

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
        const hasFile = this.currentWords && this.currentWords.length > 0;
        const ruleName = document.getElementById('ruleSelect').value;
        const hasRule = ruleName && this.ruleEngine.getRule(ruleName);

        generateBtn.disabled = !hasFile || !hasRule;

        // 调试信息
        console.log('更新生成按钮状态:', {
            hasFile,
            ruleName,
            hasRule,
            disabled: !hasFile || !hasRule
        });
    }

    /**
     * 显示筛选结果
     */
    displayResults() {
        // 更新统计信息
        this.updateResultStats();

        // 显示单词列表
        this.displayWordList();

        // 控制搜索框显示
        this.toggleSearchControls();

        // 显示导出选项
        this.showExportOptions();

        // 重置预览区滚动条位置到顶部
        const resultContainer = document.getElementById('resultContainer');
        if (resultContainer) {
            resultContainer.scrollTop = 0;
        }

        // 滚动到结果区域
        document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });
    }

    /**
     * 更新结果统计
     */
    updateResultStats() {
        const totalWords = this.currentWords.length;
        const filteredCount = this.filteredWords.length;

        // 应用搜索过滤
        const searchFilteredWords = this.filterWords(this.filteredWords);
        const searchFilteredCount = searchFilteredWords.length;

        // 计算删除的单词数（在搜索结果中）
        const deletedInSearchCount = searchFilteredWords.filter(word => {
            const originalIndex = this.filteredWords.indexOf(word);
            return this.deletedWords.has(originalIndex);
        }).length;

        const activeCount = searchFilteredCount - deletedInSearchCount;
        const filterRate = totalWords > 0 ? ((activeCount / totalWords) * 100).toFixed(1) : 0;

        document.getElementById('totalWords').textContent = totalWords;

        if (this.searchTerm) {
            document.getElementById('filteredWords').textContent = `${activeCount}${deletedInSearchCount > 0 ? ` (${deletedInSearchCount}已删除)` : ''} / 搜索结果: ${searchFilteredCount}`;
        } else {
            const totalDeletedCount = this.deletedWords.size;
            document.getElementById('filteredWords').textContent = `${filteredCount - totalDeletedCount}${totalDeletedCount > 0 ? ` (${totalDeletedCount}已删除)` : ''}`;
        }

        document.getElementById('filterRate').textContent = `${filterRate}%`;
    }

    /**
     * 根据搜索词和显示设置过滤单词
     * @param {Array} words - 要过滤的单词数组
     * @returns {Array} 过滤后的单词数组
     */
    filterWords(words) {
        let filtered = words;

        // 根据搜索词过滤
        if (this.searchTerm) {
            filtered = filtered.filter(word =>
                word.toLowerCase().includes(this.searchTerm)
            );
        }

        return filtered;
    }

    /**
     * 高亮搜索关键词
     * @param {string} text - 要高亮的文本
     * @returns {string} 高亮后的HTML
     */
    highlightSearchTerm(text) {
        if (!this.searchTerm) {
            return text;
        }

        const regex = new RegExp(`(${this.searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
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

        // 应用搜索过滤
        const searchFilteredWords = this.filterWords(this.filteredWords);

        if (searchFilteredWords.length === 0) {
            container.innerHTML = '<p class="no-results">没有找到匹配的单词</p>';
            return;
        }

        // 根据当前规则决定是否分组
        let groupedWords = null;
        const rule = this.ruleEngine.getRule(this.currentRule);
        if (rule && rule.displayRule && rule.displayRule.startsWith('@')) {
            // 正确处理@@前缀（严格相邻匹配）和@前缀（松散匹配）
            const sortRule = rule.displayRule.startsWith('@@') ? rule.displayRule.substring(2) : rule.displayRule.substring(1);
            const parseResult = this.ruleEngine.parseSortRule(sortRule);
            if (!parseResult.hasNonGrouping) {
                groupedWords = this.groupWordsByFirstLetter(searchFilteredWords);
            }
        } else {
            // 没有排序规则时，按首字母分组
            groupedWords = this.groupWordsByFirstLetter(searchFilteredWords);
        }

        let html = '';

        if (groupedWords === null) {
            // 不分组显示，直接列出所有单词
            const displayWords = searchFilteredWords.map(word => {
                const originalIndex = this.filteredWords.indexOf(word);
                const isDeleted = this.deletedWords.has(originalIndex);
                return { word, originalIndex, isDeleted };
            }).filter(item => this.showDeleted || !item.isDeleted);

            const activeWords = displayWords.filter(item => !item.isDeleted);

            html += `
                <div class="word-group">
                    <div class="group-title level-0">
                        单词列表 (${activeWords.length}/${displayWords.length})
                    </div>
                    <div class="word-list">
                        ${displayWords.map(item => {
                return `
                                <div class="word-item ${item.isDeleted ? 'deleted' : ''}" data-index="${item.originalIndex}">
                                    <span class="word-text">${this.highlightSearchTerm(item.word)}</span>
                                    <button class="delete-btn" onclick="app.toggleWordDelete(${item.originalIndex})" title="${item.isDeleted ? '恢复' : '删除'}">
                                        ${item.isDeleted ? '↶' : '×'}
                                    </button>
                                </div>
                            `;
            }).join('')}
                    </div>
                </div>
            `;
        } else {
            // 分组显示
            html += this.renderWordGroups(groupedWords, 0);
        }

        container.innerHTML = html;

        // 加载折叠状态
        this.loadCollapseStates();
    }

    /**
     * 递归渲染单词分组
     * @param {Object} groups - 分组对象
     * @param {number} level - 分组层级
     * @param {Array} parentLabels - 父级分组标签
     * @returns {string} HTML字符串
     */
    renderWordGroups(groups, level = 0, parentLabels = []) {
        let html = '';

        for (const [groupName, content] of Object.entries(groups)) {
            // 构建当前分组的完整标签
            let displayLabel = groupName;

            // 如果有父级标签，则按"一级标签 > 二级标签 > 三级标签"格式显示
            if (parentLabels.length > 0) {
                const allLabels = [...parentLabels, groupName];
                displayLabel = allLabels.join(' > ');
            }

            // 检查content是否为数组（单词列表）还是对象（子分组）
            if (Array.isArray(content)) {
                // 这是最终的单词列表
                const displayWords = content.map(word => {
                    const globalIndex = this.filteredWords.indexOf(word);
                    const isDeleted = this.deletedWords.has(globalIndex);
                    return { word, globalIndex, isDeleted };
                }).filter(item => this.showDeleted || !item.isDeleted);

                const activeWords = displayWords.filter(item => !item.isDeleted);

                const groupId = `group-${level}-${groupName.replace(/[^a-zA-Z0-9]/g, '')}-${Math.random().toString(36).substr(2, 9)}`;
                html += `
                    <div class="word-group" style="margin-left: 0px;">
                        <div class="group-title level-${level} collapsible" onclick="app.toggleGroupCollapse('${groupId}')">
                            ${displayLabel} (${activeWords.length}/${displayWords.length})
                        </div>
                        <div class="word-list" id="${groupId}">
                            ${displayWords.map(item => {
                    return `
                                    <div class="word-item ${item.isDeleted ? 'deleted' : ''}" data-index="${item.globalIndex}">
                                        <span class="word-text">${this.highlightSearchTerm(item.word)}</span>
                                        <button class="delete-btn" onclick="app.toggleWordDelete(${item.globalIndex})" title="${item.isDeleted ? '恢复' : '删除'}">
                                            ${item.isDeleted ? '↶' : '×'}
                                        </button>
                                    </div>
                                `;
                }).join('')}
                        </div>
                    </div>
                `;
            } else {
                // 这是子分组，需要递归处理
                const totalWords = this.countWordsInGroup(content);
                const activeWords = this.countActiveWordsInGroup(content);

                // 添加当前分组标签到父级标签列表，用于子分组
                const currentLabels = [...parentLabels, groupName];

                const groupId = `group-${level}-${groupName.replace(/[^a-zA-Z0-9]/g, '')}-${Math.random().toString(36).substr(2, 9)}`;
                html += `
                    <div class="word-group" style="margin-left: 0px;">
                        <div class="group-title level-${level} collapsible" onclick="app.toggleGroupCollapse('${groupId}')">
                            ${displayLabel} (${activeWords}/${totalWords})
                        </div>
                        <div class="sub-groups" id="${groupId}">
                            ${this.renderWordGroups(content, level + 1, currentLabels)}
                        </div>
                    </div>
                `;
            }
        }

        return html;
    }

    /**
     * 递归计算分组中的总单词数
     * @param {Object} group - 分组对象
     * @returns {number} 单词总数
     */
    countWordsInGroup(group) {
        let count = 0;
        for (const content of Object.values(group)) {
            if (Array.isArray(content)) {
                count += content.length;
            } else {
                count += this.countWordsInGroup(content);
            }
        }
        return count;
    }

    /**
     * 递归计算分组中的活跃单词数（未删除）
     * @param {Object} group - 分组对象
     * @returns {number} 活跃单词数
     */
    countActiveWordsInGroup(group) {
        let count = 0;
        for (const content of Object.values(group)) {
            if (Array.isArray(content)) {
                count += content.filter(word => {
                    const globalIndex = this.filteredWords.indexOf(word);
                    return !this.deletedWords.has(globalIndex);
                }).length;
            } else {
                count += this.countActiveWordsInGroup(content);
            }
        }
        return count;

        // 批量操作按钮现在在导出区域，这里不再添加
    }

    /**
     * 按首字母分组单词
     * @param {Array} words - 单词数组
     * @returns {Object} 分组结果
     */
    groupWordsByFirstLetter(words) {
        // 获取当前选中的规则
        const ruleName = document.getElementById('ruleSelect').value;
        const rule = this.ruleEngine.getRule(ruleName);

        // 检查是否有排序规则
        if (rule && rule.displayRule && rule.displayRule.startsWith('@') && rule.displayRule.length > 1) {
            // 正确处理@@前缀（严格相邻匹配）和@前缀（松散匹配）
            const sortRule = rule.displayRule.startsWith('@@') ? rule.displayRule.substring(2) : rule.displayRule.substring(1);

            // 特殊处理：@! 和 @!- 表示不分组的排序，直接返回单词列表不分组
            if (sortRule === '!' || sortRule === '!-') {
                const descending = sortRule === '!-';
                const sortedWords = this.ruleEngine.sortByAlphabet(words, descending);
                return { '单词列表': sortedWords };
            }

            // 如果有集合排序规则，按集合分组
            if (sortRule !== '-' && sortRule !== '') {
                // 传入完整的displayRule，让groupWordsBySetRule内部处理@@前缀
                return this.groupWordsBySetRule(words, rule.displayRule, ruleName);
            }
        }

        // 处理@-逆序或@正序的情况
        if (rule && rule.displayRule && rule.displayRule.startsWith('@')) {
            // 正确处理@@前缀（严格相邻匹配）和@前缀（松散匹配）
            const sortRule = rule.displayRule.startsWith('@@') ? rule.displayRule.substring(2) : rule.displayRule.substring(1);
            if (sortRule === '-' || sortRule === '') {
                // 使用ruleEngine的applySorting方法处理排序
                const sortedWords = this.ruleEngine.applySorting(words, rule.displayRule, rule.localSets);

                // 按首字母分组已排序的单词
                const groups = {};
                sortedWords.forEach(word => {
                    const firstLetter = word[0].toLowerCase();
                    if (!groups[firstLetter]) {
                        groups[firstLetter] = [];
                    }
                    groups[firstLetter].push(word);
                });

                return groups;
            }
        }

        // 默认按首字母分组
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
            sortedGroups[key] = groups[key].sort((a, b) => this.ruleEngine.compareWords(a, b));
        });

        return sortedGroups;
    }

    /**
     * 按集合规则分组单词
     * @param {Array} words - 单词数组
     * @param {string|Array} sortRule - 排序规则字符串或解析后的规则数组
     * @param {string} ruleName - 规则名称
     * @param {Array} parentLabels - 父级分组标签数组，用于构建多级标签
     * @returns {Object} 分组后的单词对象
     */
    groupWordsBySetRule(words, sortRule, ruleName, parentLabels = []) {
        const groups = {};

        // 解析排序规则（如果传入的是字符串）
        let sortGroups;
        let hasNonGrouping = false;
        let isAdjacent = false;

        if (Array.isArray(sortRule)) {
            sortGroups = sortRule;
        } else {
            // 如果sortRule以@开头，需要先处理前缀
            let actualSortRule = sortRule;
            if (sortRule.startsWith('@')) {
                // 正确处理@@前缀（严格相邻匹配）和@前缀（松散匹配）
                actualSortRule = sortRule.startsWith('@@') ? sortRule.substring(2) : sortRule.substring(1);
            }

            const parseResult = this.ruleEngine.parseSortRule(actualSortRule);
            sortGroups = parseResult.groups;
            hasNonGrouping = parseResult.hasNonGrouping;
            isAdjacent = parseResult.isAdjacent;

            // 如果原始sortRule以@@开头，强制设置isAdjacent为true
            if (sortRule.startsWith('@@')) {
                isAdjacent = true;
            }

            // 添加调试信息
            // Debug logs removed for performance
        }

        if (sortGroups.length === 0) {
            return this.groupWordsByFirstLetter(words);
        }

        // 获取当前规则的局部集合
        const rule = this.ruleEngine.getRule(ruleName);
        const localSets = rule ? rule.localSets : new Map();

        // 使用第一个集合进行分组
        const primarySet = sortGroups[0];

        // 检查是否需要分组（排序开关可能导致第一个元素就不分组）
        if (primarySet.nonGrouping) {
            // 第一个元素就标记为不分组，则不按集合分组，按字母顺序排序
            const sortedWords = words.sort((a, b) => this.ruleEngine.compareWords(a, b));
            return { '单词列表': sortedWords };
        }

        const set = this.ruleEngine.getSet(primarySet.setName, localSets);

        if (!set) {
            // 如果集合不存在，按首字母分组
            return this.groupWordsByFirstLetter(words);
        }

        // 获取集合元素并排序（用于显示顺序）
        const setElements = Array.from(set).sort((a, b) => {
            const comparison = a.localeCompare(b);
            return primarySet.descending ? -comparison : comparison;
        });

        // 为每个集合元素创建分组
        setElements.forEach(element => {
            groups[element] = [];
        });

        // 添加"其他"分组
        groups['其他'] = [];

        // 将单词分配到对应的分组
        words.forEach(word => {
            const lowerWord = word.toLowerCase();
            let matched = false;

            // 如果是严格紧邻模式(@@)且有多个排序元素，需要特殊处理
            if (isAdjacent && sortGroups.length >= 2) {
                // Debug logs removed for performance

                // 使用findAdjacentMatch来确定严格紧邻模式下的匹配
                const result = this.ruleEngine.findAdjacentMatch(word, [primarySet, sortGroups[1]], localSets);

                if (result.success) {
                    // 匹配成功，将单词添加到第一个匹配元素的分组中
                    const matchedElement = result.groupKeys[0];
                    // 找到对应的原始集合元素（保持大小写）
                    const originalElement = setElements.find(el => el.toLowerCase() === matchedElement);
                    if (originalElement) {
                        groups[originalElement].push(word);
                        matched = true;
                    }
                }
                // 在严格紧邻模式下，如果两个元素不能紧邻匹配，则不进行任何匹配
                // 该单词将被归入"其他"分组，因为它不满足严格紧邻的要求
            } else {
                // 宽松模式下，使用统一的匹配策略，优先匹配较长的元素
                const sortedElementsForMatching = [...setElements].sort((a, b) => b.length - a.length);

                // 根据位置标识符进行匹配
                for (const element of sortedElementsForMatching) {
                    const elementLower = element.toLowerCase();
                    let found = false;

                    // 根据位置标识符使用不同的匹配策略
                    switch (primarySet.positionFlag) {
                        case '^': // 前缀匹配
                            found = lowerWord.startsWith(elementLower);
                            break;
                        case '$': // 后缀匹配
                            found = lowerWord.endsWith(elementLower);
                            break;
                        case '*': // 包含匹配
                            found = lowerWord.includes(elementLower);
                            break;
                        case '~': // 严格中间匹配
                            const index = lowerWord.indexOf(elementLower);
                            found = index > 0 && index + elementLower.length < lowerWord.length;
                            break;
                    }

                    if (found) {
                        groups[element].push(word);
                        matched = true;
                        break;
                    }
                }
            }

            if (!matched) {
                groups['其他'].push(word);
            }
        });

        // 移除空分组并处理多级分组
        Object.keys(groups).forEach(key => {
            if (groups[key].length === 0) {
                delete groups[key];
            } else {
                // 如果还有更多的排序规则，检查是否需要继续分组
                if (sortGroups.length > 1) {
                    // 检查剩余的排序规则中是否还有需要分组的元素
                    const remainingSortGroups = isAdjacent ? sortGroups.slice(2) : sortGroups.slice(1);
                    const hasGroupingElements = remainingSortGroups.some(group => !group.nonGrouping);

                    if (hasGroupingElements) {
                        // 还有需要分组的元素，继续递归分组
                        if (isAdjacent) {
                            // 如果有超过2个排序元素，仍需继续处理
                            if (sortGroups.length > 2) {
                                // 创建当前级别的分组标签
                                const currentLevelLabels = [...parentLabels, key];

                                // 传递第三个及之后的排序规则数组和累积的分组标签
                                groups[key] = this.groupWordsBySetRule(
                                    groups[key],
                                    remainingSortGroups,
                                    ruleName,
                                    currentLevelLabels
                                );
                            } else {
                                // 只有两个排序元素，直接排序不再分组
                                groups[key].sort((a, b) => this.ruleEngine.compareWords(a, b));
                            }
                        } else {
                            // 非严格紧邻模式，正常处理
                            // 创建当前级别的分组标签
                            const currentLevelLabels = [...parentLabels, key];

                            // 直接传递剩余的排序规则数组和累积的分组标签
                            groups[key] = this.groupWordsBySetRule(
                                groups[key],
                                remainingSortGroups,
                                ruleName,
                                currentLevelLabels
                            );
                        }
                    } else {
                        // 剩余元素都被分组开关影响，只排序不分组
                        const sortedWords = this.ruleEngine.sortBySetGroups(
                            groups[key],
                            this.constructSortRuleString(remainingSortGroups, isAdjacent),
                            localSets
                        );
                        groups[key] = sortedWords;
                    }
                } else {
                    // 最后一级，对单词进行排序
                    groups[key].sort((a, b) => this.ruleEngine.compareWords(a, b));
                }
            }
        });

        return groups;
    }

    /**
     * 构造排序规则字符串
     * @param {Array} sortGroups - 排序组数组
     * @param {boolean} isAdjacent - 是否为紧邻模式
     * @returns {string} 排序规则字符串
     */
    constructSortRuleString(sortGroups, isAdjacent) {
        if (!sortGroups || sortGroups.length === 0) {
            return '';
        }

        let prefix = isAdjacent ? '@@' : '@';
        let ruleString = '';

        for (const group of sortGroups) {
            if (group.descending) {
                ruleString += '-';
            }

            // 检查是否需要括号
            if (group.setName.length > 1 || group.positionFlag) {
                ruleString += `(${group.setName}${group.positionFlag || ''})`;
            } else {
                ruleString += group.setName;
            }
        }

        return prefix + ruleString;
    }

    /**
     * 显示导出选项
     */
    showExportOptions() {
        const exportContainer = document.getElementById('exportContainer');
        exportContainer.style.display = this.filteredWords.length > 0 ? 'block' : 'none';

        // 添加批量操作按钮到导出区域
        this.addBatchOperationButtonsInline();
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
            const rule = this.ruleEngine.getRule(ruleName);
            const exportInfo = {
                sourceFile: this.currentFile ? this.currentFile.name : '未知文件',
                totalWords: this.currentWords.length,
                ruleName: this.ruleEngine.getRuleName(ruleName) || ruleName,
                ruleComment: rule ? rule.comment : '',
                filteredCount: this.filteredWords.length,
                deletedCount: this.deletedWords.size,
                exportedCount: activeWords.length
            };

            // 获取分组信息 - 使用与页面显示相同的逻辑
            let groupedWords = null;
            let hasNonGrouping = false;

            if (rule && rule.displayRule && rule.displayRule.startsWith('@')) {
                // 正确处理@@前缀（严格相邻匹配）和@前缀（松散匹配）
                const sortRule = rule.displayRule.startsWith('@@') ? rule.displayRule.substring(2) : rule.displayRule.substring(1);
                const parseResult = this.ruleEngine.parseSortRule(sortRule);
                hasNonGrouping = parseResult.hasNonGrouping;
        

                // 严格排序模式（@@前缀）：只按首字母分组，不使用集合分组
                if (rule.displayRule.startsWith('@@')) {
                    if (!parseResult.hasNonGrouping) {
                        groupedWords = this.groupWordsByFirstLetter(this.filteredWords);
                    }
                } else {
                    // 松散排序模式（@前缀）：按集合规则分组
                    // 特殊处理：@! 和 @!- 表示不分组的排序
                    if (sortRule === '!' || sortRule === '!-') {
                        groupedWords = null;
                    } else if (sortRule !== '-' && sortRule !== '') {
                        // 如果有集合排序规则，按集合分组
                        // 注意：即使有!标志，也要按!之前的部分进行分组
                        groupedWords = this.groupWordsBySetRule(this.filteredWords, sortRule, ruleName);
                    } else {
                        // 没有排序规则时，按首字母分组
                        groupedWords = this.groupWordsByFirstLetter(this.filteredWords);
                    }
                }
            } else {
                // 没有排序规则时，按首字母分组
                groupedWords = this.groupWordsByFirstLetter(this.filteredWords);
            }

            if (format === 'txt') {
                await this.fileUtils.exportToText(activeWords, `${filename}.txt`, exportInfo, groupedWords, hasNonGrouping);
            } else if (format === 'excel') {
        
                await this.fileUtils.exportToExcel(activeWords, `${filename}.xlsx`, exportInfo, groupedWords, hasNonGrouping);
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
        // 确保规则加载完成后再更新选择器
        this.updateRuleSelector();
        // 更新生成按钮状态
        this.updateGenerateButton();
    }

    /**
     * 更新规则选择器
     */
    updateRuleSelector() {
        const ruleSelect = document.getElementById('ruleSelect');
        const ruleNames = this.ruleEngine.getRuleNames();

        // 清空现有选项
        ruleSelect.innerHTML = '<option value="">请选择规则</option>';

        // 获取保存的规则排序
        const savedOrder = this.loadRuleOrder();

        // 按保存的顺序排序规则
        const orderedRules = [];
        savedOrder.forEach(name => {
            if (ruleNames.includes(name)) {
                orderedRules.push(name);
            }
        });
        ruleNames.forEach(name => {
            if (!orderedRules.includes(name)) {
                orderedRules.push(name);
            }
        });

        // 动态截断函数
        function getTruncatedText(text, maxWidth, font) {
            if (!text) return '';
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.font = font || '16px Arial';
            if (ctx.measureText(text).width <= maxWidth) return text;
            let truncated = '';
            for (let i = 0; i < text.length; i++) {
                let test = truncated + text[i];
                if (ctx.measureText(test + '...').width > maxWidth) break;
                truncated = test;
            }
            return truncated + '...';
        }

        // 获取select宽度和字体
        const selectWidth = ruleSelect.offsetWidth || 200;
        const font = window.getComputedStyle(ruleSelect).font || '16px Arial';
        // 名字和注释各占一半宽度
        const nameWidth = selectWidth * 0.5;
        const commentWidth = selectWidth * 0.5;

        // 添加规则选项
        orderedRules.forEach(name => {
            const rule = this.ruleEngine.getRule(name);
            if (rule) {
                const option = document.createElement('option');
                option.value = name;

                // 动态截断
                let displayName = getTruncatedText(name, nameWidth, font);
                let displayComment = '';
                if (rule.comment) {
                    displayComment = getTruncatedText(rule.comment, commentWidth, font);
                }
                let displayText = displayName;
                if (displayComment) {
                    displayText += ` (${displayComment})`;
                }
                option.textContent = displayText;
                option.title = `${name}${rule.comment ? '（' + rule.comment + '）' : ''}`;
                ruleSelect.appendChild(option);
            }
        });

        // 选中后 select 框显示的内容也做截断，鼠标悬停显示完整内容
        ruleSelect.addEventListener('change', function () {
            const selectedOption = ruleSelect.options[ruleSelect.selectedIndex];
            if (selectedOption) {
                ruleSelect.title = selectedOption.title;
            }
        });
        // 初始化时也设置一次 title
        if (ruleSelect.selectedIndex >= 0) {
            const selectedOption = ruleSelect.options[ruleSelect.selectedIndex];
            if (selectedOption) {
                ruleSelect.title = selectedOption.title;
            }
        }

        // 响应式：窗口大小变化时重新渲染
        if (!ruleSelect._resizeHandlerAdded) {
            window.addEventListener('resize', () => this.updateRuleSelector());
            ruleSelect._resizeHandlerAdded = true;
        }
    }

    /**
     * 从本地存储加载规则排序
     */
    loadRuleOrder() {
        const savedOrder = localStorage.getItem('ruleOrder');
        if (savedOrder) {
            try {
                return JSON.parse(savedOrder);
            } catch (e) {
                console.warn('Failed to parse saved rule order:', e);
            }
        }
        return [];
    }

    /**
     * 保存规则排序到本地存储
     * @param {Array} ruleOrder - 规则排序数组
     */
    saveRuleOrder(ruleOrder) {
        localStorage.setItem('ruleOrder', JSON.stringify(ruleOrder));
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
     * 隐藏文件预处理信息
     */
    hidePreprocessingInfo() {
        const section = document.getElementById('preprocessingSection');
        if (section) {
            section.style.display = 'none';
        }
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

        // 保存删除状态到localStorage
        this.saveDeletedWordsState();

        // 更新显示
        this.updateResultStats();
        this.displayWordList();
    }

    /**
     * 保存删除状态到localStorage
     */
    saveDeletedWordsState() {
        if (this.currentFile) {
            const key = `deletedWords_${this.currentFile.name}`;
            const deletedWordsArray = Array.from(this.deletedWords);
            localStorage.setItem(key, JSON.stringify(deletedWordsArray));
        }
    }

    /**
     * 从localStorage加载删除状态
     */
    loadDeletedWordsState() {
        if (this.currentFile) {
            const key = `deletedWords_${this.currentFile.name}`;
            const savedState = localStorage.getItem(key);
            if (savedState) {
                try {
                    const deletedWordsArray = JSON.parse(savedState);
                    this.deletedWords = new Set(deletedWordsArray);
                } catch (error) {
                    console.warn('加载删除状态失败:', error);
                    this.deletedWords = new Set();
                }
            } else {
                this.deletedWords = new Set();
            }
        }
    }

    /**
     * 添加搜索词到搜索历史
     * @param {string} searchTerm - 搜索词
     */
    addToSearchHistory(searchTerm) {
        // 移除重复项
        this.searchHistory = this.searchHistory.filter(term => term !== searchTerm);

        // 添加到开头
        this.searchHistory.unshift(searchTerm);

        // 限制历史记录数量
        if (this.searchHistory.length > 10) {
            this.searchHistory = this.searchHistory.slice(0, 10);
        }

        // 保存到localStorage
        this.saveSearchHistory();
    }

    /**
     * 保存搜索历史到localStorage
     */
    saveSearchHistory() {
        localStorage.setItem('searchHistory', JSON.stringify(this.searchHistory));
    }

    /**
     * 从localStorage加载搜索历史
     */
    loadSearchHistory() {
        try {
            const saved = localStorage.getItem('searchHistory');
            if (saved) {
                this.searchHistory = JSON.parse(saved);
            }
        } catch (error) {
            console.warn('加载搜索历史失败:', error);
            this.searchHistory = [];
        }
    }

    /**
     * 切换分组折叠状态
    * @param {string} groupId - 分组的ID
    */
    toggleGroupCollapse(groupId) {
        const groupContent = document.getElementById(groupId);
        const groupTitle = groupContent.previousElementSibling;

        if (groupContent && groupTitle) {
            if (groupContent.style.display === 'none') {
                // 根据元素类型恢复正确的显示模式
                if (groupContent.classList.contains('word-list')) {
                    groupContent.style.display = 'grid';
                } else {
                    groupContent.style.display = 'block';
                }
                groupTitle.classList.remove('collapsed');
            } else {
                groupContent.style.display = 'none';
                groupTitle.classList.add('collapsed');
            }

            // 保存折叠状态
            this.saveCollapseState(groupId, groupContent.style.display === 'none');
        }
    }

    /**
     * 保存折叠状态到localStorage
     * @param {string} groupId - 分组ID
     * @param {boolean} isCollapsed - 是否折叠
     */
    saveCollapseState(groupId, isCollapsed) {
        if (this.currentFile) {
            const key = `collapseState_${this.currentFile.name}`;
            let collapseStates = {};
            try {
                const saved = localStorage.getItem(key);
                if (saved) {
                    collapseStates = JSON.parse(saved);
                }
            } catch (error) {
                console.warn('加载折叠状态失败:', error);
            }

            collapseStates[groupId] = isCollapsed;
            localStorage.setItem(key, JSON.stringify(collapseStates));
        }
    }

    /**
     * 从localStorage加载折叠状态
     */
    loadCollapseStates() {
        if (this.currentFile) {
            const key = `collapseState_${this.currentFile.name}`;
            try {
                const saved = localStorage.getItem(key);
                if (saved) {
                    const collapseStates = JSON.parse(saved);

                    // 应用保存的折叠状态
                    setTimeout(() => {
                        for (const [groupId, isCollapsed] of Object.entries(collapseStates)) {
                            const groupContent = document.getElementById(groupId);
                            const groupTitle = groupContent?.previousElementSibling;

                            if (groupContent && groupTitle && isCollapsed) {
                                groupContent.style.display = 'none';
                                groupTitle.classList.add('collapsed');
                            }
                        }
                    }, 100); // 延迟执行确保DOM已渲染
                }
            } catch (error) {
                console.warn('加载折叠状态失败:', error);
            }
        }
    }

    /**
     * 添加批量操作按钮到导出区域
     */
    addBatchOperationButtonsInline() {
        const batchContainer = document.getElementById('batchOperationsInline');
        if (!batchContainer) return;

        // 清空之前的按钮
        batchContainer.innerHTML = '';

        // 只有在有筛选结果时才显示批量操作按钮
        if (this.filteredWords.length > 0) {
            batchContainer.innerHTML = `
                <button class="btn btn-danger" onclick="app.batchDeleteWords()">全部删除</button>
                <button class="btn btn-danger" onclick="app.batchRestoreWords()">全部恢复</button>
                <button class="btn btn-danger" onclick="app.batchClearWords()">清除已删除</button>
            `;
        }
    }

    /**
     * 添加批量操作按钮（保留原方法以防其他地方使用）
     * @param {HTMLElement} container - 容器元素
     */
    addBatchOperationButtons(container) {
        const batchDiv = document.createElement('div');
        batchDiv.className = 'batch-operations';
        batchDiv.innerHTML = `
            <div class="batch-buttons">
                <button class="btn btn-danger" onclick="app.batchDeleteWords()">全部删除</button>
                <button class="btn btn-danger" onclick="app.batchRestoreWords()">全部恢复</button>
                <button class="btn btn-danger" onclick="app.batchClearWords()">清除已删除</button>
            </div>
        `;
        container.appendChild(batchDiv);
    }

    /**
     * 批量删除单词
     */
    batchDeleteWords() {
        for (let i = 0; i < this.filteredWords.length; i++) {
            this.deletedWords.add(i);
        }

        // 保存删除状态到localStorage
        this.saveDeletedWordsState();

        this.updateResultStats();
        this.displayWordList();
        this.addBatchOperationButtonsInline(); // 更新按钮状态
        this.showMessage('已删除所有单词', 'info');
    }

    /**
     * 批量恢复单词
     */
    batchRestoreWords() {
        this.deletedWords.clear();

        // 保存删除状态到localStorage
        this.saveDeletedWordsState();

        this.updateResultStats();
        this.displayWordList();
        this.addBatchOperationButtonsInline(); // 更新按钮状态
        this.showMessage('已恢复所有单词', 'info');
    }

    /**
     * 批量清除单词
     */
    batchClearWords() {
        if (this.deletedWords.size === 0) {
            this.showMessage('没有已删除的单词', 'warning');
            return;
        }

        const deletedCount = this.deletedWords.size;

        // 添加确认对话框
        if (!confirm(`确定要永久清除 ${deletedCount} 个已删除的单词吗？此操作不可撤销。`)) {
            return;
        }

        // 创建新的筛选结果，排除已删除的单词
        this.filteredWords = this.filteredWords.filter((word, index) => !this.deletedWords.has(index));

        // 清空删除记录
        this.deletedWords.clear();

        // 保存删除状态到localStorage
        this.saveDeletedWordsState();

        // 更新显示
        this.updateResultStats();
        this.displayWordList();
        this.addBatchOperationButtonsInline(); // 更新按钮状态

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

    /**
     * 控制搜索框的显示和隐藏
     */
    toggleSearchControls() {
        const resultControls = document.querySelector('.result-controls');
        if (resultControls) {
            // 只有当有筛选结果时才显示搜索框
            if (this.filteredWords.length > 0) {
                resultControls.style.display = 'block';
            } else {
                resultControls.style.display = 'none';
            }
        }
    }
}

// 初始化应用程序
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new WordFilterApp();
});