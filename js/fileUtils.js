/**
 * 文件处理工具类
 * 支持Excel和TXT文件的读取与写入
 */
class FileUtils {
    constructor() {
        this.supportedFormats = ['xlsx', 'xls', 'txt'];
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
        // 将 word[phonetic] 格式分割为 word [phonetic]
        return text.replace(/([a-zA-ZÀ-ÿ'.-]+)(\[[^\]]+\])/g, '$1 $2');
    }

    /**
     * 清理特殊字符
     * @param {string} text - 原始文本
     * @returns {string} 清理后的文本
     */
    cleanSpecialChars(text) {
        // 将引号、反斜杠、中文顿号等替换为空格
        return text.replace(/["\\、]/g, ' ');
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

            // 第三步：分割单词（扩展分界符：空格、制表符、逗号、分号等）
            const lineWords = cleanedLine.split(/[\s,;]+/)
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

                            // 第三步：分割单词（扩展分界符）
                            const cellWords = cleanedCell.split(/[\s,;]+/)
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
        if (word.length < 1 || word.length > 50) {
            return false;
        }

        // 检查是否为音标格式 [音标内容]
        // 扩展音标字符集以包含IPA符号：ˈ ˌ ː ə ɪ ɛ æ ʌ ɔ ʊ ɑ ɒ ɜ ɝ ɞ ɟ ɠ ɡ ɢ ɣ ɤ ɥ ɦ ɧ ɨ ɩ ɪ ɫ ɬ ɭ ɮ ɯ ɰ ɱ ɲ ɳ ɴ ɵ ɶ ɷ ɸ ɹ ɺ ɻ ɼ ɽ ɾ ɿ ʀ ʁ ʂ ʃ ʄ ʅ ʆ ʇ ʈ ʉ ʊ ʋ ʌ ʍ ʎ ʏ ʐ ʑ ʒ ʓ ʔ ʕ ʖ ʗ ʘ ʙ ʚ ʛ ʜ ʝ ʞ ʟ ʠ ʡ ʢ ʣ ʤ ʥ ʦ ʧ ʨ ʩ ʪ ʫ ʬ ʭ ʮ ʯ
        const phoneticPattern = /^\[[a-zA-ZÀ-ÿˈˌːəɪɛæʌɔʊɑɒɜɝɞɟɠɡɢɣɤɥɦɧɨɩɫɬɭɮɯɰɱɲɳɴɵɶɷɸɹɺɻɼɽɾɿʀʁʂʃʄʅʆʇʈʉʋʍʎʏʐʑʒʓʔʕʖʗʘʙʚʛʜʝʞʟʠʡʢʣʤʥʦʧʨʩʪʫʬʭʮʯ\s'.-]+\]$/;
        if (phoneticPattern.test(word)) {
            return true;
        }

        // 普通单词验证：只包含英文字母（含重音符号）、连字符、撇号和句点
        // À-ÿ 涵盖大部分欧洲语言的重音字符（如 é, è, ê, ë, á, à, ñ, ü 等）
        const validPattern = /^[a-zA-ZÀ-ÿ'.-]+$/;
        if (!validPattern.test(word)) {
            return false;
        }

        // 确保单词至少包含一个字母，不能只由标点符号组成
        const hasLetter = /[a-zA-ZÀ-ÿ]/.test(word);
        return hasLetter;
    }

    /**
     * 去除重复单词
     * @param {Array} words - 单词数组
     * @returns {Array} 去重后的单词数组
     */
    removeDuplicates(words) {
        const uniqueWords = new Set();
        const result = [];

        words.forEach(word => {
            const lowerWord = word.toLowerCase();
            if (!uniqueWords.has(lowerWord)) {
                uniqueWords.add(lowerWord);
                result.push(word);
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
     */
    async exportToText(words, filename = 'filtered_words.txt', exportInfo = null, groupedWords = null) {
        let content = '';

        // 添加头部信息
        if (exportInfo) {
            content += this.generateExportHeader(exportInfo);
            content += '\n';
        }

        // 如果有分组信息，按分组格式输出
        if (groupedWords) {
            content += this.generateGroupedContent(groupedWords, words);
        } else {
            // 添加单词列表
            content += words.join('\n');
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
     */
    async exportToExcel(words, filename = 'filtered_words.xlsx', exportInfo = null, groupedWords = null) {
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

        // 创建工作表
        const worksheet = XLSX.utils.aoa_to_sheet(data);

        // 设置列宽
        if (groupedWords) {
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