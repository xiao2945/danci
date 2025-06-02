/**
 * 规则引擎类
 * 负责解析和执行单词筛选规则
 */
class RuleEngine {
    constructor() {
        this.rules = new Map();
        this.globalSets = new Map();
        this.fileStorage = new FileStorageManager();
        this.loadDefaultSets();
    }

    /**
     * 加载默认字符集
     */
    loadDefaultSets() {
        // 基本字符集
        this.globalSets.set('C', new Set(['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'q', 'r', 's', 't', 'v', 'w', 'x', 'y', 'z']));
        this.globalSets.set('V', new Set(['a', 'e', 'i', 'o', 'u']));
        this.globalSets.set('L', new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z']));

        // 加载保存的全局集合
        this.loadSavedGlobalSets();
    }

    /**
     * 加载保存的全局集合
     */
    loadSavedGlobalSets() {
        const savedGlobalSets = JSON.parse(localStorage.getItem('globalSets') || '{}');
        for (const [setName, setValues] of Object.entries(savedGlobalSets)) {
            this.globalSets.set(setName, new Set(setValues));
        }
    }

    /**
     * 更新全局集合
     * @param {Map} newGlobalSets - 新的全局集合
     */
    updateGlobalSets(newGlobalSets) {
        // 保留默认集合，添加新的集合
        this.loadDefaultSets();
        for (const [setName, setValues] of newGlobalSets) {
            this.globalSets.set(setName, setValues);
        }
    }

    /**
     * 获取全局集合
     * @returns {Map} 全局集合
     */
    getGlobalSets() {
        return this.globalSets;
    }

    /**
     * 解析规则文本
     * @param {string} ruleText - 规则文本
     * @returns {Object} 解析结果
     */
    parseRule(ruleText) {
        const lines = ruleText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

        let ruleName = '';
        let ruleComment = '';
        const localSets = new Map();
        let specificRule = '';
        let displayRule = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.startsWith('#')) {
                // 新格式：以#开头的规则名称
                ruleName = line.substring(1).trim();
            } else if (line.startsWith('//')) {
                // 规则注释
                ruleComment = line.substring(2).trim();
            } else if (line.startsWith('规则名称:') || line.startsWith('name:')) {
                // 兼容旧格式
                ruleName = line.split(':')[1].trim();
            } else if (line.includes('==')) {
                // 集合定义
                this.parseSetDefinition(line, localSets);
            } else if (line.startsWith('!') && !line.startsWith('!!')) {
                // 具体规则
                specificRule = line;
            } else if (line.startsWith('!!')) {
                // 组合规则
                specificRule = line;
            } else if (line.startsWith('@')) {
                // 显示规则
                displayRule = line;
            } else if (i === 0 && !ruleName) {
                // 如果是第一行且还没有规则名称，则将第一行作为规则名称
                ruleName = line;
            }
        }

        if (!ruleName) {
            throw new Error('规则名称不能为空');
        }

        if (!specificRule) {
            throw new Error('具体规则不能为空');
        }

        return {
            name: ruleName,
            comment: ruleComment,
            localSets: localSets,
            specificRule: specificRule,
            displayRule: displayRule
        };
    }

    /**
     * 解析集合定义
     * @param {string} line - 集合定义行
     * @param {Map} localSets - 本地集合映射
     */
    parseSetDefinition(line, localSets) {
        const parts = line.split('==');
        if (parts.length !== 2) {
            throw new Error(`无效的集合定义: ${line}`);
        }

        const setName = parts[0].trim();
        const setDefinition = parts[1].trim();

        // 验证集合名称
        if (setName.length === 1) {
            // 单字母集合名必须是大写
            if (!/^[A-Z]$/.test(setName)) {
                throw new Error(`单字母集合名 "${setName}" 必须是大写字母`);
            }
        } else {
            // 多字符集合名验证：必须以字母开头，可包含字母和数字
            if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(setName)) {
                throw new Error(`多字符集合名 "${setName}" 格式无效，必须以字母开头，只能包含字母和数字`);
            }
            // 多字母集合名在引用时需要用括号
            console.warn(`集合名称 "${setName}" 长度超过1个字符，在引用时请使用括号：(${setName})`);
        }

        const resultSet = this.evaluateSetExpression(setDefinition, localSets);
        localSets.set(setName, resultSet);
    }

    /**
     * 计算集合表达式
     * @param {string} expression - 集合表达式
     * @param {Map} localSets - 本地集合映射
     * @returns {Set} 计算结果集合
     */
    evaluateSetExpression(expression, localSets) {
        // 移除外层大括号
        if (expression.startsWith('{') && expression.endsWith('}')) {
            expression = expression.slice(1, -1);
        }

        const resultSet = new Set();

        // 处理集合运算符
        if (expression.includes('>>') || expression.includes('<<')) {
            return this.evaluateSetOperation(expression, localSets);
        }

        // 分割元素
        const elements = this.splitElements(expression);

        for (const element of elements) {
            const trimmedElement = element.trim();
            if (trimmedElement === '') {
                resultSet.add('');
            } else if (this.isSetName(trimmedElement)) {
                // 引用其他集合
                const referencedSet = this.getSet(trimmedElement, localSets);
                if (referencedSet) {
                    referencedSet.forEach(item => resultSet.add(item));
                }
            } else {
                // 直接字符或字符组合
                resultSet.add(trimmedElement);
            }
        }

        return resultSet;
    }

    /**
     * 计算集合运算
     * @param {string} expression - 集合运算表达式
     * @param {Map} localSets - 本地集合映射
     * @returns {Set} 计算结果集合
     */
    evaluateSetOperation(expression, localSets) {
        // 简化处理：从右到左处理运算符
        let currentExpression = expression;

        // 处理 >> 运算符（集合减法）
        if (currentExpression.includes('>>')) {
            const parts = currentExpression.split('>>');
            let result = this.evaluateSetExpression(parts[0], localSets);

            for (let i = 1; i < parts.length; i++) {
                const subtractSet = this.evaluateSetExpression(parts[i], localSets);
                subtractSet.forEach(item => result.delete(item));
            }

            return result;
        }

        // 处理 << 运算符（集合加法）
        if (currentExpression.includes('<<')) {
            const parts = currentExpression.split('<<');
            const result = new Set();

            for (const part of parts) {
                const partSet = this.evaluateSetExpression(part, localSets);
                partSet.forEach(item => result.add(item));
            }

            return result;
        }

        return new Set();
    }

    /**
     * 分割集合元素
     * @param {string} expression - 表达式
     * @returns {Array} 元素数组
     */
    splitElements(expression) {
        const elements = [];
        let current = '';
        let inParentheses = false;

        for (let i = 0; i < expression.length; i++) {
            const char = expression[i];

            if (char === '(') {
                inParentheses = true;
                current += char;
            } else if (char === ')') {
                inParentheses = false;
                current += char;
            } else if (char === ',' && !inParentheses) {
                elements.push(current);
                current = '';
            } else {
                current += char;
            }
        }

        if (current) {
            elements.push(current);
        }

        return elements;
    }

    /**
     * 判断是否为集合名称
     * @param {string} str - 字符串
     * @returns {boolean} 是否为集合名称
     */
    isSetName(str) {
        // 单字母集合允许大写和小写字母，可直接引用
        if (str.length === 1 && /^[A-Za-z]$/.test(str)) {
            return true;
        }

        // 多字母集合必须用括号引用
        if (str.startsWith('(') && str.endsWith(')')) {
            const setName = str.slice(1, -1);
            return setName.length > 0 && /^[a-zA-Z][a-zA-Z0-9]*$/.test(setName);
        }

        return false;
    }

    /**
     * 获取集合
     * @param {string} setName - 集合名称
     * @param {Map} localSets - 本地集合映射
     * @returns {Set} 集合
     */
    getSet(setName, localSets) {
        // 处理括号引用的集合名
        let actualSetName = setName;
        if (setName.startsWith('(') && setName.endsWith(')')) {
            actualSetName = setName.slice(1, -1);
        }

        // 优先查找本地集合
        if (localSets && localSets.has(actualSetName)) {
            return localSets.get(actualSetName);
        }

        // 查找全局集合
        if (this.globalSets.has(actualSetName)) {
            return this.globalSets.get(actualSetName);
        }

        return undefined;
    }

    /**
     * 保存规则
     * @param {Object} rule - 规则对象
     */
    saveRule(rule) {
        this.rules.set(rule.name, rule);

        // 保存到localStorage
        const savedRules = JSON.parse(localStorage.getItem('wordFilterRules') || '{}');

        // 正确序列化localSets：将Map<string, Set>转换为Array<[string, Array]>
        const serializedLocalSets = [];
        if (rule.localSets) {
            for (const [setName, setValues] of rule.localSets) {
                serializedLocalSets.push([setName, Array.from(setValues)]);
            }
        }

        savedRules[rule.name] = {
            name: rule.name,
            comment: rule.comment || '',
            localSets: serializedLocalSets,
            specificRule: rule.specificRule,
            displayRule: rule.displayRule
        };
        localStorage.setItem('wordFilterRules', JSON.stringify(savedRules));
    }

    /**
     * 导出所有规则到文件
     */
    async exportRulesToFile() {
        return await this.fileStorage.saveRulesToFile(this.rules);
    }

    /**
     * 从文件导入规则
     */
    importRulesFromFile() {
        this.fileStorage.createFileInput(async (file) => {
            try {
                const rulesData = await this.fileStorage.loadRulesFromFile(file);
                await this.loadRulesFromData(rulesData);

                // 触发规则列表更新事件
                window.dispatchEvent(new CustomEvent('rulesUpdated'));

                alert(`成功导入 ${Object.keys(rulesData).length} 个规则！`);
            } catch (error) {
                alert('导入规则失败: ' + error.message);
            }
        });
    }

    /**
     * 从数据对象加载规则
     * @param {Object} rulesData - 规则数据对象
     */
    async loadRulesFromData(rulesData) {
        for (const [name, ruleData] of Object.entries(rulesData)) {
            // 确保localSets正确转换为Map
            let localSets = new Map();
            if (ruleData.localSets) {
                if (Array.isArray(ruleData.localSets)) {
                    // 处理数组格式的localSets
                    for (const [setName, setValues] of ruleData.localSets) {
                        if (setValues && typeof setValues === 'object') {
                            // 如果setValues是对象，转换为Set
                            if (Array.isArray(setValues)) {
                                localSets.set(setName, new Set(setValues));
                            } else {
                                // 如果是普通对象，尝试获取其值
                                const values = Object.values(setValues);
                                localSets.set(setName, new Set(values));
                            }
                        } else {
                            localSets.set(setName, new Set());
                        }
                    }
                } else {
                    // 处理对象格式的localSets
                    localSets = new Map(Object.entries(ruleData.localSets));
                }
            }

            const rule = {
                name: ruleData.name,
                comment: ruleData.comment || '',
                localSets: localSets,
                specificRule: ruleData.specificRule,
                displayRule: ruleData.displayRule
            };

            // 保存规则到内存和localStorage
            this.saveRule(rule);
        }
    }

    /**
     * 加载保存的规则
     */
    loadSavedRules() {
        const savedRules = JSON.parse(localStorage.getItem('wordFilterRules') || '{}');

        for (const [name, ruleData] of Object.entries(savedRules)) {
            // 确保localSets正确转换为Map
            let localSets = new Map();
            if (ruleData.localSets) {
                if (Array.isArray(ruleData.localSets)) {
                    // 处理数组格式的localSets
                    for (const [setName, setValues] of ruleData.localSets) {
                        if (setValues && typeof setValues === 'object') {
                            // 如果setValues是对象，转换为Set
                            if (Array.isArray(setValues)) {
                                localSets.set(setName, new Set(setValues));
                            } else {
                                // 如果是普通对象，尝试获取其值
                                const values = Object.values(setValues);
                                localSets.set(setName, new Set(values));
                            }
                        } else {
                            localSets.set(setName, new Set());
                        }
                    }
                } else {
                    // 处理对象格式的localSets
                    localSets = new Map(Object.entries(ruleData.localSets));
                }
            }

            const rule = {
                name: ruleData.name,
                comment: ruleData.comment || '',
                localSets: localSets,
                specificRule: ruleData.specificRule,
                displayRule: ruleData.displayRule
            };
            this.rules.set(name, rule);
        }
    }

    /**
     * 获取所有规则名称
     * @returns {Array} 规则名称数组
     */
    getRuleNames() {
        return Array.from(this.rules.keys());
    }

    /**
     * 获取规则
     * @param {string} ruleName - 规则名称
     * @returns {Object} 规则对象
     */
    getRule(ruleName) {
        return this.rules.get(ruleName);
    }

    /**
     * 获取规则显示名称
     * @param {string} ruleName - 规则名称
     * @returns {string} 规则显示名称
     */
    getRuleName(ruleName) {
        const rule = this.rules.get(ruleName);
        return rule ? rule.name : ruleName;
    }

    /**
     * 删除规则
     * @param {string} ruleName - 规则名称
     */
    deleteRule(ruleName) {
        this.rules.delete(ruleName);

        // 从本地存储删除
        const savedRules = JSON.parse(localStorage.getItem('wordFilterRules') || '{}');
        delete savedRules[ruleName];
        localStorage.setItem('wordFilterRules', JSON.stringify(savedRules));
    }

    /**
     * 应用规则筛选单词
     * @param {Array} words - 单词数组
     * @param {string} ruleName - 规则名称
     * @returns {Array} 筛选结果
     */
    applyRule(words, ruleName) {
        const rule = this.getRule(ruleName);
        if (!rule) {
            throw new Error(`规则不存在: ${ruleName}`);
        }

        const filteredWords = [];

        for (const word of words) {
            if (this.matchesRule(word, rule)) {
                filteredWords.push(word);
            }
        }

        // 应用显示规则排序
        return this.applySorting(filteredWords, rule.displayRule, rule.localSets);
    }

    /**
     * 检查单词是否匹配规则
     * @param {string} word - 单词
     * @param {Object} rule - 规则对象
     * @returns {boolean} 是否匹配
     */
    matchesRule(word, rule) {
        const lowerWord = word.toLowerCase();

        if (rule.specificRule.startsWith('!!')) {
            // 组合规则
            return this.matchesCombinedRule(lowerWord, rule.specificRule, rule.localSets);
        } else {
            // 普通规则
            return this.matchesSpecificRule(lowerWord, rule.specificRule, rule.localSets);
        }
    }

    /**
     * 检查单词是否匹配具体规则
     * @param {string} word - 单词（小写）
     * @param {string} specificRule - 具体规则
     * @param {Map} localSets - 本地集合映射
     * @returns {boolean} 是否匹配
     */
    matchesSpecificRule(word, specificRule, localSets) {
        // 移除开头的 !
        const rulePattern = specificRule.substring(1);

        // 解析规则模式
        const pattern = this.parseRulePattern(rulePattern, localSets);

        // 检查单词是否匹配模式
        return this.matchesPattern(word, pattern);
    }

    /**
     * 检查单词是否匹配组合规则
     * @param {string} word - 单词（小写）
     * @param {string} combinedRule - 组合规则
     * @param {Map} localSets - 本地集合映射
     * @returns {boolean} 是否匹配
     */
    matchesCombinedRule(word, combinedRule, localSets) {
        // 移除开头的 !!
        let ruleExpression = combinedRule.substring(2);

        // 处理非操作符 "--"，转换为 "&& !"
        ruleExpression = this.processNonOperator(ruleExpression);

        // 简化处理：支持基本的 && 和 || 运算
        if (ruleExpression.includes('&&')) {
            const parts = ruleExpression.split('&&');
            return parts.every(part => {
                const trimmedPart = part.trim();

                // 处理否定操作
                if (trimmedPart.startsWith('!')) {
                    const ruleName = trimmedPart.substring(1).trim();
                    const referencedRule = this.getRule(ruleName);
                    return referencedRule ? !this.matchesRule(word, referencedRule) : true;
                } else {
                    const ruleName = trimmedPart;
                    const referencedRule = this.getRule(ruleName);
                    return referencedRule && this.matchesRule(word, referencedRule);
                }
            });
        } else if (ruleExpression.includes('||')) {
            const parts = ruleExpression.split('||');
            return parts.some(part => {
                const trimmedPart = part.trim();

                // 处理否定操作
                if (trimmedPart.startsWith('!')) {
                    const ruleName = trimmedPart.substring(1).trim();
                    const referencedRule = this.getRule(ruleName);
                    return referencedRule ? !this.matchesRule(word, referencedRule) : true;
                } else {
                    const ruleName = trimmedPart;
                    const referencedRule = this.getRule(ruleName);
                    return referencedRule && this.matchesRule(word, referencedRule);
                }
            });
        }

        return false;
    }

    /**
     * 处理非操作符 "--"，转换为 "&& !"
     * @param {string} expression - 规则表达式
     * @returns {string} 处理后的表达式
     */
    processNonOperator(expression) {
        // 使用正则表达式匹配 "--" 操作符
        // 格式：condition1 -- condition2
        // 转换为：condition1 && !condition2
        return expression.replace(
            /(.*?)\s*--\s*(.*)/g,
            '$1 && !$2'
        );
    }

    /**
     * 解析规则模式
     * @param {string} rulePattern - 规则模式
     * @param {Map} localSets - 本地集合映射
     * @returns {Array} 解析后的模式数组
     */
    parseRulePattern(rulePattern, localSets) {
        const pattern = [];
        let i = 0;

        while (i < rulePattern.length) {
            if (rulePattern[i] === '\\') {
                // 位置标记
                const positionMarker = this.parsePositionMarker(rulePattern, i);
                pattern.push(positionMarker);
                i += positionMarker.length;
            } else if (rulePattern[i] === '[') {
                // 字面字符
                const literalEnd = rulePattern.indexOf(']', i);
                if (literalEnd !== -1) {
                    const literal = rulePattern.substring(i + 1, literalEnd);
                    pattern.push({ type: 'literal', value: literal });
                    i = literalEnd + 1;
                } else {
                    i++;
                }
            } else if (rulePattern[i] === '(') {
                // 集合引用（括号内的集合名，支持多字母）
                const setEnd = rulePattern.indexOf(')', i);
                if (setEnd !== -1) {
                    const setName = rulePattern.substring(i + 1, setEnd);
                    const set = this.getSet(setName, localSets);
                    if (!set) {
                        console.warn(`集合 "${setName}" 未找到`);
                        pattern.push({ type: 'set', value: new Set() });
                    } else {
                        pattern.push({ type: 'set', value: set });
                    }
                    i = setEnd + 1;
                } else {
                    i++;
                }
            } else if (this.isSetName(rulePattern[i])) {
                // 单字母集合名称（直接引用）
                const set = this.getSet(rulePattern[i], localSets);
                if (!set) {
                    console.warn(`集合 "${rulePattern[i]}" 未找到`);
                    pattern.push({ type: 'set', value: new Set() });
                } else {
                    pattern.push({ type: 'set', value: set });
                }
                i++;
            } else {
                i++;
            }
        }

        return pattern;
    }

    /**
     * 解析位置标记
     * @param {string} rulePattern - 规则模式
     * @param {number} startIndex - 开始索引
     * @returns {Object} 位置标记对象
     */
    parsePositionMarker(rulePattern, startIndex) {
        let marker = '';
        let i = startIndex;

        while (i < rulePattern.length && (rulePattern[i] === '\\' || rulePattern[i] === '-' || /[a-z]/.test(rulePattern[i]))) {
            marker += rulePattern[i];
            i++;
        }

        return {
            type: 'position',
            value: marker,
            length: marker.length
        };
    }

    /**
     * 检查单词是否匹配模式
     * @param {string} word - 单词
     * @param {Array} pattern - 模式数组
     * @returns {boolean} 是否匹配
     */
    matchesPattern(word, pattern) {
        // 检查模式是否包含位置标记
        const hasPositionMarkers = pattern.some(element => element.type === 'position');

        if (hasPositionMarkers) {
            // 如果有位置标记，只从单词开头开始匹配
            return this.matchesPatternAtPosition(word, pattern, 0);
        } else {
            // 支持部分匹配：检查模式是否在单词的任何位置匹配
            for (let startPos = 0; startPos <= word.length - this.getPatternMinLength(pattern); startPos++) {
                if (this.matchesPatternAtPosition(word, pattern, startPos)) {
                    return true;
                }
            }
            return false;
        }
    }

    /**
     * 在指定位置检查模式匹配
     * @param {string} word - 单词
     * @param {Array} pattern - 模式数组
     * @param {number} startPos - 开始位置
     * @returns {boolean} 是否匹配
     */
    matchesPatternAtPosition(word, pattern, startPos) {
        let wordIndex = startPos;
        let patternIndex = 0;

        while (patternIndex < pattern.length) {
            const element = pattern[patternIndex];

            if (element.type === 'literal') {
                // 字面字符匹配
                if (wordIndex >= word.length || word[wordIndex] !== element.value) {
                    return false;
                }
                wordIndex++;
            } else if (element.type === 'set') {
                // 集合匹配 - 支持多字符字符串匹配
                let matched = false;
                let matchLength = 0;

                // 检查集合是否存在且可迭代
                if (!element.value || typeof element.value[Symbol.iterator] !== 'function') {
                    console.warn('集合值不存在或不可迭代:', element);
                    return false;
                }

                // 尝试匹配集合中的每个元素
                // 优先尝试非空字符串匹配，最后才尝试空字符串
                let emptyStringFound = false;

                for (const setElement of element.value) {
                    if (setElement === '') {
                        // 记录找到空字符串，但不立即匹配
                        emptyStringFound = true;
                        continue;
                    } else if (typeof setElement === 'string' && setElement.length > 1) {
                        // 多字符字符串匹配
                        if (wordIndex + setElement.length <= word.length) {
                            const wordSubstring = word.substring(wordIndex, wordIndex + setElement.length);
                            if (wordSubstring === setElement) {
                                matched = true;
                                matchLength = setElement.length;
                                break;
                            }
                        }
                    } else {
                        // 单字符匹配
                        if (wordIndex < word.length && word[wordIndex] === setElement) {
                            matched = true;
                            matchLength = 1;
                            break;
                        }
                    }
                }

                // 如果没有匹配到任何非空元素，且集合中有空字符串，则匹配空字符串
                if (!matched && emptyStringFound) {
                    matched = true;
                    matchLength = 0;
                }

                if (!matched) {
                    return false;
                }
                wordIndex += matchLength;
            } else if (element.type === 'position') {
                // 位置标记处理
                if (element.value === '\\b') {
                    // 单词开头：必须在单词的开始位置
                    if (wordIndex !== 0) {
                        return false;
                    }
                } else if (element.value === '\\e') {
                    // 单词结尾：必须在单词的结束位置
                    if (wordIndex !== word.length) {
                        return false;
                    }
                }
                // 其他位置标记暂时忽略
            }
            patternIndex++;
        }

        return true;
    }

    /**
     * 获取模式的最小长度
     * @param {Array} pattern - 模式数组
     * @returns {number} 最小长度
     */
    getPatternMinLength(pattern) {
        let length = 0;
        for (const element of pattern) {
            if (element.type === 'literal') {
                length++;
            } else if (element.type === 'set') {
                // 对于集合，找到最短的元素长度
                let minElementLength = 1;
                if (element.value && element.value.size > 0) {
                    minElementLength = Math.min(...Array.from(element.value).map(item =>
                        typeof item === 'string' ? item.length : 1
                    ));
                }
                length += minElementLength;
            }
            // 位置标记不占用字符长度
        }
        return length;
    }

    /**
     * 应用排序规则
     * @param {Array} words - 单词数组
     * @param {string} displayRule - 显示规则
     * @returns {Array} 排序后的单词数组
     */
    applySorting(words, displayRule, localSets = new Map()) {
        if (!displayRule || !displayRule.startsWith('@')) {
            // 默认按字母顺序排序
            return this.sortByAlphabet(words);
        }

        // 解析显示规则
        const sortRule = displayRule.substring(1); // 去掉@符号

        // 处理@-的情况（倒序字母排序）
        if (sortRule === '-' || sortRule === '') {
            if (sortRule === '-') {
                return this.sortByAlphabet(words, true); // 倒序
            } else {
                return this.sortByAlphabet(words); // 正序
            }
        }

        // 解析集合排序规则
        return this.sortBySetGroups(words, sortRule, localSets);
    }

    /**
     * 按字母顺序排序
     * @param {Array} words - 单词数组
     * @param {boolean} descending - 是否倒序
     * @returns {Array} 排序后的单词数组
     */
    sortByAlphabet(words, descending = false) {
        return words.sort((a, b) => {
            // 自定义字母排序：大小写字母相同，按下一个字母排序
            // 只有连续两个字母相同且只有大小写差异时，才按第一个字母先大后小
            const comparison = this.compareWords(a, b);
            return descending ? -comparison : comparison;
        });
    }

    /**
     * 自定义单词比较函数
     * @param {string} a - 第一个单词
     * @param {string} b - 第二个单词
     * @returns {number} 比较结果
     */
    compareWords(a, b) {
        const minLen = Math.min(a.length, b.length);
        let firstCaseDiffIndex = -1; // 记录第一个只有大小写不同的位置

        for (let i = 0; i < minLen; i++) {
            const charA = a[i];
            const charB = b[i];

            // 转换为小写进行比较
            const lowerA = charA.toLowerCase();
            const lowerB = charB.toLowerCase();

            if (lowerA !== lowerB) {
                // 处理特殊符号：连字符、点号等应优先于字母
                const isSymbolA = /[^a-zA-Z]/.test(charA);
                const isSymbolB = /[^a-zA-Z]/.test(charB);

                if (isSymbolA && !isSymbolB) return -1;
                if (!isSymbolA && isSymbolB) return 1;

                // 都是字母或都是符号，按字母顺序比较
                return lowerA.localeCompare(lowerB);
            }

            // 字母相同但大小写不同，记录第一个这样的位置
            if (charA !== charB && firstCaseDiffIndex === -1) {
                firstCaseDiffIndex = i;
            }
        }

        // 如果所有比较的字符都相同（包括大小写），按长度排序
        if (a.length !== b.length) {
            return a.length - b.length;
        }

        // 长度也相同，如果有大小写差异，按第一个大小写差异位置排序（大写优先）
        if (firstCaseDiffIndex !== -1) {
            const charA = a[firstCaseDiffIndex];
            const charB = b[firstCaseDiffIndex];
            return charA < charB ? -1 : 1; // 大写字母ASCII值小于小写字母
        }

        // 完全相同
        return 0;
    }

    /**
     * 按集合分组排序
     * @param {Array} words - 单词数组
     * @param {string} sortRule - 排序规则
     * @param {Map} localSets - 局部集合映射
     * @returns {Array} 排序后的单词数组
     */
    sortBySetGroups(words, sortRule, localSets = new Map()) {
        // 解析排序规则，提取集合名称和排序方向
        const sortGroups = this.parseSortRule(sortRule);

        if (sortGroups.length === 0) {
            return this.sortByAlphabet(words);
        }

        // 为每个单词计算分组键
        const wordsWithKeys = words.map(word => {
            const groupKeys = this.calculateGroupKeys(word, sortGroups, localSets);
            return { word, groupKeys };
        });

        // 按分组键排序
        wordsWithKeys.sort((a, b) => {
            for (let i = 0; i < sortGroups.length; i++) {
                const keyA = a.groupKeys[i];
                const keyB = b.groupKeys[i];

                if (keyA !== keyB) {
                    const comparison = keyA.localeCompare(keyB);
                    return sortGroups[i].descending ? -comparison : comparison;
                }
            }

            // 所有分组键都相同，按字母顺序排序（不显示字母分组）
            return this.compareWords(a.word, b.word);
        });

        return wordsWithKeys.map(item => item.word);
    }

    /**
     * 解析排序规则
     * @param {string} sortRule - 排序规则字符串
     * @returns {Array} 解析后的排序组
     */
    parseSortRule(sortRule) {
        const groups = [];
        let i = 0;

        while (i < sortRule.length) {
            let descending = false;

            // 检查是否有负号
            if (sortRule[i] === '-') {
                descending = true;
                i++;
            }

            if (i >= sortRule.length) break;

            let setName = '';

            // 检查是否是括号引用的集合
            if (sortRule[i] === '(') {
                const closeIndex = sortRule.indexOf(')', i);
                if (closeIndex === -1) {
                    throw new Error(`排序规则中括号不匹配: ${sortRule}`);
                }
                setName = sortRule.substring(i + 1, closeIndex);
                i = closeIndex + 1;
            } else {
                // 单字母集合
                setName = sortRule[i];
                i++;
            }

            if (setName) {
                groups.push({ setName, descending });
            }
        }

        // 限制排序分级层数，最多允许两级
        if (groups.length > 2) {
            throw new Error(`排序规则层数超过限制，最多允许两级排序，当前为 ${groups.length} 级`);
        }

        return groups;
    }

    /**
     * 计算单词的分组键
     * @param {string} word - 单词
     * @param {Array} sortGroups - 排序组
     * @param {Map} localSets - 局部集合映射
     * @returns {Array} 分组键数组
     */
    calculateGroupKeys(word, sortGroups, localSets = new Map()) {
        const keys = [];

        for (const group of sortGroups) {
            const key = this.findMatchingSetElement(word, group.setName, localSets);
            keys.push(key);
        }

        return keys;
    }

    /**
     * 查找单词匹配的集合元素
     * @param {string} word - 单词
     * @param {string} setName - 集合名称
     * @param {Map} localSets - 局部集合映射
     * @returns {string} 匹配的集合元素或字母
     */
    findMatchingSetElement(word, setName, localSets = new Map()) {
        // 获取集合（优先使用局部集合）
        const set = this.getSet(setName, localSets);

        if (!set) {
            // 如果集合不存在，按首字母分组
            return word.charAt(0).toLowerCase();
        }

        // 查找单词开头匹配的集合元素
        const lowerWord = word.toLowerCase();

        // 按元素长度降序排列，优先匹配较长的元素
        const sortedElements = Array.from(set).sort((a, b) => b.length - a.length);

        for (const element of sortedElements) {
            if (lowerWord.startsWith(element.toLowerCase())) {
                return element.toLowerCase();
            }
        }

        // 如果没有匹配的集合元素，返回首字母
        return word.charAt(0).toLowerCase();
    }

    /**
     * 获取规则预览文本
     * @param {string} ruleName - 规则名称
     * @returns {string} 预览文本
     */
    getRulePreview(ruleName) {
        const rule = this.getRule(ruleName);
        if (!rule) {
            return '规则不存在';
        }

        let preview = `规则名称: ${rule.name}`;
        if (rule.comment) {
            preview += ` // ${rule.comment}`;
        }
        preview += '\n';

        // 显示全局集合定义
        if (this.globalSets.size > 0) {
            preview += '\n全局集合定义:\n';
            for (const [setName, setValues] of this.globalSets) {
                const values = Array.from(setValues).slice(0, 10).join(', ');
                const more = setValues.size > 10 ? '...' : '';
                preview += `${setName} == {${values}${more}}\n`;
            }
        }

        // 显示局部集合定义
        if (rule.localSets.size > 0) {
            preview += '\n局部集合定义:\n';
            for (const [setName, setValues] of rule.localSets) {
                const values = Array.from(setValues).slice(0, 10).join(', ');
                const more = setValues.size > 10 ? '...' : '';
                preview += `${setName} == {${values}${more}}\n`;
            }
        }

        preview += `\n具体规则: ${rule.specificRule}\n`;

        if (rule.displayRule) {
            preview += `显示规则: ${rule.displayRule}\n`;
        }

        return preview;
    }
}