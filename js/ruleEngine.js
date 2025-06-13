/**
 * 规则引擎类
 * 负责解析和执行单词筛选规则
 */
class RuleEngine {
    constructor(fileStorage = null) {
        this.rules = new Map();
        this.globalSets = new Map();
        this.fileStorage = fileStorage || (typeof FileStorageManager !== 'undefined' ? new FileStorageManager() : null);

        // 内存缓存层：运行时缓存
        this.compiledRules = new Map();
        this.ruleCache = new Map();

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
        // 在Node.js环境中跳过localStorage操作
        if (typeof localStorage === 'undefined') {
            return;
        }

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
            } else if (line.includes('=') && !line.includes('==')) {
                // 检查是否是错误的单等号集合定义
                throw new Error(`集合定义需要使用双等号(==): ${line}`);
            } else if (line.startsWith(':') && !line.startsWith('::')) {
                // 普通规则
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
            throw new Error('筛选规则不能为空');
        }

        // 验证集合定义和引用的顺序
        this.validateDefinitionOrder(lines, localSets, specificRule, displayRule);

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
     * 验证集合定义和引用的顺序
     * @param {Array} lines - 规则文本行数组
     * @param {Map} localSets - 局部集合
     * @param {string} specificRule - 筛选规则
     * @param {string} displayRule - 排序规则
     */
    validateDefinitionOrder(lines, localSets, specificRule, displayRule) {
        const setDefinitionLines = new Map(); // 集合名 -> 行号
        const setReferenceLines = new Map(); // 集合名 -> 首次引用行号
        let specificRuleLine = -1;
        let displayRuleLine = -1;

        // 遍历所有行，记录集合定义和引用的位置
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();

            // 跳过注释行
            if (line.startsWith('#') || line.startsWith('//') || !line) {
                continue;
            }

            // 移除行尾注释
            line = line.replace(/\/\/.*$/, '').trim();
            if (!line) continue;

            // 记录集合定义行
            if (line.includes('==')) {
                const [setName] = line.split('==');
                const cleanSetName = setName.trim();
                setDefinitionLines.set(cleanSetName, i);
            }
            // 记录筛选规则行
            else if (line.startsWith(':')) {
                if (specificRuleLine === -1) {
                    specificRuleLine = i;
                }
            }
            // 记录排序规则行
            else if (line.startsWith('@')) {
                if (displayRuleLine === -1) {
                    displayRuleLine = i;
                }
            }
        }

        // 检查筛选规则中的集合引用
        if (specificRule && specificRuleLine !== -1) {
            const referencedSets = this.extractSetReferences(specificRule);
            for (const setName of referencedSets) {
                if (localSets.has(setName)) {
                    const definitionLine = setDefinitionLines.get(setName);
                    if (definitionLine !== undefined && definitionLine > specificRuleLine) {
                        throw new Error(`集合 "${setName}" 在第 ${definitionLine + 1} 行定义，但在第 ${specificRuleLine + 1} 行的筛选规则中被引用。集合定义必须在引用之前。`);
                    }
                }
            }
        }

