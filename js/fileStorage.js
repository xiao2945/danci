/**
 * 文件存储管理器
 * 用于将规则数据保存到本地文件而不是localStorage
 */
class FileStorageManager {
    constructor() {
        this.rulesFileName = 'rules.json';
        this.globalSetsFileName = 'globalSets.json';
    }

    /**
     * 保存规则到文件
     * @param {Map} rules - 规则Map对象
     */
    async saveRulesToFile(rules, globalSets = null) {
        try {
            const exportData = {};

            // 添加全局集合信息到导出文件的最前面
            if (globalSets && globalSets.size > 0) {
                const globalSetsData = {};
                for (const [setName, setValues] of globalSets) {
                    globalSetsData[setName] = Array.from(setValues);
                }
                exportData.globalSets = globalSetsData;
            }

            // 序列化规则数据
            const rulesData = {};
            for (const [name, rule] of rules) {
                // 正确序列化localSets：将Map<string, Set>转换为Array<[string, Array]>
                const serializedLocalSets = [];
                if (rule.localSets) {
                    for (const [setName, setValues] of rule.localSets) {
                        serializedLocalSets.push([setName, Array.from(setValues)]);
                    }
                }

                rulesData[name] = {
                    name: rule.name,
                    comment: rule.comment || '',
                    localSets: serializedLocalSets,
                    specificRule: rule.specificRule,
                    displayRule: rule.displayRule
                };
            }
            exportData.rules = rulesData;

            // 创建文件数据
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });

            // 使用文件选择器保存文件
            await this.downloadFileWithPicker(dataBlob, this.rulesFileName, 'application/json', '.json');

            console.log('规则已导出到文件:', this.rulesFileName);
            return true;
        } catch (error) {
            console.error('保存规则到文件失败:', error);
            return false;
        }
    }

    /**
     * 从文件加载规则
     * @param {File} file - 文件对象
     * @returns {Promise<Object>} 包含规则数据和全局集合的对象
     */
    async loadRulesFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const fileData = JSON.parse(e.target.result);

                    // 检查文件格式：新格式包含globalSets和rules，旧格式直接是规则数据
                    if (fileData.rules && typeof fileData.rules === 'object') {
                        // 新格式：包含全局集合和规则
                        console.log('从文件加载规则成功（新格式）:', Object.keys(fileData.rules));
                        if (fileData.globalSets) {
                            console.log('从文件加载全局集合成功:', Object.keys(fileData.globalSets));
                        }
                        resolve({
                            rules: fileData.rules,
                            globalSets: fileData.globalSets || {}
                        });
                    } else {
                        // 旧格式：直接是规则数据
                        console.log('从文件加载规则成功（旧格式）:', Object.keys(fileData));
                        resolve({
                            rules: fileData,
                            globalSets: {}
                        });
                    }
                } catch (error) {
                    console.error('解析规则文件失败:', error);
                    reject(error);
                }
            };

            reader.onerror = () => {
                reject(new Error('读取文件失败'));
            };

            reader.readAsText(file);
        });
    }

    /**
     * 保存全局集合到文件
     * @param {Map} globalSets - 全局集合Map对象
     */
    async saveGlobalSetsToFile(globalSets) {
        try {
            const globalSetsData = {};

            // 将Map转换为可序列化的对象
            for (const [name, setValues] of globalSets) {
                globalSetsData[name] = Array.from(setValues);
            }

            // 创建文件数据
            const dataStr = JSON.stringify(globalSetsData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });

            // 使用文件选择器保存文件
            await this.downloadFileWithPicker(dataBlob, this.globalSetsFileName, 'application/json', '.json');

            console.log('全局集合已导出到文件:', this.globalSetsFileName);
            return true;
        } catch (error) {
            console.error('保存全局集合到文件失败:', error);
            return false;
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
     * 从文件加载全局集合
     * @param {File} file - 文件对象
     * @returns {Promise<Object>} 全局集合数据
     */
    async loadGlobalSetsFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const globalSets = JSON.parse(e.target.result);
                    console.log('从文件加载全局集合成功');
                    resolve(globalSets);
                } catch (error) {
                    console.error('解析全局集合文件失败:', error);
                    reject(error);
                }
            };

            reader.onerror = () => {
                reject(new Error('读取文件失败'));
            };

            reader.readAsText(file);
        });
    }

    /**
     * 创建文件输入元素
     * @param {Function} callback - 文件选择回调
     * @param {string} accept - 接受的文件类型
     */
    createFileInput(callback, accept = '.json') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.style.display = 'none';

        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                callback(file);
            }
            document.body.removeChild(input);
        });

        document.body.appendChild(input);
        input.click();
    }
}

// 导出文件存储管理器
window.FileStorageManager = FileStorageManager;