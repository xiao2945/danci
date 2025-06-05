# 单词筛选工具 - 单元测试文档

## 概述

本项目采用 Jest 测试框架进行单元测试，覆盖了核心业务逻辑的主要功能模块。

## 测试结构

```
tests/
├── setup.js              # 测试环境配置
├── app.test.js           # WordFilterApp 主应用类测试
├── ruleEngine.test.js    # RuleEngine 规则引擎测试
├── fileUtils.test.js     # FileUtils 文件处理测试
├── fileStorage.test.js   # FileStorageManager 存储管理测试
└── README.md            # 测试文档
```

## 测试覆盖范围

### 1. RuleEngine 规则引擎测试
- ✅ 构造函数和初始化
- ✅ 规则解析 (parseRule)
- ✅ 集合定义验证 (validateSetDefinition)
- ✅ 规则条件验证 (validateRuleCondition)
- ✅ 单词匹配 (matchesRule)
- ✅ 全局集合管理
- ✅ 错误处理
- ✅ 性能测试

### 2. FileUtils 文件处理测试
- ✅ 文件格式检查
- ✅ 音标格式预处理
- ✅ 特殊字符清理
- ✅ 文本内容解析
- ✅ 文件读取功能
- ✅ 数据导出功能
- ✅ 错误处理
- ✅ 性能测试

### 3. FileStorageManager 存储管理测试
- ✅ 规则序列化和反序列化
- ✅ 文件格式兼容性（新旧格式）
- ✅ 全局集合处理
- ✅ 文件下载功能
- ✅ 数据验证
- ✅ 错误处理
- ✅ 性能测试

### 4. WordFilterApp 主应用测试
- ✅ 应用初始化
- ✅ 文件选择和处理
- ✅ 规则选择和变更
- ✅ 单词筛选功能
- ✅ UI状态更新
- ✅ 数据导出
- ✅ 规则同步
- ✅ 错误处理
- ✅ 性能测试

## 运行测试

### 安装依赖
```bash
npm install
```

### 运行所有测试
```bash
npm test
```

### 监视模式运行测试
```bash
npm run test:watch
```

### 生成覆盖率报告
```bash
npm run test:coverage
```

### CI环境运行测试
```bash
npm run test:ci
```

## 测试配置

### Jest 配置 (package.json)
```json
{
  "jest": {
    "testEnvironment": "jsdom",
    "setupFilesAfterEnv": ["<rootDir>/tests/setup.js"],
    "testMatch": ["<rootDir>/tests/**/*.test.js"],
    "collectCoverageFrom": [
      "js/**/*.js",
      "!js/version.js"
    ],
    "coverageDirectory": "coverage",
    "coverageReporters": ["text", "lcov", "html"]
  }
}
```

### 测试环境模拟
- **localStorage**: 模拟浏览器本地存储
- **File API**: 模拟文件读取和处理
- **DOM API**: 模拟浏览器DOM环境
- **Console**: 模拟控制台输出

## 测试策略

### 单元测试原则
1. **隔离性**: 每个测试独立运行，不依赖其他测试
2. **可重复性**: 测试结果稳定，多次运行结果一致
3. **快速性**: 单个测试执行时间控制在毫秒级
4. **可读性**: 测试用例命名清晰，描述准确

### 测试分类
- **正常路径测试**: 验证功能在正常输入下的行为
- **边界条件测试**: 验证极端输入情况的处理
- **错误处理测试**: 验证异常情况的处理机制
- **性能测试**: 验证大数据量下的性能表现

## 覆盖率目标

| 指标 | 目标 | 当前状态 |
|------|------|----------|
| 语句覆盖率 | 85%+ | 🎯 待测试 |
| 分支覆盖率 | 80%+ | 🎯 待测试 |
| 函数覆盖率 | 90%+ | 🎯 待测试 |
| 行覆盖率 | 85%+ | 🎯 待测试 |

## 测试数据

### 示例规则
```javascript
const testRules = {
  '长度为5': {
    name: '长度为5',
    specificRule: 'L=5',
    displayRule: 'L=5'
  },
  '辅音数量为3': {
    name: '辅音数量为3',
    specificRule: 'C=3',
    displayRule: 'C=3'
  }
};
```

### 示例单词数据
```javascript
const testWords = [
  'hello',    // 5个字母，3个辅音
  'world',    // 5个字母，4个辅音
  'test',     // 4个字母，3个辅音
  'example',  // 7个字母，4个辅音
  'filter'    // 6个字母，4个辅音
];
```

## 持续集成

### GitHub Actions 配置示例
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'
      - run: npm install
      - run: npm run test:ci
      - uses: codecov/codecov-action@v1
```

## 调试测试

### 运行单个测试文件
```bash
npx jest tests/ruleEngine.test.js
```

### 运行特定测试用例
```bash
npx jest -t "应该正确解析简单规则"
```

### 调试模式
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

## 最佳实践

### 测试命名规范
- 使用描述性的测试名称
- 遵循 "应该 + 期望行为" 的格式
- 使用中文描述以提高可读性

### Mock 使用原则
- 只模拟外部依赖
- 保持模拟的简单性
- 验证模拟函数的调用

### 断言策略
- 使用具体的断言而非通用断言
- 验证返回值和副作用
- 检查错误处理路径

## 问题排查

### 常见问题
1. **测试超时**: 检查异步操作是否正确处理
2. **模拟失效**: 确认模拟函数在正确的作用域内
3. **DOM错误**: 验证测试环境配置是否正确

### 调试技巧
- 使用 `console.log` 输出中间状态
- 利用 Jest 的 `--verbose` 选项查看详细信息
- 检查测试覆盖率报告定位未测试代码

## 贡献指南

### 添加新测试
1. 在对应的测试文件中添加测试用例
2. 确保测试覆盖新功能的主要路径
3. 运行测试确保通过
4. 更新文档说明

### 修改现有测试
1. 理解现有测试的目的
2. 保持测试的独立性
3. 更新相关文档
4. 验证所有测试仍然通过