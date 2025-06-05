// WordFilterApp 单元测试
require('../js/fileUtils.js');
require('../js/ruleEngine.js');
require('../js/app.js');

describe('WordFilterApp', () => {
  let app;
  let mockContainer;

  beforeEach(() => {
    // 模拟DOM环境
    mockContainer = {
      getElementById: jest.fn(),
      addEventListener: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn()
    };

    global.document = {
      getElementById: mockContainer.getElementById,
      addEventListener: mockContainer.addEventListener,
      querySelector: mockContainer.querySelector,
      querySelectorAll: mockContainer.querySelectorAll
    };

    global.window = {
      addEventListener: jest.fn()
    };

    // 模拟DOM元素
    const mockElements = {
      wordFile: { addEventListener: jest.fn() },
      ruleSelect: { addEventListener: jest.fn(), innerHTML: '' },
      generateBtn: { addEventListener: jest.fn(), disabled: true },
      exportBtn: { addEventListener: jest.fn() },
      clearBtn: { addEventListener: jest.fn() },
      fileInfo: { innerHTML: '' },
      rulePreview: { innerHTML: '' },
      resultInfo: { innerHTML: '' },
      resultPreview: { innerHTML: '' },
      messageContainer: { innerHTML: '', style: { display: 'none' } }
    };

    mockContainer.getElementById.mockImplementation((id) => mockElements[id] || null);

    app = new WordFilterApp();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('构造函数和初始化', () => {
    test('应该正确初始化应用程序', () => {
      expect(app.fileUtils).toBeDefined();
      expect(app.ruleEngine).toBeDefined();
      expect(app.currentWords).toEqual([]);
      expect(app.filteredWords).toEqual([]);
      expect(app.currentFile).toBeNull();
      expect(app.deletedWords).toBeInstanceOf(Set);
    });

    test('应该绑定事件监听器', () => {
      expect(global.window.addEventListener).toHaveBeenCalled();
      expect(global.document.addEventListener).toHaveBeenCalled();
    });
  });

  describe('文件处理 - handleFileSelect', () => {
    test('应该处理有效的文件选择', async () => {
      const mockFile = new File(['hello\nworld\ntest'], 'test.txt', { type: 'text/plain' });
      const mockEvent = {
        target: {
          files: [mockFile]
        }
      };

      // 模拟文件读取结果
      jest.spyOn(app.fileUtils, 'readFile').mockResolvedValue({
        words: ['hello', 'world', 'test'],
        totalWords: 3,
        validWords: 3,
        duplicates: 0
      });

      await app.handleFileSelect(mockEvent);

      expect(app.currentWords).toEqual(['hello', 'world', 'test']);
      expect(app.currentFile).toBe(mockFile);
    });

    test('应该拒绝不支持的文件格式', async () => {
      const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      const mockEvent = {
        target: {
          files: [mockFile]
        }
      };

      jest.spyOn(app, 'showMessage');

      await app.handleFileSelect(mockEvent);

      expect(app.showMessage).toHaveBeenCalledWith(
        expect.stringContaining('不支持的文件格式'),
        'error'
      );
    });

    test('应该处理文件读取错误', async () => {
      const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' });
      const mockEvent = {
        target: {
          files: [mockFile]
        }
      };

      jest.spyOn(app.fileUtils, 'readFile').mockRejectedValue(new Error('读取失败'));
      jest.spyOn(app, 'showMessage');

      await app.handleFileSelect(mockEvent);

      expect(app.showMessage).toHaveBeenCalledWith(
        expect.stringContaining('文件读取失败'),
        'error'
      );
    });

    test('应该处理空文件选择', async () => {
      const mockEvent = {
        target: {
          files: []
        }
      };

      await app.handleFileSelect(mockEvent);

      expect(app.currentFile).toBeNull();
      expect(app.currentWords).toEqual([]);
    });
  });

  describe('规则处理 - handleRuleChange', () => {
    beforeEach(() => {
      // 设置测试规则
      const testRule = {
        name: '测试规则',
        comment: '这是一个测试规则',
        specificRule: 'L=5',
        displayRule: 'L=5',
        localSets: new Map()
      };
      app.ruleEngine.rules.set('测试规则', testRule);
    });

    test('应该正确处理规则选择', () => {
      const mockEvent = {
        target: {
          value: '测试规则'
        }
      };

      jest.spyOn(app, 'updateRulePreview');
      jest.spyOn(app, 'updateGenerateButton');

      app.handleRuleChange(mockEvent);

      expect(app.updateRulePreview).toHaveBeenCalledWith('测试规则');
      expect(app.updateGenerateButton).toHaveBeenCalled();
    });

    test('应该处理空规则选择', () => {
      const mockEvent = {
        target: {
          value: ''
        }
      };

      jest.spyOn(app, 'updateRulePreview');
      jest.spyOn(app, 'updateGenerateButton');

      app.handleRuleChange(mockEvent);

      expect(app.updateRulePreview).toHaveBeenCalledWith('');
      expect(app.updateGenerateButton).toHaveBeenCalled();
    });
  });

  describe('筛选功能 - generateFilteredWords', () => {
    beforeEach(() => {
      app.currentWords = ['hello', 'world', 'test', 'example', 'filter'];

      const testRule = {
        name: '长度为5',
        specificRule: 'L=5',
        displayRule: 'L=5',
        localSets: new Map()
      };
      app.ruleEngine.rules.set('长度为5', testRule);
    });

    test('应该正确筛选符合条件的单词', () => {
      jest.spyOn(app.ruleEngine, 'matchesRule').mockImplementation((word, rule) => {
        return word.length === 5;
      });

      app.generateFilteredWords('长度为5');

      expect(app.filteredWords).toEqual(['hello', 'world']);
    });

    test('应该处理无匹配结果的情况', () => {
      jest.spyOn(app.ruleEngine, 'matchesRule').mockReturnValue(false);
      jest.spyOn(app, 'showMessage');

      app.generateFilteredWords('长度为5');

      expect(app.filteredWords).toEqual([]);
      expect(app.showMessage).toHaveBeenCalledWith(
        expect.stringContaining('没有找到符合条件的单词'),
        'warning'
      );
    });

    test('应该处理无效的规则名', () => {
      jest.spyOn(app, 'showMessage');

      app.generateFilteredWords('不存在的规则');

      expect(app.showMessage).toHaveBeenCalledWith(
        expect.stringContaining('规则不存在'),
        'error'
      );
    });

    test('应该处理空单词列表', () => {
      app.currentWords = [];
      jest.spyOn(app, 'showMessage');

      app.generateFilteredWords('长度为5');

      expect(app.showMessage).toHaveBeenCalledWith(
        expect.stringContaining('请先选择单词库文件'),
        'warning'
      );
    });
  });

  describe('UI更新功能', () => {
    test('应该正确更新生成按钮状态', () => {
      const mockGenerateBtn = { disabled: true };
      mockContainer.getElementById.mockReturnValue(mockGenerateBtn);

      app.currentWords = ['hello', 'world'];
      app.selectedRule = '测试规则';

      app.updateGenerateButton();

      expect(mockGenerateBtn.disabled).toBe(false);
    });

    test('应该在条件不满足时禁用生成按钮', () => {
      const mockGenerateBtn = { disabled: false };
      mockContainer.getElementById.mockReturnValue(mockGenerateBtn);

      app.currentWords = [];
      app.selectedRule = '';

      app.updateGenerateButton();

      expect(mockGenerateBtn.disabled).toBe(true);
    });

    test('应该正确显示消息', () => {
      const mockMessageContainer = {
        innerHTML: '',
        style: { display: 'none' },
        className: ''
      };
      mockContainer.getElementById.mockReturnValue(mockMessageContainer);

      app.showMessage('测试消息', 'success');

      expect(mockMessageContainer.innerHTML).toContain('测试消息');
      expect(mockMessageContainer.style.display).toBe('block');
      expect(mockMessageContainer.className).toContain('success');
    });
  });

  describe('数据导出功能', () => {
    test('应该正确导出筛选结果', () => {
      app.filteredWords = ['hello', 'world', 'test'];
      app.selectedRule = '测试规则';
      app.currentWords = ['hello', 'world', 'test', 'example', 'filter'];

      jest.spyOn(app.fileUtils, 'exportToFile').mockImplementation(() => { });

      app.exportResults();

      expect(app.fileUtils.exportToFile).toHaveBeenCalledWith(
        app.filteredWords,
        expect.objectContaining({
          totalWords: 5,
          filteredWords: 3
        }),
        '测试规则'
      );
    });

    test('应该处理空结果导出', () => {
      app.filteredWords = [];
      jest.spyOn(app, 'showMessage');

      app.exportResults();

      expect(app.showMessage).toHaveBeenCalledWith(
        expect.stringContaining('没有可导出的结果'),
        'warning'
      );
    });
  });

  describe('规则同步功能', () => {
    test('应该检测规则变化并更新', () => {
      const newRulesData = JSON.stringify({ '新规则': { name: '新规则' } });
      localStorage.getItem.mockReturnValue(newRulesData);
      app.lastRulesData = JSON.stringify({ '旧规则': { name: '旧规则' } });

      jest.spyOn(app, 'loadSavedRules');
      jest.spyOn(app, 'updateRuleSelector');
      jest.spyOn(app, 'showMessage');

      app.checkAndUpdateRules();

      expect(app.loadSavedRules).toHaveBeenCalled();
      expect(app.updateRuleSelector).toHaveBeenCalled();
      expect(app.showMessage).toHaveBeenCalledWith('规则已更新', 'success');
    });

    test('应该在规则未变化时不执行更新', () => {
      const sameRulesData = JSON.stringify({ '规则': { name: '规则' } });
      localStorage.getItem.mockReturnValue(sameRulesData);
      app.lastRulesData = sameRulesData;

      jest.spyOn(app, 'loadSavedRules');
      jest.spyOn(app, 'updateRuleSelector');

      app.checkAndUpdateRules();

      expect(app.loadSavedRules).not.toHaveBeenCalled();
      expect(app.updateRuleSelector).not.toHaveBeenCalled();
    });
  });

  describe('错误处理', () => {
    test('应该处理规则引擎错误', () => {
      jest.spyOn(app.ruleEngine, 'matchesRule').mockImplementation(() => {
        throw new Error('规则执行错误');
      });
      jest.spyOn(app, 'showMessage');

      app.currentWords = ['hello'];
      const testRule = {
        name: '测试规则',
        specificRule: 'L=5',
        localSets: new Map()
      };
      app.ruleEngine.rules.set('测试规则', testRule);

      app.generateFilteredWords('测试规则');

      expect(app.showMessage).toHaveBeenCalledWith(
        expect.stringContaining('筛选过程中发生错误'),
        'error'
      );
    });

    test('应该处理DOM元素不存在的情况', () => {
      mockContainer.getElementById.mockReturnValue(null);

      expect(() => app.updateGenerateButton()).not.toThrow();
      expect(() => app.showMessage('测试', 'info')).not.toThrow();
    });
  });

  describe('性能测试', () => {
    test('应该能够处理大量单词的筛选', () => {
      // 创建10000个单词
      app.currentWords = Array(10000).fill().map((_, i) => `word${i}`);

      const testRule = {
        name: '性能测试规则',
        specificRule: 'L=5',
        localSets: new Map()
      };
      app.ruleEngine.rules.set('性能测试规则', testRule);

      jest.spyOn(app.ruleEngine, 'matchesRule').mockImplementation((word) => {
        return word.length === 5;
      });

      const start = Date.now();
      app.generateFilteredWords('性能测试规则');
      const end = Date.now();

      expect(end - start).toBeLessThan(2000); // 应该在2秒内完成
      expect(app.filteredWords.length).toBeGreaterThan(0);
    });
  });
});