// RuleEngine 单元测试
// 需要先加载被测试的类
require('../js/ruleEngine.js');

describe('RuleEngine', () => {
  let ruleEngine;

  beforeEach(() => {
    ruleEngine = new RuleEngine();
  });

  describe('构造函数和初始化', () => {
    test('应该正确初始化默认字符集', () => {
      expect(ruleEngine.getGlobalSets().has('C')).toBe(true);
      expect(ruleEngine.getGlobalSets().has('V')).toBe(true);
      expect(ruleEngine.getGlobalSets().has('L')).toBe(true);
    });

    test('默认字符集应该包含正确的字符', () => {
      const consonants = ruleEngine.getGlobalSets().get('C');
      const vowels = ruleEngine.getGlobalSets().get('V');
      const letters = ruleEngine.getGlobalSets().get('L');

      expect(consonants.has('b')).toBe(true);
      expect(consonants.has('a')).toBe(false); // 'a' 是元音
      expect(vowels.has('a')).toBe(true);
      expect(vowels.has('b')).toBe(false); // 'b' 是辅音
      expect(letters.size).toBe(26); // 26个字母
    });
  });

  describe('规则解析 - parseRule', () => {
    test('应该正确解析简单规则', () => {
      const ruleText = '#测试规则\nL=5';
      const result = ruleEngine.parseRule(ruleText);

      expect(result.success).toBe(true);
      expect(result.ruleName).toBe('测试规则');
      expect(result.specificRule).toBe('L=5');
    });

    test('应该正确解析带注释的规则', () => {
      const ruleText = '#测试规则\n// 这是一个测试注释\nL=5';
      const result = ruleEngine.parseRule(ruleText);

      expect(result.success).toBe(true);
      expect(result.ruleName).toBe('测试规则');
      expect(result.ruleComment).toBe('这是一个测试注释');
      expect(result.specificRule).toBe('L=5');
    });

    test('应该正确解析包含本地集合定义的规则', () => {
      const ruleText = '#测试规则\nX={a,b,c}\nX=3';
      const result = ruleEngine.parseRule(ruleText);

      expect(result.success).toBe(true);
      expect(result.localSets.has('X')).toBe(true);
      expect(result.localSets.get('X').has('a')).toBe(true);
      expect(result.specificRule).toBe('X=3');
    });

    test('应该拒绝无效的规则格式', () => {
      const ruleText = '无效规则';
      const result = ruleEngine.parseRule(ruleText);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('应该拒绝空规则名', () => {
      const ruleText = '#\nL=5';
      const result = ruleEngine.parseRule(ruleText);

      expect(result.success).toBe(false);
      expect(result.errors.some(error => error.includes('规则名称不能为空'))).toBe(true);
    });
  });

  describe('集合定义验证 - validateSetDefinition', () => {
    test('应该验证正确的集合定义', () => {
      expect(ruleEngine.validateSetDefinition('X={a,b,c}')).toBe(true);
      expect(ruleEngine.validateSetDefinition('Y={1,2,3}')).toBe(true);
      expect(ruleEngine.validateSetDefinition('Z={hello,world}')).toBe(true);
    });

    test('应该拒绝无效的集合定义', () => {
      expect(ruleEngine.validateSetDefinition('X=a,b,c')).toBe(false); // 缺少大括号
      expect(ruleEngine.validateSetDefinition('X={}')).toBe(false); // 空集合
      expect(ruleEngine.validateSetDefinition('={a,b,c}')).toBe(false); // 缺少集合名
    });
  });

  describe('规则条件验证 - validateRuleCondition', () => {
    test('应该验证长度条件', () => {
      expect(ruleEngine.validateRuleCondition('L=5')).toBe(true);
      expect(ruleEngine.validateRuleCondition('L>3')).toBe(true);
      expect(ruleEngine.validateRuleCondition('L<10')).toBe(true);
      expect(ruleEngine.validateRuleCondition('L>=5')).toBe(true);
      expect(ruleEngine.validateRuleCondition('L<=8')).toBe(true);
    });

    test('应该验证字符集条件', () => {
      expect(ruleEngine.validateRuleCondition('C=3')).toBe(true);
      expect(ruleEngine.validateRuleCondition('V>1')).toBe(true);
    });

    test('应该验证位置条件', () => {
      expect(ruleEngine.validateRuleCondition('P1=a')).toBe(true);
      expect(ruleEngine.validateRuleCondition('P-1=z')).toBe(true);
      expect(ruleEngine.validateRuleCondition('P2∈C')).toBe(true);
    });

    test('应该拒绝无效的条件格式', () => {
      expect(ruleEngine.validateRuleCondition('L==')).toBe(false); // 缺少值
      expect(ruleEngine.validateRuleCondition('=5')).toBe(false); // 缺少变量
      expect(ruleEngine.validateRuleCondition('L=abc')).toBe(false); // 长度值应该是数字
    });
  });

  describe('单词匹配 - matchesRule', () => {
    test('应该正确匹配长度条件', () => {
      const rule = {
        name: '长度为5',
        specificRule: 'L=5',
        localSets: new Map()
      };

      expect(ruleEngine.matchesRule('hello', rule)).toBe(true);
      expect(ruleEngine.matchesRule('hi', rule)).toBe(false);
      expect(ruleEngine.matchesRule('wonderful', rule)).toBe(false);
    });

    test('应该正确匹配字符集条件', () => {
      const rule = {
        name: '辅音数量为3',
        specificRule: 'C=3',
        localSets: new Map()
      };

      expect(ruleEngine.matchesRule('hello', rule)).toBe(true); // h,l,l = 3个辅音
      expect(ruleEngine.matchesRule('apple', rule)).toBe(false); // p,p,l = 3个辅音，但有重复
    });

    test('应该正确匹配位置条件', () => {
      const rule = {
        name: '首字母为h',
        specificRule: 'P1=h',
        localSets: new Map()
      };

      expect(ruleEngine.matchesRule('hello', rule)).toBe(true);
      expect(ruleEngine.matchesRule('world', rule)).toBe(false);
    });

    test('应该正确匹配复合条件', () => {
      const rule = {
        name: '长度为5且首字母为h',
        specificRule: 'L=5 AND P1=h',
        localSets: new Map()
      };

      expect(ruleEngine.matchesRule('hello', rule)).toBe(true);
      expect(ruleEngine.matchesRule('hi', rule)).toBe(false); // 长度不符
      expect(ruleEngine.matchesRule('world', rule)).toBe(false); // 首字母不符
    });
  });

  describe('全局集合管理', () => {
    test('应该能够更新全局集合', () => {
      const newSets = new Map();
      newSets.set('CUSTOM', new Set(['x', 'y', 'z']));

      ruleEngine.updateGlobalSets(newSets);

      expect(ruleEngine.getGlobalSets().has('CUSTOM')).toBe(true);
      expect(ruleEngine.getGlobalSets().get('CUSTOM').has('x')).toBe(true);
    });

    test('更新全局集合后应该保留默认集合', () => {
      const newSets = new Map();
      newSets.set('CUSTOM', new Set(['x', 'y', 'z']));

      ruleEngine.updateGlobalSets(newSets);

      expect(ruleEngine.getGlobalSets().has('C')).toBe(true);
      expect(ruleEngine.getGlobalSets().has('V')).toBe(true);
      expect(ruleEngine.getGlobalSets().has('L')).toBe(true);
    });
  });

  describe('内置集合名称', () => {
    test('应该返回正确的内置集合名称', () => {
      const builtinNames = ruleEngine.getBuiltinSetNames();
      expect(builtinNames).toEqual(['C', 'V', 'L']);
    });
  });

  describe('错误处理', () => {
    test('应该处理无效的单词输入', () => {
      const rule = {
        name: '测试规则',
        specificRule: 'L=5',
        localSets: new Map()
      };

      expect(() => ruleEngine.matchesRule(null, rule)).not.toThrow();
      expect(() => ruleEngine.matchesRule(undefined, rule)).not.toThrow();
      expect(() => ruleEngine.matchesRule('', rule)).not.toThrow();
    });

    test('应该处理无效的规则输入', () => {
      expect(() => ruleEngine.matchesRule('hello', null)).not.toThrow();
      expect(() => ruleEngine.matchesRule('hello', undefined)).not.toThrow();
    });
  });
});