        // 检查排序规则中的集合引用
        if (displayRule && displayRuleLine !== -1) {
            const referencedSets = this.extractSetReferences(displayRule);
            for (const setName of referencedSets) {
                if (localSets.has(setName)) {
                    const definitionLine = setDefinitionLines.get(setName);
                    if (definitionLine !== undefined && definitionLine > displayRuleLine) {
                        throw new Error(`集合 "${setName}" 在第 ${definitionLine + 1} 行定义，但在第 ${displayRuleLine + 1} 行的排序规则中被引用。集合定义必须在引用之前。`);
                    }
                }
            }
        }
    }

    /**
     * 验证规则的有效性
     * @param {Object} rule - 规则对象
     */
    validateRule(rule) {
        // 1. 验证集合定义中的集合运算引用
        this.validateSetDefinitions(rule.localSets);

        // 2. 验证普通规则中的集合引用
        if (!rule.specificRule.startsWith('::')) {
            this.validateBasicRuleReferences(rule.specificRule, rule.localSets);
            // 验证普通规则的格式
            this.validateSpecificRuleFormat(rule.specificRule, rule.localSets);
        }

        // 3. 验证组合规则中的普通规则引用
        if (rule.specificRule.startsWith('::')) {
            this.validateCombinedRuleReferences(rule.specificRule);
        }

        // 4. 验证排序规则中的集合引用
        if (rule.displayRule) {
            this.validateSortRuleReferences(rule.displayRule, rule.localSets, rule.specificRule.startsWith('::'));
            // 验证新的排序规则格式
            this.validateNewSortRuleFormat(rule.displayRule);
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
     * 验证普通规则的格式
     * @param {string} specificRule - 筛选规则
     * @param {Map} localSets - 本地集合映射
     */
    validateSpecificRuleFormat(specificRule, localSets) {
        if (!specificRule.startsWith(':')) {
            throw new Error('筛选规则必须以:开头');
        }

        // 移除开头的:
        const rulePattern = specificRule.substring(1);

        // 检查括号、引号是否成对出现
        let openParenCount = 0;
        let openQuoteCount = 0;

        // 首先进行括号检查，避免后续处理中遇到问题
        for (let j = 0; j < rulePattern.length; j++) {
            if (rulePattern[j] === '(') {
                openParenCount++;
            } else if (rulePattern[j] === ')') {
                openParenCount--;
                if (openParenCount < 0) {
                    throw new Error('筛选规则中括号不匹配：有多余的右括号');
                }
            } else if (rulePattern[j] === '"') {
                openQuoteCount = 1 - openQuoteCount; // 0->1, 1->0
            }
        }

        // 最终检查括号和引号是否闭合
        if (openParenCount > 0) {
            throw new Error('筛选规则中括号不匹配：有未闭合的左括号');
        }

        if (openQuoteCount !== 0) {
            throw new Error('筛选规则中引号不匹配：有未闭合的引号');
        }

        // 重置计数器，开始详细规则验证
        openParenCount = 0;
        openQuoteCount = 0;
        let i = 0;

        // 锚点验证：检查重复锚点和只有锚点的情况
        this.validateAnchors(rulePattern);

        while (i < rulePattern.length) {
            // 处理位置锚点
            if (rulePattern[i] === '\\') {
                // 跳过位置标记
                if (i + 1 < rulePattern.length && /[be]/.test(rulePattern[i + 1])) {
                    i += 2; // 跳过 \b 或 \e
                } else if (i + 2 < rulePattern.length && rulePattern[i + 1] === '-' && /[be]/.test(rulePattern[i + 2])) {
                    i += 3; // 跳过 \-b 或 \-e
                } else {
                    i++; // 跳过单个反斜杠
                }
                continue;
            }

            // 检查单独的数字（不允许）
            if (/[0-9]/.test(rulePattern[i]) && openQuoteCount === 0) {
                // 如果数字不是作为集合名后缀出现，而是单独出现
                const isAfterSetName = i > 0 && /[A-Z]/.test(rulePattern[i - 1]);

                if (!isAfterSetName) {
                    throw new Error(`筛选规则中不允许使用数字 "${rulePattern[i]}"`);
                }
            }

            // 处理括号内的多字母集合引用
            if (rulePattern[i] === '(') {
                // 找到对应的右括号位置
                let endPos = i + 1;
                let depth = 1;

                while (endPos < rulePattern.length && depth > 0) {
                    if (rulePattern[endPos] === '(') depth++;
                    if (rulePattern[endPos] === ')') depth--;
                    endPos++;
                }

                // 提取多字母集合名称
                if (depth === 0) { // 如果找到了匹配的右括号
                    const setName = rulePattern.substring(i + 1, endPos - 1);
                    // 验证集合名称格式
                    if (/^[a-zA-Z][a-zA-Z0-9]*$/.test(setName)) {
                        // 检查多字母集合是否存在
                        const setExists = this.globalSets.has(setName) || localSets.has(setName);
                        if (!setExists) {
                            throw new Error(`筛选规则中引用的多字母集合 "${setName}" 不存在`);
                        }
                    } else {
                        throw new Error(`筛选规则中集合名称格式不正确: "${setName}"`);
                    }
                    i = endPos; // 跳过整个括号内容
                    continue;
                }
            }

            // 处理引号
            if (rulePattern[i] === '"') {
                // 找到对应的右引号位置
                const endPos = rulePattern.indexOf('"', i + 1);
                if (endPos !== -1) {
                    i = endPos + 1; // 跳过整个引号内容
                    continue;
                } else {
                    throw new Error('筛选规则中引号不匹配：有未闭合的引号');
                }
            }

            // 检查单字母集合引用（仅当不在引号内）
            if (/[A-Z]/.test(rulePattern[i]) && openQuoteCount === 0) {
                const char = rulePattern[i];

                // 检查单字母集合是否存在
                const setExists = this.globalSets.has(char) || localSets.has(char);
                if (!setExists) {
                    throw new Error(`筛选规则中引用的单字母集合 "${char}" 不存在`);
                }

                // 检查后面是否紧跟字母或数字（非法格式）
                if (i + 1 < rulePattern.length && /[0-9a-z]/.test(rulePattern[i + 1]) && rulePattern[i + 1] !== '+') {
                    const invalidChar = rulePattern[i + 1];
                    throw new Error(`集合名称 "${char}" 后不能跟随无意义的字符 "${invalidChar}"`);
                }
            }

            // 检查小写字母（仅当不在引号内）
            if (/[a-z]/.test(rulePattern[i]) && openQuoteCount === 0) {
                // 检查是否在合法的位置标记内
                if (i > 0 && rulePattern[i - 1] === '\\' && /[be]/.test(rulePattern[i])) {
                    // 这是位置标记的一部分，如 \b 或 \e，已经在前面处理过了
                } else if (i > 1 && rulePattern[i - 2] === '\\' && rulePattern[i - 1] === '-' && /[be]/.test(rulePattern[i])) {
                    // 这是位置标记的一部分，如 \-b 或 \-e，已经在前面处理过了
                } else {
                    throw new Error(`筛选规则中存在无效字符 "${rulePattern[i]}"。小写字母只能出现在引号内作为字面量`);
                }
            }

            // 检查+量词的位置是否合法
            if (rulePattern[i] === '+' && openQuoteCount === 0) {
                // +量词必须跟在集合或字面字符串后面
                if (i === 0) {
                    throw new Error('量词+不能出现在规则开头');
                }

                // 检查+前面的字符
                let validPrevious = false;

                // 情况1：前面是单字母集合
                if (i > 0 && /[A-Z]/.test(rulePattern[i - 1])) {
                    validPrevious = true;
                }

                // 情况2：前面是括号集合的右括号
                if (i > 0 && rulePattern[i - 1] === ')') {
                    validPrevious = true;
                }

                // 情况3：前面是字面字符串的右引号
                if (i > 0 && rulePattern[i - 1] === '"') {
                    validPrevious = true;
                }

                if (!validPrevious) {
                    throw new Error('量词+只能跟在集合或字面字符串后面');
                }

                // 检查是否有连续的+
                if (i + 1 < rulePattern.length && rulePattern[i + 1] === '+') {
                    throw new Error('不允许连续的量词++');
                }
            }

            // 检查非字母数字字符是否合法（排除已处理的括号、引号和位置标记）
            if (!/[A-Za-z0-9\(\)"\\+\-]/.test(rulePattern[i]) && openQuoteCount === 0) {
                throw new Error(`筛选规则中存在无效字符 "${rulePattern[i]}"`);
            }

            i++;
        }
    }

    /**
     * 验证锚点的合理性
     * @param {string} rulePattern - 规则模式（去掉开头的:）
     */
    validateAnchors(rulePattern) {
        const anchors = [];
        let hasNonAnchorContent = false;

        let i = 0;
        while (i < rulePattern.length) {
            if (rulePattern[i] === '\\') {
                // 检查位置锚点
                if (i + 1 < rulePattern.length && rulePattern[i + 1] === 'b') {
                    anchors.push({ type: '\\b', position: i });
                    i += 2;
                } else if (i + 1 < rulePattern.length && rulePattern[i + 1] === 'e') {
                    anchors.push({ type: '\\e', position: i });
                    i += 2;
                } else if (i + 2 < rulePattern.length && rulePattern[i + 1] === '-' && rulePattern[i + 2] === 'b') {
                    anchors.push({ type: '\\-b', position: i });
                    i += 3;
                } else if (i + 2 < rulePattern.length && rulePattern[i + 1] === '-' && rulePattern[i + 2] === 'e') {
                    anchors.push({ type: '\\-e', position: i });
                    i += 3;
                } else {
                    i++;
                }
            } else if (rulePattern[i] === '"') {
                // 跳过引号内容
                const endPos = rulePattern.indexOf('"', i + 1);
                if (endPos !== -1) {
                    hasNonAnchorContent = true;
                    i = endPos + 1;
                } else {
                    i++;
                }
            } else if (/[A-Z()]/.test(rulePattern[i])) {
                // 集合引用或括号集合
                hasNonAnchorContent = true;
                i++;
            } else {
                i++;
            }
        }

        // 1. 检查是否只有锚点没有其他内容
        if (anchors.length > 0 && !hasNonAnchorContent) {
            throw new Error('规则不能只包含锚点，必须包含至少一个集合引用或字面字符串');
        }

        // 2. 检查重复锚点和冲突组合（优先检查）
        const beginAnchors = anchors.filter(a => a.type === '\\b' || a.type === '\\-b');
        const endAnchors = anchors.filter(a => a.type === '\\e' || a.type === '\\-e');

        // 检查冲突的锚点组合
        const hasBeginAnchor = beginAnchors.some(a => a.type === '\\b');
        const hasNonBeginAnchor = beginAnchors.some(a => a.type === '\\-b');
        const hasEndAnchor = endAnchors.some(a => a.type === '\\e');
        const hasNonEndAnchor = endAnchors.some(a => a.type === '\\-e');

        if (hasBeginAnchor && hasNonBeginAnchor) {
            throw new Error('规则中不能同时包含 \\b 和 \\-b 锚点，它们的语义相互冲突');
        }

        if (hasEndAnchor && hasNonEndAnchor) {
            throw new Error('规则中不能同时包含 \\e 和 \\-e 锚点，它们的语义相互冲突');
        }

        if (beginAnchors.length > 1) {
            const types = beginAnchors.map(a => a.type).join(' 和 ');
            throw new Error(`规则中不能包含重复的前锚点：${types}`);
        }

        if (endAnchors.length > 1) {
            const types = endAnchors.map(a => a.type).join(' 和 ');
            throw new Error(`规则中不能包含重复的后锚点：${types}`);
        }

        // 3. 检查锚点位置：只能在最前或最后
        for (const anchor of anchors) {
            const isBeginAnchor = anchor.type === '\\b' || anchor.type === '\\-b';
            const isEndAnchor = anchor.type === '\\e' || anchor.type === '\\-e';

            if (isBeginAnchor && anchor.position !== 0) {
                throw new Error(`前锚点 ${anchor.type} 只能出现在规则的最前面`);
            }

            if (isEndAnchor) {
                // 计算锚点应该在的位置（规则末尾）
                const expectedEndPos = rulePattern.length - anchor.type.length;
                if (anchor.position !== expectedEndPos) {
                    throw new Error(`后锚点 ${anchor.type} 只能出现在规则的最后面`);
                }
            }
        }
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
     * 验证普通规则中的集合引用
     * @param {string} specificRule - 普通规则
     * @param {Map} localSets - 本地集合映射
     */
    validateBasicRuleReferences(specificRule, localSets) {
        const referencedSets = this.extractSetReferences(specificRule);

        for (const refSetName of referencedSets) {
            if (!this.globalSets.has(refSetName) && !localSets.has(refSetName)) {
                throw new Error(`普通规则中引用的集合 "${refSetName}" 不存在`);
            }
        }
    }

    /**
     * 验证组合规则中的普通规则引用
     * @param {string} combinedRule - 组合规则
     */
    validateCombinedRuleReferences(combinedRule) {
        // 检查双冒号后是否为空
        const ruleContent = combinedRule.substring(2).trim();
        if (!ruleContent) {
            throw new Error('组合规则双冒号后不能为空，必须包含规则引用');
        }

        // 验证组合规则语法和操作数完整性
        this.validateCombinedRuleSyntax(ruleContent);

        // 提取组合规则中引用的普通规则名称
        const referencedRules = this.extractRuleReferences(combinedRule);

        // 检查是否有有效的规则引用
        if (referencedRules.length === 0) {
            throw new Error('组合规则必须包含至少一个有效的规则引用');
        }

        for (const refRuleName of referencedRules) {
            const referencedRule = this.rules.get(refRuleName);
            if (!referencedRule) {
                throw new Error(`组合规则中引用的普通规则 "${refRuleName}" 不存在`);
            }

            // 检查引用的规则是否也是组合规则（不允许组合规则引用组合规则）
            if (referencedRule.specificRule.startsWith('::')) {
                throw new Error(`组合规则不能引用其他组合规则 "${refRuleName}"`);
            }
        }
    }

    /**
     * 验证组合规则语法和操作数完整性
     * @param {string} ruleContent - 组合规则内容（不含::前缀）
     */
    validateCombinedRuleSyntax(ruleContent) {
        try {
            // 分词
            const tokens = this.tokenizeLogic(ruleContent);

            // 检查操作数完整性
            this.validateOperands(tokens);

            // 尝试解析为AST以验证语法
            this.parseLogicExpression(ruleContent);
        } catch (error) {
            throw new Error(`组合规则语法错误: ${error.message}`);
        }
    }

    /**
     * 验证操作数完整性
     * @param {Array} tokens - 分词结果
     */
    validateOperands(tokens) {
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];

            // 检查取反操作符~的操作数
            if (token.type === 'neg' && token.value === '~') {
                // 取反操作符后面必须有操作数
                let nextTokenIndex = i + 1;

                // 跳过左括号和其他取反操作符（支持连续取反如~~A）
                while (nextTokenIndex < tokens.length &&
                    (tokens[nextTokenIndex].type === 'lparen' || tokens[nextTokenIndex].type === 'neg')) {
                    nextTokenIndex++;
                }

                // 检查是否有有效的操作数
                if (nextTokenIndex >= tokens.length ||
                    tokens[nextTokenIndex].type !== 'rule') {
                    throw new Error('取反操作符~缺少操作数');
                }
            }

            // 检查二元操作符的操作数
            if (token.type === 'op' && (token.value === '&&' || token.value === '||' || token.value === '!')) {
                // 检查左操作数
                let prevTokenIndex = i - 1;
                while (prevTokenIndex >= 0 &&
                    (tokens[prevTokenIndex].type === 'rparen')) {
                    prevTokenIndex--;
                }

                if (prevTokenIndex < 0 ||
                    (tokens[prevTokenIndex].type !== 'rule' && tokens[prevTokenIndex].type !== 'rparen')) {
                    throw new Error(`${token.value}操作符缺少左操作数`);
                }

                // 检查右操作数
                let nextTokenIndex = i + 1;
                while (nextTokenIndex < tokens.length &&
                    (tokens[nextTokenIndex].type === 'lparen' || tokens[nextTokenIndex].type === 'neg')) {
                    nextTokenIndex++;
                }

                if (nextTokenIndex >= tokens.length ||
                    tokens[nextTokenIndex].type !== 'rule') {
                    throw new Error(`${token.value}操作符缺少右操作数`);
                }
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

        // 正确处理@@前缀（严格相邻匹配）和@前缀（松散匹配）
        const sortRule = displayRule.startsWith('@@') ? displayRule.substring(2) : displayRule.substring(1);
        if (sortRule === '' || sortRule === '-') {
            return; // 基础字母排序，无需验证
        }

        // 解析排序规则
        try {
            const parseResult = this.parseSortRule(sortRule);
            const sortGroups = parseResult.groups;

            // 检查排序层级（最多三级）
            if (sortGroups.length > 3) {
                throw new Error(`排序规则层数超过限制，最多允许三级排序，当前为 ${sortGroups.length} 级`);
            }

            // 验证每个排序组中引用的集合
            for (const group of sortGroups) {
                const setName = group.setName;

                // 检查集合是否存在
                if (!this.globalSets.has(setName) && !localSets.has(setName)) {
                    // 注释掉第三种支持：引用普通规则中的局部集合
                    // 原因：避免引用的普通规则中局部定义不一致的问题，且当前实现有BUG
                    // if (isCombinedRule) {
                    //     let foundInReferencedRule = false;
                    //     const referencedRules = this.extractRuleReferences(displayRule);
                    //
                    //     for (const refRuleName of referencedRules) {
                    //         const referencedRule = this.rules.get(refRuleName);
                    //         if (referencedRule && referencedRule.localSets && referencedRule.localSets.has(setName)) {
                    //             foundInReferencedRule = true;
                    //             break;
                    //         }
                    //     }
                    //
                    //     if (!foundInReferencedRule) {
                    //         throw new Error(`排序规则中引用的集合 "${setName}" 不存在`);
                    //     }
                    // } else {
                    //     throw new Error(`排序规则中引用的集合 "${setName}" 不存在`);
                    // }

                    // 简化逻辑：排序规则只支持全局集合和当前组合规则的局部集合
                    throw new Error(`排序规则中引用的集合 "${setName}" 不存在`);
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

        if (ruleName.length > 20) {
            throw new Error('规则名称长度不能超过20个字符');
        }

        // 检查规则名称是否包含特殊字符
        if (!/^[\u4e00-\u9fa5a-zA-Z0-9_]+$/.test(ruleName)) {
            throw new Error('规则名称只能包含中文、英文、数字和下划线');
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

        // 处理集合运算：如 A>>B, A<<B, a>>b, a<<b (不包括 A>>{xxx} 这样的字面值运算)
        const operationMatches = text.match(/([A-Za-z])\s*(>>|<<)\s*([A-Za-z])/g);
        if (operationMatches) {
            for (const match of operationMatches) {
                const parts = match.match(/([A-Za-z])\s*(>>|<<)\s*([A-Za-z])/);
                if (parts) {
                    setNames.push(parts[1]); // 左侧集合
                    setNames.push(parts[3]); // 右侧集合
                }
            }
        }

        // 匹配单字母集合名称（包括大写和小写），但排除特殊上下文
        // 先移除已经处理过的内容，避免重复匹配
        let textWithoutSpecial = text.replace(/\([a-zA-Z][a-zA-Z0-9]*\)/g, ''); // 移除括号集合
        textWithoutSpecial = textWithoutSpecial.replace(/[A-Za-z]\s*(>>|<<)\s*([A-Za-z]|\{[^}]*\})/g, ''); // 移除集合运算
        textWithoutSpecial = textWithoutSpecial.replace(/\\(-?[be])/g, ''); // 移除 \b, \e, \-b, \-e 等位置锚点
        textWithoutSpecial = textWithoutSpecial.replace(/@\([^)]*\)/g, ''); // 移除 @(xxx) 排序规则
        textWithoutSpecial = textWithoutSpecial.replace(/@[A-Za-z]/g, ''); // 移除 @X 单字母排序规则
        textWithoutSpecial = textWithoutSpecial.replace(/\{[^}]*\}/g, ''); // 移除 {xxx} 内容
        textWithoutSpecial = textWithoutSpecial.replace(/"[^"]*"/g, ''); // 移除 "xxx" 字面字符串

        const singleLetterMatches = textWithoutSpecial.match(/[A-Za-z]/g);
        if (singleLetterMatches) {
            for (const match of singleLetterMatches) {
                setNames.push(match);
            }
        }

        return [...new Set(setNames)]; // 去重
    }

    /**
     * 提取组合规则中引用的普通规则名称
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
        const builtinSetNames = this.getBuiltinSetNames();
        for (const setName of localSets.keys()) {
            // 只检查是否与默认集合冲突，允许覆盖自定义全局集合
            if (builtinSetNames.includes(setName)) {
                throw new Error(`局部集合名称 "${setName}" 与默认集合冲突`);
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
     * 实时预览规则效果
     * @param {string} ruleName - 规则名称
     * @returns {string} 规则预览内容
     */
    previewRule(ruleName) {
        const rule = this.getRule(ruleName);
        if (!rule) {
            return '规则不存在';
        }

        let preview = `规则名称: ${rule.name}\n`;
        if (rule.comment) {
            preview += `注释: ${rule.comment}\n`;
        }

        // 显示局部集合定义
        if (rule.localSets.size > 0) {
            preview += '\n局部集合:\n';
            for (const [setName, setValues] of rule.localSets) {
                preview += `  ${setName} = {${Array.from(setValues).join(', ')}}\n`;
            }
        }

        preview += `\n匹配规则: ${rule.specificRule}\n`;
        if (rule.displayRule) {
            preview += `排序规则: ${rule.displayRule}\n`;
        }

        return preview;
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
        // 检查是否使用了单等号而非双等号
        // 匹配类似 "T={a,b,c}" 的模式，但不包含双等号
        if (line.includes('=') && !line.includes('==')) {
            // 检查是否看起来像集合定义（包含等号和大括号）
            if (line.includes('{') && line.includes('}')) {
                throw new Error(`集合定义需要使用双等号(==): ${line}`);
            }
            // 检查是否是简单的 name=value 格式（可能是错误的集合定义）
            const equalIndex = line.indexOf('=');
            if (equalIndex > 0 && equalIndex < line.length - 1) {
                const beforeEqual = line.substring(0, equalIndex).trim();
                const afterEqual = line.substring(equalIndex + 1).trim();
                // 如果等号前是标识符，等号后包含大括号，很可能是错误的集合定义
                if (/^[a-zA-Z][a-zA-Z0-9]*$/.test(beforeEqual) && afterEqual.includes('{')) {
                    throw new Error(`集合定义需要使用双等号(==): ${line}`);
                }
            }
        }

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
        const originalExpression = expression;

        // 检查是否有大括号（在处理运算符之前）
        const hasBraces = expression.startsWith('{') && expression.endsWith('}');

        // 处理集合运算符（在移除大括号之前）
        if (expression.includes('>>') || expression.includes('<<')) {
            return this.evaluateSetOperation(expression, localSets);
        }

        // 情况1：双引号字面字符串（如 "abc"）
        if (!hasBraces && expression.startsWith('"') && expression.endsWith('"')) {
            const content = expression.slice(1, -1);
            resultSet.add(content);
            return resultSet;
        }

        // 情况2：集合名引用（单大写字母或括号形式）
        if (!hasBraces) {
            // 单大写字母集合名
            if (/^[A-Z]$/.test(expression)) {
                const referencedSet = this.getSet(expression, localSets);
                if (referencedSet) {
                    referencedSet.forEach(item => resultSet.add(item));
                    return resultSet;
                } else {
                    throw new Error(`集合 "${expression}" 不存在`);
                }
            }
            // 括号形式的集合名（支持单字母和多字母）
            else if (expression.startsWith('(') && expression.endsWith(')')) {
                const setName = expression.slice(1, -1);
                // 单字母集合名必须是大写，多字母集合名必须以字母开头
                if (/^[A-Z]$/.test(setName) || /^[a-zA-Z][a-zA-Z0-9]*$/.test(setName)) {
                    const referencedSet = this.getSet(setName, localSets);
                    if (referencedSet) {
                        referencedSet.forEach(item => resultSet.add(item));
                        return resultSet;
                    } else {
                        throw new Error(`集合 "${setName}" 不存在`);
                    }
                } else {
                    throw new Error(`无效的集合名格式: ${expression}`);
                }
            }
            // 其他情况都不允许
            else {
                throw new Error(`无效的集合定义格式: ${originalExpression}。只允许：1）单大写字母集合名(如A) 2）括号集合名(如(ShortV)) 3）大括号字面集合(如{a,b}) 4）双引号字面字符串(如"abc")`);
            }
        }

        // 情况3：大括号字面集合（如 {a,b,c}）
        if (hasBraces) {
            expression = expression.slice(1, -1);

            // 分割元素
            const elements = this.splitElements(expression);

            for (const element of elements) {
                const trimmedElement = element.trim();
                if (trimmedElement === '') {
                    resultSet.add('');
                } else {
                    // 大括号内的元素都作为字面值处理，保持原样不去除引号
                    // 例如：{"hello"} 中的 "hello" 应该匹配带引号的字符串
                    resultSet.add(trimmedElement);
                }
            }
            return resultSet;
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

            // 验证左侧操作数
            const leftPart = parts[0].trim();
            this.validateSetOperand(leftPart, localSets);
            let result = this.evaluateSetExpression(leftPart, localSets);
            console.log('[evaluateSetOperation] Initial result for ' + leftPart + ':', new Set(result));

            for (let i = 1; i < parts.length; i++) {
                let partToEvaluate = parts[i].trim();
                // 去除行尾注释
                partToEvaluate = partToEvaluate.replace(/\s*\/\/.*$/, '').trim();

                // 验证右侧操作数
                this.validateSetOperand(partToEvaluate, localSets);

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

                // 验证操作数
                this.validateSetOperand(partToEvaluate, localSets);

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
        // 排除带引号的字符串，这些应该作为字面值处理
        if ((str.startsWith('"') && str.endsWith('"')) ||
            (str.startsWith("'") && str.endsWith("'"))) {
            return false;
        }

        // 单字母集合只允许大写字母
        if (str.length === 1 && /^[A-Z]$/.test(str)) {
            return true;
        }

        // 括号形式的集合名（支持单字母和多字母）
        if (str.startsWith('(') && str.endsWith(')')) {
            const setName = str.slice(1, -1);
            // 单字母集合名必须是大写，多字母集合名必须以字母开头
            return /^[A-Z]$/.test(setName) || /^[a-zA-Z][a-zA-Z0-9]*$/.test(setName);
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
     * 验证集合运算操作数
     * @param {string} operand - 操作数
     * @param {Map} localSets - 本地集合映射
     */
    validateSetOperand(operand, localSets) {
        // 情况1：大括号字面集合
        if (operand.startsWith('{') && operand.endsWith('}')) {
            return;
        }

        // 情况2：双引号字面字符串
        if (operand.startsWith('"') && operand.endsWith('"')) {
            return;
        }

        // 情况3：单大写字母集合名
        if (/^[A-Z]$/.test(operand)) {
            const referencedSet = this.getSet(operand, localSets);
            if (!referencedSet) {
                throw new Error(`集合 "${operand}" 不存在`);
            }
            return;
        }

        // 情况4：括号形式的集合名（支持单字母和多字母）
        if (operand.startsWith('(') && operand.endsWith(')')) {
            const setName = operand.slice(1, -1);
            // 单字母集合名必须是大写，多字母集合名必须以字母开头
            if (/^[A-Z]$/.test(setName) || /^[a-zA-Z][a-zA-Z0-9]*$/.test(setName)) {
                const referencedSet = this.getSet(setName, localSets);
                if (!referencedSet) {
                    throw new Error(`集合 "${setName}" 不存在`);
                }
                return;
            } else {
                throw new Error(`无效的集合名格式: ${operand}`);
            }
        }

        // 其他情况都不允许
        throw new Error(`无效的集合操作数格式: ${operand}。只允许：1）单大写字母集合名(如A) 2）括号集合名(如(ShortV)) 3）大括号字面集合(如{a,b}) 4）双引号字面字符串(如"abc")`);
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
            // 添加调试信息，特别关注"末尾Xle"规则
            if (name === '末尾Xle') {
                // Debug logs removed for performance
            }

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

            // 添加调试信息，确认规则对象的最终状态
            if (name === '末尾Xle') {
                // Debug logs removed for performance
            }

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
        // console.log(`[DEBUG] ===== matchesRule: word="${word}" =====`);
        // console.log(`[DEBUG] rule:`, rule);

        const lowerWord = word.toLowerCase();

        if (rule.specificRule.startsWith('::')) {
            // 组合规则
            // console.log(`[DEBUG] using combined rule`);
            const result = this.matchesCombinedRule(lowerWord, rule.specificRule, rule.localSets);
            // console.log(`[DEBUG] matchesCombinedRule result: ${result}`);
            return result;
        } else {
            // 普通规则
            // console.log(`[DEBUG] using specific rule`);
            const result = this.matchesSpecificRule(lowerWord, rule.specificRule, rule.localSets);
            // console.log(`[DEBUG] matchesSpecificRule result: ${result}`);
            return result;
        }
    }

    /**
     * 检查单词是否匹配普通规则
     * @param {string} word - 单词（小写）
     * @param {string} specificRule - 筛选规则
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
                // 规则名（允许字母、数字、下划线、中文字符）
                let start = i;
                while (i < expr.length && /[\w\d_\u4e00-\u9fff]/.test(expr[i])) i++;
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
            if (!referencedRule) throw new Error(`组合规则中引用的普通规则 "${node.value}" 不存在`);
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
                    let element = { type: 'literal', value: literal };
                    i = end + 1;

                    // 检查是否有量词
                    if (i < rulePattern.length && rulePattern[i] === '+') {
                        element.quantifier = '+';
                        i++;
                    }
                    pattern.push(element);
                } else {
                    // 引号不闭合，抛出错误
                    throw new Error('规则模式中引号不匹配：存在未闭合的引号');
                }
            } else if (rulePattern[i] === '(') {
                // 集合引用（括号内的集合名，支持多字母）
                const setEnd = rulePattern.indexOf(')', i);
                if (setEnd !== -1) {
                    const setName = rulePattern.substring(i + 1, setEnd);
                    const set = this.getSet(setName, localSets);
                    let element;
                    if (!set) {
                        throw new Error(`集合 "${setName}" 未找到`);
                    } else {
                        element = {
                            type: 'set',
                            value: set,
                            bracketSet: true,  // 标记这是一个括号集合
                            setName: setName    // 保存集合名称用于调试
                        };
                    }
                    i = setEnd + 1;

                    // 检查是否有量词
                    if (i < rulePattern.length && rulePattern[i] === '+') {
                        element.quantifier = '+';
                        i++;
                    }
                    pattern.push(element);
                } else {
                    // 括号不闭合，抛出错误
                    throw new Error('规则模式中括号不匹配：存在未闭合的左括号');
                }
            } else if (this.isSetName(rulePattern[i])) {
                // 单字母集合名称（直接引用）
                const set = this.getSet(rulePattern[i], localSets);
                let element;
                if (!set) {
                    throw new Error(`集合 "${rulePattern[i]}" 未找到`);
                } else {
                    element = {
                        type: 'set',
                        value: set,
                        setName: rulePattern[i]  // 保存集合名称用于调试
                    };
                }
                i++;

                // 检查是否有量词
                if (i < rulePattern.length && rulePattern[i] === '+') {
                    element.quantifier = '+';
                    i++;
                }
                pattern.push(element);
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
            // 检查具体的锚点类型
            const hasBeginAnchor = pattern.some(el => el.type === 'position' && el.value === '\\b');
            const hasNonBeginAnchor = pattern.some(el => el.type === 'position' && el.value === '\\-b');
            const hasEndAnchor = pattern.some(el => el.type === 'position' && (el.value === '\\e' || el.value === '\\-e'));

            if (hasNonBeginAnchor && !hasBeginAnchor) {
                // 如果只有 \-b 锚点（不能从开头开始），从位置 1 开始尝试
                for (let startPos = 1; startPos <= word.length - this.getPatternMinLength(pattern); startPos++) {
                    if (this.matchesPatternAtPosition(word, pattern, startPos)) {
                        return true;
                    }
                }
                return false;
            } else {
                // 其他情况（包含 \b 或 \e 或 \-e），从位置 0 开始
                return this.matchesPatternAtPosition(word, pattern, 0);
            }
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
        // console.log(`[DEBUG] matchesPatternAtPosition: word="${word}", startPos=${startPos}`);
        // console.log(`[DEBUG] pattern:`, pattern);

        // 检查是否有位置锚点
        const hasBeginAnchor = pattern.some(el => el.type === 'position' && (el.value === '\\b' || el.value === '\\-b'));
        const hasEndAnchor = pattern.some(el => el.type === 'position' && (el.value === '\\e' || el.value === '\\-e'));

        // console.log(`[DEBUG] hasBeginAnchor: ${hasBeginAnchor}, hasEndAnchor: ${hasEndAnchor}`);

        if (hasBeginAnchor || hasEndAnchor) {
            const result = this.matchesPatternWithAnchors(word, pattern, startPos);
            // console.log(`[DEBUG] matchesPatternWithAnchors result: ${result}`);
            return result;
        } else {
            // 对于单个集合规则（如:V），使用部分匹配而不是完全匹配
            // 这样:V规则就能正确匹配包含元音的单词，而不是要求所有字符都是元音
            // 当无锚点且模式中有多字母集合组合时，也使用部分匹配
            const hasBracketSets = pattern.some(el => el.bracketSet === true);
            const isMultiSetPattern = pattern.filter(el => el.type === 'set').length > 1;

            if (pattern.length === 1 && pattern[0].type === 'set' || hasBracketSets || isMultiSetPattern) {
                const result = this.matchesPatternPartial(word, pattern, startPos);
                // console.log(`[DEBUG] matchesPatternPartial result: ${result}`);
                return result;
            } else {
                const result = this.matchesPatternSequential(word, pattern, startPos);
                // console.log(`[DEBUG] matchesPatternSequential result: ${result}`);
                return result;
            }
        }
    }

    /**
     * 处理带位置锚点的模式匹配
     */
    matchesPatternWithAnchors(word, pattern, startPos) {
        // console.log(`[DEBUG] matchesPatternWithAnchors: word="${word}", startPos=${startPos}`);
        // console.log(`[DEBUG] pattern:`, pattern);

        // 查找锚点位置和类型
        let beginAnchorIndex = -1;
        let endAnchorIndex = -1;
        let beginAnchorType = null;
        let endAnchorType = null;

        for (let i = 0; i < pattern.length; i++) {
            if (pattern[i].type === 'position') {
                if (pattern[i].value === '\\b' || pattern[i].value === '\\-b') {
                    beginAnchorIndex = i;
                    beginAnchorType = pattern[i].value;
                } else if (pattern[i].value === '\\e' || pattern[i].value === '\\-e') {
                    endAnchorIndex = i;
                    endAnchorType = pattern[i].value;
                }
            }
        }

        // 提取非锚点元素
        const elements = pattern.filter(p => p.type !== 'position');

        // 根据锚点组合分类处理
        if (beginAnchorIndex !== -1 && endAnchorIndex !== -1) {
            // 双边锚点情况
            return this.handleDoubleAnchor(word, elements, beginAnchorType, endAnchorType, startPos);
        } else if (beginAnchorIndex !== -1) {
            // 仅开始锚点
            return this.handleBeginAnchor(word, elements, beginAnchorType, startPos);
        } else if (endAnchorIndex !== -1) {
            // 仅结束锚点
            return this.handleEndAnchor(word, elements, endAnchorType, startPos);
        } else {
            // 无锚点，使用部分匹配
            return this.matchesPatternPartial(word, elements, startPos);
        }
    }

    /**
     * 处理双边锚点情况
     */
    handleDoubleAnchor(word, elements, beginAnchorType, endAnchorType, startPos) {
        let matchStart, matchEnd;

        if (beginAnchorType === '\\b' && endAnchorType === '\\e') {
            // \\bAB+CD\\e: 前缀是A、后缀是D，中间结构且用完
            if (startPos !== 0) return false;
            matchStart = 0;
            matchEnd = word.length;
        } else if (beginAnchorType === '\\b' && endAnchorType === '\\-e') {
            // \\bAB+CD\\-e: 前缀是A，D不能是结尾，从位置0开始，从倒数第二个位置反向找最后一个D的结束位置
            if (startPos !== 0) return false;
            matchStart = 0;
            const lastElement = elements[elements.length - 1];
            // 从倒数第二个位置开始反向查找最后一个匹配元素的结束位置
            let foundMatchEnd = -1;
            for (let i = word.length - 2; i >= 0; i--) {
                const matchResult = this.matchElementFromEnd(word, lastElement, i + 1);
                if (matchResult.matched) {
                    // matchElementFromEnd 返回的是匹配的起始位置，结束位置就是传入的 i + 1
                    foundMatchEnd = i + 1;
                    break;
                }
            }
            if (foundMatchEnd === -1) return false;
            matchEnd = foundMatchEnd;
        } else if (beginAnchorType === '\\-b' && endAnchorType === '\\e') {
            // \\-bAB+CD\\e: A不能是开头，从当前startPos开始找第一个A的起始位置，后缀是D
            if (startPos === 0) return false;
            const firstElement = elements[0];
            matchStart = this.findFirstElementFromStart(word, firstElement, startPos);
            if (matchStart === -1) return false;
            matchEnd = word.length;
        } else if (beginAnchorType === '\\-b' && endAnchorType === '\\-e') {
            // \\-bAB+CD\\-e: A不能是开头，D不能是结尾，从当前startPos开始找第一个A，从倒数第二个位置反向找最后一个D
            if (startPos === 0) {
                return false;
            }
            const firstElement = elements[0];
            const lastElement = elements[elements.length - 1];

            matchStart = this.findFirstElementFromStart(word, firstElement, startPos);
            if (matchStart === -1) {
                return false;
            }

            // 从倒数第二个位置开始反向查找最后一个匹配元素的结束位置
            let foundMatchEnd = -1;
            for (let i = word.length - 2; i >= 0; i--) {
                const matchResult = this.matchElementFromEnd(word, lastElement, i + 1);
                if (matchResult.matched) {
                    // matchElementFromEnd 返回的是匹配的起始位置，结束位置就是传入的 i + 1
                    foundMatchEnd = i + 1;
                    break;
                }
            }
            if (foundMatchEnd === -1) {
                return false;
            }
            matchEnd = foundMatchEnd;
        }

        // 检查锚点是否交叉
        if (matchStart >= matchEnd) {
            return false;  // 锚点交叉，无效匹配
        }

        // 匹配中间部分，必须完全消耗
        const targetText = word.substring(matchStart, matchEnd);

        // 检测是否存在歧义，选择合适的匹配策略
        let hasAmbiguity = false;
        for (const element of elements) {
            if (element.type === 'set' && this.detectAmbiguity(element.value)) {
                hasAmbiguity = true;
                break;
            }
        }

        let finalResult;
        if (hasAmbiguity) {
            // Enhanced backtracking for ambiguous patterns
            finalResult = this.matchWithEnhancedBacktrack(targetText, elements, 0);
        } else {
            // Standard matching for unambiguous patterns
            finalResult = this.matchesPatternSequential(targetText, elements, 0);
        }
        return finalResult;
    }

    /**
     * 处理仅开始锚点情况
     */
    handleBeginAnchor(word, elements, beginAnchorType, startPos) {
        let matchStart;

        if (beginAnchorType === '\\b') {
            // \\bAB+C: 前缀是A，后面是结构，但后面还有没有都行
            if (startPos !== 0) return false;
            matchStart = 0;
        } else if (beginAnchorType === '\\-b') {
            // \\-bAB+C: A不能是开头，去掉首字母后找到第1个A
            if (startPos === 0) return false;
            const firstElement = elements[0];
            // 对于\-b锚点，从当前startPos开始查找第一个匹配的元素
            matchStart = this.findFirstElementFromStart(word, firstElement, startPos);
            if (matchStart === -1) return false;
        }

        // 从matchStart开始尝试匹配，不要求完全消耗
        return this.matchesPatternPartial(word, elements, matchStart);
    }

    /**
     * 处理仅结束锚点情况
     */
    handleEndAnchor(word, elements, endAnchorType, startPos) {
        let matchEnd;

        if (endAnchorType === '\\e') {
            // A+BC\\e: 后缀是C，前面紧邻结构，但A前面还有没有都行
            matchEnd = word.length;
        } else if (endAnchorType === '\\-e') {
            // A+BC\\-e: C不能是结尾，从倒数第二个位置开始向前找到最后一个C
            const lastElement = elements[elements.length - 1];
            // 从倒数第二个位置开始查找，确保匹配的元素不在最后位置
            matchEnd = this.findLastElementFromEnd(word, lastElement, word.length - 2);
            if (matchEnd === -1) return false;
        }

        // 向前匹配到matchEnd，不要求完全消耗前面部分
        return this.matchesPatternFromEnd(word, elements, matchEnd, startPos);
    }

    /**
     * 从指定位置开始查找第一个匹配的元素
     */
    findFirstElementFromStart(word, element, startPos) {
        for (let i = startPos; i < word.length; i++) {
            const matchResult = this.matchElementFromStart(word, element, i);
            if (matchResult.matched) {
                return i;
            }
        }
        return -1;
    }

    /**
     * 从指定位置向前查找最后一个匹配的元素
     */
    findLastElementFromEnd(word, element, endPos) {
        for (let i = endPos; i >= 0; i--) {
            const matchResult = this.matchElementFromEnd(word, element, i + 1);
            if (matchResult.matched) {
                return i + 1; // 返回匹配结束位置
            }
        }
        return -1;
    }

    /**
     * 从结尾向前匹配模式
     */
    matchesPatternFromEnd(word, elements, endPos, startPos) {
        // 从不同起始位置尝试匹配到endPos
        for (let tryStart = startPos; tryStart <= endPos - this.getPatternMinLength(elements); tryStart++) {
            const targetText = word.substring(tryStart, endPos);
            if (this.matchesPatternSequential(targetText, elements, 0)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 检测集合中是否存在歧义（前缀重叠）
     */
    detectAmbiguity(setElements) {
        for (let i = 0; i < setElements.length; i++) {
            for (let j = i + 1; j < setElements.length; j++) {
                const elemA = setElements[i];
                const elemB = setElements[j];

                // 跳过空字符串
                if (elemA === '' || elemB === '') continue;

                // 检查是否存在前缀关系
                if (typeof elemA === 'string' && typeof elemB === 'string') {
                    if (elemA.startsWith(elemB) || elemB.startsWith(elemA)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * 使用回溯策略匹配集合元素（单次匹配）
     */
    matchSetWithBacktrack(word, setElements, startPos, isFromEnd = false) {
        // 尝试所有可能的匹配
        const candidates = [];

        for (const setElement of setElements) {
            if (setElement === '') {
                candidates.push({ element: setElement, length: 0 });
                continue;
            }

            if (typeof setElement === 'string' && setElement.length > 1) {
                if (isFromEnd) {
                    if (startPos - setElement.length >= 0 &&
                        word.substring(startPos - setElement.length, startPos) === setElement) {
                        candidates.push({ element: setElement, length: setElement.length });
                    }
                } else {
                    if (startPos + setElement.length <= word.length &&
                        word.substring(startPos, startPos + setElement.length) === setElement) {
                        candidates.push({ element: setElement, length: setElement.length });
                    }
                }
            } else {
                if (isFromEnd) {
                    if (startPos > 0 && word[startPos - 1] === setElement) {
                        candidates.push({ element: setElement, length: 1 });
                    }
                } else {
                    if (startPos < word.length && word[startPos] === setElement) {
                        candidates.push({ element: setElement, length: 1 });
                    }
                }
            }
        }

        return candidates;
    }

    /**
     * 增强的回溯匹配方法，用于处理完整的模式匹配
     * 当检测到歧义时，会尝试所有可能的匹配路径
     */
    matchWithEnhancedBacktrack(word, pattern, startPos = 0) {
        return this.enhancedBacktrackRecursive(word, pattern, startPos, 0, []);
    }

    /**
     * 增强回溯的递归实现
     */
    enhancedBacktrackRecursive(word, pattern, wordIndex, patternIndex, matchHistory) {
        // 如果模式已全部匹配完成
        if (patternIndex >= pattern.length) {
            return wordIndex === word.length; // 要求完全匹配
        }

        // 如果单词已结束但模式未完成
        if (wordIndex >= word.length) {
            return false;
        }

        const element = pattern[patternIndex];

        if (element.type === 'set') {
            const hasAmbiguity = this.detectAmbiguity(element.value);

            if (hasAmbiguity) {
                // 有歧义：尝试所有可能的匹配
                const candidates = this.matchSetWithBacktrack(word, element.value, wordIndex, false);

                for (const candidate of candidates) {
                    const newWordIndex = wordIndex + candidate.length;
                    const newMatchHistory = [...matchHistory, {
                        type: 'set',
                        element: candidate.element,
                        length: candidate.length,
                        position: wordIndex
                    }];

                    if (this.enhancedBacktrackRecursive(word, pattern, newWordIndex, patternIndex + 1, newMatchHistory)) {
                        return true;
                    }
                }
                return false;
            } else {
                // 无歧义：使用贪婪匹配
                const result = this.matchElementFromStart(word, element, wordIndex);
                if (result.matched) {
                    return this.enhancedBacktrackRecursive(word, pattern, result.endPos, patternIndex + 1, matchHistory);
                }
                return false;
            }
        } else if (element.type === 'literal') {
            const result = this.matchElementFromStart(word, element, wordIndex);
            if (result.matched) {
                return this.enhancedBacktrackRecursive(word, pattern, result.endPos, patternIndex + 1, matchHistory);
            }
            return false;
        }

        // 跳过其他类型的元素
        return this.enhancedBacktrackRecursive(word, pattern, wordIndex, patternIndex + 1, matchHistory);
    }

    /**
     * 从开始位置匹配元素
     */
    matchElementFromStart(word, element, startPos) {
        // console.log(`[DEBUG] matchElementFromStart: word="${word}", element:`, element, `startPos=${startPos}`);

        if (element.type === 'literal') {
            if (element.quantifier === '+') {
                let matchCount = 0;
                let pos = startPos;
                const literalLength = element.value.length;

                while (pos + literalLength <= word.length &&
                    word.substring(pos, pos + literalLength) === element.value) {
                    pos += literalLength;
                    matchCount++;
                }

                return { matched: matchCount > 0, endPos: pos };
            } else {
                const literalLength = element.value.length;
                if (startPos + literalLength <= word.length &&
                    word.substring(startPos, startPos + literalLength) === element.value) {
                    return { matched: true, endPos: startPos + literalLength };
                }
                return { matched: false, endPos: startPos };
            }
        } else if (element.type === 'set') {
            // console.log(`[DEBUG] matching set: ${element.name}, quantifier: ${element.quantifier}`);
            // console.log(`[DEBUG] set values:`, element.value);

            // 检测是否存在歧义
            const hasAmbiguity = this.detectAmbiguity(element.value);

            if (element.quantifier === '+') {
                let matchCount = 0;
                let pos = startPos;

                while (pos < word.length) {
                    let matched = false;
                    let matchLength = 0;

                    // console.log(`[DEBUG] trying to match at pos ${pos}, char: "${word[pos]}"`);

                    if (hasAmbiguity) {
                        // 有歧义：使用回溯策略，尝试所有可能的匹配
                        const candidates = this.matchSetWithBacktrack(word, element.value, pos, false);
                        if (candidates.length > 0) {
                            // 优先选择最长匹配，但这里需要考虑后续匹配的成功性
                            // 简化实现：选择第一个匹配（可以进一步优化）
                            const candidate = candidates.sort((a, b) => b.length - a.length)[0];
                            matched = true;
                            matchLength = candidate.length;
                        }
                    } else {
                        // 无歧义：使用贪婪匹配（长度优先）
                        const sortedElements = Array.from(element.value).sort((a, b) => {
                            if (typeof a === 'string' && typeof b === 'string') {
                                return b.length - a.length;
                            }
                            return 0;
                        });

                        for (const setElement of sortedElements) {
                            if (setElement === '') continue;

                            if (typeof setElement === 'string' && setElement.length > 1) {
                                if (pos + setElement.length <= word.length &&
                                    word.substring(pos, pos + setElement.length) === setElement) {
                                    // Multi-char element matched
                                    matched = true;
                                    matchLength = setElement.length;
                                    break;
                                }
                            } else {
                                if (pos < word.length && word[pos] === setElement) {
                                    // Single char matched
                                    matched = true;
                                    matchLength = 1;
                                    break;
                                }
                            }
                        }
                    }

                    if (!matched) {
                        // No match at current position
                        break;
                    }
                    pos += matchLength;
                    matchCount++;
                }

                // Set match completed
                return { matched: matchCount > 0, endPos: pos };
            } else {
                // 单次匹配逻辑
                if (hasAmbiguity) {
                    // 有歧义：使用回溯策略
                    const candidates = this.matchSetWithBacktrack(word, element.value, startPos, false);
                    if (candidates.length > 0) {
                        // 返回第一个匹配，实际应用中可能需要尝试所有候选
                        const candidate = candidates[0];
                        return {
                            matched: true,
                            endPos: startPos + candidate.length,
                            candidates: candidates // 保存所有候选，供回溯使用
                        };
                    }
                    return { matched: false, endPos: startPos };
                } else {
                    // 无歧义：使用贪婪匹配（长度优先）
                    const sortedElements = Array.from(element.value).sort((a, b) => {
                        if (typeof a === 'string' && typeof b === 'string') {
                            return b.length - a.length;
                        }
                        return 0;
                    });

                    for (const setElement of sortedElements) {
                        if (setElement === '') {
                            return { matched: true, endPos: startPos };
                        }

                        if (typeof setElement === 'string' && setElement.length > 1) {
                            if (startPos + setElement.length <= word.length &&
                                word.substring(startPos, startPos + setElement.length) === setElement) {
                                return { matched: true, endPos: startPos + setElement.length };
                            }
                        } else {
                            if (startPos < word.length && word[startPos] === setElement) {
                                return { matched: true, endPos: startPos + 1 };
                            }
                        }
                    }
                    return { matched: false, endPos: startPos };
                }
            }
        }

        return { matched: false, endPos: startPos };
    }

    /**
     * 从结束位置向前匹配元素
     */
    matchElementFromEnd(word, element, endPos) {
        if (element.type === 'literal') {
            if (element.quantifier === '+') {
                let matchCount = 0;
                let pos = endPos;
                const literalLength = element.value.length;

                while (pos - literalLength >= 0 &&
                    word.substring(pos - literalLength, pos) === element.value) {
                    pos -= literalLength;
                    matchCount++;
                }

                return { matched: matchCount > 0, startPos: pos };
            } else {
                const literalLength = element.value.length;
                if (endPos - literalLength >= 0 &&
                    word.substring(endPos - literalLength, endPos) === element.value) {
                    return { matched: true, startPos: endPos - literalLength };
                }
                return { matched: false, startPos: endPos };
            }
        } else if (element.type === 'set') {
            // 检测是否存在歧义
            const hasAmbiguity = this.detectAmbiguity(element.value);

            if (element.quantifier === '+') {
                let matchCount = 0;
                let pos = endPos;

                while (pos > 0) {
                    let matched = false;
                    let matchLength = 0;

                    if (hasAmbiguity) {
                        // 有歧义：使用回溯策略
                        const candidates = this.matchSetWithBacktrack(word, element.value, pos, true);
                        if (candidates.length > 0) {
                            // 优先选择最长匹配
                            const candidate = candidates.sort((a, b) => b.length - a.length)[0];
                            matched = true;
                            matchLength = candidate.length;
                        }
                    } else {
                        // 无歧义：使用贪婪匹配（长度优先）
                        const sortedElements = Array.from(element.value).sort((a, b) => {
                            if (typeof a === 'string' && typeof b === 'string') {
                                return b.length - a.length;
                            }
                            return 0;
                        });

                        for (const setElement of sortedElements) {
                            if (setElement === '') continue;

                            if (typeof setElement === 'string' && setElement.length > 1) {
                                if (pos - setElement.length >= 0 &&
                                    word.substring(pos - setElement.length, pos) === setElement) {
                                    matched = true;
                                    matchLength = setElement.length;
                                    break;
                                }
                            } else {
                                if (pos > 0 && word[pos - 1] === setElement) {
                                    matched = true;
                                    matchLength = 1;
                                    break;
                                }
                            }
                        }
                    }

                    if (!matched) break;
                    pos -= matchLength;
                    matchCount++;
                }

                return { matched: matchCount > 0, startPos: pos };
            } else {
                // 单次匹配逻辑
                if (hasAmbiguity) {
                    // 有歧义：使用回溯策略
                    const candidates = this.matchSetWithBacktrack(word, element.value, endPos, true);
                    if (candidates.length > 0) {
                        // 返回第一个匹配
                        const candidate = candidates[0];
                        return {
                            matched: true,
                            startPos: endPos - candidate.length,
                            candidates: candidates // 保存所有候选，供回溯使用
                        };
                    }
                    return { matched: false, startPos: endPos };
                } else {
                    // 无歧义：使用贪婪匹配（长度优先）
                    const sortedElements = Array.from(element.value).sort((a, b) => {
                        if (typeof a === 'string' && typeof b === 'string') {
                            return b.length - a.length;
                        }
                        return 0;
                    });

                    for (const setElement of sortedElements) {
                        if (setElement === '') {
                            return { matched: true, startPos: endPos };
                        }

                        if (typeof setElement === 'string' && setElement.length > 1) {
                            if (endPos - setElement.length >= 0 &&
                                word.substring(endPos - setElement.length, endPos) === setElement) {
                                return { matched: true, startPos: endPos - setElement.length };
                            }
                        } else {
                            if (endPos > 0 && word[endPos - 1] === setElement) {
                                return { matched: true, startPos: endPos - 1 };
                            }
                        }
                    }
                    return { matched: false, startPos: endPos };
                }
            }
        }

        return { matched: false, startPos: endPos };
    }

    /**
     * 顺序匹配模式（无位置锚点）- 支持非贪婪匹配和回溯
     * 使用混合策略：检测歧义后选择合适的匹配算法
     */
    matchesPatternSequential(word, pattern, startPos) {
        // 检测模式中是否存在歧义
        let hasAmbiguity = false;
        for (const element of pattern) {
            if (element.type === 'set' && this.detectAmbiguity(element.value)) {
                hasAmbiguity = true;
                break;
            }
        }

        if (hasAmbiguity) {
            // 有歧义：使用增强回溯算法
            // Enhanced backtracking for ambiguous patterns
            return this.matchWithEnhancedBacktrack(word, pattern, startPos);
        } else {
            // 无歧义：使用原有的回溯算法（性能更好）
            // Standard backtracking algorithm
            return this.matchWithBacktrack(word, pattern, startPos, 0, []);
        }
    }

    /**
     * 部分匹配模式 - 不要求消耗所有字符
     */
    matchesPatternPartial(word, pattern, startPos) {
        return this.matchWithBacktrackPartial(word, pattern, startPos, 0, []);
    }

    /**
     * 使用回溯算法进行部分模式匹配（不要求消耗所有字符）
     * @param {string} word - 要匹配的单词
     * @param {Array} pattern - 模式数组
     * @param {number} wordIndex - 当前单词位置
     * @param {number} patternIndex - 当前模式位置
     * @param {Array} matchHistory - 匹配历史记录（用于回溯）
     * @returns {boolean} 是否匹配成功
     */
    matchWithBacktrackPartial(word, pattern, wordIndex, patternIndex, matchHistory) {
        // 如果模式已全部匹配完成，直接返回成功（不要求消耗所有字符）
        if (patternIndex >= pattern.length) {
            return true;
        }

        const element = pattern[patternIndex];

        if (element.type === 'literal') {
            return this.matchLiteralWithBacktrackPartial(word, pattern, wordIndex, patternIndex, matchHistory, element);
        } else if (element.type === 'set') {
            return this.matchSetWithBacktrackPartial(word, pattern, wordIndex, patternIndex, matchHistory, element);
        }

        // 跳过位置标记等其他类型
        return this.matchWithBacktrackPartial(word, pattern, wordIndex, patternIndex + 1, matchHistory);
    }

    /**
     * 匹配字面量（部分匹配版本，不要求消耗所有字符）
     */
    matchLiteralWithBacktrackPartial(word, pattern, wordIndex, patternIndex, matchHistory, element) {
        if (element.quantifier === '+') {
            // 非贪婪匹配：从最少匹配开始尝试
            const literalLength = element.value.length;
            let matchCount = 0;

            // 首先确保至少能匹配一次
            if (wordIndex + literalLength > word.length ||
                word.substring(wordIndex, wordIndex + literalLength) !== element.value) {
                return false;
            }

            // 计算最大可能的匹配次数
            let maxMatches = 0;
            let tempIndex = wordIndex;
            while (tempIndex + literalLength <= word.length &&
                word.substring(tempIndex, tempIndex + literalLength) === element.value) {
                tempIndex += literalLength;
                maxMatches++;
            }

            // 从最少匹配（1次）开始尝试，逐步增加
            for (let tryCount = 1; tryCount <= maxMatches; tryCount++) {
                const newWordIndex = wordIndex + (tryCount * literalLength);
                const matchedText = word.substring(wordIndex, newWordIndex);

                const newMatchHistory = [...matchHistory, { type: 'literal', count: tryCount, length: tryCount * literalLength, matched: matchedText }];

                if (this.matchWithBacktrackPartial(word, pattern, newWordIndex, patternIndex + 1, newMatchHistory)) {
                    return true;
                }
            }

            return false;
        } else {
            // 精确匹配一次
            const literalLength = element.value.length;
            if (wordIndex + literalLength > word.length ||
                word.substring(wordIndex, wordIndex + literalLength) !== element.value) {
                return false;
            }

            const matchedText = word.substring(wordIndex, wordIndex + literalLength);

            const newMatchHistory = [...matchHistory, { type: 'literal', count: 1, length: literalLength, matched: matchedText }];
            return this.matchWithBacktrackPartial(word, pattern, wordIndex + literalLength, patternIndex + 1, newMatchHistory);
        }
    }

    /**
     * 匹配集合（部分匹配版本，不要求消耗所有字符）
     */
    matchSetWithBacktrackPartial(word, pattern, wordIndex, patternIndex, matchHistory, element) {
        // 检查集合是否存在且可迭代
        if (!element.value || typeof element.value[Symbol.iterator] !== 'function') {
            console.warn('集合值不存在或不可迭代:', element);
            return false;
        }

        if (element.quantifier === '+') {
            // 非贪婪匹配：从最少匹配开始尝试
            return this.matchSetPlusWithBacktrackPartial(word, pattern, wordIndex, patternIndex, matchHistory, element);
        } else {
            // 精确匹配一次
            return this.matchSetOnceWithBacktrackPartial(word, pattern, wordIndex, patternIndex, matchHistory, element);
        }
    }

    /**
     * 匹配集合的+量词（部分匹配版本，不要求消耗所有字符）
     */
    matchSetPlusWithBacktrackPartial(word, pattern, wordIndex, patternIndex, matchHistory, element) {
        // 收集所有可能的匹配序列
        const allPossibleMatches = this.generateAllPossibleMatches(word, wordIndex, element);

        // 按长度从短到长排序（非贪婪）
        allPossibleMatches.sort((a, b) => a.totalLength - b.totalLength);

        // 尝试每种可能的匹配序列
        for (let i = 0; i < allPossibleMatches.length; i++) {
            const matchSequence = allPossibleMatches[i];
            if (matchSequence.matches.length === 0) continue; // +量词至少需要一次匹配

            const newWordIndex = wordIndex + matchSequence.totalLength;
            const matchedText = word.substring(wordIndex, newWordIndex);

            const newMatchHistory = [...matchHistory, {
                type: 'set',
                count: matchSequence.matches.length,
                length: matchSequence.totalLength,
                matches: matchSequence.matches,
                matched: matchedText
            }];

            if (this.matchWithBacktrackPartial(word, pattern, newWordIndex, patternIndex + 1, newMatchHistory)) {
                return true;
            }
        }

        return false;
    }

    /**
     * 匹配集合的单次匹配（部分匹配版本，不要求消耗所有字符）
     */
    matchSetOnceWithBacktrackPartial(word, pattern, wordIndex, patternIndex, matchHistory, element) {
        let matched = false;
        let matchLength = 0;
        let matchedElement = null;

        // 尝试匹配集合中的每个元素
        // 优先尝试非空字符串匹配，最后才尝试空字符串
        let emptyStringFound = false;

        for (const setElement of element.value) {
            if (setElement === '') {
                emptyStringFound = true;
                continue;
            } else if (typeof setElement === 'string' && setElement.length > 1) {
                // 多字符字符串匹配
                if (wordIndex + setElement.length <= word.length) {
                    const wordSubstring = word.substring(wordIndex, wordIndex + setElement.length);
                    if (wordSubstring === setElement) {
                        matched = true;
                        matchLength = setElement.length;
                        matchedElement = setElement;
                        break;
                    }
                }
            } else {
                // 单字符匹配
                if (wordIndex < word.length && word[wordIndex] === setElement) {
                    matched = true;
                    matchLength = 1;
                    matchedElement = setElement;
                    break;
                }
            }
        }

        // 如果没有匹配到任何非空元素，且集合中有空字符串，则匹配空字符串
        if (!matched && emptyStringFound) {
            matched = true;
            matchLength = 0;
            matchedElement = '';
        }

        if (!matched) {
            return false;
        }

        const matchedText = word.substring(wordIndex, wordIndex + matchLength);

        const newMatchHistory = [...matchHistory, {
            type: 'set',
            count: 1,
            length: matchLength,
            matches: [matchedElement],
            matched: matchedText
        }];

        return this.matchWithBacktrackPartial(word, pattern, wordIndex + matchLength, patternIndex + 1, newMatchHistory);
    }

    /**
     * 使用回溯算法进行模式匹配
     * @param {string} word - 要匹配的单词
     * @param {Array} pattern - 模式数组
     * @param {number} wordIndex - 当前单词位置
     * @param {number} patternIndex - 当前模式位置
     * @param {Array} matchHistory - 匹配历史记录（用于回溯）
     * @returns {boolean} 是否匹配成功
     */
    matchWithBacktrack(word, pattern, wordIndex, patternIndex, matchHistory) {
        // console.log(`[BACKTRACK] matchWithBacktrack: word="${word}", wordIndex=${wordIndex}, patternIndex=${patternIndex}`);
        // console.log(`[BACKTRACK] remaining word: "${word.substring(wordIndex)}", remaining pattern:`, pattern.slice(patternIndex));

        // 如果模式已全部匹配完成，检查是否所有字符都被消耗
        if (patternIndex >= pattern.length) {
            const allConsumed = wordIndex >= word.length;
            // console.log(`[BACKTRACK] Pattern fully matched! Final wordIndex=${wordIndex}, word.length=${word.length}, allConsumed=${allConsumed}`);
            if (allConsumed) {
                // console.log(`[BACKTRACK] SUCCESS: All characters consumed`);
                return true;
            } else {
                // console.log(`[BACKTRACK] FAILURE: Remaining characters: "${word.substring(wordIndex)}"`);
                return false;
            }
        }

        const element = pattern[patternIndex];
        // console.log(`[BACKTRACK] Processing element:`, element);

        if (element.type === 'literal') {
            return this.matchLiteralWithBacktrack(word, pattern, wordIndex, patternIndex, matchHistory, element);
        } else if (element.type === 'set') {
            return this.matchSetWithBacktrack(word, pattern, wordIndex, patternIndex, matchHistory, element);
        }

        // 跳过位置标记等其他类型
        // console.log(`[BACKTRACK] Skipping element type: ${element.type}`);
        return this.matchWithBacktrack(word, pattern, wordIndex, patternIndex + 1, matchHistory);
    }

    matchLiteralWithBacktrack(word, pattern, wordIndex, patternIndex, matchHistory, element) {
        // console.log(`[BACKTRACK] matchLiteralWithBacktrack: literal="${element.value}", quantifier="${element.quantifier}"`);

        if (element.quantifier === '+') {
            // 非贪婪匹配：从最少匹配开始尝试
            const literalLength = element.value.length;
            let matchCount = 0;

            // 首先确保至少能匹配一次
            if (wordIndex + literalLength > word.length ||
                word.substring(wordIndex, wordIndex + literalLength) !== element.value) {
                // console.log(`[BACKTRACK] Literal+ failed: cannot match even once`);
                return false;
            }

            // 计算最大可能的匹配次数
            let maxMatches = 0;
            let tempIndex = wordIndex;
            while (tempIndex + literalLength <= word.length &&
                word.substring(tempIndex, tempIndex + literalLength) === element.value) {
                tempIndex += literalLength;
                maxMatches++;
            }

            // console.log(`[BACKTRACK] Literal+ can match 1 to ${maxMatches} times`);

            // 从最少匹配（1次）开始尝试，逐步增加
            for (let tryCount = 1; tryCount <= maxMatches; tryCount++) {
                const newWordIndex = wordIndex + (tryCount * literalLength);
                const matchedText = word.substring(wordIndex, newWordIndex);
                // console.log(`[BACKTRACK] Trying literal+ match: "${matchedText}" (${tryCount} times)`);

                const newMatchHistory = [...matchHistory, { type: 'literal', count: tryCount, length: tryCount * literalLength, matched: matchedText }];

                if (this.matchWithBacktrack(word, pattern, newWordIndex, patternIndex + 1, newMatchHistory)) {
                    // console.log(`[BACKTRACK] Literal+ successful with ${tryCount} matches`);
                    return true;
                }
                // console.log(`[BACKTRACK] Literal+ failed with ${tryCount} matches, trying next`);
            }

            // console.log(`[BACKTRACK] Literal+ exhausted all possibilities`);
            return false;
        } else {
            // 精确匹配一次
            const literalLength = element.value.length;
            if (wordIndex + literalLength > word.length ||
                word.substring(wordIndex, wordIndex + literalLength) !== element.value) {
                // console.log(`[BACKTRACK] Literal exact match failed`);
                return false;
            }

            const matchedText = word.substring(wordIndex, wordIndex + literalLength);
            // console.log(`[BACKTRACK] Literal exact match successful: "${matchedText}"`);

            const newMatchHistory = [...matchHistory, { type: 'literal', count: 1, length: literalLength, matched: matchedText }];
            return this.matchWithBacktrack(word, pattern, wordIndex + literalLength, patternIndex + 1, newMatchHistory);
        }
    }

    /**
     * 匹配集合（支持回溯）
     */
    matchSetWithBacktrack(word, pattern, wordIndex, patternIndex, matchHistory, element) {
        // console.log(`[BACKTRACK] matchSetWithBacktrack: set size=${element.value?.size || 0}, quantifier="${element.quantifier}"`);
        // console.log(`[BACKTRACK] Set values:`, Array.from(element.value || []));

        // 检查集合是否存在且可迭代
        if (!element.value || typeof element.value[Symbol.iterator] !== 'function') {
            console.warn('集合值不存在或不可迭代:', element);
            return false;
        }

        if (element.quantifier === '+') {
            // 非贪婪匹配：从最少匹配开始尝试
            return this.matchSetPlusWithBacktrack(word, pattern, wordIndex, patternIndex, matchHistory, element);
        } else {
            // 精确匹配一次
            return this.matchSetOnceWithBacktrack(word, pattern, wordIndex, patternIndex, matchHistory, element);
        }
    }

    /**
     * 匹配集合的+量词（非贪婪+回溯）
     */
    matchSetPlusWithBacktrack(word, pattern, wordIndex, patternIndex, matchHistory, element) {
        console.log(`[BACKTRACK] matchSetPlusWithBacktrack: generating all possible matches from position ${wordIndex}`);

        // 收集所有可能的匹配序列
        const allPossibleMatches = this.generateAllPossibleMatches(word, wordIndex, element);

        console.log(`[BACKTRACK] Generated ${allPossibleMatches.length} possible match sequences`);

        // 按长度从短到长排序（非贪婪）
        allPossibleMatches.sort((a, b) => a.totalLength - b.totalLength);

        // 尝试每种可能的匹配序列
        for (let i = 0; i < allPossibleMatches.length; i++) {
            const matchSequence = allPossibleMatches[i];
            if (matchSequence.matches.length === 0) continue; // +量词至少需要一次匹配

            const newWordIndex = wordIndex + matchSequence.totalLength;
            const matchedText = word.substring(wordIndex, newWordIndex);

            console.log(`[BACKTRACK] Trying set+ sequence ${i + 1}/${allPossibleMatches.length}: "${matchedText}" (${matchSequence.matches.join(', ')})`);

            const newMatchHistory = [...matchHistory, {
                type: 'set',
                count: matchSequence.matches.length,
                length: matchSequence.totalLength,
                matches: matchSequence.matches,
                matched: matchedText
            }];

            if (this.matchWithBacktrack(word, pattern, newWordIndex, patternIndex + 1, newMatchHistory)) {
                console.log(`[BACKTRACK] Set+ successful with sequence: "${matchedText}"`);
                return true;
            }
            console.log(`[BACKTRACK] Set+ failed with sequence: "${matchedText}", trying next`);
        }

        console.log(`[BACKTRACK] Set+ exhausted all ${allPossibleMatches.length} possibilities`);
        return false;
    }

    /**
     * 匹配集合的单次匹配（支持回溯）
     */
    matchSetOnceWithBacktrack(word, pattern, wordIndex, patternIndex, matchHistory, element) {
        console.log(`[BACKTRACK] matchSetOnceWithBacktrack: trying to match one element from position ${wordIndex}`);

        let matched = false;
        let matchLength = 0;
        let matchedElement = null;

        // 尝试匹配集合中的每个元素
        // 优先尝试非空字符串匹配，最后才尝试空字符串
        let emptyStringFound = false;

        for (const setElement of element.value) {
            if (setElement === '') {
                emptyStringFound = true;
                continue;
            } else if (typeof setElement === 'string' && setElement.length > 1) {
                // 多字符字符串匹配
                if (wordIndex + setElement.length <= word.length) {
                    const wordSubstring = word.substring(wordIndex, wordIndex + setElement.length);
                    if (wordSubstring === setElement) {
                        matched = true;
                        matchLength = setElement.length;
                        matchedElement = setElement;
                        console.log(`[BACKTRACK] Set matched multi-char element: "${setElement}"`);
                        break;
                    }
                }
            } else {
                // 单字符匹配
                if (wordIndex < word.length && word[wordIndex] === setElement) {
                    matched = true;
                    matchLength = 1;
                    matchedElement = setElement;
                    console.log(`[BACKTRACK] Set matched single-char element: "${setElement}"`);
                    break;
                }
            }
        }

        // 如果没有匹配到任何非空元素，且集合中有空字符串，则匹配空字符串
        if (!matched && emptyStringFound) {
            matched = true;
            matchLength = 0;
            matchedElement = '';
            console.log(`[BACKTRACK] Set matched empty string`);
        }

        if (!matched) {
            console.log(`[BACKTRACK] Set failed to match any element`);
            return false;
        }

        const matchedText = word.substring(wordIndex, wordIndex + matchLength);
        console.log(`[BACKTRACK] Set single match successful: "${matchedText}" (element: "${matchedElement}")`);

        const newMatchHistory = [...matchHistory, {
            type: 'set',
            count: 1,
            length: matchLength,
            matches: [matchedElement],
            matched: matchedText
        }];
        return this.matchWithBacktrack(word, pattern, wordIndex + matchLength, patternIndex + 1, newMatchHistory);
    }

    /**
     * 生成所有可能的匹配序列（用于+量词的非贪婪匹配）
     */
    generateAllPossibleMatches(word, startIndex, element) {
        console.log(`[BACKTRACK] generateAllPossibleMatches: from position ${startIndex}, remaining: "${word.substring(startIndex)}"`);

        const results = [];
        const maxLength = word.length - startIndex;

        // 使用动态规划生成所有可能的匹配组合
        this.generateMatchSequences(word, startIndex, element, [], 0, maxLength, results);

        console.log(`[BACKTRACK] Generated ${results.length} total sequences:`);
        results.forEach((seq, i) => {
            const text = word.substring(startIndex, startIndex + seq.totalLength);
            console.log(`[BACKTRACK]   ${i + 1}: "${text}" = [${seq.matches.join(', ')}]`);
        });

        return results;
    }

    /**
     * 递归生成匹配序列
     */
    generateMatchSequences(word, currentIndex, element, currentMatches, currentLength, maxLength, results) {
        // 添加当前序列到结果中
        if (currentMatches.length > 0) {
            results.push({
                matches: [...currentMatches],
                totalLength: currentLength
            });
        }

        // 如果已达到最大长度，停止递归
        if (currentLength >= maxLength) {
            return;
        }

        // 尝试匹配集合中的每个元素
        for (const setElement of element.value) {
            if (setElement === '') {
                continue; // +量词不允许匹配空字符串
            }

            const elementLength = typeof setElement === 'string' ? setElement.length : 1;

            if (currentIndex + currentLength + elementLength <= word.length) {
                let canMatch = false;

                if (typeof setElement === 'string' && setElement.length > 1) {
                    // 多字符字符串匹配
                    const wordSubstring = word.substring(currentIndex + currentLength, currentIndex + currentLength + elementLength);
                    canMatch = (wordSubstring === setElement);
                } else {
                    // 单字符匹配
                    canMatch = (word[currentIndex + currentLength] === setElement);
                }

                if (canMatch) {
                    const newMatches = [...currentMatches, setElement];
                    const newLength = currentLength + elementLength;

                    // 递归生成更长的序列
                    this.generateMatchSequences(word, currentIndex, element, newMatches, newLength, maxLength, results);
                }
            }
        }
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
                if (element.quantifier === '+') {
                    // +量词至少匹配一次
                    length += element.value.length;
                } else {
                    length += element.value.length;
                }
            } else if (element.type === 'set') {
                // 对于集合，找到最短的元素长度
                let minElementLength = 1;
                if (element.value && element.value.size > 0) {
                    let validElements = Array.from(element.value);
                    if (element.quantifier === '+') {
                        // +量词不能匹配空字符串，过滤掉空字符串
                        validElements = validElements.filter(item => item !== '');
                    }
                    if (validElements.length > 0) {
                        minElementLength = Math.min(...validElements.map(item =>
                            typeof item === 'string' ? item.length : 1
                        ));
                    } else if (element.quantifier === '+') {
                        // +量词至少需要1个字符
                        minElementLength = 1;
                    }
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
        // 正确处理@@前缀（严格相邻匹配）和@前缀（松散匹配）
        const sortRule = displayRule.startsWith('@@') ? displayRule.substring(2) : displayRule.substring(1); // 去掉@符号

        // 处理基础字母排序和不分组排序
        if (sortRule === '-' || sortRule === '' || sortRule === '!' || sortRule === '!-') {
            const descending = sortRule === '-' || sortRule === '!-';
            return this.sortByAlphabet(words, descending);
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
        const parseResult = this.parseSortRule(sortRule);
        const { groups: sortGroups, isAdjacent, hasNonGrouping } = parseResult;

        if (sortGroups.length === 0) {
            return this.sortByAlphabet(words);
        }

        // 为每个单词计算分组键
        const wordsWithKeys = words.map(word => {
            const groupKeys = this.calculateGroupKeys(word, sortGroups, localSets, isAdjacent, hasNonGrouping);
            return { word, groupKeys, isValid: groupKeys !== null };
        });

        // 将无法匹配的单词分离出来
        const validWords = wordsWithKeys.filter(item => item.isValid);
        const invalidWords = wordsWithKeys.filter(item => !item.isValid);

        // 对无效单词按字母顺序排序
        invalidWords.sort((a, b) => a.word.localeCompare(b.word));

        // 按分组键排序（只对有效单词排序）
        validWords.sort((a, b) => {
            // 从分组键结构中提取用于比较的键
            let keysA, keysB;

            if (hasNonGrouping) {
                // 如果有分组开关，使用所有键（包括不分组的键）进行排序比较
                keysA = a.groupKeys.allKeys;
                keysB = b.groupKeys.allKeys;
            } else {
                // 没有分组开关，直接使用所有键
                keysA = a.groupKeys;
                keysB = b.groupKeys;
            }

            // 按排序规则逐级比较
            for (let i = 0; i < sortGroups.length; i++) {
                const keyA = keysA[i];
                const keyB = keysB[i];

                if (keyA !== keyB) {
                    const comparison = keyA.localeCompare(keyB);
                    return sortGroups[i].descending ? -comparison : comparison;
                }
            }

            // 所有分组键都相同，按字母顺序排序
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
     * @returns {Object} 解析后的排序组和相关标志
     */
    parseSortRule(sortRule) {
        // 检查是否是有序紧邻模式（@@开头）或普通排序模式（@开头）
        const isAdjacent = sortRule.startsWith('@@');
        const isSortRule = sortRule.startsWith('@') && !isAdjacent;
        let actualRule = sortRule;

        if (isAdjacent) {
            actualRule = sortRule.substring(2); // 移除@@前缀
        } else if (isSortRule) {
            actualRule = sortRule.substring(1); // 移除@前缀
        }

        // 检查是否有!标志（分组开关）
        let nonGroupingFromIndex = -1;
        if (actualRule.includes('!')) {
            // 找到第一个!的位置（最多只能有一个分组开关）
            nonGroupingFromIndex = actualRule.indexOf('!');
            if (actualRule.indexOf('!', nonGroupingFromIndex + 1) !== -1) {
                throw new Error(`排序规则中最多只能有一个分组开关!: ${sortRule}`);
            }

            // 验证!的位置是否合法
            this.validateNonGroupingPosition(actualRule, nonGroupingFromIndex, sortRule);

            actualRule = actualRule.replace('!', ''); // 移除!标志
        }

        const groups = [];
        let i = 0;
        let elementIndex = 0; // 跟踪当前是第几个排序元素
        let nonGroupingStartIndex = -1; // 分组开关影响的起始元素索引

        // 解析分组开关的影响
        if (nonGroupingFromIndex !== -1) {
            // 如果!在最开始，即@!或@@!，则所有元素都不分组
            if (nonGroupingFromIndex === 0) {
                nonGroupingStartIndex = 0;
            } else {
                // 正常处理!开关的位置（包括严格模式和宽松模式）
                // 严格模式的特殊处理在最后的返回值中进行
                {
                    // 扫描!之前的部分，识别排序元素
                    let tempI = 0;
                    let tempElementIndex = 0;

                    while (tempI < nonGroupingFromIndex) {
                        // 跳过-号
                        if (actualRule[tempI] === '-') {
                            tempI++;
                            continue;
                        }

                        // 处理括号引用的集合
                        if (actualRule[tempI] === '(') {
                            const closeIndex = actualRule.indexOf(')', tempI);
                            if (closeIndex !== -1) {
                                // 括号内是一个完整的集合引用，算作一个元素
                                tempI = closeIndex + 1;
                                tempElementIndex++;
                            } else {
                                tempI++; // 括号不匹配，跳过
                            }
                        }
                        // 处理单字母集合
                        else if (/[a-zA-Z]/.test(actualRule[tempI])) {
                            // 读取连续的字母数字（可能是集合名）
                            let setName = '';
                            const startPos = tempI;

                            while (tempI < actualRule.length && /[a-zA-Z0-9]/.test(actualRule[tempI])) {
                                setName += actualRule[tempI];
                                tempI++;
                            }

                            // 如果后面紧跟位置匹配符，一起算作一个元素
                            if (tempI < actualRule.length && /[\^\$\*~]/.test(actualRule[tempI])) {
                                tempI++;
                            }

                            // 每个单字母集合算一个元素，但规则上要求多字母集合必须用括号
                            if (setName.length === 1) {
                                tempElementIndex++;
                            } else {
                                // 多字母集合，如果没有括号，每个字母视为一个独立集合
                                tempElementIndex += setName.length;
                            }
                        } else {
                            tempI++; // 跳过其他字符
                        }
                    }

                    // 设置开始不分组的元素索引
                    nonGroupingStartIndex = tempElementIndex;
                }
            }
        }

        // 解析所有排序元素
        while (i < actualRule.length) {
            let descending = false;
            let nonGrouping = false;
            let startI = i; // 记录循环开始时的位置

            // 检查是否有负号（位于括号外）
            if (actualRule[i] === '-') {
                descending = true;
                i++;
            }

            if (i >= actualRule.length) {
                // 如果只剩下逆序标志，这是允许的特殊情况
                if (descending) {
                    groups.push({ setName: '', positionFlag: '*', descending, nonGrouping: false });
                }
                break;
            }

            // 检查当前元素是否在分组开关之后
            nonGrouping = nonGroupingStartIndex !== -1 && elementIndex >= nonGroupingStartIndex;

            let setName = '';
            let positionFlag = '*'; // 统一默认为*，不再区分@@和@模式

            // 检查是否是括号引用的集合
            if (actualRule[i] === '(') {
                const closeIndex = actualRule.indexOf(')', i);
                if (closeIndex === -1) {
                    throw new Error(`排序规则中括号不匹配: ${sortRule}`);
                }
                const content = actualRule.substring(i + 1, closeIndex);

                // 解析集合名和位置标识符
                const result = this.parseSetNameWithPosition(content);
                setName = result.setName;
                positionFlag = result.positionFlag || positionFlag;
                // 如果括号内有逆序标志，使用它
                if (result.descending) {
                    descending = result.descending;
                }

                i = closeIndex + 1;
                
                // 检查括号后是否有位置匹配符（这是错误的）
                if (i < actualRule.length && /[\^\$\*~]/.test(actualRule[i])) {
                    throw new Error(`位置匹配符必须放在括号内，不能放在括号外: ${sortRule}`);
                }

                // 添加为单个排序元素
                groups.push({ setName, positionFlag, descending, nonGrouping });
                elementIndex++;
            } else {
                // 单字母集合，可能带位置标识符
                const result = this.parseSetNameWithPosition(actualRule.substring(i));
                setName = result.setName;
                positionFlag = result.positionFlag || positionFlag;
                // 如果返回的结果中包含逆序标志，使用它
                if (result.descending) {
                    descending = result.descending;
                }
                i += result.consumed;

                // 验证集合名不能为空
                if (setName.length === 0) {
                    // 检查是否只有位置匹配符或逆序标志
                    if (result.positionFlag && !result.descending) {
                        throw new Error(`位置匹配符不能独立存在，必须与集合名组合使用: ${sortRule}`);
                    }
                    if (result.descending && !result.positionFlag) {
                        // 允许只有逆序标志的情况（@- 或 @!-）
                        groups.push({ setName: '', positionFlag: positionFlag, descending, nonGrouping });
                        elementIndex++;
                    } else if (result.descending && result.positionFlag) {
                        throw new Error(`逆序标志和位置匹配符不能独立存在，必须与集合名组合使用: ${sortRule}`);
                    } else {
                        // 如果既没有集合名，也没有逆序标志或位置匹配符，跳过
                        continue;
                    }
                } else {
                    // 处理多字母序列（如ABC）- 规则要求多字母集合必须用括号，所以这里应该是连续的单字母集合
                    if (setName.length > 1 && result.positionFlag === null && result.consumed === setName.length) {
                        // 拆分为单个字母集合
                        for (let j = 0; j < setName.length; j++) {
                            const currentElementNonGrouping = nonGroupingStartIndex !== -1 && elementIndex >= nonGroupingStartIndex;
                            groups.push({
                                setName: setName[j],
                                positionFlag: positionFlag,
                                descending,
                                nonGrouping: currentElementNonGrouping
                            });
                            elementIndex++;
                        }
                    } else {
                        // 单字母集合或带位置匹配符的集合
                        groups.push({ setName, positionFlag, descending, nonGrouping });
                        elementIndex++;
                    }
                }
            }

            // 防止死循环：如果位置没有前进，强制跳过当前字符
            if (i === startI) {
                console.warn(`解析排序规则时遇到无法识别的字符: '${actualRule[i]}' at position ${i}`);
                i++; // 强制前进一位
            }
        }

        // 限制排序分级层数，最多允许三级
        if (groups.length > 3) {
            throw new Error(`排序规则层数超过限制，最多允许三级排序，当前为 ${groups.length} 级`);
        }

        // 严格排序验证
        if (isAdjacent) {

            // 验证@@模式：必须是两个集合
            if (groups.length === 0) {
                throw new Error(`严格排序模式（@@）必须包含两个排序单元，当前没有任何排序单元`);
            }
            if (groups.length === 1) {
                throw new Error(`严格排序模式（@@）必须包含两个排序单元，当前只有一个排序单元`);
            }
            if (groups.length !== 2) {
                throw new Error(`严格排序模式（@@）只支持两个排序单元，当前为 ${groups.length} 个排序单元`);
            }

            // 验证@@模式中的位置标识符限制
            const [group1, group2] = groups;

            // 硬性限制：第一个集合不能使用$
            if (group1.positionFlag === '$') {
                throw new Error(`有序紧邻模式（@@）中第一个集合不能使用后缀匹配标识符（$）`);
            }

            // 硬性限制：第二个集合不能使用^
            if (group2.positionFlag === '^') {
                throw new Error(`有序紧邻模式（@@）中第二个集合不能使用前缀匹配标识符（^）`);
            }
        }

        // 计算最终的hasNonGrouping值
        let finalHasNonGrouping = nonGroupingFromIndex !== -1;

        // 严格排序模式下的特殊处理
        if (isAdjacent && nonGroupingFromIndex !== -1 && nonGroupingFromIndex !== 0) {
            // 在严格排序模式下，如果!不在开头，则忽略!开关
            finalHasNonGrouping = false;
        }

        // 宽松排序模式下，如果!不在开头，应该根据!的位置进行分组
        // 这里finalHasNonGrouping应该表示是否完全不分组
        // 对于@(BL^)!(V*)这种情况，应该按!之前的部分分组，所以不是完全不分组
        if (!isAdjacent && nonGroupingFromIndex !== -1 && nonGroupingFromIndex !== 0) {
            // 在宽松排序模式下，如果!不在开头，则表示部分分组，不是完全不分组
            finalHasNonGrouping = false;
        }

        return { groups, isAdjacent, hasNonGrouping: finalHasNonGrouping };
    }

    /**
     * 验证!开关的位置是否合法
     * @param {string} actualRule - 实际规则（已移除@前缀）
     * @param {number} nonGroupingIndex - !的位置索引
     * @param {string} originalRule - 原始规则（用于错误信息）
     */
    validateNonGroupingPosition(actualRule, nonGroupingIndex, originalRule) {
        // 特殊情况：!- 或 !开头（如@!或@!-）是合法的
        if (nonGroupingIndex === 0) {
            return; // !在开头是合法的
        }

        // 检查!是否在括号内（不合法）
        let openParenCount = 0;
        for (let i = 0; i < nonGroupingIndex; i++) {
            if (actualRule[i] === '(') {
                openParenCount++;
            } else if (actualRule[i] === ')') {
                openParenCount--;
            }
        }

        // 如果!前面有未闭合的括号，说明!在括号内
        if (openParenCount > 0) {
            throw new Error(`分组开关!不能放在集合引用的括号内: ${originalRule}`);
        }

        // 检查!是否直接跟在-后面（不合法，除非是特殊情况!-）
        if (nonGroupingIndex > 0 && actualRule[nonGroupingIndex - 1] === '-') {
            // 检查是否是特殊情况：整个规则就是!-
            if (actualRule.trim() !== '!-') {
                throw new Error(`分组开关!不能直接放在逆序标志-后面: ${originalRule}`);
            }
        }

        // 检查!是否在规则末尾（不合法）
        // 注意：需要检查去除!后的位置是否为末尾
        if (nonGroupingIndex === actualRule.length - 1) {
            throw new Error(`分组开关!不能放在排序规则的末尾: ${originalRule}`);
        }

        // 验证!前后是否为有效的排序单元分隔位置
        // !应该在排序标志与排序单元之间，或排序单元与排序单元之间
        const beforeChar = nonGroupingIndex > 0 ? actualRule[nonGroupingIndex - 1] : '';
        const afterChar = nonGroupingIndex < actualRule.length - 1 ? actualRule[nonGroupingIndex + 1] : '';

        // !前面应该是字母、数字、)、位置匹配符（^$*~）（表示一个排序单元的结束）
        const validBeforeChars = /[a-zA-Z0-9)\^\$\*~]/;
        if (beforeChar && !validBeforeChars.test(beforeChar)) {
            throw new Error(`分组开关!的位置不正确，应该放在排序单元之间: ${originalRule}`);
        }

        // !后面应该是字母、(或-（表示一个排序单元的开始）
        const validAfterChars = /[a-zA-Z(-]/;
        if (afterChar && !validAfterChars.test(afterChar)) {
            throw new Error(`分组开关!的位置不正确，应该放在排序单元之间: ${originalRule}`);
        }
    }

    /**
     * 解析集合名和位置标识符
     * @param {string} content - 内容字符串
     * @returns {Object} 包含集合名、位置标识符和消费字符数的对象
     */
    parseSetNameWithPosition(content) {
        let setName = '';
        let positionFlag = null; // 默认为null，表示没有显式位置标识符
        let consumed = 0;
        let descending = false;

        // 处理开头的逆序标志
        let i = 0;
        if (i < content.length && content[i] === '-') {
            descending = true;
            i++;
        }

        // 提取集合名（字母开头，可包含数字）
        const startNameIndex = i;
        while (i < content.length && /[a-zA-Z0-9]/.test(content[i])) {
            setName += content[i];
            i++;
        }

        // 检查是否有逆序标志在集合名后面（错误格式）
        if (i < content.length && content[i] === '-') {
            throw new Error(`逆序标志'-'必须放在集合名前面，不能放在集合名后面: ${content}`);
        }

        // 检查位置标识符
        if (i < content.length && /[\^\$\*~]/.test(content[i])) {
            positionFlag = content[i];
            i++;
        }

        // 检查是否只有位置匹配符（在没有集合名的情况下）
        if (setName === '' && !descending && i < content.length && /[\^\$\*~]/.test(content[i])) {
            positionFlag = content[i];
            consumed = i + 1;
            return { setName: '', positionFlag, consumed, descending: false };
        }
        
        // 如果开头就是位置匹配符（没有逆序标志和集合名）
        if (i === 0 && content.length > 0 && /^[\^\$\*~]/.test(content)) {
            positionFlag = content[0];
            consumed = 1;
            return { setName: '', positionFlag, consumed, descending: false };
        }

        consumed = i;

        return { setName, positionFlag, consumed, descending };
    }

    /**
     * 计算单词的分组键
     * @param {string} word - 单词
     * @param {Array} sortGroups - 排序组
     * @param {Map} localSets - 局部集合映射
     * @param {boolean} isAdjacent - 是否为紧邻模式
     * @param {boolean} hasNonGrouping - 是否有不分组标志
     * @returns {Array|Object} 分组键数组或包含分组和排序键的对象
     */
    calculateGroupKeys(word, sortGroups, localSets = new Map(), isAdjacent = false, hasNonGrouping = false) {
        // 有序紧邻模式特殊处理
        if (isAdjacent && sortGroups.length === 2) {
            // 有序紧邻模式：两个集合必须相邻匹配
            const result = this.findAdjacentMatch(word, sortGroups, localSets);
            if (result.success) {
                // 根据!标志决定返回的分组键
                if (hasNonGrouping) {
                    // 如果有!标志，分离用于分组和排序的键
                    const groupingKeys = [];
                    const sortingKeys = [];

                    for (let i = 0; i < sortGroups.length; i++) {
                        let key = result.groupKeys[i];

                        // 注意：在严格排序模式下，降序处理已经在findAdjacentMatch中完成
                        // 这里不需要重复处理降序，直接分配到对应的键数组

                        if (sortGroups[i].nonGrouping) {
                            sortingKeys.push(key);
                        } else {
                            groupingKeys.push(key);
                        }
                    }

                    return {
                        groupingKeys, // 用于分组的键
                        sortingKeys,  // 用于排序但不分组的键
                        allKeys: result.groupKeys // 所有键（用于比较）
                    };
                }
                return result.groupKeys;
            }
            return null;
        }

        // 普通模式处理
        const keys = [];
        let lastMatchEnd = 0; // 记录上一个匹配的结束位置

        // 逐个处理排序元素
        for (const group of sortGroups) {
            const result = this.findMatchingSetElementWithPosition(
                word,
                group.setName,
                localSets,
                group.positionFlag,
                lastMatchEnd
            );

            if (result.element) {
                let key = result.element;

                // 如果是降序，需要反转排序键
                if (group.descending) {
                    // 对于降序，使用字符串的反向比较值
                    key = String.fromCharCode(255 - key.charCodeAt(0)) + key.slice(1);
                }

                keys.push(key);
                lastMatchEnd = result.endPosition; // 更新下一次搜索的起始位置
            } else {
                // 如果某一级无法匹配，整个多级匹配失败
                return null;
            }
        }

        // 如果有分组开关，需要分离分组键和排序键
        if (hasNonGrouping) {
            const groupingKeys = [];
            const sortingKeys = [];

            for (let i = 0; i < sortGroups.length; i++) {
                if (sortGroups[i].nonGrouping) {
                    sortingKeys.push(keys[i]);
                } else {
                    groupingKeys.push(keys[i]);
                }
            }

            // 如果所有元素都不分组（如@!ABC），则groupingKeys为空数组
            return {
                groupingKeys, // 用于分组的键（可能为空）
                sortingKeys,  // 用于排序但不分组的键
                allKeys: keys // 所有键（用于比较）
            };
        }

        return keys;
    }

    /**
     * 查找有序紧邻匹配
     * @param {string} word - 单词
     * @param {Array} sortGroups - 排序组（必须是两个）
     * @param {Map} localSets - 局部集合映射
     * @returns {Object} 包含成功标志和分组键的对象
     */
    findAdjacentMatch(word, sortGroups, localSets) {
        // Find adjacent matches for strict matching rules

        if (sortGroups.length !== 2) {
            // Invalid sortGroups length
            return { success: false, groupKeys: null };
        }

        const [group1, group2] = sortGroups;
        // Process group1 and group2

        // 检查无效的位置标志组合
        if (group1.positionFlag === '$' || group2.positionFlag === '^') {
            // Invalid position flag combination
            return { success: false, groupKeys: null }; // 不符合紧邻逻辑的组合
        }

        const set1 = this.getSet(group1.setName, localSets);
        const set2 = this.getSet(group2.setName, localSets);
        // Get sets for both groups

        if (!set1 || !set2) {
            // Missing required sets
            return { success: false, groupKeys: null };
        }

        // 按元素长度排序，优先匹配较长的元素
        const sortedElements1 = Array.from(set1).sort((a, b) => b.length - a.length);
        const sortedElements2 = Array.from(set2).sort((a, b) => b.length - a.length);

        const lowerWord = word.toLowerCase();

        // 优先处理有明确位置标志的元素（^或$），这样可以确保正确的匹配顺序
        // 对于@@X(Le$)这样的规则，应该先找到末尾的Le，再向前查找紧邻的X
        if (group2.positionFlag === '$') {
            // Using end-based matching for $ flag
            // 第二个元素有$标志，先匹配它，再向前查找第一个元素
            return this.findAdjacentMatchFromEnd(word, group1, group2, sortedElements1, sortedElements2, localSets);
        } else if (group1.positionFlag === '^') {
            // Using start-based matching for ^ flag
            // 第一个元素有^标志，先匹配它，再向后查找第二个元素
            return this.findAdjacentMatchFromStart(word, group1, group2, sortedElements1, sortedElements2, localSets);
        } else {
            // Using sequential matching for general cases
            // 都没有明确位置标志，使用原来的逻辑
            return this.findAdjacentMatchSequential(word, group1, group2, sortedElements1, sortedElements2, localSets);
        }
    }

    /**
     * 从词尾开始的紧邻匹配（用于处理$标志）
     */
    findAdjacentMatchFromEnd(word, group1, group2, sortedElements1, sortedElements2, localSets) {
        const lowerWord = word.toLowerCase();
        // Match from end for $ flag rules

        // 先匹配第二个元素（有$标志）
        for (const element2 of sortedElements2) {
            const element2Lower = element2.toLowerCase();
            // Check element2 for end match

            // 检查是否是词尾匹配
            if (lowerWord.endsWith(element2Lower)) {
                const match2StartPos = lowerWord.length - element2Lower.length;

                // 向前查找紧邻的第一个元素
                for (const element1 of sortedElements1) {
                    const element1Lower = element1.toLowerCase();
                    const expectedEndPos = match2StartPos;
                    const expectedStartPos = expectedEndPos - element1Lower.length;

                    // 检查位置是否有效且元素匹配
                    if (expectedStartPos >= 0 &&
                        lowerWord.substring(expectedStartPos, expectedEndPos) === element1Lower) {
                        // Element1 matches at expected position


                        // 根据第一个元素的位置标志进行额外检查
                        let validMatch = true;
                        switch (group1.positionFlag) {
                            case '^': // 前缀匹配
                                validMatch = expectedStartPos === 0;
                                break;
                            case '~': // 严格中间匹配
                                validMatch = expectedStartPos > 0 && expectedEndPos < lowerWord.length;
                                break;
                            // '*'和默认情况不需要额外检查
                        }

                        if (validMatch) {
                            // 处理降序标志
                            let key1 = element1Lower;
                            let key2 = element2Lower;

                            if (group1.descending) {
                                key1 = String.fromCharCode(255 - key1.charCodeAt(0)) + key1.slice(1);
                            }
                            if (group2.descending) {
                                key2 = String.fromCharCode(255 - key2.charCodeAt(0)) + key2.slice(1);
                            }

                            return {
                                success: true,
                                groupKeys: [key1, key2]
                            };
                        }
                    }
                }
            }
        }

        return { success: false, groupKeys: null };
    }

    /**
     * 从词首开始的紧邻匹配（用于处理^标志）
     */
    findAdjacentMatchFromStart(word, group1, group2, sortedElements1, sortedElements2, localSets) {
        const lowerWord = word.toLowerCase();

        // 先匹配第一个元素（有^标志）
        for (const element1 of sortedElements1) {
            const element1Lower = element1.toLowerCase();

            // 检查是否是词首匹配
            if (lowerWord.startsWith(element1Lower)) {
                const match1EndPos = element1Lower.length;

                // 向后查找紧邻的第二个元素
                for (const element2 of sortedElements2) {
                    const element2Lower = element2.toLowerCase();
                    const expectedStartPos = match1EndPos;
                    const expectedEndPos = expectedStartPos + element2Lower.length;

                    // 检查位置是否有效且元素匹配
                    if (expectedEndPos <= lowerWord.length &&
                        lowerWord.substring(expectedStartPos, expectedEndPos) === element2Lower) {

                        // 根据第二个元素的位置标志进行额外检查
                        let validMatch = true;
                        switch (group2.positionFlag) {
                            case '$': // 后缀匹配
                                validMatch = expectedEndPos === lowerWord.length;
                                break;
                            case '~': // 严格中间匹配
                                validMatch = expectedStartPos > 0 && expectedEndPos < lowerWord.length;
                                break;
                            // '*'和默认情况不需要额外检查
                        }

                        if (validMatch) {
                            // 处理降序标志
                            let key1 = element1Lower;
                            let key2 = element2Lower;

                            if (group1.descending) {
                                key1 = String.fromCharCode(255 - key1.charCodeAt(0)) + key1.slice(1);
                            }
                            if (group2.descending) {
                                key2 = String.fromCharCode(255 - key2.charCodeAt(0)) + key2.slice(1);
                            }

                            return {
                                success: true,
                                groupKeys: [key1, key2]
                            };
                        }
                    }
                }
            }
        }

        return { success: false, groupKeys: null };
    }

    /**
     * 顺序紧邻匹配（原来的逻辑，用于没有明确位置标志的情况）
     */
    findAdjacentMatchSequential(word, group1, group2, sortedElements1, sortedElements2, localSets) {
        const lowerWord = word.toLowerCase();

        for (let i = 0; i < lowerWord.length - 1; i++) {
            // 逐个尝试第一个集合的元素
            for (const element1 of sortedElements1) {
                const element1Lower = element1.toLowerCase();
                let match1 = null;

                // 根据位置标志检查第一个元素是否匹配
                switch (group1.positionFlag) {
                    case '^': // 前缀匹配
                        if (i === 0 && lowerWord.startsWith(element1Lower)) {
                            match1 = {
                                element: element1Lower,
                                startPos: 0,
                                endPos: element1Lower.length
                            };
                        }
                        break;
                    case '*': // 包含匹配
                    default:
                        if (lowerWord.indexOf(element1Lower, i) === i) {
                            match1 = {
                                element: element1Lower,
                                startPos: i,
                                endPos: i + element1Lower.length
                            };
                        }
                        break;
                    case '~': // 严格中间匹配
                        if (i > 0 && i + element1Lower.length < lowerWord.length &&
                            lowerWord.indexOf(element1Lower, i) === i) {
                            match1 = {
                                element: element1Lower,
                                startPos: i,
                                endPos: i + element1Lower.length
                            };
                        }
                        break;
                }

                // 如果第一个元素匹配，检查第二个元素是否紧邻
                if (match1) {
                    const nextPos = match1.endPos;

                    // 确保下一个位置存在
                    if (nextPos < lowerWord.length) {
                        // 逐个尝试第二个集合的元素
                        for (const element2 of sortedElements2) {
                            const element2Lower = element2.toLowerCase();
                            let match2 = null;

                            // 根据位置标志检查第二个元素是否匹配且紧邻第一个元素
                            switch (group2.positionFlag) {
                                case '$': // 后缀匹配
                                    if (nextPos + element2Lower.length === lowerWord.length &&
                                        lowerWord.endsWith(element2Lower) &&
                                        lowerWord.indexOf(element2Lower, nextPos) === nextPos) {
                                        match2 = {
                                            element: element2Lower,
                                            startPos: nextPos,
                                            endPos: lowerWord.length
                                        };
                                    }
                                    break;
                                case '*': // 包含匹配
                                default:
                                    if (lowerWord.indexOf(element2Lower, nextPos) === nextPos) {
                                        match2 = {
                                            element: element2Lower,
                                            startPos: nextPos,
                                            endPos: nextPos + element2Lower.length
                                        };
                                    }
                                    break;
                                case '~': // 严格中间匹配
                                    if (nextPos > 0 && nextPos + element2Lower.length < lowerWord.length &&
                                        lowerWord.indexOf(element2Lower, nextPos) === nextPos) {
                                        match2 = {
                                            element: element2Lower,
                                            startPos: nextPos,
                                            endPos: nextPos + element2Lower.length
                                        };
                                    }
                                    break;
                            }

                            // 如果两个元素都匹配且紧邻，返回成功
                            if (match2) {
                                // 根据排序方向处理返回的键
                                let key1 = match1.element;
                                let key2 = match2.element;

                                // 如果第一个集合是降序，需要反转排序键
                                if (group1.descending) {
                                    // 对于降序，使用字符串的反向比较值
                                    key1 = String.fromCharCode(255 - key1.charCodeAt(0)) + key1.slice(1);
                                }

                                // 如果第二个集合是降序，需要反转排序键
                                if (group2.descending) {
                                    // 对于降序，使用字符串的反向比较值
                                    key2 = String.fromCharCode(255 - key2.charCodeAt(0)) + key2.slice(1);
                                }

                                return {
                                    success: true,
                                    groupKeys: [key1, key2]
                                };
                            }
                        }
                    }
                }
            }
        }

        return { success: false, groupKeys: null };
    }

    /**
     * 验证新的排序规则格式
     * @param {string} displayRule - 显示规则
     */
    validateNewSortRuleFormat(displayRule) {
        if (!displayRule.startsWith('@')) {
            return; // 非排序规则，无需验证
        }

        // 正确处理@@前缀（严格相邻匹配）和@前缀（松散匹配）
        const sortRule = displayRule.startsWith('@@') ? displayRule.substring(2) : displayRule.substring(1);

        // 对于@@模式，空规则是无效的
        if (displayRule.startsWith('@@') && sortRule === '') {
            throw new Error(`严格排序模式（@@）不能为空，必须包含排序规则`);
        }

        if (sortRule === '' || sortRule === '-' || sortRule === '!' || sortRule === '!-') {
            return; // 基础字母排序或不分组排序，无需验证
        }

        try {
            const parseResult = this.parseSortRule(displayRule);
            const { groups, isAdjacent } = parseResult;

            if (isAdjacent) {

                // 验证@@模式：必须是两个集合
                if (groups.length === 0) {
                    throw new Error(`严格排序模式（@@）必须包含两个排序单元，当前没有任何排序单元`);
                }
                if (groups.length === 1) {
                    throw new Error(`严格排序模式（@@）必须包含两个排序单元，当前只有一个排序单元`);
                }
                if (groups.length !== 2) {
                    throw new Error(`严格排序模式（@@）只支持两个排序单元，当前为 ${groups.length} 个排序单元`);
                }

                // 验证@@模式中的位置标识符限制
                const [group1, group2] = groups;

                // 硬性限制：第一个集合不能使用$
                if (group1.positionFlag === '$') {
                    throw new Error(`有序紧邻模式（@@）中第一个集合不能使用后缀匹配标识符（$）`);
                }

                // 硬性限制：第二个集合不能使用^
                if (group2.positionFlag === '^') {
                    throw new Error(`有序紧邻模式（@@）中第二个集合不能使用前缀匹配标识符（^）`);
                }
            }
            // 移除多级排序必须显式指定位置标识符的限制
            // 现在统一默认为*，不再强制要求显式位置标识符
        } catch (error) {
            throw new Error(`排序规则格式错误: ${error.message}`);
        }
    }

    /**
     * 检查集合名是否有显式位置标识符
     * @param {string} setName - 集合名
     * @param {string} sortRule - 完整排序规则
     * @returns {boolean} 是否有显式位置标识符
     */

    /*byR，2025-06-07，转义正则表达式中的特殊字符*/
    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    hasExplicitPositionFlag(setName, sortRule) {
        const escapedSetName = this.escapeRegExp(setName);

        // 检查括号形式：(setName^), (setName$), (setName*), (setName~)
        const bracketPattern = new RegExp(`\\(${escapedSetName}[\\^\\$\\*\\~]\\)`);
        if (bracketPattern.test(sortRule)) {
            return true;
        }

        // 检查单字母形式：setName^, setName$, setName*, setName~
        // 使用单词边界确保精确匹配
        const directPattern = new RegExp(`\\b${escapedSetName}[\\^\\$\\*\\~]`);
        if (directPattern.test(sortRule)) {
            return true;
        }

        return false;
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
                    // 修复严格中间匹配的位置指针逻辑
                    // 当位置指针为1时，应该从位置2开始搜索
                    // 当位置指针大于1时，直接从指针位置开始搜索
                    const searchStartPos = startPosition === 1 ? 2 : startPosition;
                    const index = lowerWord.indexOf(lowerElement, searchStartPos);
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

        // 截断规则名称，最多显示20个字符
        const truncatedName = rule.name.length > 20 ? rule.name.substring(0, 20) + '...' : rule.name;
        let preview = `规则名称: ${truncatedName}`;

        if (rule.comment) {
            // 截断注释内容，最多显示40个字符
            const truncatedComment = rule.comment.length > 40 ? rule.comment.substring(0, 40) + '...' : rule.comment;
            preview += `\n注释内容: ${truncatedComment}`;
        }
        preview += '\n';

        // 显示全局集合定义
        if (this.globalSets.size > 0) {
            preview += '\n全局集合定义:\n';
            for (const [setName, setValues] of this.globalSets) {
                const values = Array.from(setValues).slice(0, 26).join(', ');
                const more = setValues.size > 26 ? '...' : '';
                preview += `${setName} == {${values}${more}}\n`;
            }
        }

        // 显示局部集合定义
        if (rule.localSets.size > 0) {
            preview += '\n局部集合定义:\n';
            for (const [setName, setValues] of rule.localSets) {
                const values = Array.from(setValues).slice(0, 26).join(', ');
                const more = setValues.size > 26 ? '...' : '';
                preview += `${setName} == {${values}${more}}\n`;
            }
        }

        preview += `\n筛选规则: ${rule.specificRule}\n`;

        if (rule.displayRule) {
            preview += `排序规则: ${rule.displayRule}\n`;
        }

        return preview;
    }

    /**
     * 筛选单词列表
     * @param {Array} words - 单词列表
     * @param {string} ruleName - 规则名称
     * @returns {Array} 筛选结果
     */
    filterWords(words, ruleName) {
        const rule = this.getRule(ruleName);
        if (!rule) {
            throw new Error(`规则 "${ruleName}" 不存在`);
        }

        const filteredWords = [];
        for (const word of words) {
            if (this.matchesRule(word, rule)) {
                filteredWords.push(word);
            }
        }

        return filteredWords;
    }
}

// Node.js 模块导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RuleEngine;
}