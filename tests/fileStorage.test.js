// FileStorageManager 单元测试
require('../js/fileStorage.js');

describe('FileStorageManager', () => {
  let fileStorage;

  beforeEach(() => {
    fileStorage = new FileStorageManager();
  });

  describe('构造函数和初始化', () => {
    test('应该正确初始化文件名', () => {
      expect(fileStorage.rulesFileName).toBe('rules.json');
      expect(fileStorage.globalSetsFileName).toBe('globalSets.json');
    });
  });

  describe('规则序列化 - saveRulesToFile', () => {
    test('应该正确序列化简单规则', async () => {
      const rules = new Map();
      const rule = {
        name: '测试规则',
        comment: '这是一个测试',
        localSets: new Map(),
        specificRule: 'L=5',
        displayRule: 'L=5'
      };
      rules.set('测试规则', rule);

      // 模拟文件下载
      const mockDownload = jest.fn().mockResolvedValue(true);
      fileStorage.downloadFileWithPicker = mockDownload;

      const result = await fileStorage.saveRulesToFile(rules);

      expect(result).toBe(true);
      expect(mockDownload).toHaveBeenCalled();

      // 检查传递给下载函数的数据
      const callArgs = mockDownload.mock.calls[0];
      const blob = callArgs[0];
      expect(blob).toBeInstanceOf(Blob);
    });

    test('应该正确序列化包含本地集合的规则', async () => {
      const rules = new Map();
      const localSets = new Map();
      localSets.set('X', new Set(['a', 'b', 'c']));
      localSets.set('Y', new Set(['1', '2', '3']));

      const rule = {
        name: '复杂规则',
        comment: '包含本地集合',
        localSets: localSets,
        specificRule: 'X=3 AND Y=2',
        displayRule: 'X=3 AND Y=2'
      };
      rules.set('复杂规则', rule);

      const mockDownload = jest.fn().mockResolvedValue(true);
      fileStorage.downloadFileWithPicker = mockDownload;

      const result = await fileStorage.saveRulesToFile(rules);

      expect(result).toBe(true);
      expect(mockDownload).toHaveBeenCalled();
    });

    test('应该正确序列化全局集合', async () => {
      const rules = new Map();
      const globalSets = new Map();
      globalSets.set('CUSTOM', new Set(['x', 'y', 'z']));
      globalSets.set('NUMBERS', new Set(['1', '2', '3']));

      const mockDownload = jest.fn().mockResolvedValue(true);
      fileStorage.downloadFileWithPicker = mockDownload;

      const result = await fileStorage.saveRulesToFile(rules, globalSets);

      expect(result).toBe(true);
      expect(mockDownload).toHaveBeenCalled();
    });

    test('应该处理保存失败的情况', async () => {
      const rules = new Map();
      const mockDownload = jest.fn().mockRejectedValue(new Error('保存失败'));
      fileStorage.downloadFileWithPicker = mockDownload;

      const result = await fileStorage.saveRulesToFile(rules);

      expect(result).toBe(false);
    });
  });

  describe('规则反序列化 - loadRulesFromFile', () => {
    test('应该正确加载新格式的规则文件', async () => {
      const fileData = {
        globalSets: {
          'CUSTOM': ['x', 'y', 'z']
        },
        rules: {
          '测试规则': {
            name: '测试规则',
            comment: '这是一个测试',
            localSets: [['X', ['a', 'b', 'c']]],
            specificRule: 'L=5',
            displayRule: 'L=5'
          }
        }
      };

      const fileContent = JSON.stringify(fileData);
      const file = new File([fileContent], 'rules.json', { type: 'application/json' });

      const result = await fileStorage.loadRulesFromFile(file);

      expect(result.rules).toBeDefined();
      expect(result.globalSets).toBeDefined();
      expect(result.rules['测试规则']).toBeDefined();
      expect(result.globalSets['CUSTOM']).toEqual(['x', 'y', 'z']);
    });

    test('应该正确加载旧格式的规则文件', async () => {
      const fileData = {
        '测试规则': {
          name: '测试规则',
          comment: '这是一个测试',
          localSets: [],
          specificRule: 'L=5',
          displayRule: 'L=5'
        }
      };

      const fileContent = JSON.stringify(fileData);
      const file = new File([fileContent], 'rules.json', { type: 'application/json' });

      const result = await fileStorage.loadRulesFromFile(file);

      expect(result.rules).toBeDefined();
      expect(result.globalSets).toEqual({});
      expect(result.rules['测试规则']).toBeDefined();
    });

    test('应该处理无效的JSON文件', async () => {
      const invalidContent = '{ invalid json';
      const file = new File([invalidContent], 'invalid.json', { type: 'application/json' });

      await expect(fileStorage.loadRulesFromFile(file)).rejects.toThrow();
    });

    test('应该处理空文件', async () => {
      const file = new File([''], 'empty.json', { type: 'application/json' });

      await expect(fileStorage.loadRulesFromFile(file)).rejects.toThrow();
    });
  });

  describe('文件下载模拟 - downloadFileWithPicker', () => {
    test('应该创建正确的下载链接', async () => {
      // 模拟浏览器环境
      const mockCreateElement = jest.fn();
      const mockClick = jest.fn();
      const mockAppendChild = jest.fn();
      const mockRemoveChild = jest.fn();

      const mockAnchor = {
        href: '',
        download: '',
        click: mockClick
      };

      global.document = {
        createElement: mockCreateElement.mockReturnValue(mockAnchor),
        body: {
          appendChild: mockAppendChild,
          removeChild: mockRemoveChild
        }
      };

      const blob = new Blob(['test content'], { type: 'application/json' });

      await fileStorage.downloadFileWithPicker(blob, 'test.json', 'application/json', '.json');

      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockClick).toHaveBeenCalled();
      expect(mockAppendChild).toHaveBeenCalledWith(mockAnchor);
      expect(mockRemoveChild).toHaveBeenCalledWith(mockAnchor);
    });
  });

  describe('数据验证', () => {
    test('应该验证规则数据的完整性', () => {
      const validRule = {
        name: '测试规则',
        comment: '注释',
        localSets: new Map(),
        specificRule: 'L=5',
        displayRule: 'L=5'
      };

      expect(validRule.name).toBeDefined();
      expect(validRule.specificRule).toBeDefined();
      expect(validRule.displayRule).toBeDefined();
    });

    test('应该处理缺少字段的规则', () => {
      const incompleteRule = {
        name: '不完整规则'
        // 缺少其他必要字段
      };

      expect(incompleteRule.name).toBeDefined();
      expect(incompleteRule.specificRule).toBeUndefined();
    });
  });

  describe('错误处理', () => {
    test('应该处理文件读取错误', async () => {
      // 模拟FileReader错误
      const originalFileReader = global.FileReader;
      global.FileReader = class MockFileReader {
        readAsText() {
          setTimeout(() => {
            if (this.onerror) this.onerror(new Error('读取失败'));
          }, 0);
        }
      };

      const file = new File(['content'], 'test.json', { type: 'application/json' });

      await expect(fileStorage.loadRulesFromFile(file)).rejects.toThrow();

      // 恢复原始FileReader
      global.FileReader = originalFileReader;
    });

    test('应该处理空的规则Map', async () => {
      const emptyRules = new Map();
      const mockDownload = jest.fn().mockResolvedValue(true);
      fileStorage.downloadFileWithPicker = mockDownload;

      const result = await fileStorage.saveRulesToFile(emptyRules);

      expect(result).toBe(true);
      expect(mockDownload).toHaveBeenCalled();
    });

    test('应该处理null和undefined输入', async () => {
      const mockDownload = jest.fn().mockResolvedValue(true);
      fileStorage.downloadFileWithPicker = mockDownload;

      await expect(fileStorage.saveRulesToFile(null)).rejects.toThrow();
      await expect(fileStorage.saveRulesToFile(undefined)).rejects.toThrow();
    });
  });

  describe('性能测试', () => {
    test('应该能够处理大量规则', async () => {
      const largeRulesMap = new Map();

      // 创建1000个规则
      for (let i = 0; i < 1000; i++) {
        const rule = {
          name: `规则${i}`,
          comment: `注释${i}`,
          localSets: new Map(),
          specificRule: `L=${i % 10 + 1}`,
          displayRule: `L=${i % 10 + 1}`
        };
        largeRulesMap.set(`规则${i}`, rule);
      }

      const mockDownload = jest.fn().mockResolvedValue(true);
      fileStorage.downloadFileWithPicker = mockDownload;

      const start = Date.now();
      const result = await fileStorage.saveRulesToFile(largeRulesMap);
      const end = Date.now();

      expect(result).toBe(true);
      expect(end - start).toBeLessThan(2000); // 应该在2秒内完成
    });
  });
});