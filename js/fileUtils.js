/**
 * 文件处理工具类
 * 支持Excel和TXT文件的读取与写入
 */
class FileUtils {
    constructor() {
        this.supportedFormats = ['xlsx', 'xls', 'txt', 'csv'];
    }

    /**
     * 检查文件格式是否支持
     * @param {File} file - 文件对象
     * @returns {boolean} 是否支持
     */
    isSupportedFormat(file) {
        const extension = file.name.split('.').pop().toLowerCase();
        return this.supportedFormats.includes(extension);
    }

    /**
     * 读取文件内容
     * @param {File} file - 文件对象
     * @returns {Promise<Object>} 包含单词数组和统计信息的对象
     */
    async readFile(file) {
        const extension = file.name.split('.').pop().toLowerCase();

        try {
            if (extension === 'txt') {
                return await this.readTextFile(file);
            } else if (extension === 'csv') {
                return await this.readCSVFile(file);
            } else if (extension === 'xlsx' || extension === 'xls') {
                return await this.readExcelFile(file);
            } else {
                throw new Error(`不支持的文件格式: ${extension}`);
            }
        } catch (error) {
            console.error('文件读取错误:', error);
            throw error;
        }
    }

    /**
     * 读取文本文件
     * @param {File} file - 文件对象
     * @returns {Promise<Object>} 包含单词数组和统计信息的对象
     */
    async readTextFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const result = this.parseTextContent(text);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsText(file, 'utf-8');
        });
    }

    /**
     * 读取CSV文件
     * @param {File} file - 文件对象
     * @returns {Promise<Object>} 包含单词数组和统计信息的对象
     */
    async readCSVFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const result = this.parseCSVContent(text);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('CSV文件读取失败'));
            reader.readAsText(file, 'utf-8');
        });
    }

    /**
     * 读取Excel文件
     * @param {File} file - 文件对象
     * @returns {Promise<Object>} 包含单词数组和统计信息的对象
     */
    async readExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const result = this.parseExcelContent(workbook);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Excel文件读取失败'));
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * 预处理音标格式
     * @param {string} text - 原始文本
     * @returns {string} 处理后的文本
     */
    preprocessPhonetics(text) {
        // 将 word[phonetic] 和 word/phonetic/ 格式分割为 word [phonetic] 和 word /phonetic/
        let result = text.replace(/([a-zA-ZÀ-ÿ'.-]+)(\[[^\]]+\])/g, '$1 $2'); // [音标]
        result = result.replace(/([a-zA-ZÀ-ÿ'.-]+)(\/[^\/]+\/)/g, '$1 $2');   // /音标/
        return result;
    }

    /**
     * 清理特殊字符
     * @param {string} text - 原始文本
     * @returns {string} 清理后的文本
     */
    cleanSpecialChars(text) {
        // 英文符号：竖线、反斜杠、逗号、双引号、分号
        // 中文符号：顿号、逗号、引号、分号
        // 注意：单引号可能是所有格，只处理单词前后成对出现的单引号
        let result = text;

        // 处理英文符号
        result = result.replace(/[|\\,";]/g, ' '); // 英文竖线、反斜杠、逗号、双引号、分号

        // 处理中文符号
        result = result.replace(/[、，“”；]/g, ' '); // 中文顿号、逗号、引号、分号

        // 处理单引号 - 只替换单词边界的单引号，保留所有格单引号
        result = result.replace(/(\s|^)'|'(\s|$)/g, ' '); // 单词前后的单引号替换为空格

        return result;
    }

    /**
     * 解析文本内容
     * @param {string} text - 文本内容
     * @returns {Object} 包含有效单词数组和统计信息的对象
     */
    parseTextContent(text) {
        // 按行分割，去除空行和无效内容
        const lines = text.split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0);

        const allWords = [];
        const invalidWords = [];
        const preprocessingSteps = [];

        for (const line of lines) {
            // 第一步：预处理音标
            const phoneticProcessed = this.preprocessPhonetics(line);
            if (phoneticProcessed !== line) {
                preprocessingSteps.push(`音标分离: "${line}" → "${phoneticProcessed}"`);
            }

            // 第二步：清理特殊字符
            const cleanedLine = this.cleanSpecialChars(phoneticProcessed);
            if (cleanedLine !== phoneticProcessed) {
                preprocessingSteps.push(`字符清理: "${phoneticProcessed}" → "${cleanedLine}"`);
            }

            // 第三步：分割单词（仅使用空格、制表符等空白字符分割，逗号分号已在前面处理）
            const lineWords = cleanedLine.split(/\s+/)
                .map(word => word.trim())
                .filter(word => word.length > 0);

            // 分离有效和无效单词
            lineWords.forEach(word => {
                if (this.isValidWord(word)) {
                    allWords.push(word);
                } else {
                    invalidWords.push(word);
                }
            });
        }

        const validWords = this.removeDuplicates(allWords);
        const duplicateCount = allWords.length - validWords.length;
        const totalWords = allWords.length + invalidWords.length; // 总单词数 = 有效单词(含重复) + 无效单词
        return {
            words: validWords,
            totalExtracted: totalWords,
            validCount: validWords.length, // 最终有效单词数(去重后)
            duplicateCount: duplicateCount, // 重复单词数
            invalidCount: invalidWords.length, // 无效单词数
            invalidWords: invalidWords.slice(0, 10), // 只保留前10个作为示例
            preprocessingSteps: preprocessingSteps.slice(0, 5) // 只保留前5个预处理步骤作为示例
        };
    }

    /**
     * 解析CSV内容
     * @param {string} text - CSV文本内容
     * @returns {Object} 包含有效单词数组和统计信息的对象
     */
    parseCSVContent(text) {
        const allWords = [];
        const invalidWords = [];
        const preprocessingSteps = [];

        // 按行分割CSV内容
        const lines = text.split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0);

        for (const line of lines) {
            // 简单的CSV解析：按逗号分割，处理引号包围的字段
            const fields = this.parseCSVLine(line);

            for (const field of fields) {
                if (field && typeof field === 'string' && field.trim().length > 0) {
                    const cellContent = field.trim();

                    // 第一步：预处理音标
                    const phoneticProcessed = this.preprocessPhonetics(cellContent);
                    if (phoneticProcessed !== cellContent) {
                        preprocessingSteps.push(`音标分离: "${cellContent}" → "${phoneticProcessed}"`);
                    }

                    // 第二步：清理特殊字符
                    const cleanedCell = this.cleanSpecialChars(phoneticProcessed);
                    if (cleanedCell !== phoneticProcessed) {
                        preprocessingSteps.push(`字符清理: "${phoneticProcessed}" → "${cleanedCell}"`);
                    }

                    // 第三步：分割单词（仅使用空格、制表符等空白字符分割，逗号分号已在前面处理）
                    const cellWords = cleanedCell.split(/\s+/)
                        .map(word => word.trim())
                        .filter(word => word.length > 0);

                    // 分离有效和无效单词
                    cellWords.forEach(word => {
                        if (this.isValidWord(word)) {
                            allWords.push(word);
                        } else {
                            invalidWords.push(word);
                        }
                    });
                }
            }
        }

        const validWords = this.removeDuplicates(allWords);
        const duplicateCount = allWords.length - validWords.length;
        const totalWords = allWords.length + invalidWords.length;
        return {
            words: validWords,
            totalExtracted: totalWords,
            validCount: validWords.length,
            duplicateCount: duplicateCount,
            invalidCount: invalidWords.length,
            invalidWords: invalidWords.slice(0, 10),
            preprocessingSteps: preprocessingSteps.slice(0, 5)
        };
    }

    /**
     * 解析CSV行，处理引号包围的字段
     * @param {string} line - CSV行内容
     * @returns {Array} 字段数组
     */
    parseCSVLine(line) {
        const fields = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // 转义的引号
                    current += '"';
                    i++; // 跳过下一个引号
                } else {
                    // 切换引号状态
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                // 字段分隔符
                fields.push(current);
                current = '';
            } else {
                current += char;
            }
        }

        // 添加最后一个字段
        fields.push(current);

        return fields;
    }

    /**
     * 解析Excel内容
     * @param {Object} workbook - Excel工作簿对象
     * @returns {Object} 包含有效单词数组和统计信息的对象
     */
    parseExcelContent(workbook) {
        const allWords = [];
        const invalidWords = [];
        const preprocessingSteps = [];

        // 遍历所有工作表
        workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            // 遍历所有行和列
            jsonData.forEach(row => {
                if (Array.isArray(row)) {
                    row.forEach(cell => {
                        if (cell && typeof cell === 'string') {
                            // 第一步：预处理音标
                            const phoneticProcessed = this.preprocessPhonetics(cell);
                            if (phoneticProcessed !== cell) {
                                preprocessingSteps.push(`音标分离: "${cell}" → "${phoneticProcessed}"`);
                            }

                            // 第二步：清理特殊字符
                            const cleanedCell = this.cleanSpecialChars(phoneticProcessed);
                            if (cleanedCell !== phoneticProcessed) {
                                preprocessingSteps.push(`字符清理: "${phoneticProcessed}" → "${cleanedCell}"`);
                            }

                            // 第三步：分割单词（仅使用空格、制表符等空白字符分割，逗号分号已在前面处理）
                            const cellWords = cleanedCell.split(/\s+/)
                                .map(word => word.trim())
                                .filter(word => word.length > 0);

                            // 分离有效和无效单词
                            cellWords.forEach(word => {
                                if (this.isValidWord(word)) {
                                    allWords.push(word);
                                } else {
                                    invalidWords.push(word);
                                }
                            });
                        }
                    });
                }
            });
        });

        const validWords = this.removeDuplicates(allWords);
        const duplicateCount = allWords.length - validWords.length;
        const totalWords = allWords.length + invalidWords.length; // 总单词数 = 有效单词(含重复) + 无效单词
        return {
            words: validWords,
            totalExtracted: totalWords,
            validCount: validWords.length, // 最终有效单词数(去重后)
            duplicateCount: duplicateCount, // 重复单词数
            invalidCount: invalidWords.length, // 无效单词数
            invalidWords: invalidWords.slice(0, 10), // 只保留前10个作为示例
            preprocessingSteps: preprocessingSteps.slice(0, 5) // 只保留前5个预处理步骤作为示例
        };
    }

    /**
     * 验证单词是否有效
     * @param {string} word - 单词
     * @returns {boolean} 是否有效
     */
    isValidWord(word) {
        // 基本长度检查
        if (word.length < 1 || word.length > 100) {
            return false;
        }

        // 检查是否为音标格式 [音标内容] 或 /音标内容/
        // 严格的英语IPA音标字符集验证
        if (this.isStrictPhonetic(word)) {
            return true;
        }

        // 普通单词验证：严格限制字符集
        // 1. 26个大写字母：A-Z
        // 2. 26个小写字母：a-z
        // 3. 连字符、缩写点、所有格：- . '
        // 4. 指定的变音符号：é ü ñ ç à è ì ò ù â ê î ô û ä ë ï ö ü ÿ æ œ ø
        const allowedDiacritics = 'éüñçàèìòùâêîôûäëïöüÿæœø';
        const validPattern = new RegExp(`^[a-zA-Z${allowedDiacritics}'.-]+$`);
        if (!validPattern.test(word)) {
            return false;
        }

        // 禁止开头的连字符、缩写点、所有格
        if (/^[-.']/.test(word)) {
            return false;
        }

        // 禁止结尾的连字符
        if (/[-]$/.test(word)) {
            return false;
        }

        // 确保单词至少包含一个字母，不能只由标点符号组成
        const hasLetter = new RegExp(`[a-zA-Z${allowedDiacritics}]`).test(word);
        return hasLetter;
    }

    /**
     * 严格的音标验证
     * @param {string} word - 单词或音标
     * @returns {boolean} 是否为有效的严格音标
     */
    isStrictPhonetic(word) {
        // 检查是否为音标格式 [音标内容] 或 /音标内容/
        if (!/^\[.+\]$/.test(word) && !/^\/.*\/$/.test(word)) {
            return false;
        }

        // 提取音标内容（去掉外层的[]或//）
        const content = word.slice(1, -1);

        // 定义严格的IPA字符集
        // 1. 英语IPA元音和辅音
        const ipaVowels = 'iɪeɛæaɑɔoʊuʌəɜɝɒ';
        const ipaConsonants = 'pbtdkɡfvθðszʃʒhmnŋlrjw';

        // 2. 超音段符号
        const suprasegmentals = 'ˈˌː.‿';

        // 3. 结构符号（圆括号）
        const structural = '()';

        // 4. 特殊放宽字符
        const relaxedChars = 'grtʃdʒ:\'a';

        // 合并所有允许的字符
        const allowedChars = ipaVowels + ipaConsonants + suprasegmentals + structural + relaxedChars;

        // 检查是否只包含允许的字符
        for (let char of content) {
            if (!allowedChars.includes(char)) {
                return false;
            }
        }

        // 5. 检查ː和:不能混用
        if (content.includes('ː') && content.includes(':')) {
            return false;
        }

        // 6. 检查ˈ和'不能混用
        if (content.includes('ˈ') && content.includes('\'')) {
            return false;
        }

        return true;
    }

    /**
     * 检查是否为音标格式
     * @param {string} word - 单词或音标
     * @returns {boolean} 是否为音标
     */
    isPhonetic(word) {
        return /^\[.+\]$/.test(word) || /^\/.*\/$/.test(word);
    }

    /**
     * 去除重复单词（不区分大小写，音标不参与去重）
     * @param {Array} words - 单词数组
     * @returns {Array} 去重后的单词数组
     */
    removeDuplicates(words) {
        const uniqueWords = new Set();
        const result = [];

        words.forEach(word => {
            // 音标不参与去重，直接保留
            if (this.isPhonetic(word)) {
                result.push(word);
            } else {
                // 只对普通单词进行去重
                const lowerWord = word.toLowerCase();
                if (!uniqueWords.has(lowerWord)) {
                    uniqueWords.add(lowerWord);
                    result.push(word);
                }
            }
        });

        return result;
    }

    /**
     * 导出为文本文件
     * @param {Array} words - 单词数组
     * @param {string} filename - 文件名
     * @param {Object} exportInfo - 导出信息（可选）
     * @param {Object} groupedWords - 分组信息（可选）
     * @param {boolean} hasNonGrouping - 是否使用!标志（不分组）
     */
    async exportToText(words, filename = 'filtered_words.txt', exportInfo = null, groupedWords = null, hasNonGrouping = false) {
        let content = '';

        // 添加头部信息
        if (exportInfo) {
            content += this.generateExportHeader(exportInfo);
            content += '\n';
        }

        // 如果使用!标志，强制不分组显示
        if (hasNonGrouping) {
            content += words.join('\n');
        } else {
            // 如果有分组信息，按分组格式输出
            if (groupedWords) {
                content += this.generateGroupedContent(groupedWords, words);
            } else {
                // 添加单词列表
                content += words.join('\n');
            }
        }

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        await this.downloadFileWithPicker(blob, filename, 'text/plain', '.txt');
    }

    /**
     * 导出为Excel文件
     * @param {Array} words - 单词数组
     * @param {string} filename - 文件名
     * @param {Object} exportInfo - 导出信息（可选）
     * @param {Object} groupedWords - 分组信息（可选）
     * @param {boolean} hasNonGrouping - 是否使用!标志（不分组）
     */
    async exportToExcel(words, filename = 'filtered_words.xlsx', exportInfo = null, groupedWords = null, hasNonGrouping = false) {
        // 创建工作簿
        const workbook = XLSX.utils.book_new();

        // 准备数据
        const data = [];

        // 添加头部信息
        if (exportInfo) {
            const headerLines = this.generateExportHeader(exportInfo).split('\n');
            headerLines.forEach(line => {
                if (line.trim()) {
                    data.push([line]);
                }
            });
            data.push(['']); // 空行分隔
        }

        // 如果使用!标志，强制不分组显示
        if (hasNonGrouping) {
            data.push(['单词']);
            words.forEach(word => {
                data.push([word]);
            });
        } else {
            // 如果有分组信息，按分组格式输出
            if (groupedWords) {
                // 检查是否有二级分组
                const hasSecondLevel = this.hasSecondLevelGroups(groupedWords);

                // 添加表头
                if (hasSecondLevel) {
                    data.push(['一级分组', '二级分组', '单词']);
                } else {
                    data.push(['分组', '单词']);
                }
                this.addGroupedDataToExcel(data, groupedWords, words, 0, '', hasSecondLevel);
            } else {
                // 添加表头
                data.push(['单词']);

                // 添加单词数据
                words.forEach(word => {
                    data.push([word]);
                });
            }
        }

        // 创建工作表
        const worksheet = XLSX.utils.aoa_to_sheet(data);

        // 设置列宽
        if (!hasNonGrouping && groupedWords) {
            const hasSecondLevel = this.hasSecondLevelGroups(groupedWords);
            if (hasSecondLevel) {
                worksheet['!cols'] = [{ width: 10 }, { width: 10 }, { width: 50 }];
            } else {
                worksheet['!cols'] = [{ width: 10 }, { width: 50 }];
            }
        } else {
            worksheet['!cols'] = [{ width: 30 }];
        }

        // 添加工作表到工作簿
        XLSX.utils.book_append_sheet(workbook, worksheet, '筛选结果');

        // 生成Excel文件的二进制数据
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        await this.downloadFileWithPicker(blob, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.xlsx');
    }

    /**
     * 生成导出文件头部信息
     * @param {Object} exportInfo - 导出信息
     * @returns {string} 头部信息字符串
     */
    generateExportHeader(exportInfo) {
        const lines = [];

        // 添加源文件信息
        if (exportInfo.sourceFile && exportInfo.totalWords) {
            lines.push(`源文件：${exportInfo.sourceFile} (总单词数：${exportInfo.totalWords})`);
        }

        // 添加筛选规则信息
        if (exportInfo.ruleName && exportInfo.filteredCount !== undefined) {
            let ruleDisplayName = exportInfo.ruleName;

            // 如果有注释，在规则名后面加括号显示截取的注释
            if (exportInfo.ruleComment && exportInfo.ruleComment.trim()) {
                const truncatedComment = exportInfo.ruleComment.length > 20 ? exportInfo.ruleComment.substring(0, 20) + '...' : exportInfo.ruleComment;
                ruleDisplayName += ` (${truncatedComment})`;
            }

            lines.push(`筛选规则：${ruleDisplayName} (筛选结果：${exportInfo.filteredCount}个单词)`);
        }

        // 添加删除统计信息
        if (exportInfo.deletedCount !== undefined && exportInfo.exportedCount !== undefined) {
            if (exportInfo.deletedCount > 0) {
                lines.push(`删除统计：已删除 ${exportInfo.deletedCount} 个单词，导出 ${exportInfo.exportedCount} 个单词`);
            } else {
                lines.push(`删除统计：无删除单词，导出全部 ${exportInfo.exportedCount} 个单词`);
            }
        }

        // 添加生成时间
        const now = new Date();
        const timestamp = now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0') + ' ' +
            String(now.getHours()).padStart(2, '0') + ':' +
            String(now.getMinutes()).padStart(2, '0') + ':' +
            String(now.getSeconds()).padStart(2, '0');
        lines.push(`生成时间：${timestamp}`);

        // 添加分隔线
        lines.push('=' + '='.repeat(50));

        return lines.join('\n');
    }

    /**
     * 生成分组内容
     * @param {Object} groupedWords - 分组对象
     * @param {Array} activeWords - 活跃单词数组（用于过滤已删除的单词）
     * @param {number} level - 分组层级
     * @returns {string} 分组内容字符串
     */
    generateGroupedContent(groupedWords, activeWords, level = 0) {
        let content = '';
        const prefix = '#'.repeat(level + 1); // 根据层级生成标题前缀

        for (const [groupName, groupContent] of Object.entries(groupedWords)) {
            // 添加分组标签
            content += `${prefix} ${groupName}\n\n`;

            if (Array.isArray(groupContent)) {
                // 这是最终的单词列表，只输出活跃的单词
                const activeGroupWords = groupContent.filter(word => activeWords.includes(word));
                if (activeGroupWords.length > 0) {
                    content += activeGroupWords.join('\n') + '\n\n';
                }
            } else {
                // 这是子分组，递归处理
                content += this.generateGroupedContent(groupContent, activeWords, level + 1);
            }
        }

        return content;
    }

    /**
     * 检查是否有二级分组
     * @param {Object} groupedWords - 分组对象
     * @returns {boolean} 是否有二级分组
     */
    hasSecondLevelGroups(groupedWords) {
        for (const [groupName, groupContent] of Object.entries(groupedWords)) {
            if (!Array.isArray(groupContent)) {
                return true; // 发现非数组内容，说明有子分组
            }
        }
        return false;
    }

    /**
     * 为Excel添加分组数据
     * @param {Array} data - Excel数据数组
     * @param {Object} groupedWords - 分组对象
     * @param {Array} activeWords - 活跃单词数组
     * @param {number} level - 分组层级
     * @param {string} parentGroup - 父级分组名称
     * @param {boolean} hasSecondLevel - 是否有二级分组
     */
    addGroupedDataToExcel(data, groupedWords, activeWords, level = 0, parentGroup = '', hasSecondLevel = true) {
        for (const [groupName, groupContent] of Object.entries(groupedWords)) {
            if (Array.isArray(groupContent)) {
                // 这是最终的单词列表，只输出活跃的单词
                const activeGroupWords = groupContent.filter(word => activeWords.includes(word));
                if (activeGroupWords.length > 0) {
                    const wordsString = activeGroupWords.join('，');
                    if (level === 0) {
                        if (hasSecondLevel) {
                            // 有二级分组：第一列是分组名，第二列空，第三列是单词
                            data.push([groupName, '', wordsString]);
                        } else {
                            // 无二级分组：第一列是分组名，第二列是单词
                            data.push([groupName, wordsString]);
                        }
                    } else if (level === 1) {
                        if (hasSecondLevel) {
                            // 二级分组：第一列是父分组名，第二列是当前分组名，第三列是单词
                            data.push([parentGroup, groupName, wordsString]);
                        }
                    }
                }
            } else {
                // 这是子分组，需要递归处理
                if (level === 0) {
                    // 处理一级分组的子分组
                    let isFirstSubGroup = true;
                    for (const [subGroupName, subGroupContent] of Object.entries(groupContent)) {
                        if (Array.isArray(subGroupContent)) {
                            const activeSubGroupWords = subGroupContent.filter(word => activeWords.includes(word));
                            if (activeSubGroupWords.length > 0) {
                                const wordsString = activeSubGroupWords.join('，');
                                if (hasSecondLevel) {
                                    if (isFirstSubGroup) {
                                        // 第一个二级分组和一级分组在同一行
                                        data.push([groupName, subGroupName, wordsString]);
                                        isFirstSubGroup = false;
                                    } else {
                                        // 后续二级分组，第一列为空
                                        data.push(['', subGroupName, wordsString]);
                                    }
                                }
                            }
                        }
                    }
                } else {
                    // 更深层级的递归处理（虽然当前限制最多三级）
                    this.addGroupedDataToExcel(data, groupContent, activeWords, level + 1, groupName, hasSecondLevel);
                }
            }
        }
    }

    /**
     * 使用文件选择器下载文件
     * @param {Blob} blob - 文件数据
     * @param {string} defaultFilename - 默认文件名
     * @param {string} mimeType - MIME类型
     * @param {string} extension - 文件扩展名
     */
    async downloadFileWithPicker(blob, defaultFilename, mimeType, extension) {
        try {
            // 检查是否支持File System Access API
            if ('showSaveFilePicker' in window) {
                const fileHandle = await window.showSaveFilePicker({
                    suggestedName: defaultFilename,
                    types: [{
                        description: `${extension.toUpperCase()} files`,
                        accept: { [mimeType]: [extension] }
                    }]
                });

                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
            } else {
                // 降级到传统下载方式
                this.downloadFile(blob, defaultFilename);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                // 用户取消操作，重新抛出错误让调用方处理
                throw error;
            } else {
                console.error('保存文件失败:', error);
                // 降级到传统下载方式
                this.downloadFile(blob, defaultFilename);
            }
        }
    }

    /**
     * 下载文件（传统方式）
     * @param {Blob} blob - 文件数据
     * @param {string} filename - 文件名
     */
    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * 获取文件信息
     * @param {File} file - 文件对象
     * @returns {Object} 文件信息
     */
    getFileInfo(file) {
        const extension = file.name.split('.').pop().toLowerCase();
        const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);

        return {
            name: file.name,
            size: file.size,
            sizeFormatted: `${sizeInMB} MB`,
            type: file.type,
            extension: extension,
            lastModified: new Date(file.lastModified).toLocaleString('zh-CN'),
            isSupported: this.isSupportedFormat(file)
        };
    }

    /**
     * 验证文件大小
     * @param {File} file - 文件对象
     * @param {number} maxSizeMB - 最大文件大小（MB）
     * @returns {boolean} 是否符合大小限制
     */
    validateFileSize(file, maxSizeMB = 10) {
        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        return file.size <= maxSizeBytes;
    }
}