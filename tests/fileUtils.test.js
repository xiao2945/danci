// FileUtils 单元测试
require('../js/fileUtils.js');

describe('FileUtils', () => {
  let fileUtils;

  beforeEach(() => {
    fileUtils = new FileUtils();
  });

  describe('构造函数和初始化', () => {
    test('应该正确初始化支持的文件格式', () => {
      expect(fileUtils.supportedFormats).toEqual(['xlsx', 'xls', 'txt']);
    });
  });

  describe('文件格式检查 - isSupportedFormat', () => {
    test('应该识别支持的文件格式', () => {
      const txtFile = new File(['content'], 'test.txt', { type: 'text/plain' });
      const xlsxFile = new File(['content'], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const xlsFile = new File(['content'], 'test.xls', { type: 'application/vnd.ms-excel' });

      expect(fileUtils.isSupportedFormat(txtFile)).toBe(true);
      expect(fileUtils.isSupportedFormat(xlsxFile)).toBe(true);
      expect(fileUtils.isSupportedFormat(xlsFile)).toBe(true);
    });

    test('应该拒绝不支持的文件格式', () => {
      const pdfFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      const docFile = new File(['content'], 'test.doc', { type: 'application/msword' });
      const jpgFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      expect(fileUtils.isSupportedFormat(pdfFile)).toBe(false);
      expect(fileUtils.isSupportedFormat(docFile)).toBe(false);
      expect(fileUtils.isSupportedFormat(jpgFile)).toBe(false);
    });

    test('应该处理大小写不敏感的文件扩展名', () => {
      const txtFileUpper = new File(['content'], 'test.TXT', { type: 'text/plain' });
      const xlsxFileMixed = new File(['content'], 'test.XlSx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      expect(fileUtils.isSupportedFormat(txtFileUpper)).toBe(true);
      expect(fileUtils.isSupportedFormat(xlsxFileMixed)).toBe(true);
    });
  });

  describe('音标格式预处理 - preprocessPhonetics', () => {
    test('应该正确分割单词和音标', () => {
      const input = 'hello[həˈloʊ]';
      const expected = 'hello [həˈloʊ]';
      expect(fileUtils.preprocessPhonetics(input)).toBe(expected);
    });

    test('应该处理多个单词音标组合', () => {
      const input = 'hello[həˈloʊ] world[wɜːrld]';
      const expected = 'hello [həˈloʊ] world [wɜːrld]';
      expect(fileUtils.preprocessPhonetics(input)).toBe(expected);
    });

    test('应该处理包含特殊字符的单词', () => {
      const input = "don't[doʊnt] it's[ɪts]";
      const expected = "don't [doʊnt] it's [ɪts]";
      expect(fileUtils.preprocessPhonetics(input)).toBe(expected);
    });

    test('应该保持已经正确格式的文本不变', () => {
      const input = 'hello [həˈloʊ] world [wɜːrld]';
      expect(fileUtils.preprocessPhonetics(input)).toBe(input);
    });
  });

  describe('特殊字符清理 - cleanSpecialChars', () => {
    test('应该移除常见的特殊字符', () => {
      expect(fileUtils.cleanSpecialChars('hello!')).toBe('hello');
      expect(fileUtils.cleanSpecialChars('world?')).toBe('world');
      expect(fileUtils.cleanSpecialChars('test,')).toBe('test');
      expect(fileUtils.cleanSpecialChars('example.')).toBe('example');
    });

    test('应该保留字母、数字和基本符号', () => {
      expect(fileUtils.cleanSpecialChars("don't")).toBe("don't");
      expect(fileUtils.cleanSpecialChars('co-operate')).toBe('co-operate');
      expect(fileUtils.cleanSpecialChars('test123')).toBe('test123');
    });

    test('应该处理空字符串和null', () => {
      expect(fileUtils.cleanSpecialChars('')).toBe('');
      expect(fileUtils.cleanSpecialChars(null)).toBe('');
      expect(fileUtils.cleanSpecialChars(undefined)).toBe('');
    });
  });

  describe('文本内容解析 - parseTextContent', () => {
    test('应该正确解析简单的单词列表', () => {
      const content = 'hello\nworld\ntest';
      const result = fileUtils.parseTextContent(content);

      expect(result.words).toEqual(['hello', 'world', 'test']);
      expect(result.totalWords).toBe(3);
      expect(result.validWords).toBe(3);
      expect(result.duplicates).toBe(0);
    });

    test('应该移除重复单词', () => {
      const content = 'hello\nworld\nhello\ntest';
      const result = fileUtils.parseTextContent(content);

      expect(result.words).toEqual(['hello', 'world', 'test']);
      expect(result.totalWords).toBe(4);
      expect(result.validWords).toBe(3);
      expect(result.duplicates).toBe(1);
    });

    test('应该过滤空行和无效内容', () => {
      const content = 'hello\n\nworld\n   \ntest\n';
      const result = fileUtils.parseTextContent(content);

      expect(result.words).toEqual(['hello', 'world', 'test']);
      expect(result.validWords).toBe(3);
    });

    test('应该处理包含音标的内容', () => {
      const content = 'hello [həˈloʊ]\nworld [wɜːrld]';
      const result = fileUtils.parseTextContent(content);

      expect(result.words).toContain('hello');
      expect(result.words).toContain('world');
      expect(result.words.some(word => word.includes('['))).toBe(true);
    });

    test('应该处理空内容', () => {
      const result = fileUtils.parseTextContent('');

      expect(result.words).toEqual([]);
      expect(result.totalWords).toBe(0);
      expect(result.validWords).toBe(0);
      expect(result.duplicates).toBe(0);
    });
  });

  describe('文本文件读取 - readTextFile', () => {
    test('应该成功读取文本文件', async () => {
      const content = 'hello\nworld\ntest';
      const file = new File([content], 'test.txt', { type: 'text/plain' });

      const result = await fileUtils.readTextFile(file);

      expect(result.words).toEqual(['hello', 'world', 'test']);
      expect(result.totalWords).toBe(3);
    });

    test('应该处理UTF-8编码的文件', async () => {
      const content = 'hello\n你好\nworld';
      const file = new File([content], 'test.txt', { type: 'text/plain' });

      const result = await fileUtils.readTextFile(file);

      expect(result.words).toContain('hello');
      expect(result.words).toContain('你好');
      expect(result.words).toContain('world');
    });
  });

  describe('数据导出 - exportToFile', () => {
    test('应该正确格式化导出数据', () => {
      const words = ['hello', 'world', 'test'];
      const stats = {
        totalWords: 100,
        filteredWords: 3,
        filterRate: '3.00%'
      };
      const ruleName = '测试规则';

      const result = fileUtils.formatExportData(words, stats, ruleName);

      expect(result).toContain('筛选规则: 测试规则');
      expect(result).toContain('原始单词数: 100');
      expect(result).toContain('筛选结果数: 3');
      expect(result).toContain('筛选率: 3.00%');
      expect(result).toContain('hello');
      expect(result).toContain('world');
      expect(result).toContain('test');
    });

    test('应该处理空结果', () => {
      const words = [];
      const stats = {
        totalWords: 100,
        filteredWords: 0,
        filterRate: '0.00%'
      };
      const ruleName = '测试规则';

      const result = fileUtils.formatExportData(words, stats, ruleName);

      expect(result).toContain('筛选结果数: 0');
      expect(result).toContain('无符合条件的单词');
    });
  });

  describe('错误处理', () => {
    test('应该处理文件读取错误', async () => {
      // 模拟文件读取失败
      const originalFileReader = global.FileReader;
      global.FileReader = class MockFileReader {
        readAsText() {
          setTimeout(() => {
            if (this.onerror) this.onerror(new Error('读取失败'));
          }, 0);
        }
      };

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      await expect(fileUtils.readTextFile(file)).rejects.toThrow();

      // 恢复原始FileReader
      global.FileReader = originalFileReader;
    });

    test('应该处理无效的文件对象', () => {
      expect(() => fileUtils.isSupportedFormat(null)).not.toThrow();
      expect(() => fileUtils.isSupportedFormat(undefined)).not.toThrow();
      expect(fileUtils.isSupportedFormat(null)).toBe(false);
    });

    test('应该处理解析错误', () => {
      expect(() => fileUtils.parseTextContent(null)).not.toThrow();
      expect(() => fileUtils.parseTextContent(undefined)).not.toThrow();
    });
  });

  describe('性能测试', () => {
    test('应该能够处理大量单词', () => {
      const largeContent = Array(10000).fill().map((_, i) => `word${i}`).join('\n');
      const start = Date.now();
      const result = fileUtils.parseTextContent(largeContent);
      const end = Date.now();

      expect(result.words.length).toBe(10000);
      expect(end - start).toBeLessThan(1000); // 应该在1秒内完成
    });
  });
});