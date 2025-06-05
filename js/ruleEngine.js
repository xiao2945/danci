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
     * 获取内置集合名称列表
     * @returns {Array} 内置集合名称数组
     */
    getBuiltinSetNames() {
        return ['C', 'V', 'L'];
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
        // 清空当前全局集合
        this.globalSets.clear();

        // 重新加载默认集合
        this.globalSets.set('C', new Set(['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'q', 'r', 's', 't', 'v', 'w', 'x', 'y', 'z']));
        this.globalSets.set('V', new Set(['a', 'e', 'i', 'o', 'u']));
        this.globalSets.set('L', new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z']));

        // 添加新的自定义集合
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

        // 初始化原始集合定义存储
        this.originalSetDefinitions = new Map();

        let ruleNameLineIndex = -1; // 记录规则名称行的索引

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];

            // 移除所有行尾注释，除非它是规则名称行尾的注释（这部分会在后面单独处理规则名时处理）
            // 或者它是紧跟在规则名称行下面的第一条规则注释
            if (line.startsWith('#')) {
                ruleNameLineIndex = i;
                // 对于规则名称行，暂时不移除行尾注释，后续解析规则名时再处理
            } else if (ruleNameLineIndex !== -1 && i === ruleNameLineIndex + 1 && line.startsWith('//')) {
                // 这是规则名称行下面的第一条注释，视为规则注释
                ruleComment = line.substring(2).trim();
                continue; // 处理完规则注释，跳到下一行
            } else {
                // 其他情况，移除所有行尾注释
                line = line.replace(/\/\/.*$/, '').trim();
            }

            // 如果移除注释后行为空，则跳过
            if (!line) {
                continue;
            }

            if (line.startsWith('#')) {
                // 新格式：以#开头的规则名称
                // 此时处理规则名称行尾的注释
                const commentIndex = line.indexOf('//');
                if (commentIndex > 0) {
                    ruleName = line.substring(1, commentIndex).trim();
                } else {
                    ruleName = line.substring(1).trim();
                }
            } else if (line.startsWith('规则名称:') || line.startsWith('name:')) {
                // 兼容旧格式
                ruleName = line.split(':')[1].trim();
            } else if (line.includes('==')) {
                // 集合定义
                this.parseSetDefinition(line, localSets);

                // 存储原始集合定义
                const [setName] = line.split('==');
                const cleanSetName = setName.trim();
                this.originalSetDefinitions.set(cleanSetName, line);
            } else if (line.startsWith(':') && !line.startsWith('::')) {
                // 具体规则
                specificRule = line;
            } else if (line.startsWith('::')) {
                // 组合规则
                specificRule = line;
            } else if (line.startsWith('@')) {
                // 排序规则
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

        // 执行有效性检查
        this.validateRule({
            name: ruleName,
            comment: ruleComment,
            localSets: localSets,
            specificRule: specificRule,
            displayRule: displayRule
        });

        return {
            name: ruleName,
            comment: ruleComment,
            localSets: localSets,
            specificRule: specificRule,
            displayRule: displayRule
        };
    }

    /**
     * 验证规则的有效性
     * @param {Object} rule - 规则对象
     */
    validateRule(rule) {
        // 1. 验证集合定义中的集合运算引用
        this.validateSetDefinitions(rule.localSets);

        // 2. 验证基础规则中的集合引用
        if (!rule.specificRule.startsWith('::')) {
            this.validateBasicRuleReferences(rule.specificRule, rule.localSets);
        }

        // 3. 验证组合规则中的基础规则引用
        if (rule.specificRule.startsWith('::')) {
            this.validateCombinedRuleReferences(rule.specificRule);
        }

        // 4. 验证排序规则中的集合引用
        if (rule.displayRule) {
            this.validateSortRuleReferences(rule.displayRule, rule.localSets, rule.specificRule.startsWith('::'));
        }

        // 5. 验证规则名称格式
        this.validateRuleName(rule.name);

        // 6. 验证注释长度
        this.validateComment(rule.comment);

        // 7. 验证集合名称冲突
        this.validateSetNameConflicts(rule.localSets);

        // 8. 验证循环引用
        this.validateCircularReferences(rule);

        // 9. 验证规则名称冲突
        this.validateRuleNameConflict(rule.name);
    }

    /**
     * 验证集合定义中的集合运算引用
     * @param {Map} localSets - 本地集合映射
     */
    validateSetDefinitions(localSets) {
        for (const [setName, setValues] of localSets) {
            // 检查集合定义中是否包含集合运算
            const setDefinition = this.getOriginalSetDefinition(setName, localSets);
            if (setDefinition && (setDefinition.includes('>>') || setDefinition.includes('<<'))) {
                this.validateSetOperationReferences(setDefinition, localSets);
            }
        }
    }

    /**
     * 验证集合运算中的集合引用
     * @param {string} setDefinition - 集合定义
     * @param {Map} localSets - 本地集合映射
     */
    validateSetOperationReferences(setDefinition, localSets) {
        // 从集合定义中提取右侧部分（去掉集合名称）
        let rightSide = setDefinition;
        if (setDefinition.includes('==')) {
            rightSide = setDefinition.split('==')[1].trim();
        }

        // 提取集合运算中引用的集合名称
        const referencedSets = this.extractSetReferences(rightSide);

        for (const refSetName of referencedSets) {
            // 检查是否是跨规则引用其他规则的局部集合
            if (!this.globalSets.has(refSetName) && !localSets.has(refSetName)) {
                // 检查是否是其他规则的局部集合
                let foundInOtherRule = false;
                for (const [ruleName, rule] of this.rules) {
                    if (rule.localSets && rule.localSets.has(refSetName)) {
                        throw new Error(`不允许跨规则引用局部集合 "${refSetName}"（来自规则 "${ruleName}"）`);
                    }
                }

                // 如果不是其他规则的局部集合，则集合不存在
                throw new Error(`集合运算中引用的集合 "${refSetName}" 不存在`);
            }
        }
    }

    /**
     * 验证基础规则中的集合引用
     * @param {string} specificRule - 具体规则
     * @param {Map} localSets - 本地集合映射
     */
    validateBasicRuleReferences(specificRule, localSets) {
        const referencedSets = this.extractSetReferences(specificRule);

        for (const refSetName of referencedSets) {
            if (!this.globalSets.has(refSetName) && !localSets.has(refSetName)) {
                throw new Error(`基础规则中引用的集合 "${refSetName}" 不存在`);
            }
        }
    }

    /**
     * 验证组合规则中的基础规则引用
     * @param {string} combinedRule - 组合规则
     */
    validateCombinedRuleReferences(combinedRule) {
        // 提取组合规则中引用的基础规则名称
        const referencedRules = this.extractRuleReferences(combinedRule);

        for (const refRuleName of referencedRules) {
            const referencedRule = this.rules.get(refRuleName);
            if (!referencedRule) {
                throw new Error(`组合规则中引用的基础规则 "${refRuleName}" 不存在`);
            }

            // 检查引用的规则是否也是组合规则（不允许组合规则引用组合规则）
            if (referencedRule.specificRule.startsWith('::')) {
                throw new Error(`组合规则不能引用其他组合规则 "${refRuleName}"`);
            }
        }
    }

    /**
     * 验证排序规则中的集合引用
     * @param {string} displayRule - 排序规则
     * @param {Map} localSets - 本地集合映射
     * @param {boolean} isCombinedRule - 是否为组合规则
     */
    validateSortRuleReferences(displayRule, localSets, isCombinedRule) {
        if (!displayRule.startsWith('@')) {
            return;
        }

        const sortRule = displayRule.substring(1);
        if (sortRule === '' || sortRule === '-') {
            return; // 基础字母排序，无需验证
        }

        // 解析排序规则
        try {
            const sortGroups = this.parseSortRule(sortRule);

            // 检查排序层级（最多三级）
            if (sortGroups.length > 3) {
                throw new Error(`排序规则层数超过限制，最多允许三级排序，当前为 ${sortGroups.length} 级`);
            }

            // 验证每个排序组中引用的集合
            for (const group of sortGroups) {
                const setName = group.setName;

                // 检查集合是否存在
                if (!this.globalSets.has(setName) && !localSets.has(setName)) {
                    // 如果是组合规则，还需要检查引用的基础规则中的局部集合
                    if (isCombinedRule) {
                        let foundInReferencedRule = false;
                        const referencedRules = this.extractRuleReferences(displayRule);

                        for (const refRuleName of referencedRules) {
                            const referencedRule = this.rules.get(refRuleName);
                            if (referencedRule && referencedRule.localSets && referencedRule.localSets.has(setName)) {
                                foundInReferencedRule = true;
                                break;
                            }
                        }

                        if (!foundInReferencedRule) {
                            throw new Error(`排序规则中引用的集合 "${setName}" 不存在`);
                        }
                    } else {
                        throw new Error(`排序规则中引用的集合 "${setName}" 不存在`);
                    }
                }
            }
        } catch (error) {
            throw new Error(`排序规则验证失败: ${error.message}`);
        }
    }

    /**
     * 验证规则名称格式
     * @param {string} ruleName - 规则名称
     */
    validateRuleName(ruleName) {
        if (!ruleName || ruleName.trim() === '') {
            throw new Error('规则名称不能为空');
        }

        if (ruleName.length > 50) {
            throw new Error('规则名称长度不能超过50个字符');
        }

        // 检查规则名称是否包含特殊字符
        if (!/^[\u4e00-\u9fa5a-zA-Z0-9\s_-]+$/.test(ruleName)) {
            throw new Error('规则名称只能包含中文、英文、数字、空格、下划线和连字符');
        }
    }

    /**
     * 验证注释长度
     * @param {string} comment - 注释内容
     */
    validateComment(comment) {
        if (comment && comment.length > 60) {
            throw new Error('注释内容长度不能超过60个字符');
        }
    }

    /**
     * 提取文本中引用的集合名称
     * @param {string} text - 文本内容
     * @returns {Array} 集合名称数组
     */
    extractSetReferences(text) {
        const setNames = [];

        // 匹配括号中的集合名称 (SetName)
        const bracketMatches = text.match(/\(([a-zA-Z][a-zA-Z0-9]*)\)/g);
        if (bracketMatches) {
            for (const match of bracketMatches) {
                const setName = match.slice(1, -1); // 去掉括号
                setNames.push(setName);
            }
        }

        // 处理集合运算：如 A>>B, A<<B (不包括 A>>{xxx} 这样的字面值运算)
        const operationMatches = text.match(/([A-Z])\s*(>>|<<)\s*([A-Z])/g);
        if (operationMatches) {
            for (const match of operationMatches) {
                const parts = match.match(/([A-Z])\s*(>>|<<)\s*([A-Z])/);
                if (parts) {
                    setNames.push(parts[1]); // 左侧集合
                    setNames.push(parts[3]); // 右侧集合
                }
            }
        }

        // 匹配单字母集合名称，但排除特殊上下文
        // 先移除已经处理过的内容，避免重复匹配
        let textWithoutSpecial = text.replace(/\([a-zA-Z][a-zA-Z0-9]*\)/g, ''); // 移除括号集合
        textWithoutSpecial = textWithoutSpecial.replace(/[A-Z]\s*(>>|<<)\s*([A-Z]|\{[^}]*\})/g, ''); // 移除集合运算
        textWithoutSpecial = textWithoutSpecial.replace(/\\[a-zA-Z]/g, ''); // 移除 \b, \e 等转义序列
        textWithoutSpecial = textWithoutSpecial.replace(/@\([^)]*\)/g, ''); // 移除 @(xxx) 排序规则
        textWithoutSpecial = textWithoutSpecial.replace(/@[A-Z]/g, ''); // 移除 @X 单字母排序规则
        textWithoutSpecial = textWithoutSpecial.replace(/\{[^}]*\}/g, ''); // 移除 {xxx} 内容

        const singleLetterMatches = textWithoutSpecial.match(/[A-Z]/g);
        if (singleLetterMatches) {
            for (const match of singleLetterMatches) {
                setNames.push(match);
            }
        }

        return [...new Set(setNames)]; // 去重
    }

    /**
     * 提取组合规则中引用的基础规则名称
     * @param {string} combinedRule - 组合规则
     * @returns {Array} 规则名称数组
     */
    extractRuleReferences(combinedRule) {
        const ruleNames = [];

        // 移除开头的 ::
        const ruleContent = combinedRule.substring(2);

        // 分割操作符 &&, ||, !, ~
        const parts = ruleContent.split(/\s*(?:&&|\|\||!|~)\s*/);

        for (const part of parts) {
            const trimmedPart = part.trim();
            if (trimmedPart) {
                ruleNames.push(trimmedPart);
            }
        }

        return [...new Set(ruleNames)]; // 去重
    }

    /**
     * 验证集合名称冲突
     * @param {Map} localSets - 本地集合映射
     */
    validateSetNameConflicts(localSets) {
        for (const setName of localSets.keys()) {
            // 检查是否与全局集合冲突
            if (this.globalSets.has(setName)) {
                throw new Error(`局部集合名称 "${setName}" 与全局集合冲突`);
            }
        }
    }

    /**
     * 验证循环引用
     * @param {Object} rule - 规则对象
     */
    validateCircularReferences(rule) {
        // 检查集合定义中的循环引用
        this.validateSetCircularReferences(rule.localSets);

        // 检查组合规则中的循环引用
        if (rule.specificRule.startsWith('::')) {
            this.validateRuleCircularReferences(rule.name, rule.specificRule, new Set());
        }
    }

    /**
     * 验证集合循环引用
     * @param {Map} localSets - 本地集合映射
     */
    validateSetCircularReferences(localSets) {
        for (const [setName] of localSets) {
            this.checkSetCircularReference(setName, localSets, new Set());
        }
    }

    /**
     * 检查单个集合的循环引用
     * @param {string} setName - 集合名称
     * @param {Map} localSets - 本地集合映射
     * @param {Set} visited - 已访问的集合
     */
    checkSetCircularReference(setName, localSets, visited) {
        if (visited.has(setName)) {
            throw new Error(`检测到集合循环引用: ${Array.from(visited).join(' -> ')} -> ${setName}`);
        }

        visited.add(setName);

        const setDefinition = this.getOriginalSetDefinition(setName, localSets);
        if (setDefinition) {
            const referencedSets = this.extractSetReferences(setDefinition);
            for (const refSetName of referencedSets) {
                if (localSets.has(refSetName)) {
                    this.checkSetCircularReference(refSetName, localSets, new Set(visited));
                }
            }
        }

        visited.delete(setName);
    }

    /**
     * 验证规则循环引用
     * @param {string} ruleName - 规则名称
     * @param {string} combinedRule - 组合规则
     * @param {Set} visited - 已访问的规则
     */
    validateRuleCircularReferences(ruleName, combinedRule, visited) {
        if (visited.has(ruleName)) {
            throw new Error(`检测到规则循环引用: ${Array.from(visited).join(' -> ')} -> ${ruleName}`);
        }

        visited.add(ruleName);

        const referencedRules = this.extractRuleReferences(combinedRule);
        for (const refRuleName of referencedRules) {
            const referencedRule = this.rules.get(refRuleName);
            if (referencedRule && referencedRule.specificRule.startsWith('::')) {
                this.validateRuleCircularReferences(refRuleName, referencedRule.specificRule, new Set(visited));
            }
        }

        visited.delete(ruleName);
    }

    /**
     * 验证规则名称冲突
     * @param {string} ruleName - 规则名称
     */
    validateRuleNameConflict(ruleName) {
        // 检查是否与现有规则冲突（更新规则时允许同名）
        const existingRule = this.rules.get(ruleName);
        if (existingRule) {
            console.warn(`规则 "${ruleName}" 已存在，将被覆盖`);
        }

        // 检查规则名称是否与保留关键字冲突
        const reservedKeywords = [...this.getBuiltinSetNames(), 'true', 'false', 'null', 'undefined'];
        if (reservedKeywords.includes(ruleName)) {
            throw new Error(`规则名称 "${ruleName}" 是保留关键字，不能使用`);
        }
    }

    /**
     * 获取集合的原始定义（用于验证集合运算）
     * @param {string} setName - 集合名称
     * @param {Map} localSets - 本地集合映射
     * @returns {string} 原始集合定义
     */
    getOriginalSetDefinition(setName, localSets) {
        // 从存储的原始定义中获取
        if (this.originalSetDefinitions && this.originalSetDefinitions.has(setName)) {
            const fullDefinition = this.originalSetDefinitions.get(setName);
            // 返回等号右边的部分
            const parts = fullDefinition.split('==');
            return parts.length > 1 ? parts[1].trim() : null;
        }
        return null;
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
        }

        const resultSet = this.evaluateSetExpression(setDefinition, localSets, false);
        localSets.set(setName, resultSet);
    }

    /**
     * 计算集合表达式
     * @param {string} expression - 集合表达式
     * @param {Map} localSets - 本地集合映射
     * @param {boolean} isFromBraces - 是否来自大括号内容
     * @returns {Set} 计算结果集合
     */
    evaluateSetExpression(expression, localSets, isFromBraces = false) {
        const resultSet = new Set();

        // 检查是否有大括号（在处理运算符之前）
        const hasBraces = expression.startsWith('{') && expression.endsWith('}');

        // 处理集合运算符（在移除大括号之前）
        if (expression.includes('>>') || expression.includes('<<')) {
            return this.evaluateSetOperation(expression, localSets);
        }

        // 移除外层大括号
        if (hasBraces) {
            expression = expression.slice(1, -1);
            isFromBraces = true;
        }

        // 分割元素
        const elements = this.splitElements(expression);

        for (const element of elements) {
            const trimmedElement = element.trim();
            if (trimmedElement === '') {
                resultSet.add('');
            } else if (!isFromBraces && this.isSetName(trimmedElement)) {
                // 只有不是来自大括号内容时才尝试作为集合引用
                const referencedSet = this.getSet(trimmedElement, localSets);
                if (referencedSet) {
                    referencedSet.forEach(item => resultSet.add(item));
                } else {
                    // 如果集合不存在，当作字面值处理
                    resultSet.add(trimmedElement);
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
            let result = this.evaluateSetExpression(parts[0].trim(), localSets);
            console.log('[evaluateSetOperation] Initial result for ' + parts[0].trim() + ':', new Set(result));

            for (let i = 1; i < parts.length; i++) {
                let partToEvaluate = parts[i].trim();
                // 去除行尾注释
                partToEvaluate = partToEvaluate.replace(/\s*\/\/.*$/, '').trim();
                console.log('[evaluateSetOperation] Processing subtraction part (comment stripped): ' + partToEvaluate);
                // 检查是否是大括号表达式，如果是则直接处理为字面值
                const isFromBraces = partToEvaluate.startsWith('{') && partToEvaluate.endsWith('}');
                console.log('[evaluateSetOperation] partToEvaluate: ' + partToEvaluate + ', isFromBraces: ' + isFromBraces);
                const subtractSet = this.evaluateSetExpression(partToEvaluate, localSets, isFromBraces);
                console.log('[evaluateSetOperation] SubtractSet for ' + partToEvaluate + ':', new Set(subtractSet));

                subtractSet.forEach(item => {
                    console.log('[evaluateSetOperation] Attempting to delete ' + item + ' (type: ' + typeof item + ') from result.');
                    console.log('[evaluateSetOperation] Result before delete:', new Set(result));
                    const deleteSuccess = result.delete(item);
                    console.log('[evaluateSetOperation] Deleted ' + item + ', success: ' + deleteSuccess + '. Result after delete:', new Set(result));
                });
            }

            return result;
        }

        // 处理 << 运算符（集合加法）
        if (currentExpression.includes('<<')) {
            const parts = currentExpression.split('<<');
            const result = new Set();

            for (const part of parts) {
                let partToEvaluate = part.trim();
                // 去除行尾注释
                partToEvaluate = partToEvaluate.replace(/\s*\/\/.*$/, '').trim();
                const isFromBraces = partToEvaluate.startsWith('{') && partToEvaluate.endsWith('}');
                const partSet = this.evaluateSetExpression(partToEvaluate, localSets, isFromBraces);
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
        return await this.fileStorage.saveRulesToFile(this.rules, this.globalSets);
    }

    /**
     * 从文件导入规则
     */
    importRulesFromFile() {
        this.fileStorage.createFileInput(async (file) => {
            try {
                const importData = await this.fileStorage.loadRulesFromFile(file);
                await this.loadRulesFromData(importData.rules);

                // 导入全局集合（如果存在）
                if (importData.globalSets && Object.keys(importData.globalSets).length > 0) {
                    const newGlobalSets = new Map();
                    for (const [setName, setValues] of Object.entries(importData.globalSets)) {
                        newGlobalSets.set(setName, new Set(setValues));
                    }
                    this.updateGlobalSets(newGlobalSets);

                    // 保存到localStorage
                    localStorage.setItem('globalSets', JSON.stringify(importData.globalSets));
                }

                // 触发规则列表更新事件
                window.dispatchEvent(new CustomEvent('rulesUpdated'));

                // 触发全局集合更新事件
                window.dispatchEvent(new CustomEvent('globalSetsUpdated'));

                const ruleCount = Object.keys(importData.rules).length;
                const globalSetCount = Object.keys(importData.globalSets || {}).length;
                let message = `成功导入 ${ruleCount} 个规则！`;
                if (globalSetCount > 0) {
                    message += `\n同时导入了 ${globalSetCount} 个全局集合。`;
                }
                alert(message);
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

        // 应用排序规则排序
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

        if (rule.specificRule.startsWith('::')) {
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
        // 移除开头的 :
        const rulePattern = specificRule.substring(1);

        // 解析规则模式
        const pattern = this.parseRulePattern(rulePattern, localSets);

        // 检查单词是否匹配模式
        return this.matchesPattern(word, pattern);
    }

    /**
     * 检查单词是否匹配组合规则（支持括号、优先级，禁止&&!写法，只允许A ! B）
     * @param {string} word - 单词（小写）
     * @param {string} combinedRule - 组合规则
     * @param {Map} localSets - 本地集合映射
     * @returns {boolean} 是否匹配
     */
    matchesCombinedRule(word, combinedRule, localSets) {
        // 移除开头的 ::
        let ruleExpression = combinedRule.substring(2).trim();
        // 解析表达式为AST
        const ast = this.parseLogicExpression(ruleExpression);
        // 递归计算AST
        return this.evalLogicAST(word, ast, localSets);
    }

    /**
     * 解析逻辑表达式为AST（支持括号、优先级，!为二元运算符）
     * @param {string} expr
     * @returns {Object} AST
     */
    parseLogicExpression(expr) {
        // 分词
        const tokens = this.tokenizeLogic(expr);
        // Shunting Yard算法转为逆波兰表达式
        const output = [];
        const ops = [];
        const precedence = { '!': 3, '&&': 2, '||': 1, '~': 4 }; // 添加~的优先级
        const associativity = { '!': 'left', '&&': 'left', '||': 'left', '~': 'right' }; // 添加~的结合性
        for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];
            if (t.type === 'rule') {
                output.push({ type: 'rule', value: t.value });
            } else if (t.type === 'op' || t.type === 'neg') {
                while (
                    ops.length &&
                    ops[ops.length - 1].type !== 'lparen' &&
                    ((associativity[t.value] === 'left' && precedence[t.value] <= precedence[ops[ops.length - 1].value]) ||
                        (associativity[t.value] === 'right' && precedence[t.value] < precedence[ops[ops.length - 1].value]))
                ) {
                    output.push(ops.pop());
                }
                ops.push(t);
            } else if (t.type === 'lparen') {
                ops.push(t);
            } else if (t.type === 'rparen') {
                while (ops.length && ops[ops.length - 1].type !== 'lparen') {
                    output.push(ops.pop());
                }
                if (!ops.length) throw new Error('括号不匹配');
                ops.pop(); // 弹出左括号
            }
        }
        while (ops.length) {
            if (ops[ops.length - 1].type === 'lparen' || ops[ops.length - 1].type === 'rparen') throw new Error('括号不匹配');
            output.push(ops.pop());
        }
        // 逆波兰表达式转AST
        const stack = [];
        for (const token of output) {
            if (token.type === 'rule') {
                stack.push({ type: 'rule', value: token.value });
            } else if (token.type === 'op') {
                if (token.value === '!') {
                    // 差集运算符
                    if (stack.length < 2) throw new Error('差集运算符!缺少操作数');
                    const right = stack.pop();
                    const left = stack.pop();
                    stack.push({ type: 'not', left, right });
                } else if (token.value === '&&' || token.value === '||') {
                    if (stack.length < 2) throw new Error(token.value + ' 运算符缺少操作数');
                    const right = stack.pop();
                    const left = stack.pop();
                    stack.push({ type: token.value === '&&' ? 'and' : 'or', left, right });
                }
            } else if (token.type === 'neg') {
                // 规则取反
                if (stack.length < 1) throw new Error('规则取反运算符~缺少操作数');
                const operand = stack.pop();
                stack.push({ type: 'negate', operand });
            }
        }
        if (stack.length !== 1) throw new Error('表达式语法错误');
        return stack[0];
    }

    /**
     * 逻辑表达式分词
     * @param {string} expr
     * @returns {Array}
     */
    tokenizeLogic(expr) {
        const tokens = [];
        let i = 0;
        while (i < expr.length) {
            if (/\s/.test(expr[i])) {
                i++;
            } else if (expr.startsWith('&&', i)) {
                tokens.push({ type: 'op', value: '&&' });
                i += 2;
            } else if (expr.startsWith('||', i)) {
                tokens.push({ type: 'op', value: '||' });
                i += 2;
            } else if (expr[i] === '!') {
                tokens.push({ type: 'op', value: '!' });
                i++;
            } else if (expr[i] === '~') {
                tokens.push({ type: 'neg', value: '~' });
                i++;
            } else if (expr[i] === '(') {
                tokens.push({ type: 'lparen' });
                i++;
            } else if (expr[i] === ')') {
                tokens.push({ type: 'rparen' });
                i++;
            } else {
                // 规则名（允许字母、数字、下划线）
                let start = i;
                while (i < expr.length && /[\w\d_]/.test(expr[i])) i++;
                const name = expr.slice(start, i).trim();
                if (!name) throw new Error('缺少规则名');
                tokens.push({ type: 'rule', value: name });
            }
        }
        return tokens;
    }

    /**
     * 递归计算逻辑AST
     */
    evalLogicAST(word, node, localSets) {
        if (node.type === 'rule') {
            const referencedRule = this.getRule(node.value);
            if (!referencedRule) throw new Error(`组合规则中引用的基础规则 "${node.value}" 不存在`);
            if (referencedRule.specificRule.startsWith('::')) {
                throw new Error(`组合规则不能引用其他组合规则 "${node.value}"`);
            }
            return this.matchesRule(word, referencedRule);
        } else if (node.type === 'negate') {
            return !this.evalLogicAST(word, node.operand, localSets);
        } else if (node.type === 'not') {
            return this.evalLogicAST(word, node.left, localSets) && !this.evalLogicAST(word, node.right, localSets);
        } else if (node.type === 'and') {
            return this.evalLogicAST(word, node.left, localSets) && this.evalLogicAST(word, node.right, localSets);
        } else if (node.type === 'or') {
            return this.evalLogicAST(word, node.left, localSets) || this.evalLogicAST(word, node.right, localSets);
        }
        throw new Error('未知的逻辑节点类型');
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
            } else if (rulePattern[i] === '"') {
                // 字面字符（新语法：用双引号包裹）
                const end = rulePattern.indexOf('"', i + 1);
                if (end !== -1) {
                    const literal = rulePattern.substring(i + 1, end);
                    pattern.push({ type: 'literal', value: literal });
                    i = end + 1;
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
                } else if (element.value === '\\-b') {
                    // 不在开头：不能在单词的开始位置
                    if (wordIndex === 0) {
                        return false;
                    }
                } else if (element.value === '\\-e') {
                    // 不在结尾：不能在单词的结束位置
                    if (wordIndex === word.length) {
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
     * @param {string} displayRule - 排序规则
     * @returns {Array} 排序后的单词数组
     */
    applySorting(words, displayRule, localSets = new Map()) {
        if (!displayRule || !displayRule.startsWith('@')) {
            // 默认按字母顺序排序
            return this.sortByAlphabet(words);
        }

        // 解析排序规则
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
            return { word, groupKeys, isValid: groupKeys !== null };
        });

        // 将无法匹配的单词分离出来
        const validWords = wordsWithKeys.filter(item => item.isValid);
        const invalidWords = wordsWithKeys.filter(item => !item.isValid);

        // 对无效单词按字母顺序排序
        invalidWords.sort((a, b) => a.word.localeCompare(b.word));

        // 按分组键排序（只对有效单词排序）
        validWords.sort((a, b) => {
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

        // 合并有效单词和无效单词（无效单词排在最后）
        const sortedValidWords = validWords.map(item => item.word);
        const sortedInvalidWords = invalidWords.map(item => item.word);

        return [...sortedValidWords, ...sortedInvalidWords];
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
            let positionFlag = '^'; // 默认为前缀匹配，向后兼容

            // 检查是否是括号引用的集合
            if (sortRule[i] === '(') {
                const closeIndex = sortRule.indexOf(')', i);
                if (closeIndex === -1) {
                    throw new Error(`排序规则中括号不匹配: ${sortRule}`);
                }
                const content = sortRule.substring(i + 1, closeIndex);

                // 解析集合名和位置标识符
                const result = this.parseSetNameWithPosition(content);
                setName = result.setName;
                positionFlag = result.positionFlag;

                i = closeIndex + 1;
            } else {
                // 单字母集合，可能带位置标识符
                const result = this.parseSetNameWithPosition(sortRule.substring(i));
                setName = result.setName;
                positionFlag = result.positionFlag;
                i += result.consumed;
            }

            if (setName) {
                groups.push({ setName, positionFlag, descending });
            }
        }

        // 限制排序分级层数，最多允许三级
        if (groups.length > 3) {
            throw new Error(`排序规则层数超过限制，最多允许三级排序，当前为 ${groups.length} 级`);
        }

        return groups;
    }

    /**
     * 解析集合名和位置标识符
     * @param {string} content - 内容字符串
     * @returns {Object} 包含集合名、位置标识符和消费字符数的对象
     */
    parseSetNameWithPosition(content) {
        let setName = '';
        let positionFlag = '^'; // 默认前缀匹配
        let consumed = 0;

        // 提取集合名（字母开头，可包含数字）
        let i = 0;
        while (i < content.length && /[a-zA-Z0-9]/.test(content[i])) {
            setName += content[i];
            i++;
        }

        // 检查位置标识符
        if (i < content.length && /[\^\$\*~]/.test(content[i])) {
            positionFlag = content[i];
            i++;
        }

        consumed = i;

        return { setName, positionFlag, consumed };
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
        let lastMatchEnd = 0; // 记录上一个匹配的结束位置

        for (const group of sortGroups) {
            const result = this.findMatchingSetElementWithPosition(word, group.setName, localSets, group.positionFlag, lastMatchEnd);

            if (result.element) {
                keys.push(result.element);
                lastMatchEnd = result.endPosition; // 更新下一次搜索的起始位置
            } else {
                // 如果某一级无法匹配，整个多级匹配失败
                return null;
            }
        }

        return keys;
    }

    /**
     * 查找单词匹配的集合元素（带位置约束的版本）
     * @param {string} word - 单词
     * @param {string} setName - 集合名称
     * @param {Map} localSets - 局部集合映射
     * @param {string} positionFlag - 位置标识符 (^前缀, $后缀, *包含, ~严格中间)
     * @param {number} startPosition - 开始搜索的位置（用于多级排序的顺序约束）
     * @returns {Object} 包含匹配元素和位置信息的对象 {element, startPosition, endPosition}
     */
    findMatchingSetElementWithPosition(word, setName, localSets = new Map(), positionFlag = '^', startPosition = 0) {
        // 获取集合（优先使用局部集合）
        const set = this.getSet(setName, localSets);

        if (!set) {
            // 如果集合不存在，按首字母分组
            return {
                element: word.charAt(0).toLowerCase(),
                startPosition: 0,
                endPosition: 1
            };
        }

        const lowerWord = word.toLowerCase();

        // 按元素长度降序排列，优先匹配较长的元素
        const sortedElements = Array.from(set).sort((a, b) => b.length - a.length);

        // 根据位置标识符进行不同的匹配逻辑
        switch (positionFlag) {
            case '^': // 前缀匹配（默认）
                // 对于前缀匹配，只有在startPosition为0时才有效
                if (startPosition === 0) {
                    for (const element of sortedElements) {
                        const lowerElement = element.toLowerCase();
                        if (lowerWord.startsWith(lowerElement)) {
                            return {
                                element: lowerElement,
                                startPosition: 0,
                                endPosition: lowerElement.length
                            };
                        }
                    }
                }
                break;

            case '$': // 后缀匹配
                for (const element of sortedElements) {
                    const lowerElement = element.toLowerCase();
                    if (lowerWord.endsWith(lowerElement)) {
                        const matchStart = lowerWord.length - lowerElement.length;
                        // 检查匹配位置是否在startPosition之后
                        if (matchStart >= startPosition) {
                            return {
                                element: lowerElement,
                                startPosition: matchStart,
                                endPosition: lowerWord.length
                            };
                        }
                    }
                }
                break;

            case '*': // 包含匹配
                for (const element of sortedElements) {
                    const lowerElement = element.toLowerCase();
                    const index = lowerWord.indexOf(lowerElement, startPosition);
                    if (index !== -1) {
                        return {
                            element: lowerElement,
                            startPosition: index,
                            endPosition: index + lowerElement.length
                        };
                    }
                }
                break;

            case '~': // 严格中间匹配（元素必须出现在单词中间，不在首尾）
                for (const element of sortedElements) {
                    const lowerElement = element.toLowerCase();
                    const index = lowerWord.indexOf(lowerElement, Math.max(1, startPosition));
                    // 检查元素是否在中间位置（不在开头和结尾）且在startPosition之后
                    if (index > 0 && index < lowerWord.length - lowerElement.length && index >= startPosition) {
                        return {
                            element: lowerElement,
                            startPosition: index,
                            endPosition: index + lowerElement.length
                        };
                    }
                }
                break;
        }

        // 如果没有匹配的集合元素，返回null表示匹配失败
        return { element: null, startPosition: -1, endPosition: -1 };
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
            preview += ` /* ${rule.comment} */`;
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
            preview += `排序规则: ${rule.displayRule}\n`;
        }

        return preview;
    }
}